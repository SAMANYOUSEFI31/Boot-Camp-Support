/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

(function (root) {
  'use strict';

  var SupportApp = root.SupportApp || (root.SupportApp = {});
  var Names = SupportApp.Names || {};

  var STORAGE_KEY = 'bsh_support_app_state_v1';
  var TAB_CHANNEL_NAME = 'bsh_support_tab_sync';
  var currentTabId = 'tab_' + Math.random().toString(36).slice(2, 9);

  /**
   * ساخت ۳۰ روز پیش‌فرض دوره
   */
  function createDefaultDays(warmupCount, mainCount, reviewCount) {
    var w = warmupCount != null ? warmupCount : 7;
    var m = mainCount != null ? mainCount : 21;
    var r = reviewCount != null ? reviewCount : 2;
    var total = 30;

    var days = [];
    for (var i = 1; i <= total; i++) {
      var type = 'main';
      var hard = 3;
      var special = true;

      if (i <= w) {
        type = 'warmup';
        hard = 0;
        special = false;
      } else if (i > w + m) {
        type = 'review';
        hard = 0;
        special = false;
      }

      days.push({
        n: i,
        type: type,
        hardLevels: hard,
        specialMission: special
      });
    }
    return days;
  }

  /**
   * مدل خالی و اولیه
   */
  function createInitialState() {
    return {
      schemaVersion: 1,
      activeCohortId: null,
      lastBackupAt: null,
      lastChangeAt: new Date().toISOString(),
      cohorts: []
    };
  }

  /**
   * تابع مهاجرت داده‌های قدیمی به نسخه‌های جدید
   */
  function migrate(data) {
    if (!data || typeof data !== 'object') {
      return createInitialState();
    }
    var version = data.schemaVersion || 1;
    if (version === 1) {
      if (!Array.isArray(data.cohorts)) data.cohorts = [];
      data.cohorts.forEach(function (c) {
        if (!c.days || !c.days.length) c.days = createDefaultDays();
        if (!Array.isArray(c.groups)) c.groups = [];
        if (!Array.isArray(c.participants)) c.participants = [];
        if (!c.records || typeof c.records !== 'object') c.records = {};
        if (c.archived === undefined) c.archived = false;
        c.groups.forEach(function (g) {
          if (!Array.isArray(g.closedDays)) g.closedDays = [];
          if (g.mine === undefined) g.mine = true;
        });
      });
      return data;
    }
    return data;
  }

  // تلاش برای پایدارسازی حافظه در مرورگر
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      navigator.storage.persist().catch(function () {});
    } catch (e) {}
  }

  var state = createInitialState();
  var listeners = [];
  var saveTimer = null;
  var hasQuotaError = false;
  var multiTabConflict = false;

  // کانال همگام‌سازی بین تب‌ها
  var broadcastChannel = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannel = new BroadcastChannel(TAB_CHANNEL_NAME);
      broadcastChannel.onmessage = function (ev) {
        if (ev.data && ev.data.tabId !== currentTabId) {
          multiTabConflict = true;
          notifyListeners({ type: 'multi_tab_warning' });
        }
      };
    }
  } catch (e) {}

  // لود اولیه از localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        state = migrate(parsed);
      }
    }
  } catch (e) {
    console.warn('Storage read error:', e);
  }

  function notifyListeners(event) {
    listeners.forEach(function (fn) {
      try {
        fn(state, event);
      } catch (e) {
        console.error('Store listener error:', e);
      }
    });
  }

  /**
   * نوشتن در حافظه محلی
   */
  function persistToStorage() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        hasQuotaError = false;
        if (broadcastChannel) {
          broadcastChannel.postMessage({ tabId: currentTabId, timestamp: Date.now() });
        }
      }
    } catch (e) {
      console.error('Storage write error:', e);
      hasQuotaError = true;
      notifyListeners({ type: 'quota_error', error: e });
    }
  }

  function scheduleSave() {
    state.lastChangeAt = new Date().toISOString();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      persistToStorage();
    }, 250);
  }

  function saveImmediately() {
    clearTimeout(saveTimer);
    state.lastChangeAt = new Date().toISOString();
    persistToStorage();
    notifyListeners({ type: 'saved' });
  }

  function getState() {
    return state;
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (l) { return l !== fn; });
    };
  }

  function getActiveCohort() {
    if (!state.cohorts.length) return null;
    if (!state.activeCohortId) {
      var nonArchived = state.cohorts.filter(function (c) { return !c.archived; });
      return nonArchived[0] || state.cohorts[0] || null;
    }
    for (var i = 0; i < state.cohorts.length; i++) {
      if (state.cohorts[i].id === state.activeCohortId) {
        return state.cohorts[i];
      }
    }
    return state.cohorts[0] || null;
  }

  function setActiveCohortId(cohortId) {
    state.activeCohortId = cohortId;
    saveImmediately();
    notifyListeners({ type: 'active_cohort_changed' });
  }

  /**
   * ساخت دوره جدید
   */
  function createCohort(params) {
    var name = (params && params.name) || 'دوره جدید';
    var startDate = (params && params.startDate) || new Date().toISOString().slice(0, 10);
    var warmup = params && params.warmupDays != null ? params.warmupDays : 7;
    var main = params && params.mainDays != null ? params.mainDays : 21;
    var review = params && params.reviewDays != null ? params.reviewDays : 2;

    var newId = 'cohort_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    var days = createDefaultDays(warmup, main, review);

    var groups = [];
    var participants = [];

    // اگر کپی از دوره قبلی خواسته شده باشد
    if (params && params.copyFromCohortId) {
      var srcCohort = state.cohorts.find(function (c) { return c.id === params.copyFromCohortId; });
      if (srcCohort) {
        var groupMap = {};
        srcCohort.groups.forEach(function (g, idx) {
          var newGId = 'grp_' + Date.now() + '_' + idx;
          groupMap[g.id] = newGId;
          groups.push({
            id: newGId,
            name: g.name,
            order: g.order || idx + 1,
            mine: g.mine !== false,
            closedDays: []
          });
        });

        srcCohort.participants.forEach(function (p, idx) {
          participants.push({
            id: 'p_' + Date.now() + '_' + idx,
            name: p.name,
            nameKey: p.nameKey || (Names.normalizeName && Names.normalizeName(p.name)) || p.name,
            telegram: p.telegram || '',
            groupId: groupMap[p.groupId] || (groups[0] && groups[0].id) || '',
            status: p.status || 'active',
            habitCount: p.habitCount
          });
        });
      }
    }

    var newCohort = {
      id: newId,
      name: name,
      startDate: startDate,
      archived: false,
      days: days,
      groups: groups,
      participants: participants,
      records: {}
    };

    state.cohorts.push(newCohort);
    state.activeCohortId = newId;
    saveImmediately();
    notifyListeners({ type: 'cohort_created', cohort: newCohort });
    return newCohort;
  }

  function updateCohort(cohortId, updates) {
    var c = state.cohorts.find(function (item) { return item.id === cohortId; });
    if (!c) return;
    Object.assign(c, updates);
    saveImmediately();
    notifyListeners({ type: 'cohort_updated', cohort: c });
  }

  function archiveCohort(cohortId, archived) {
    var c = state.cohorts.find(function (item) { return item.id === cohortId; });
    if (!c) return;
    c.archived = archived !== false;
    saveImmediately();
    notifyListeners({ type: 'cohort_archived', cohort: c });
  }

  function deleteCohort(cohortId) {
    state.cohorts = state.cohorts.filter(function (c) { return c.id !== cohortId; });
    if (state.activeCohortId === cohortId) {
      state.activeCohortId = state.cohorts[0] ? state.cohorts[0].id : null;
    }
    saveImmediately();
    notifyListeners({ type: 'cohort_deleted' });
  }

  /**
   * افزودن گروه به دوره
   */
  function addGroup(cohortId, groupData) {
    var c = state.cohorts.find(function (item) { return item.id === cohortId; });
    if (!c) return null;
    var maxOrder = c.groups.reduce(function (max, g) { return Math.max(max, g.order || 0); }, 0);
    var newGroup = {
      id: 'grp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: groupData.name || ('گروه ' + (maxOrder + 1)),
      order: groupData.order || maxOrder + 1,
      mine: groupData.mine !== false,
      closedDays: []
    };
    c.groups.push(newGroup);
    saveImmediately();
    notifyListeners({ type: 'group_added', group: newGroup });
    return newGroup;
  }

  function updateGroup(cohortId, groupId, updates) {
    var c = state.cohorts.find(function (item) { return item.id === cohortId; });
    if (!c) return;
    var g = c.groups.find(function (item) { return item.id === groupId; });
    if (!g) return;
    Object.assign(g, updates);
    saveImmediately();
    notifyListeners({ type: 'group_updated', group: g });
  }

  function deleteGroup(cohortId, groupId) {
    var c = state.cohorts.find(function (item) { return item.id === cohortId; });
    if (!c) return;
    c.groups = c.groups.filter(function (g) { return g.id !== groupId; });
    // حذف افراد آن گروه
    c.participants = c.participants.filter(function (p) { return p.groupId !== groupId; });
    saveImmediately();
    notifyListeners({ type: 'group_deleted' });
  }

  /**
   * افزودن افراد
   */
  function addParticipants(cohortId, groupId, pList) {
    var c = state.cohorts.find(function (item) { return item.id === cohortId; });
    if (!c) return [];
    var added = [];
    pList.forEach(function (p) {
      var name = (p.name || '').trim();
      if (!name) return;
      var nameKey = Names.normalizeName ? Names.normalizeName(name) : name.trim();
      var newP = {
        id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        name: name,
        nameKey: nameKey,
        telegram: (p.telegram || '').trim().replace(/^@/, ''),
        groupId: groupId || p.groupId,
        status: p.status || 'active',
        habitCount: p.habitCount != null ? parseInt(p.habitCount, 10) : null
      };
      c.participants.push(newP);
      added.push(newP);
    });
    saveImmediately();
    notifyListeners({ type: 'participants_added', count: added.length });
    return added;
  }

  function updateParticipant(cohortId, participantId, updates) {
    var c = state.cohorts.find(function (item) { return item.id === cohortId; });
    if (!c) return;
    var p = c.participants.find(function (item) { return item.id === participantId; });
    if (!p) return;
    if (updates.name && updates.name !== p.name) {
      updates.nameKey = Names.normalizeName ? Names.normalizeName(updates.name) : updates.name;
    }
    if (updates.telegram !== undefined) {
      updates.telegram = (updates.telegram || '').replace(/^@/, '').trim();
    }
    Object.assign(p, updates);
    saveImmediately();
    notifyListeners({ type: 'participant_updated', participant: p });
  }

  function deleteParticipant(cohortId, participantId) {
    var c = state.cohorts.find(function (item) { return item.id === cohortId; });
    if (!c) return;
    c.participants = c.participants.filter(function (p) { return p.id !== participantId; });
    if (c.records && c.records[participantId]) {
      delete c.records[participantId];
    }
    saveImmediately();
    notifyListeners({ type: 'participant_deleted' });
  }

  /**
   * ثبت روزانه نتیجه یک فرد
   */
  function recordDaily(cohortId, participantId, dayN, recordData) {
    var c = state.cohorts.find(function (item) { return item.id === cohortId; });
    if (!c) return;
    if (!c.records) c.records = {};
    if (!c.records[participantId]) c.records[participantId] = {};

    var existing = c.records[participantId][dayN] || { done: null, hard: null, special: null };
    var updated = Object.assign({}, existing, recordData);

    c.records[participantId][dayN] = updated;
    scheduleSave();
    notifyListeners({ type: 'record_updated', participantId: participantId, dayN: dayN });
  }

  /**
   * ابزارهای گروهی ثبت روزانه
   */
  function batchRecordDay(cohortId, groupId, dayN, action) {
    var c = state.cohorts.find(function (item) { return item.id === cohortId; });
    if (!c) return null;
    var groupMembers = c.participants.filter(function (p) {
      return p.groupId === groupId && p.status === 'active';
    });

    if (!c.records) c.records = {};

    // ذخیره کپی قبل از تغییر برای undo
    var previousRecords = {};
    groupMembers.forEach(function (p) {
      if (c.records[p.id] && c.records[p.id][dayN]) {
        previousRecords[p.id] = Object.assign({}, c.records[p.id][dayN]);
      } else {
        previousRecords[p.id] = null;
      }
    });

    groupMembers.forEach(function (p) {
      if (!c.records[p.id]) c.records[p.id] = {};
      var cur = c.records[p.id][dayN] || { done: null, hard: null, special: null };

      if (action === 'all_habits_done') {
        cur.done = p.habitCount != null ? p.habitCount : 3;
      } else if (action === 'all_special_done') {
        cur.special = 1;
      } else if (action === 'clear_day') {
        cur.done = null;
        cur.hard = null;
        cur.special = null;
      }
      c.records[p.id][dayN] = cur;
    });

    saveImmediately();
    notifyListeners({ type: 'batch_record_applied', action: action });

    // بازگردانی (Undo)
    return function rollback() {
      groupMembers.forEach(function (p) {
        if (!c.records[p.id]) c.records[p.id] = {};
        if (previousRecords[p.id] === null) {
          delete c.records[p.id][dayN];
        } else {
          c.records[p.id][dayN] = previousRecords[p.id];
        }
      });
      saveImmediately();
      notifyListeners({ type: 'batch_record_rolled_back' });
    };
  }

  /**
   * بستن یا باز کردن مجدد یک روز برای گروه
   */
  function toggleCloseDay(cohortId, groupId, dayN, shouldClose) {
    var c = state.cohorts.find(function (item) { return item.id === cohortId; });
    if (!c) return;
    var g = c.groups.find(function (item) { return item.id === groupId; });
    if (!g) return;
    if (!Array.isArray(g.closedDays)) g.closedDays = [];

    var idx = g.closedDays.indexOf(dayN);
    if (shouldClose && idx === -1) {
      g.closedDays.push(dayN);
      g.closedDays.sort(function (a, b) { return a - b; });
    } else if (!shouldClose && idx !== -1) {
      g.closedDays.splice(idx, 1);
    }
    saveImmediately();
    notifyListeners({ type: 'day_closed_toggled', dayN: dayN, closed: shouldClose });
  }

  /**
   * بروزرسانی تنظیمات روزهای دوره (تعداد سطوح کار سخت، ماموریت، نوع روز)
   */
  function updateDaysConfig(cohortId, updatedDays) {
    var c = state.cohorts.find(function (item) { return item.id === cohortId; });
    if (!c) return;
    c.days = updatedDays;
    saveImmediately();
    notifyListeners({ type: 'days_config_updated' });
  }

  /**
   * علامت‌گذاری تاریخ آخرین بکاپ
   */
  function recordBackupTime() {
    state.lastBackupAt = new Date().toISOString();
    saveImmediately();
    notifyListeners({ type: 'backup_recorded' });
  }

  /**
   * آیا نیاز به یادآوری بکاپ وجود دارد؟
   * شرط: داده تغییر کرده باشد و بیش از ۲ روز از آخرین بکاپ گذشته باشد، یا هرگز بکاپ گرفته نشده و داده وجود دارد.
   */
  function isBackupOverdue() {
    if (!state.cohorts || !state.cohorts.length) return false;
    var totalParticipants = 0;
    state.cohorts.forEach(function (c) {
      totalParticipants += (c.participants || []).length;
    });
    if (totalParticipants === 0) return false;

    if (!state.lastBackupAt) {
      return true;
    }

    var lastBackupTime = new Date(state.lastBackupAt).getTime();
    var lastChangeTime = new Date(state.lastChangeAt || 0).getTime();

    // اگر از زمان آخرین بکاپ تغییری داده نشده باشد، هشدار نده
    if (lastChangeTime <= lastBackupTime) {
      return false;
    }

    // اگر تغییر داده شده و بیش از ۲ روز گذشته است
    var twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    var now = Date.now();
    return (now - lastBackupTime) > twoDaysMs;
  }

  /**
   * پاک کردن کامل همه داده‌ها
   */
  function clearAllData() {
    state = createInitialState();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    saveImmediately();
    notifyListeners({ type: 'all_data_cleared' });
  }

  /**
   * جایگزینی کامل داده‌ها از بکاپ
   */
  function restoreState(backupData) {
    if (!backupData || typeof backupData !== 'object') {
      throw new Error('فایل بکاپ نامعتبر است.');
    }
    var migrated = migrate(backupData);
    migrated.lastBackupAt = new Date().toISOString();
    state = migrated;
    saveImmediately();
    notifyListeners({ type: 'state_restored' });
  }

  SupportApp.Store = {
    getState: getState,
    subscribe: subscribe,
    saveImmediately: saveImmediately,
    getActiveCohort: getActiveCohort,
    setActiveCohortId: setActiveCohortId,
    createCohort: createCohort,
    updateCohort: updateCohort,
    archiveCohort: archiveCohort,
    deleteCohort: deleteCohort,
    addGroup: addGroup,
    updateGroup: updateGroup,
    deleteGroup: deleteGroup,
    addParticipants: addParticipants,
    updateParticipant: updateParticipant,
    deleteParticipant: deleteParticipant,
    recordDaily: recordDaily,
    batchRecordDay: batchRecordDay,
    toggleCloseDay: toggleCloseDay,
    updateDaysConfig: updateDaysConfig,
    recordBackupTime: recordBackupTime,
    isBackupOverdue: isBackupOverdue,
    clearAllData: clearAllData,
    restoreState: restoreState,
    getMultiTabWarning: function () { return multiTabConflict; },
    clearMultiTabWarning: function () { multiTabConflict = false; },
    getQuotaError: function () { return hasQuotaError; }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupportApp.Store;
  }
})(typeof window !== 'undefined' ? window : globalThis);
