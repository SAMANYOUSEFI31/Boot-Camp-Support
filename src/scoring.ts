/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Names } from './names';
import { doneIndexes } from './habits';
import { donationScore } from './membership';
import type { Payment } from './types';

const toLatinDigits = Names.toLatinDigits;

// ورودی‌ها عمداً ساختاری و منعطف‌اند (مقدارها ممکن است رشته یا ارقام فارسی باشند)
type Num = number | string | null | undefined;
export interface RecordInput {
  done?: Num;
  doneHabits?: number[];
  hard?: Num;
  special?: Num;
}
export interface ParticipantInput {
  id: string;
  habitCount?: Num;
  donations?: Payment[];
}
export interface DayInput {
  n: number;
  type?: string;
  hardLevels?: Num;
  specialMission?: boolean | null; // قدیمی؛ برای روزهای main همیشه فعال
}
interface CohortInput {
  days?: DayInput[];
  records?: Record<string, Record<number, RecordInput>>;
  participants?: (ParticipantInput & { groupId?: string; status?: string })[];
}
interface GroupInput {
  id?: string;
  closedDays?: number[];
  dayParticipants?: Record<number, string[]>;
}

const toInt = (v: Num): number => parseInt(toLatinDigits(v), 10);

/** امتیاز «گزارش هدف» (فیلد داده‌ای قدیمی: special) */
const GOAL_REPORT_POINTS = 1;
/** امتیاز اضافهٔ «روز استاندارد» */
const STANDARD_DAY_POINTS = 2;

/** سقف عادت‌های یک فرد در یک روز (با قاعدهٔ موقت وقتی habitCount هنوز null است) */
function habitCap(_participant: ParticipantInput | null | undefined, _record?: RecordInput | null): number {
  return 5;
}

/** تعداد عادت‌های انجام‌شده (نسبت به سقف) */
function habitsDone(
  participant: ParticipantInput | null | undefined,
  record: RecordInput | null | undefined
): number {
  // ثبت تک‌تک عادت‌ها: شمارش از روی همان‌ها (done فقط نسخهٔ هم‌گام است)
  if (record && Array.isArray(record.doneHabits)) {
    const idx = doneIndexes(
      { habitCount: 5 },
      { doneHabits: record.doneHabits }
    );
    return idx ? idx.length : 0;
  }
  if (!record || record.done == null || record.done === '') return 0;
  const d = parseInt(toLatinDigits(record.done), 10);
  if (isNaN(d)) return 0;
  return Math.max(0, Math.min(d, habitCap(participant, record)));
}

/** فقط روزهای main امتیاز دارند؛ گزارش هدف در همهٔ آن‌ها فعال است */
const isScoredDay = (dayCfg: DayInput | null | undefined): dayCfg is DayInput =>
  !!dayCfg && dayCfg.type !== 'warmup' && dayCfg.type !== 'review';

/**
 * «روز استاندارد»: چهار عادت اصلی انجام شده باشد؛ عادت پنجم اثری ندارد.
 * کاملاً مشتق‌شده است؛ کار سخت و گزارش هدف نقشی ندارند.
 */
export function standardDay(
  participant: ParticipantInput | null | undefined,
  record: RecordInput | null | undefined,
  dayCfg: DayInput | null | undefined
): boolean {
  if (!record || !isScoredDay(dayCfg)) return false;
  const indices = doneIndexes({ habitCount: 5 }, { doneHabits: record.doneHabits });
  // رکوردهای قدیمی با تعداد کمتر از پنج، هویت عادت‌های انجام‌شده را مشخص نمی‌کنند.
  return indices ? [0, 1, 2, 3].every((i) => indices.includes(i)) : habitsDone(participant, record) === 5;
}

/**
 * حداکثر امتیاز ممکن یک فرد در یک روز:
 * ۵ عادت + ۲ روز استاندارد + سطح کار سخت + ۱ مأموریت ویژه؛ بدون دونیت.
 */
const normalizeHardLevels = (rawLevels: Num): 0 | 1 | 3 => {
  const n = toInt(rawLevels != null ? rawLevels : 0);
  if (isNaN(n) || n <= 0) return 0;
  return n === 1 ? 1 : 3;
};

function dayMax(
  participant: ParticipantInput | null | undefined,
  dayCfg: DayInput | null | undefined,
  record?: RecordInput | null
): number {
  if (!isScoredDay(dayCfg)) return 0;

  const cap = habitCap(participant, record);
  const standardMax = STANDARD_DAY_POINTS;
  const hardLevels = normalizeHardLevels(dayCfg.hardLevels);
  const hardMax = hardLevels > 0 ? 3 : 0;

  return cap + standardMax + hardMax + GOAL_REPORT_POINTS;
}

/**
 * امتیاز کسب‌شدهٔ یک فرد در یک روز
 * (عادت‌ها + روز استاندارد + بالاترین سطح کار سخت + گزارش هدف)
 */
function dayScore(
  participant: ParticipantInput | null | undefined,
  record: RecordInput | null | undefined,
  dayCfg: DayInput | null | undefined
): number {
  const b = dayBreakdown(participant, record, dayCfg);
  return b.total;
}

/** تفکیک امتیاز روز برای نمایش و گزارش‌ها */
function dayBreakdown(
  participant: ParticipantInput | null | undefined,
  record: RecordInput | null | undefined,
  dayCfg: DayInput | null | undefined
) {
  const res = { habits: 0, standard: 0, hard: 0, goal: 0, total: 0 };
  if (!record || !isScoredDay(dayCfg)) return res;

  res.habits = habitsDone(participant, record);
  res.standard = standardDay(participant, record, dayCfg) ? STANDARD_DAY_POINTS : 0;

  // کار سخت: اگر ۱ سطح باشد و انجام شود ۳ امتیاز دارد؛ اگر ۳ سطحی باشد بر اساس سطح انجام‌شده (۱ تا ۳) امتیاز می‌گیرد
  const hardLevels = normalizeHardLevels(dayCfg.hardLevels);
  if (hardLevels > 0 && record.hard != null && record.hard !== '') {
    const h = parseInt(toLatinDigits(record.hard), 10);
    if (!isNaN(h) && h > 0) {
      if (hardLevels === 1) {
        res.hard = 3;
      } else {
        res.hard = Math.max(0, Math.min(h, 3));
      }
    }
  }

  // مأموریت ویژه: گزارش کار در راستای هدف.
  if (record.special != null && record.special !== '') {
    const s = parseInt(toLatinDigits(record.special), 10);
    if (!isNaN(s) && s > 0) res.goal = GOAL_REPORT_POINTS;
  }

  res.total = res.habits + res.standard + res.hard + res.goal;
  return res;
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
  for (const value of [record.done, record.hard, record.special]) {
    if (value != null && value !== '' && !/^\d+$/.test(toLatinDigits(value))) {
      errors.push('مقدار باید عدد صحیح و نامنفی باشد.');
    }
  }

  if (record.done != null && record.done !== '') {
    const d = parseInt(toLatinDigits(record.done), 10);
    if (isNaN(d) || d < 0) {
      errors.push('تعداد عادت‌ها نامعتبر است.');
    } else if (d > 5) {
      errors.push('انجام‌شده‌ها نمی‌تواند از انتخابی‌ها بیشتر باشد.');
    }
  }

  if (record.hard != null && record.hard !== '') {
    const h = parseInt(toLatinDigits(record.hard), 10);
    const maxH = normalizeHardLevels(dayCfg.hardLevels);
    if (isNaN(h) || h < 0) {
      errors.push('سطح کار سخت نامعتبر است.');
    } else if (h > maxH) {
      errors.push('سطح کار سخت نمی‌تواند از سقف روز بیشتر باشد.');
    }
  }

  if (record.special != null && record.special !== '') {
    const s = parseInt(toLatinDigits(record.special), 10);
    if (isNaN(s) || (s !== 0 && s !== 1)) {
      errors.push('وضعیت گزارش هدف نامعتبر است.');
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
    closedDaysCount: 0,
    donationScore: 0
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
    const attendees = group.dayParticipants?.[dayCfg.n];
    if (attendees && !attendees.includes(participant.id)) continue;

    if (uptoDay != null && dayCfg.n > uptoDay) continue;

    res.closedDaysCount++;
    const rec = pRecords[dayCfg.n] || null;

    const sc = dayScore(participant, rec, dayCfg);
    const mx = dayMax(participant, dayCfg, rec);

    res.totalScore += sc;
    res.totalMax += mx;
  }

  res.donationScore = donationScore(participant, uptoDay ?? Infinity);
  res.totalScore += res.donationScore;
  res.totalMax += 5;
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
  habitsDone: habitsDone,
  dayScore: dayScore,
  dayBreakdown: dayBreakdown,
  standardDay: standardDay,
  GOAL_REPORT_POINTS: GOAL_REPORT_POINTS,
  STANDARD_DAY_POINTS: STANDARD_DAY_POINTS,
  validateRecord: validateRecord,
  personTotals: personTotals,
  groupSummary: groupSummary
};
