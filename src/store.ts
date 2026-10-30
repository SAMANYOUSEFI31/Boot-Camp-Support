/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Names } from './names';
import type {
  AppState,
  Cohort,
  DayConfig,
  DayRecord,
  DayType,
  Group,
  MergeOptions,
  MergeReport,
  Participant,
  ValidateResult
} from './types';

const SCHEMA_VERSION = 1;
const STORAGE_KEY = 'bsh_support_app_state_v1';
const TAB_CHANNEL_NAME = 'bsh_support_tab_sync';
const currentTabId = 'tab_' + Math.random().toString(36).slice(2, 9);

/**
 * ساخت ۳۰ روز پیش‌فرض دوره
 */
function createDefaultDays(
  warmupCount?: number | null,
  mainCount?: number | null,
  reviewCount?: number | null
): DayConfig[] {
  const w = warmupCount != null ? warmupCount : 7;
  const m = mainCount != null ? mainCount : 21;
  const r = reviewCount != null ? reviewCount : 2;
  const total = 30;

  const days: DayConfig[] = [];
  for (let i = 1; i <= total; i++) {
    let type: DayType = 'main';
    let hard = 3;
    let special = true;

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
function createInitialState(): AppState {
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
// شکل «شاید ناقص» داده‌ای که از حافظه یا فایل می‌آید و هنوز مهاجرت نشده
interface LooseCohort {
  days?: DayConfig[];
  groups?: Partial<Group>[];
  participants?: Participant[];
  records?: Cohort['records'];
  archived?: boolean;
}
interface LooseState {
  schemaVersion?: number;
  cohorts?: LooseCohort[];
}

function migrate(input: unknown): AppState {
  if (!input || typeof input !== 'object') {
    return createInitialState();
  }
  const data = input as LooseState;
  const version = data.schemaVersion || 1;
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
    return data as AppState;
  }
  return data as AppState;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * اعتبارسنجی فایل بکاپ. هیچ تغییری روی ورودی نمی‌دهد.
 * خروجی: { ok: true, data } (کپی عمیق و مهاجرت‌شده) یا { ok: false, error } با پیام فارسی ساده
 */
function validateBackup(raw: unknown): ValidateResult {
  if (!isPlainObject(raw)) {
    return { ok: false, error: 'این فایل، فایل بکاپ برنامه نیست.' };
  }
  if (
    raw.schemaVersion !== undefined &&
    (typeof raw.schemaVersion !== 'number' || raw.schemaVersion < 1 || raw.schemaVersion > SCHEMA_VERSION)
  ) {
    return { ok: false, error: 'نسخهٔ این فایل با برنامه سازگار نیست. شاید با نسخهٔ جدیدتری ساخته شده است.' };
  }
  if (!Array.isArray(raw.cohorts)) {
    return { ok: false, error: 'در این فایل فهرست دوره‌ها پیدا نشد.' };
  }
  for (let i = 0; i < raw.cohorts.length; i++) {
    const c: unknown = raw.cohorts[i];
    let label = 'دورهٔ شمارهٔ ' + (i + 1);
    if (!isPlainObject(c) || typeof c.id !== 'string' || !c.id) {
      return { ok: false, error: label + ' شناسه ندارد یا خراب است.' };
    }
    if (typeof c.name !== 'string' || !c.name.trim()) {
      return { ok: false, error: label + ' نام ندارد.' };
    }
    label = 'دورهٔ «' + c.name + '»';
    if (!Array.isArray(c.groups)) return { ok: false, error: label + ': فهرست گروه‌ها خراب است.' };
    if (!Array.isArray(c.participants)) return { ok: false, error: label + ': فهرست افراد خراب است.' };
    if (!isPlainObject(c.records)) return { ok: false, error: label + ': اطلاعات ثبت روزانه خراب است.' };
    if (!Array.isArray(c.days)) return { ok: false, error: label + ': فهرست روزها خراب است.' };
    for (let gi = 0; gi < c.groups.length; gi++) {
      const g: unknown = c.groups[gi];
      if (!isPlainObject(g) || typeof g.id !== 'string') {
        return { ok: false, error: label + ': یکی از گروه‌ها خراب است.' };
      }
    }
    for (let pi = 0; pi < c.participants.length; pi++) {
      const p: unknown = c.participants[pi];
      if (!isPlainObject(p) || typeof p.id !== 'string' || typeof p.name !== 'string') {
        return { ok: false, error: label + ': اطلاعات یکی از افراد خراب است.' };
      }
    }
  }
  return { ok: true, data: migrate(deepClone(raw)) };
}

function sameCohortKey(
  a: Pick<Cohort, 'name' | 'startDate'>,
  b: Pick<Cohort, 'name' | 'startDate'>
): boolean {
  return (
    String(a.name || '').trim() === String(b.name || '').trim() &&
    String(a.startDate || '') === String(b.startDate || '')
  );
}

/**
 * پیدا کردن دورهٔ موجود که با دورهٔ ورودی یکی است
 * (هم‌شناسه، یا هم‌نام و هم‌تاریخ شروع). خروجی: اندیس یا -1
 */
function findConflictIndex(cohorts: Cohort[], incoming: Cohort): number {
  let i: number;
  for (i = 0; i < cohorts.length; i++) {
    if (cohorts[i].id === incoming.id) return i;
  }
  for (i = 0; i < cohorts.length; i++) {
    if (sameCohortKey(cohorts[i], incoming)) return i;
  }
  return -1;
}

function newCohortId() {
  return 'cohort_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function copyName(cohorts: Cohort[], baseName: string): string {
  const fa = Names.toPersianDigits;
  let n = 2;
  let name: string;
  do {
    name = baseName + ' ـ' + fa(n);
    n++;
  } while (
    cohorts.some(function (c) {
      return c.name === name;
    })
  );
  return name;
}

/**
 * تابع خالص: دوره‌های ورودی را به وضعیت فعلی اضافه می‌کند. ورودی‌ها را تغییر نمی‌دهد.
 * هر دوره همیشه «کامل» ادغام می‌شود (گروه‌ها، افراد و رکوردهایش با هم)، نه تکه‌تکه.
 *
 * options:
 *   selected  : { [اندیس دورهٔ ورودی]: false } برای نادیده‌گرفتن (پیش‌فرض: همه انتخاب‌اند)
 *   decisions : { [اندیس]: 'skip' | 'replace' | 'copy' } برای دوره‌های تکراری (پیش‌فرض: skip)
 *   groupMine : { [اندیس]: { [شناسه گروه]: true/false } } برای تغییر «گروه من/دیگران»
 *   rename    : { [اندیس]: 'نام تازه' } برای عوض‌کردن نام دورهٔ ورودی
 *   newId     : تابع تولید شناسهٔ دورهٔ جدید (برای آزمون)
 *
 * خروجی: { state, report: { added, replaced, copied, skipped } } (فهرست نام دوره‌ها)
 */
function mergeCohorts(
  currentState: AppState,
  incomingCohorts: Cohort[],
  options?: MergeOptions
): { state: AppState; report: MergeReport } {
  options = options || {};
  const selected = options.selected || {};
  const decisions = options.decisions || {};
  const groupMine = options.groupMine || {};
  const rename = options.rename || {};
  const makeId = options.newId || newCohortId;

  const next = deepClone(currentState);
  const report: MergeReport = { added: [], replaced: [], copied: [], skipped: [] };

  (incomingCohorts || []).forEach(function (raw: Cohort, idx: number) {
    if (selected[idx] === false) return;
    const inc = deepClone(raw);

    const newName = (rename[idx] || '').trim();
    if (newName) inc.name = newName;

    const mineMap = groupMine[idx];
    if (mineMap) {
      inc.groups.forEach(function (g: Group) {
        if (mineMap[g.id] !== undefined) g.mine = !!mineMap[g.id];
      });
    }

    const at = findConflictIndex(next.cohorts, inc);
    if (at === -1) {
      next.cohorts.push(inc);
      report.added.push(inc.name);
      return;
    }

    const decision = decisions[idx] || 'skip';
    if (decision === 'replace') {
      next.cohorts[at] = inc;
      report.replaced.push(inc.name);
    } else if (decision === 'copy') {
      inc.id = makeId();
      while (
        next.cohorts.some(function (c) {
          return c.id === inc.id;
        })
      )
        inc.id = makeId();
      // پسوند «ـ۲» فقط وقتی لازم است که نام از قبل گرفته شده باشد
      if (next.cohorts.some((c) => c.name === inc.name)) inc.name = copyName(next.cohorts, inc.name);
      next.cohorts.push(inc);
      report.copied.push(inc.name);
    } else {
      report.skipped.push(inc.name);
    }
  });

  if (!next.activeCohortId && next.cohorts.length) {
    next.activeCohortId = next.cohorts[0].id;
  }
  return { state: next, report: report };
}

/**
 * ساخت دادهٔ فایل بکاپ؛ با cohortId فقط همان دوره، وگرنه همهٔ دوره‌ها
 */
function buildBackupData(fromState: AppState, cohortId?: string | null): AppState {
  const data = deepClone(fromState);
  data.exportedAt = new Date().toISOString();
  if (cohortId) {
    data.cohorts = data.cohorts.filter(function (c) {
      return c.id === cohortId;
    });
    data.activeCohortId = data.cohorts[0] ? data.cohorts[0].id : null;
  }
  return data;
}

// تلاش برای پایدارسازی حافظه در مرورگر
if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
  try {
    navigator.storage.persist().catch(function () {});
  } catch (e) {}
}

type StoreEvent = { type: string; [key: string]: unknown };
type ListenerFn = (state: AppState, event?: StoreEvent) => void;

let state = createInitialState();
let listeners: ListenerFn[] = [];
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let hasQuotaError = false;
let multiTabConflict = false;

// کانال همگام‌سازی بین تب‌ها
let broadcastChannel: (BroadcastChannel & { unref?: () => void }) | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    broadcastChannel = new BroadcastChannel(TAB_CHANNEL_NAME);
    if (broadcastChannel.unref) broadcastChannel.unref(); // در Node (آزمون‌ها) فرایند را باز نگه ندارد
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
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = migrate(parsed);
    }
  }
} catch (e) {
  console.warn('Storage read error:', e);
}

function notifyListeners(event?: StoreEvent) {
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
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    persistToStorage();
  }, 250);
}

function saveImmediately() {
  if (saveTimer) clearTimeout(saveTimer);
  state.lastChangeAt = new Date().toISOString();
  persistToStorage();
  notifyListeners({ type: 'saved' });
}

function getState() {
  return state;
}

function subscribe(fn: ListenerFn) {
  listeners.push(fn);
  return function () {
    listeners = listeners.filter(function (l) {
      return l !== fn;
    });
  };
}

function getActiveCohort(): Cohort | null {
  if (!state.cohorts.length) return null;
  if (!state.activeCohortId) {
    const nonArchived = state.cohorts.filter(function (c) {
      return !c.archived;
    });
    return nonArchived[0] || state.cohorts[0] || null;
  }
  for (let i = 0; i < state.cohorts.length; i++) {
    if (state.cohorts[i].id === state.activeCohortId) {
      return state.cohorts[i];
    }
  }
  return state.cohorts[0] || null;
}

function setActiveCohortId(cohortId: string | null) {
  state.activeCohortId = cohortId;
  saveImmediately();
  notifyListeners({ type: 'active_cohort_changed' });
}

/**
 * ساخت دوره جدید
 */
interface CreateCohortParams {
  name?: string;
  startDate?: string;
  warmupDays?: number;
  mainDays?: number;
  reviewDays?: number;
  copyFromCohortId?: string | null;
}

function createCohort(params?: CreateCohortParams): Cohort {
  const name = (params && params.name) || 'دوره جدید';
  const startDate = (params && params.startDate) || new Date().toISOString().slice(0, 10);
  const warmup = params && params.warmupDays != null ? params.warmupDays : 7;
  const main = params && params.mainDays != null ? params.mainDays : 21;
  const review = params && params.reviewDays != null ? params.reviewDays : 2;

  const newId = 'cohort_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const days = createDefaultDays(warmup, main, review);

  const groups: Group[] = [];
  const participants: Participant[] = [];

  // اگر کپی از دوره قبلی خواسته شده باشد
  if (params && params.copyFromCohortId) {
    const srcCohort = state.cohorts.find(function (c) {
      return c.id === params.copyFromCohortId;
    });
    if (srcCohort) {
      const groupMap: Record<string, string> = {};
      srcCohort.groups.forEach(function (g, idx) {
        const newGId = 'grp_' + Date.now() + '_' + idx;
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
          nameKey: p.nameKey || Names.normalizeName(p.name) || p.name,
          telegram: p.telegram || '',
          groupId: groupMap[p.groupId] || (groups[0] && groups[0].id) || '',
          status: p.status || 'active',
          habitCount: p.habitCount
        });
      });
    }
  }

  const newCohort: Cohort = {
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

function updateCohort(cohortId: string, updates: Partial<Cohort>) {
  const c = state.cohorts.find(function (item) {
    return item.id === cohortId;
  });
  if (!c) return;
  Object.assign(c, updates);
  saveImmediately();
  notifyListeners({ type: 'cohort_updated', cohort: c });
}

function archiveCohort(cohortId: string, archived?: boolean) {
  const c = state.cohorts.find(function (item) {
    return item.id === cohortId;
  });
  if (!c) return;
  c.archived = archived !== false;
  saveImmediately();
  notifyListeners({ type: 'cohort_archived', cohort: c });
}

function deleteCohort(cohortId: string) {
  state.cohorts = state.cohorts.filter(function (c) {
    return c.id !== cohortId;
  });
  if (state.activeCohortId === cohortId) {
    state.activeCohortId = state.cohorts[0] ? state.cohorts[0].id : null;
  }
  saveImmediately();
  notifyListeners({ type: 'cohort_deleted' });
}

/**
 * افزودن گروه به دوره
 */
function addGroup(cohortId: string, groupData: Partial<Group>): Group | null {
  const c = state.cohorts.find(function (item) {
    return item.id === cohortId;
  });
  if (!c) return null;
  const maxOrder = c.groups.reduce(function (max: number, g) {
    return Math.max(max, g.order || 0);
  }, 0);
  const newGroup: Group = {
    id: 'grp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    name: groupData.name || 'گروه ' + (maxOrder + 1),
    order: groupData.order || maxOrder + 1,
    mine: groupData.mine !== false,
    closedDays: []
  };
  c.groups.push(newGroup);
  saveImmediately();
  notifyListeners({ type: 'group_added', group: newGroup });
  return newGroup;
}

function updateGroup(cohortId: string, groupId: string, updates: Partial<Group>) {
  const c = state.cohorts.find(function (item) {
    return item.id === cohortId;
  });
  if (!c) return;
  const g = c.groups.find(function (item) {
    return item.id === groupId;
  });
  if (!g) return;
  Object.assign(g, updates);
  saveImmediately();
  notifyListeners({ type: 'group_updated', group: g });
}

function deleteGroup(cohortId: string, groupId: string) {
  const c = state.cohorts.find(function (item) {
    return item.id === cohortId;
  });
  if (!c) return;
  c.groups = c.groups.filter(function (g) {
    return g.id !== groupId;
  });
  // حذف افراد آن گروه
  c.participants = c.participants.filter(function (p) {
    return p.groupId !== groupId;
  });
  saveImmediately();
  notifyListeners({ type: 'group_deleted' });
}

/**
 * افزودن افراد
 */
interface NewParticipantInput {
  name?: string;
  telegram?: string;
  groupId?: string;
  status?: Participant['status'];
  habitCount?: number | string | null;
}

function addParticipants(
  cohortId: string,
  groupId: string | null | undefined,
  pList: NewParticipantInput[]
): Participant[] {
  const c = state.cohorts.find(function (item) {
    return item.id === cohortId;
  });
  if (!c) return [];
  const added: Participant[] = [];
  pList.forEach(function (p) {
    const name = (p.name || '').trim();
    if (!name) return;
    const nameKey = Names.normalizeName(name);
    const newP: Participant = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: name,
      nameKey: nameKey,
      telegram: (p.telegram || '').trim().replace(/^@/, ''),
      groupId: (groupId || p.groupId) as string,
      status: p.status || 'active',
      habitCount: p.habitCount != null ? parseInt(String(p.habitCount), 10) : null
    };
    c.participants.push(newP);
    added.push(newP);
  });
  saveImmediately();
  notifyListeners({ type: 'participants_added', count: added.length });
  return added;
}

function updateParticipant(cohortId: string, participantId: string, updates: Partial<Participant>) {
  const c = state.cohorts.find(function (item) {
    return item.id === cohortId;
  });
  if (!c) return;
  const p = c.participants.find(function (item) {
    return item.id === participantId;
  });
  if (!p) return;
  if (updates.name && updates.name !== p.name) {
    updates.nameKey = Names.normalizeName(updates.name);
  }
  if (updates.telegram !== undefined) {
    updates.telegram = (updates.telegram || '').replace(/^@/, '').trim();
  }
  Object.assign(p, updates);
  saveImmediately();
  notifyListeners({ type: 'participant_updated', participant: p });
}

function deleteParticipant(cohortId: string, participantId: string) {
  const c = state.cohorts.find(function (item) {
    return item.id === cohortId;
  });
  if (!c) return;
  c.participants = c.participants.filter(function (p) {
    return p.id !== participantId;
  });
  if (c.records && c.records[participantId]) {
    delete c.records[participantId];
  }
  saveImmediately();
  notifyListeners({ type: 'participant_deleted' });
}

/**
 * ثبت روزانه نتیجه یک فرد
 */
function recordDaily(cohortId: string, participantId: string, dayN: number, recordData: Partial<DayRecord>) {
  const c = state.cohorts.find(function (item) {
    return item.id === cohortId;
  });
  if (!c) return;
  if (!c.records) c.records = {};
  if (!c.records[participantId]) c.records[participantId] = {};

  const existing: DayRecord = c.records[participantId][dayN] || { done: null, hard: null, special: null };
  const updated = Object.assign({}, existing, recordData);

  c.records[participantId][dayN] = updated;
  scheduleSave();
  notifyListeners({ type: 'record_updated', participantId: participantId, dayN: dayN });
}

/**
 * ابزارهای گروهی ثبت روزانه
 */
type BatchAction = 'all_habits_done' | 'all_special_done' | 'clear_day';

function batchRecordDay(
  cohortId: string,
  groupId: string,
  dayN: number,
  action: BatchAction
): (() => void) | null {
  const c = state.cohorts.find(function (item) {
    return item.id === cohortId;
  });
  if (!c) return null;
  const groupMembers = c.participants.filter(function (p) {
    return p.groupId === groupId && p.status === 'active';
  });

  if (!c.records) c.records = {};

  // ذخیره کپی قبل از تغییر برای undo
  const previousRecords: Record<string, DayRecord | null> = {};
  groupMembers.forEach(function (p) {
    if (c.records[p.id] && c.records[p.id][dayN]) {
      previousRecords[p.id] = Object.assign({}, c.records[p.id][dayN]);
    } else {
      previousRecords[p.id] = null;
    }
  });

  groupMembers.forEach(function (p) {
    if (!c.records[p.id]) c.records[p.id] = {};
    const cur = c.records[p.id][dayN] || { done: null, hard: null, special: null };

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
      const previous = previousRecords[p.id];
      if (previous === null) {
        delete c.records[p.id][dayN];
      } else {
        c.records[p.id][dayN] = previous;
      }
    });
    saveImmediately();
    notifyListeners({ type: 'batch_record_rolled_back' });
  };
}

/**
 * بستن یا باز کردن مجدد یک روز برای گروه
 */
function toggleCloseDay(cohortId: string, groupId: string, dayN: number, shouldClose: boolean) {
  const c = state.cohorts.find(function (item) {
    return item.id === cohortId;
  });
  if (!c) return;
  const g = c.groups.find(function (item) {
    return item.id === groupId;
  });
  if (!g) return;
  if (!Array.isArray(g.closedDays)) g.closedDays = [];

  const idx = g.closedDays.indexOf(dayN);
  if (shouldClose && idx === -1) {
    g.closedDays.push(dayN);
    g.closedDays.sort(function (a, b) {
      return a - b;
    });
  } else if (!shouldClose && idx !== -1) {
    g.closedDays.splice(idx, 1);
  }
  saveImmediately();
  notifyListeners({ type: 'day_closed_toggled', dayN: dayN, closed: shouldClose });
}

/**
 * بروزرسانی تنظیمات روزهای دوره (تعداد سطوح کار سخت، ماموریت، نوع روز)
 */
function updateDaysConfig(cohortId: string, updatedDays: DayConfig[]) {
  const c = state.cohorts.find(function (item) {
    return item.id === cohortId;
  });
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
  let totalParticipants = 0;
  state.cohorts.forEach(function (c) {
    totalParticipants += (c.participants || []).length;
  });
  if (totalParticipants === 0) return false;

  if (!state.lastBackupAt) {
    return true;
  }

  const lastBackupTime = new Date(state.lastBackupAt).getTime();
  const lastChangeTime = new Date(state.lastChangeAt || 0).getTime();

  // اگر از زمان آخرین بکاپ تغییری داده نشده باشد، هشدار نده
  if (lastChangeTime <= lastBackupTime) {
    return false;
  }

  // اگر تغییر داده شده و بیش از ۲ روز گذشته است
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  return now - lastBackupTime > twoDaysMs;
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
function restoreState(backupData: unknown) {
  const v = validateBackup(backupData);
  if (!v.ok) throw new Error(v.error);
  const restored = v.data;
  restored.lastBackupAt = new Date().toISOString();
  state = restored;
  saveImmediately();
  notifyListeners({ type: 'state_restored' });
}

/**
 * افزودن دوره‌های فایل بکاپ به داده‌های فعلی (گزینه‌ها: mergeCohorts)
 */
function mergeFromBackup(backupData: unknown, options?: MergeOptions): MergeReport {
  const v = validateBackup(backupData);
  if (!v.ok) throw new Error(v.error);
  const result = mergeCohorts(state, v.data.cohorts, options);
  const merged = result.state;
  state = merged;
  saveImmediately();
  notifyListeners({ type: 'state_merged' });
  return result.report;
}

export const Store = {
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
  mergeFromBackup: mergeFromBackup,
  mergeCohorts: mergeCohorts,
  findConflictIndex: findConflictIndex,
  validateBackup: validateBackup,
  buildBackupData: buildBackupData,
  getMultiTabWarning: function () {
    return multiTabConflict;
  },
  clearMultiTabWarning: function () {
    multiTabConflict = false;
  },
  getQuotaError: function () {
    return hasQuotaError;
  }
};
