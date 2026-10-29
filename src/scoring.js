/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

(function (root) {
  'use strict';

  var SupportApp = root.SupportApp || (root.SupportApp = {});
  var toLatinDigits = (SupportApp.Names && SupportApp.Names.toLatinDigits) || function (val) {
    if (val === null || val === undefined) return '';
    return String(val)
      .replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 1776; })
      .replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 1632; });
  };

  /**
   * محاسبه حداکثر امتیاز ممکن برای یک فرد در یک روز
   * @param {Object} participant فرد { id, habitCount, ... }
   * @param {Object} dayCfg تنظیم روز { n, type: 'warmup'|'main'|'review', hardLevels, specialMission }
   * @param {Object} [record] رکورد ثبت‌شده روز (برای قاعده موقت در صورت null بودن habitCount)
   * @returns {number} حداکثر امتیاز روز
   */
  function dayMax(participant, dayCfg, record) {
    if (!dayCfg || dayCfg.type === 'warmup' || dayCfg.type === 'review') {
      return 0;
    }

    var effectiveHabitCount = 0;
    if (participant && participant.habitCount != null) {
      effectiveHabitCount = Math.max(0, parseInt(participant.habitCount, 10) || 0);
    } else if (record && record.done != null) {
      // قاعده موقت: اگر habitCount هنوز null است و done ثبت شده، از done استفاده کن
      var latinDone = toLatinDigits(record.done);
      effectiveHabitCount = Math.max(0, parseInt(latinDone, 10) || 0);
    }

    var hardMax = Math.max(0, parseInt(dayCfg.hardLevels != null ? dayCfg.hardLevels : 0, 10) || 0);
    var specialMax = dayCfg.specialMission ? 1 : 0;

    return effectiveHabitCount + hardMax + specialMax;
  }

  /**
   * محاسبه امتیاز کسب‌شده یک فرد در یک روز
   * @param {Object} participant فرد
   * @param {Object} record رکورد روز { done, hard, special }
   * @param {Object} dayCfg تنظیم روز
   * @returns {number} امتیاز روز
   */
  function dayScore(participant, record, dayCfg) {
    if (!record || !dayCfg || dayCfg.type === 'warmup' || dayCfg.type === 'review') {
      return 0;
    }

    // سقف عادت‌ها
    var habitCap = 0;
    if (participant && participant.habitCount != null) {
      habitCap = Math.max(0, parseInt(participant.habitCount, 10) || 0);
    } else if (record.done != null) {
      var ld = toLatinDigits(record.done);
      habitCap = Math.max(0, parseInt(ld, 10) || 0);
    }

    var scoreDone = 0;
    if (record.done != null && record.done !== '') {
      var d = parseInt(toLatinDigits(record.done), 10);
      if (!isNaN(d)) {
        scoreDone = Math.max(0, Math.min(d, habitCap));
      }
    }

    // کار سخت (سطحِ بالاترین مرحله، نه جمع مراحل)
    var hardCap = Math.max(0, parseInt(dayCfg.hardLevels != null ? dayCfg.hardLevels : 0, 10) || 0);
    var scoreHard = 0;
    if (hardCap > 0 && record.hard != null && record.hard !== '') {
      var h = parseInt(toLatinDigits(record.hard), 10);
      if (!isNaN(h)) {
        scoreHard = Math.max(0, Math.min(h, hardCap));
      }
    }

    // مأموریت ویژه (۱ یا ۰)
    var scoreSpecial = 0;
    if (dayCfg.specialMission && record.special != null && record.special !== '') {
      var s = parseInt(toLatinDigits(record.special), 10);
      if (!isNaN(s) && s > 0) {
        scoreSpecial = 1;
      }
    }

    return scoreDone + scoreHard + scoreSpecial;
  }

  /**
   * اعتبارسنجی ورودی‌های رکورد
   * @returns {{ valid: boolean, errors: string[] }}
   */
  function validateRecord(participant, record, dayCfg) {
    var errors = [];
    if (!record || !dayCfg) return { valid: true, errors: errors };

    if (dayCfg.type === 'warmup' || dayCfg.type === 'review') {
      return { valid: true, errors: errors };
    }

    if (record.done != null && record.done !== '') {
      var d = parseInt(toLatinDigits(record.done), 10);
      if (isNaN(d) || d < 0) {
        errors.push('تعداد عادت‌ها نامعتبر است.');
      } else if (participant && participant.habitCount != null && d > participant.habitCount) {
        errors.push('انجام‌شده‌ها نمی‌تواند از انتخابی‌ها بیشتر باشد.');
      }
    }

    if (record.hard != null && record.hard !== '') {
      var h = parseInt(toLatinDigits(record.hard), 10);
      var maxH = Math.max(0, parseInt(dayCfg.hardLevels != null ? dayCfg.hardLevels : 0, 10) || 0);
      if (isNaN(h) || h < 0) {
        errors.push('سطح کار سخت نامعتبر است.');
      } else if (h > maxH) {
        errors.push('سطح کار سخت نمی‌تواند از سقف روز بیشتر باشد.');
      }
    }

    if (record.special != null && record.special !== '') {
      var s = parseInt(toLatinDigits(record.special), 10);
      if (isNaN(s) || (s !== 0 && s !== 1)) {
        errors.push('وضعیت مأموریت ویژه نامعتبر است.');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * محاسبه مجموع تجمعی یک فرد در روزهای بسته‌شده
   */
  function personTotals(participant, cohort, group, uptoDay) {
    var res = {
      totalScore: 0,
      totalMax: 0,
      percent: 0,
      closedDaysCount: 0
    };

    if (!participant || !cohort || !group) return res;

    var closedDays = group.closedDays || [];
    var days = cohort.days || [];
    var pRecords = (cohort.records && cohort.records[participant.id]) || {};

    for (var i = 0; i < days.length; i++) {
      var dayCfg = days[i];
      if (dayCfg.type !== 'main') continue;

      // روز باید حتماً بسته شده باشد تا در مجموع تجمعی بیاید
      if (closedDays.indexOf(dayCfg.n) === -1) continue;

      if (uptoDay != null && dayCfg.n > uptoDay) continue;

      res.closedDaysCount++;
      var rec = pRecords[dayCfg.n] || null;

      var sc = dayScore(participant, rec, dayCfg);
      var mx = dayMax(participant, dayCfg, rec);

      res.totalScore += sc;
      res.totalMax += mx;
    }

    res.percent = res.totalMax > 0 ? Math.round((res.totalScore / res.totalMax) * 100) : 0;
    return res;
  }

  /**
   * خلاصه گروه
   */
  function groupSummary(cohort, group, uptoDay, includeFrozen) {
    var summary = {
      participantCount: 0,
      activeCount: 0,
      frozenCount: 0,
      leftCount: 0,
      totalScore: 0,
      totalMax: 0,
      percent: 0,
      unrecordedTodayCount: 0
    };

    if (!cohort || !group) return summary;

    var participants = (cohort.participants || []).filter(function (p) {
      return p.groupId === group.id;
    });

    summary.participantCount = participants.length;

    var todayN = uptoDay;
    if (todayN == null) {
      // پیش‌فرض روز جاری
      todayN = 8;
    }

    var validMembers = [];
    for (var i = 0; i < participants.length; i++) {
      var p = participants[i];
      if (p.status === 'frozen') {
        summary.frozenCount++;
      } else if (p.status === 'left') {
        summary.leftCount++;
      } else {
        summary.activeCount++;
      }

      if (includeFrozen || (p.status !== 'frozen' && p.status !== 'left')) {
        validMembers.push(p);
      }

      // بررسی وضعیت ثبت امروز برای اعضای فعال
      if (p.status === 'active') {
        var rec = cohort.records && cohort.records[p.id] && cohort.records[p.id][todayN];
        var isUnrecorded = !rec || (rec.done == null && rec.hard == null && rec.special == null);
        if (isUnrecorded) {
          summary.unrecordedTodayCount++;
        }
      }
    }

    for (var j = 0; j < validMembers.length; j++) {
      var mem = validMembers[j];
      var totals = personTotals(mem, cohort, group, uptoDay);
      summary.totalScore += totals.totalScore;
      summary.totalMax += totals.totalMax;
    }

    summary.percent = summary.totalMax > 0 ? Math.round((summary.totalScore / summary.totalMax) * 100) : 0;
    return summary;
  }

  SupportApp.Scoring = {
    dayMax: dayMax,
    dayScore: dayScore,
    validateRecord: validateRecord,
    personTotals: personTotals,
    groupSummary: groupSummary
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupportApp.Scoring;
  }
})(typeof window !== 'undefined' ? window : globalThis);
