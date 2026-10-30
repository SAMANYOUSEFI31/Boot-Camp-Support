/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * فهرست مشترک ستون‌های گزارش (اکسل و تصویر).
 * عنوان، ترتیب، متن نمایش، مقدار عددی شیت داده، شرط نمایش و متن قاعده‌ها فقط همین‌جا هستند؛
 * محاسبهٔ امتیاز همچنان فقط از scoring.ts می‌آید.
 */

import { Names } from './names';
import { SCORING_RULES } from './copy';
import { Scoring } from './scoring';
import { habitStatuses, hasHabitNames, MAX_HABITS } from './habits';
import type { HabitStatus } from './habits';
import type { Cohort, DayConfig, Group, Participant, ParticipantStatus, DayRecord } from './types';

export type ReportTarget = 'excel' | 'image';

/** همهٔ آن‌چه یک ستون برای ساختن مقدارش از یک ردیف لازم دارد */
export interface ReportRow {
  rowNum: number;
  participantId: string;
  /** نام نمایشی با برچسب (فریز) یا (خارج) */
  name: string;
  rawName: string;
  status: ParticipantStatus;
  participant: Participant;
  record: DayRecord | null;
  hasRecord: boolean;
  standardDay: boolean;
  dayScore: number | null;
  dayMax: number | null;
  totalScore: number;
  totalMax: number;
  percent: number;
  breakdown: ReturnType<typeof Scoring.dayBreakdown>;
  /** وضعیت تک‌تک عادت‌ها (انجام شد / نشد / فقط تعداد / ثبت‌نشده) */
  habits: HabitStatus[];
}

export interface ReportContext {
  dayCfg: DayConfig;
  /** دست‌کم یک فرد عادت نام‌دار دارد: گزارش‌ها جزئیات هر عادت را نشان می‌دهند */
  hasHabitNames?: boolean;
}

export type Tone = 'success' | 'subtle';

/** یک ستون عددی شیت «داده» (ارقام لاتین، مناسب فرمول) */
export interface DataField {
  header: string;
  /** lead: ردیف و نام، input: ورودی‌های خام، score: امتیازها */
  group: 'lead' | 'input' | 'score';
  value: (r: ReportRow) => number | string | null;
}

export interface ReportColumn {
  id: string;
  title: string;
  /** اگر عنوان در تصویر فرق دارد */
  imageTitle?: string;
  /** نحوهٔ رسم در تصویر */
  kind: 'index' | 'name' | 'text' | 'percent';
  excelWidth: number;
  /** عرض در تصویر ۱۰۸۰ پیکسلی؛ ستون نام همیشه باقی‌ماندهٔ عرض را می‌گیرد */
  imageWidth: number;
  /** شرط نمایش در هر خروجی؛ پیش‌فرض همیشه */
  excel?: (ctx: ReportContext) => boolean;
  image?: (ctx: ReportContext) => boolean;
  /** متن نمایش (اکسل و پیش‌فرض تصویر) */
  text: (r: ReportRow, ctx: ReportContext) => string;
  imageText?: (r: ReportRow, ctx: ReportContext) => string;
  tone?: (r: ReportRow, target: ReportTarget) => Tone | undefined;
  /** وزن فونت در تصویر؛ پیش‌فرض معمولی */
  weight?: 'semibold' | 'bold';
  data: DataField[];
}

const fa = (v: number | string) => Names.toPersianDigits(v);
const ofText = (a: number, b: number) => fa(a) + ' از ' + fa(b);
const isMissing = (text: string) => text === 'ثبت‌نشده' || text === 'ندارد';
const orDash = (text: string) => (isMissing(text) ? '—' : text);
const num = (v: unknown): number | null => (v != null ? Number(v) : null);
const scoreIf = (r: ReportRow, pick: (b: ReportRow['breakdown']) => number) =>
  r.hasRecord ? pick(r.breakdown) : null;

const habitsText = (r: ReportRow, _ctx?: ReportContext): string => {
  const hc = r.participant.habitCount;
  if (hc == null) return '—';
  const has = r.record && (r.record.done != null || Array.isArray(r.record.doneHabits));
  return has ? ofText(r.breakdown.habits, hc) : '— از ' + fa(hc);
};

/** «✓ مطالعه، ✗ ورزش»؛ برای رکورد قدیمی فقط تعداد معلوم است */
const habitDetailsText = (r: ReportRow, _ctx?: ReportContext): string => {
  if (!r.habits.length) return '—';
  if (r.habits.every((h) => h.state === 'unknown')) return habitsText(r) + ' (کدام‌ها ثبت نشده)';
  return r.habits
    .map((h) => (h.state === 'done' ? '✓ ' : h.state === 'missed' ? '✗ ' : '— ') + h.label)
    .join('، ');
};

/** ستون‌های عددی هر عادت برای شیت «داده»: نام و ۱/۰ انجام‌شدن */
const habitDataFields = (): DataField[] =>
  Array.from({ length: MAX_HABITS }, (_v, i) => i).flatMap((i) => [
    {
      header: 'habit' + (i + 1) + '_name',
      group: 'input' as const,
      value: (r: ReportRow) => (r.habits[i] && r.habits[i].named ? r.habits[i].label : null)
    },
    {
      header: 'habit' + (i + 1) + '_done',
      group: 'input' as const,
      value: (r: ReportRow) => {
        const st = r.habits[i] && r.habits[i].state;
        return st === 'done' ? 1 : st === 'missed' ? 0 : null;
      }
    }
  ]);

const hardText = (r: ReportRow, ctx: ReportContext): string => {
  if (!(ctx.dayCfg.hardLevels > 0)) return 'ندارد';
  if (r.record && r.record.hard != null) {
    const h = Number(r.record.hard);
    return h > 0 ? 'سطح ' + fa(h) : 'انجام نداد';
  }
  return 'ثبت‌نشده';
};

const goalText = (r: ReportRow, _ctx?: ReportContext): string => {
  if (r.record && r.record.special != null) return r.record.special > 0 ? '✓' : '✗';
  return 'ثبت‌نشده';
};

const dayScoreText = (r: ReportRow, _ctx?: ReportContext): string =>
  r.dayScore != null && r.dayMax != null ? ofText(r.dayScore, r.dayMax) : 'ثبت‌نشده';

export const REPORT_COLUMNS: ReportColumn[] = [
  {
    id: 'rowNum',
    title: 'ردیف',
    kind: 'index',
    excelWidth: 8,
    imageWidth: 56,
    text: (r) => fa(r.rowNum),
    data: [{ header: 'ردیف', group: 'lead', value: (r) => r.rowNum }]
  },
  {
    id: 'name',
    title: 'نام',
    imageTitle: 'نام و نام خانوادگی',
    kind: 'name',
    excelWidth: 24,
    imageWidth: 0,
    text: (r) => r.name,
    data: [{ header: 'نام', group: 'lead', value: (r) => r.rawName }]
  },
  {
    id: 'habits',
    title: 'عادت‌ها',
    kind: 'text',
    excelWidth: 14,
    imageWidth: 150,
    text: habitsText,
    // در حالت عادت‌های نام‌دار، تصویر جزئیات را زیر نام می‌نویسد و این ستون نمی‌آید
    image: (ctx) => !ctx.hasHabitNames,
    // «روز استاندارد» در تصویر با یک تیک کوچک کنار عادت‌ها نشان داده می‌شود
    imageText: (r, ctx) => (r.standardDay ? habitsText(r, ctx) + ' ✓' : habitsText(r, ctx)),
    tone: (r, target) => (target === 'image' && r.standardDay ? 'success' : undefined),
    data: [
      { header: 'habitCount', group: 'input', value: (r) => r.participant.habitCount ?? null },
      { header: 'done', group: 'input', value: (r) => num(r.record && r.record.done) },
      ...habitDataFields(),
      { header: 'habitScore', group: 'score', value: (r) => scoreIf(r, (b) => b.habits) }
    ]
  },
  {
    id: 'habitDetails',
    title: 'کدام عادت‌ها',
    kind: 'text',
    excelWidth: 36,
    imageWidth: 0,
    // فقط در Excel و فقط وقتی عادت‌ها نام دارند (تصویر جزئیات را خودش زیر نام می‌کشد)
    excel: (ctx) => !!ctx.hasHabitNames,
    image: () => false,
    text: habitDetailsText,
    data: []
  },
  {
    id: 'standardDay',
    title: 'روز استاندارد',
    kind: 'text',
    excelWidth: 14,
    imageWidth: 0,
    image: () => false,
    text: (r) => (r.hasRecord && r.standardDay ? '✓' : '—'),
    data: [{ header: 'standardDayScore', group: 'score', value: (r) => scoreIf(r, (b) => b.standard) }]
  },
  {
    id: 'hard',
    title: 'کار سخت',
    kind: 'text',
    excelWidth: 14,
    imageWidth: 120,
    // در تصویر فقط وقتی روز سطح کار سخت دارد
    image: (ctx) => ctx.dayCfg.hardLevels > 0,
    text: hardText,
    imageText: (r, ctx) => orDash(hardText(r, ctx)),
    tone: (r, target) =>
      target === 'image' && r.record && r.record.hard != null && Number(r.record.hard) <= 0
        ? 'subtle'
        : undefined,
    data: [
      { header: 'hard', group: 'input', value: (r) => num(r.record && r.record.hard) },
      { header: 'hardScore', group: 'score', value: (r) => scoreIf(r, (b) => b.hard) }
    ]
  },
  {
    id: 'goal',
    title: 'گزارش هدف',
    kind: 'text',
    excelWidth: 14,
    imageWidth: 140,
    weight: 'semibold',
    text: goalText,
    imageText: (r, ctx) => orDash(goalText(r, ctx)),
    tone: (r, target) =>
      target === 'image' ? (r.record && Number(r.record.special) > 0 ? 'success' : 'subtle') : undefined,
    data: [
      { header: 'special', group: 'input', value: (r) => num(r.record && r.record.special) },
      { header: 'goalScore', group: 'score', value: (r) => scoreIf(r, (b) => b.goal) }
    ]
  },
  {
    id: 'dayScore',
    title: 'امتیاز این روز',
    kind: 'text',
    excelWidth: 14,
    imageWidth: 140,
    weight: 'bold',
    text: dayScoreText,
    imageText: (r, ctx) => (r.dayScore == null ? '—' : dayScoreText(r, ctx)),
    tone: (r, target) =>
      target === 'image' && r.dayScore != null && (r.dayMax ?? 0) > 0 && r.dayScore === r.dayMax
        ? 'success'
        : undefined,
    data: [
      { header: 'dayScore', group: 'score', value: (r) => r.dayScore },
      { header: 'dayMax', group: 'score', value: (r) => r.dayMax }
    ]
  },
  {
    id: 'total',
    title: 'مجموع تا این روز',
    imageTitle: 'مجموع',
    kind: 'text',
    excelWidth: 16,
    imageWidth: 130,
    text: (r) => ofText(r.totalScore, r.totalMax),
    data: [
      { header: 'totalScore', group: 'score', value: (r) => r.totalScore },
      { header: 'totalMax', group: 'score', value: (r) => r.totalMax }
    ]
  },
  {
    id: 'percent',
    title: 'درصد',
    kind: 'percent',
    excelWidth: 12,
    imageWidth: 120,
    text: (r) => fa(r.percent) + '٪',
    data: [{ header: 'percent', group: 'score', value: (r) => r.percent }]
  }
];

/** متن قاعده‌های امتیاز برای سطر یادآور شیت اکسل */
export function scoringRules(dayCfg: DayConfig): string[] {
  const rules = [SCORING_RULES.habit.short, SCORING_RULES.standardDay.short];
  if (dayCfg.hardLevels > 0) rules.push(SCORING_RULES.hard.short(fa(dayCfg.hardLevels)));
  rules.push(SCORING_RULES.goal.short);
  return rules;
}

/** ستون‌های قابل‌نمایش یک خروجی برای یک روز */
export function visibleColumns(target: ReportTarget, ctx: ReportContext): ReportColumn[] {
  return REPORT_COLUMNS.filter((c) => {
    const cond = c[target];
    return cond ? cond(ctx) : true;
  });
}

export function columnTitle(col: ReportColumn, target: ReportTarget): string {
  return target === 'image' && col.imageTitle ? col.imageTitle : col.title;
}

export function cellText(
  col: ReportColumn,
  row: ReportRow,
  ctx: ReportContext,
  target: ReportTarget
): string {
  return target === 'image' && col.imageText ? col.imageText(row, ctx) : col.text(row, ctx);
}

/** ستون‌های شیت «داده»: ردیف و نام، سپس ورودی‌های خام، سپس امتیازها */
export function dataFields(): DataField[] {
  const all = REPORT_COLUMNS.flatMap((c) => c.data);
  return (['lead', 'input', 'score'] as const).flatMap((g) => all.filter((f) => f.group === g));
}

export function resolveDayConfig(cohort: Cohort, dayN: number): DayConfig {
  return (
    (cohort.days || []).find((d) => d.n === dayN) || {
      n: dayN,
      type: dayN <= 7 ? 'warmup' : dayN >= 29 ? 'review' : 'main',
      hardLevels: 3,
      specialMission: true
    }
  );
}

/** اعضای گروه؛ فریز و خارج فقط اگر خواسته شده باشد */
export function membersOf(cohort: Cohort, group: Group, includeFrozen?: boolean): Participant[] {
  return (cohort.participants || []).filter((p) => {
    if (p.groupId !== group.id) return false;
    if (!includeFrozen && (p.status === 'frozen' || p.status === 'left')) return false;
    return true;
  });
}

export function displayName(p: Participant): string {
  return p.name + (p.status === 'frozen' ? ' (فریز)' : p.status === 'left' ? ' (خارج)' : '');
}

export interface ReportRowsData {
  cohortName: string;
  groupName: string;
  dayN: number;
  dayShamsi: string;
  isClosed: boolean;
  dayCfg: DayConfig;
  ctx: ReportContext;
  rules: string[];
  rows: ReportRow[];
}

/**
 * ردیف‌های گزارش یک روز یک گروه (مشترک بین اکسل و تصویر)
 */
export function buildReportRows(
  cohort: Cohort,
  group: Group,
  dayN: number,
  options?: { includeFrozen?: boolean }
): ReportRowsData {
  const dayCfg = resolveDayConfig(cohort, dayN);
  const isClosed = (group.closedDays || []).indexOf(dayN) !== -1;
  const dayShamsi = Names.formatShamsiShort(Names.addDaysToIso(cohort.startDate, dayN - 1));

  const rows: ReportRow[] = membersOf(cohort, group, options && options.includeFrozen).map((p, idx) => {
    const rec = (cohort.records && cohort.records[p.id] && cohort.records[p.id][dayN]) || null;
    const totals = Scoring.personTotals(p, cohort, group, dayN);
    const hasRecord = !!rec && (rec.done != null || rec.hard != null || rec.special != null);
    return {
      rowNum: idx + 1,
      participantId: p.id,
      name: displayName(p),
      rawName: p.name,
      status: p.status,
      participant: p,
      record: rec,
      hasRecord: hasRecord,
      standardDay: Scoring.standardDay(p, rec, dayCfg),
      dayScore: hasRecord ? Scoring.dayScore(p, rec, dayCfg) : null,
      dayMax: hasRecord ? Scoring.dayMax(p, dayCfg, rec) : null,
      totalScore: totals.totalScore,
      totalMax: totals.totalMax,
      percent: totals.percent,
      breakdown: Scoring.dayBreakdown(p, rec, dayCfg),
      habits: habitStatuses(p, rec)
    };
  });

  return {
    cohortName: cohort.name || '',
    groupName: group.name || '',
    dayN: dayN,
    dayShamsi: dayShamsi,
    isClosed: isClosed,
    dayCfg: dayCfg,
    ctx: { dayCfg: dayCfg, hasHabitNames: rows.some((r) => hasHabitNames(r.participant)) },
    rules: scoringRules(dayCfg),
    rows: rows
  };
}

// ── ماتریس کل دوره (روزها در ستون‌ها) ─────────────────────────────

export const MATRIX_TITLES = {
  rowNum: 'ردیف',
  name: 'نام',
  total: 'مجموع',
  max: 'حداکثر',
  percent: 'درصد',
  /** سرستون لاتین شیت داده */
  dataTotal: 'totalScore',
  dataMax: 'totalMax',
  dataPercent: 'percent'
};

export interface MatrixRow {
  rowNum: number;
  name: string;
  rawName: string;
  /** امتیاز روزهای بسته‌شده؛ برای روز باز null */
  dayScores: (number | null)[];
  totalScore: number;
  totalMax: number;
  percent: number;
}

export interface MatrixData {
  mainDays: DayConfig[];
  rows: MatrixRow[];
}

export function buildCohortMatrix(
  cohort: Cohort,
  group: Group,
  options?: { includeFrozen?: boolean }
): MatrixData {
  const mainDays = (cohort.days || []).filter((d) => d.type === 'main');
  const closed = group.closedDays || [];
  const rows = membersOf(cohort, group, options && options.includeFrozen).map((p, idx) => {
    const totals = Scoring.personTotals(p, cohort, group);
    return {
      rowNum: idx + 1,
      name: displayName(p),
      rawName: p.name,
      dayScores: mainDays.map((d) => {
        if (closed.indexOf(d.n) === -1) return null;
        const rec = (cohort.records && cohort.records[p.id] && cohort.records[p.id][d.n]) || null;
        return Scoring.dayScore(p, rec, d);
      }),
      totalScore: totals.totalScore,
      totalMax: totals.totalMax,
      percent: totals.percent
    };
  });
  return { mainDays: mainDays, rows: rows };
}
