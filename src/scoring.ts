/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Names } from './names';

const toLatinDigits = Names.toLatinDigits;

// ورودی‌ها عمداً ساختاری و منعطف‌اند (مقدارها ممکن است رشته یا ارقام فارسی باشند)
type Num = number | string | null | undefined;
export interface RecordInput {
  done?: Num;
  hard?: Num;
  special?: Num;
}
export interface ParticipantInput {
  id: string;
  habitCount?: Num;
}
export interface DayInput {
  n: number;
  type?: string;
  hardLevels?: Num;
  specialMission?: boolean | null;
}
interface CohortInput {
  days?: DayInput[];
  records?: Record<string, Record<number, RecordInput>>;
  participants?: (ParticipantInput & { groupId?: string; status?: string })[];
}
interface GroupInput {
  id?: string;
  closedDays?: number[];
}

const toInt = (v: Num): number => parseInt(String(v), 10);

/**
 * محاسبه حداکثر امتیاز ممکن برای یک فرد در یک روز
 * @param {Object} participant فرد { id, habitCount, ... }
 * @param {Object} dayCfg تنظیم روز { n, type: 'warmup'|'main'|'review', hardLevels, specialMission }
 * @param {Object} [record] رکورد ثبت‌شده روز (برای قاعده موقت در صورت null بودن habitCount)
 * @returns {number} حداکثر امتیاز روز
 */
function dayMax(
  participant: ParticipantInput | null | undefined,
  dayCfg: DayInput | null | undefined,
  record?: RecordInput | null
): number {
  if (!dayCfg || dayCfg.type === 'warmup' || dayCfg.type === 'review') {
    return 0;
  }

  let effectiveHabitCount = 0;
  if (participant && participant.habitCount != null) {
    effectiveHabitCount = Math.max(0, toInt(participant.habitCount) || 0);
  } else if (record && record.done != null) {
    // قاعده موقت: اگر habitCount هنوز null است و done ثبت شده، از done استفاده کن
    const latinDone = toLatinDigits(record.done);
    effectiveHabitCount = Math.max(0, parseInt(latinDone, 10) || 0);
  }

  const hardMax = Math.max(0, toInt(dayCfg.hardLevels != null ? dayCfg.hardLevels : 0) || 0);
  const specialMax = dayCfg.specialMission ? 1 : 0;

  return effectiveHabitCount + hardMax + specialMax;
}

/**
 * محاسبه امتیاز کسب‌شده یک فرد در یک روز
 * @param {Object} participant فرد
 * @param {Object} record رکورد روز { done, hard, special }
 * @param {Object} dayCfg تنظیم روز
 * @returns {number} امتیاز روز
 */
function dayScore(
  participant: ParticipantInput | null | undefined,
  record: RecordInput | null | undefined,
  dayCfg: DayInput | null | undefined
): number {
  if (!record || !dayCfg || dayCfg.type === 'warmup' || dayCfg.type === 'review') {
    return 0;
  }

  // سقف عادت‌ها
  let habitCap = 0;
  if (participant && participant.habitCount != null) {
    habitCap = Math.max(0, toInt(participant.habitCount) || 0);
  } else if (record.done != null) {
    const ld = toLatinDigits(record.done);
    habitCap = Math.max(0, parseInt(ld, 10) || 0);
  }

  let scoreDone = 0;
  if (record.done != null && record.done !== '') {
    const d = parseInt(toLatinDigits(record.done), 10);
    if (!isNaN(d)) {
      scoreDone = Math.max(0, Math.min(d, habitCap));
    }
  }

  // کار سخت (سطحِ بالاترین مرحله، نه جمع مراحل)
  const hardCap = Math.max(0, toInt(dayCfg.hardLevels != null ? dayCfg.hardLevels : 0) || 0);
  let scoreHard = 0;
  if (hardCap > 0 && record.hard != null && record.hard !== '') {
    const h = parseInt(toLatinDigits(record.hard), 10);
    if (!isNaN(h)) {
      scoreHard = Math.max(0, Math.min(h, hardCap));
    }
  }

  // مأموریت ویژه (۱ یا ۰)
  let scoreSpecial = 0;
  if (dayCfg.specialMission && record.special != null && record.special !== '') {
    const s = parseInt(toLatinDigits(record.special), 10);
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
function validateRecord(
  participant: ParticipantInput | null | undefined,
  record: RecordInput | null | undefined,
  dayCfg: DayInput | null | undefined
) {
  const errors: string[] = [];
  if (!record || !dayCfg) return { valid: true, errors: errors };

  if (dayCfg.type === 'warmup' || dayCfg.type === 'review') {
    return { valid: true, errors: errors };
  }

  if (record.done != null && record.done !== '') {
    const d = parseInt(toLatinDigits(record.done), 10);
    if (isNaN(d) || d < 0) {
      errors.push('تعداد عادت‌ها نامعتبر است.');
    } else if (participant && participant.habitCount != null && d > toInt(participant.habitCount)) {
      errors.push('انجام‌شده‌ها نمی‌تواند از انتخابی‌ها بیشتر باشد.');
    }
  }

  if (record.hard != null && record.hard !== '') {
    const h = parseInt(toLatinDigits(record.hard), 10);
    const maxH = Math.max(0, toInt(dayCfg.hardLevels != null ? dayCfg.hardLevels : 0) || 0);
    if (isNaN(h) || h < 0) {
      errors.push('سطح کار سخت نامعتبر است.');
    } else if (h > maxH) {
      errors.push('سطح کار سخت نمی‌تواند از سقف روز بیشتر باشد.');
    }
  }

  if (record.special != null && record.special !== '') {
    const s = parseInt(toLatinDigits(record.special), 10);
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
function personTotals(
  participant: ParticipantInput | null | undefined,
  cohort: CohortInput | null | undefined,
  group: GroupInput | null | undefined,
  uptoDay?: number | null
) {
  const res = {
    totalScore: 0,
    totalMax: 0,
    percent: 0,
    closedDaysCount: 0
  };

  if (!participant || !cohort || !group) return res;

  const closedDays = group.closedDays || [];
  const days = cohort.days || [];
  const pRecords = (cohort.records && cohort.records[participant.id]) || {};

  for (let i = 0; i < days.length; i++) {
    const dayCfg = days[i];
    if (dayCfg.type !== 'main') continue;

    // روز باید حتماً بسته شده باشد تا در مجموع تجمعی بیاید
    if (closedDays.indexOf(dayCfg.n) === -1) continue;

    if (uptoDay != null && dayCfg.n > uptoDay) continue;

    res.closedDaysCount++;
    const rec = pRecords[dayCfg.n] || null;

    const sc = dayScore(participant, rec, dayCfg);
    const mx = dayMax(participant, dayCfg, rec);

    res.totalScore += sc;
    res.totalMax += mx;
  }

  res.percent = res.totalMax > 0 ? Math.round((res.totalScore / res.totalMax) * 100) : 0;
  return res;
}

/**
 * خلاصه گروه
 */
function groupSummary(
  cohort: CohortInput | null | undefined,
  group: GroupInput | null | undefined,
  uptoDay?: number | null,
  includeFrozen?: boolean
) {
  const summary = {
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

  const participants = (cohort.participants || []).filter(function (p) {
    return p.groupId === group.id;
  });

  summary.participantCount = participants.length;

  let todayN = uptoDay;
  if (todayN == null) {
    // پیش‌فرض روز جاری
    todayN = 8;
  }

  const validMembers = [];
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
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
      const rec = cohort.records && cohort.records[p.id] && cohort.records[p.id][todayN];
      const isUnrecorded = !rec || (rec.done == null && rec.hard == null && rec.special == null);
      if (isUnrecorded) {
        summary.unrecordedTodayCount++;
      }
    }
  }

  for (let j = 0; j < validMembers.length; j++) {
    const mem = validMembers[j];
    const totals = personTotals(mem, cohort, group, uptoDay);
    summary.totalScore += totals.totalScore;
    summary.totalMax += totals.totalMax;
  }

  summary.percent = summary.totalMax > 0 ? Math.round((summary.totalScore / summary.totalMax) * 100) : 0;
  return summary;
}

export const Scoring = {
  dayMax: dayMax,
  dayScore: dayScore,
  validateRecord: validateRecord,
  personTotals: personTotals,
  groupSummary: groupSummary
};
