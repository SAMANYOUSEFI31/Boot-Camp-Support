/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Names } from './names';
import type { Cohort, DayConfig, DayRecord, Group, Participant } from './types';

/**
 * ادغام یک دورهٔ فایل بکاپ در یک دورهٔ موجود (چند پشتیبان، یک دید کلی).
 * همهٔ تابع‌ها خالص‌اند: ورودی‌ها را تغییر نمی‌دهند.
 */

export type GroupPolicy = 'current' | 'file' | 'both';
export type Side = 'current' | 'file';
export type PersonField = 'habitCount' | 'status' | 'telegram';

export interface GroupPlan {
  /** «بیاور»؛ پیش‌فرض: فقط گروهی که دست‌کم یک رکورد دارد */
  include: boolean;
  /** شناسهٔ گروه فعلی یا 'new' */
  target: string;
  /** وقتی دو طرف برای یک فرد-روز رکوردِ متفاوت دارند */
  policy: GroupPolicy;
  /** برچسب «گروه من» برای گروهٔ تازه */
  mine: boolean;
}

export interface MergePlan {
  groups: Record<string, GroupPlan>;
  /** انتخاب برای مشخصات متفاوت افراد؛ کلید: fileGroupId|nameKey|field */
  personChoices: Record<string, Side>;
  /** تنظیم روزها از کدام نسخه بماند */
  days: Side;
}

export interface PersonDiff {
  key: string;
  groupId: string;
  name: string;
  field: PersonField;
  current: string;
  file: string;
}

export interface GroupAnalysis {
  fileGroupId: string;
  name: string;
  peopleCount: number;
  recordCount: number;
  hasRecords: boolean;
  fileMine: boolean;
  /** گروه فعلی که با نام تطبیق خورده یا 'new' */
  suggestedTarget: string;
  /** روزهایی که هر دو طرف برای یک فرد رکوردِ متفاوت دارند (فقط وقتی به گروه فعلی وصل است) */
  conflictDays: number[];
  personDiffs: PersonDiff[];
  /** افرادی که در گروه دیگری از دورهٔ فعلی هم هستند (فقط گزارش) */
  overlaps: string[];
}

export interface DaysDiff {
  count: number;
  summary: string[];
}

export interface MergeStats {
  groupsAdded: number;
  peopleAdded: number;
  recordsAdded: number;
  recordsReplaced: number;
  fieldsFilled: number;
  fieldsReplaced: number;
  conflictDays: number;
  overlaps: string[];
  /** هیچ چیز تازه‌ای نیست */
  nothingNew: boolean;
}

export interface MergeResult {
  cohort: Cohort;
  stats: MergeStats;
}

// ───────── کمک‌ها ─────────

const personKey = (p: Participant) => p.nameKey || Names.normalizeName(p.name) || p.name;

/** «۱»، «1»، «گروه ۱»، «گروه 1» یکی گرفته می‌شوند */
export function normalizeGroupName(name: string): string {
  const n = Names.normalizeName(name)
    .replace(/^گروه\s*/, '')
    .trim();
  return n || Names.normalizeName(name);
}

/** نام و تاریخ شروع، با نرمال‌سازی فاصله و ارقام */
export function cohortMatchKey(c: Pick<Cohort, 'name' | 'startDate'>): string {
  return Names.normalizeName(c.name) + '|' + Names.toLatinDigits(String(c.startDate || '')).trim();
}

/** دورهٔ فعلی که پیش‌فرض ادغام است (هم‌شناسه یا هم‌نام و هم‌تاریخ)؛ اندیس یا -1 */
export function findMergeTarget(current: Cohort[], file: Cohort): number {
  for (let i = 0; i < current.length; i++) if (current[i].id === file.id) return i;
  const k = cohortMatchKey(file);
  for (let i = 0; i < current.length; i++) if (cohortMatchKey(current[i]) === k) return i;
  return -1;
}

const isEmptyRec = (r: Partial<DayRecord> | null | undefined) =>
  !r || (r.done == null && r.hard == null && r.special == null);

function sameRec(a: Partial<DayRecord>, b: Partial<DayRecord>) {
  return (
    (a.done ?? null) === (b.done ?? null) &&
    (a.hard ?? null) === (b.hard ?? null) &&
    (a.special ?? null) === (b.special ?? null)
  );
}

const isEmptyField = (field: PersonField, v: unknown) => v == null || v === '';

const STATUS_FA: Record<string, string> = { active: 'فعال', frozen: 'فریز', left: 'خارج‌شده' };
function show(field: PersonField, v: unknown): string {
  if (v == null || v === '') return 'خالی';
  if (field === 'status') return STATUS_FA[String(v)] || String(v);
  if (field === 'habitCount') return Names.toPersianDigits(String(v)) + ' عادت';
  return String(v);
}

function peopleOf(c: Cohort, groupId: string): Participant[] {
  return (c.participants || []).filter((p) => p.groupId === groupId);
}

function recordsOf(c: Cohort, participantId: string): Record<number, DayRecord> {
  return (c.records && c.records[participantId]) || {};
}

function countRecords(c: Cohort, groupId: string): number {
  let n = 0;
  peopleOf(c, groupId).forEach((p) => {
    Object.values(recordsOf(c, p.id)).forEach((r) => {
      if (!isEmptyRec(r)) n++;
    });
  });
  return n;
}

// ───────── تحلیل ─────────

/** تفاوت تنظیم روزها (type, hardLevels, specialMission) */
export function diffDays(current: Cohort, file: Cohort): DaysDiff {
  const cur = new Map((current.days || []).map((d) => [d.n, d]));
  let types = 0;
  let hard = 0;
  let goal = 0;
  let missing = 0;
  (file.days || []).forEach((fd) => {
    const cd = cur.get(fd.n);
    if (!cd) {
      missing++;
      return;
    }
    if (cd.type !== fd.type) types++;
    if (cd.hardLevels !== fd.hardLevels) hard++;
    if (!!cd.specialMission !== !!fd.specialMission) goal++;
  });
  const fa = Names.toPersianDigits;
  const summary: string[] = [];
  if (types) summary.push(fa(types) + ' روز با نوع متفاوت');
  if (hard) summary.push(fa(hard) + ' روز با سطح کار سخت متفاوت');
  if (goal) summary.push(fa(goal) + ' روز با گزارش هدف متفاوت');
  if (missing) summary.push(fa(missing) + ' روز که در دورهٔ فعلی نیست');
  return { count: types + hard + goal + missing, summary: summary };
}

function currentTargetOf(current: Cohort, fg: Group): string {
  const k = normalizeGroupName(fg.name);
  const hit = (current.groups || []).find((g) => normalizeGroupName(g.name) === k);
  return hit ? hit.id : 'new';
}

/** تحلیل هر گروه فایل نسبت به گروه هدف (برای پیش‌نمایش) */
export function analyzeGroups(current: Cohort, file: Cohort, plan: MergePlan): GroupAnalysis[] {
  return (file.groups || []).map((fg) => {
    const filePeople = peopleOf(file, fg.id);
    const recordCount = countRecords(file, fg.id);
    const target = plan.groups[fg.id] ? plan.groups[fg.id].target : currentTargetOf(current, fg);
    const conflictDays = new Set<number>();
    const diffs: PersonDiff[] = [];
    const overlaps: string[] = [];

    const tg = target !== 'new' ? (current.groups || []).find((g) => g.id === target) : null;
    const curPeople = tg ? peopleOf(current, tg.id) : [];
    const curByKey = new Map(curPeople.map((p) => [personKey(p), p]));

    filePeople.forEach((fp) => {
      const cp = curByKey.get(personKey(fp));
      if (cp) {
        (['habitCount', 'status', 'telegram'] as PersonField[]).forEach((field) => {
          const a = cp[field];
          const b = fp[field];
          if (isEmptyField(field, a) || isEmptyField(field, b)) return;
          if (String(a) === String(b)) return;
          diffs.push({
            key: fg.id + '|' + personKey(fp) + '|' + field,
            groupId: fg.id,
            name: fp.name,
            field: field,
            current: show(field, a),
            file: show(field, b)
          });
        });
        const cr = recordsOf(current, cp.id);
        const fr = recordsOf(file, fp.id);
        Object.keys(fr).forEach((d) => {
          const n = Number(d);
          if (!isEmptyRec(fr[n]) && !isEmptyRec(cr[n]) && !sameRec(fr[n], cr[n])) conflictDays.add(n);
        });
      } else {
        // در دورهٔ فعلی در گروه دیگری هست؟
        const other = (current.participants || []).find(
          (p) => personKey(p) === personKey(fp) && (!tg || p.groupId !== tg.id)
        );
        if (other) overlaps.push(fp.name);
      }
    });

    return {
      fileGroupId: fg.id,
      name: fg.name,
      peopleCount: filePeople.length,
      recordCount: recordCount,
      hasRecords: recordCount > 0,
      fileMine: fg.mine !== false,
      suggestedTarget: currentTargetOf(current, fg),
      conflictDays: Array.from(conflictDays).sort((a, b) => a - b),
      personDiffs: diffs,
      overlaps: overlaps
    };
  });
}

/** برنامهٔ پیش‌فرض: گروه‌های دارای رکورد روشن، بقیه خاموش؛ تطبیق با نام؛ تنظیم روزها از نسخهٔ فعلی */
export function defaultPlan(current: Cohort, file: Cohort): MergePlan {
  const groups: Record<string, GroupPlan> = {};
  (file.groups || []).forEach((fg) => {
    groups[fg.id] = {
      include: countRecords(file, fg.id) > 0,
      target: currentTargetOf(current, fg),
      policy: 'current',
      // گروه‌های اضافه‌شده در دید کلی دورهٔ مالک دیده شوند
      mine: true
    };
  });
  return { groups: groups, personChoices: {}, days: 'current' };
}

// ───────── ادغام ─────────

type IdMaker = (prefix: string) => string;
let counter = 0;
const defaultId: IdMaker = (prefix) =>
  prefix + '_' + Date.now() + '_' + ++counter + Math.random().toString(36).slice(2, 5);

/**
 * فایل را در دورهٔ فعلی ادغام می‌کند.
 *  - گروهِ جدید همراه افراد، رکوردها و closedDays اضافه می‌شود.
 *  - برای گروه وصل‌شده: اجتماع افراد و رکوردها؛ فقط فرد-روزِ متفاوت تعارض است
 *    و با policy حل می‌شود: current | file (برای هر روز تعارضی نسخهٔ فایل) | both (نسخهٔ فایل با ـ۲ جدا).
 *  - مشخصات فرد: مقدار خالی با مقدار پر پر می‌شود؛ مقدارهای متفاوت طبق personChoices (پیش‌فرض: فعلی).
 */
export function mergeIntoCohort(
  currentIn: Cohort,
  fileIn: Cohort,
  plan: MergePlan,
  makeId?: IdMaker
): MergeResult {
  const newId = makeId || defaultId;
  const cur: Cohort = JSON.parse(JSON.stringify(currentIn));
  const file: Cohort = JSON.parse(JSON.stringify(fileIn));
  cur.records = cur.records || {};
  const stats: MergeStats = {
    groupsAdded: 0,
    peopleAdded: 0,
    recordsAdded: 0,
    recordsReplaced: 0,
    fieldsFilled: 0,
    fieldsReplaced: 0,
    conflictDays: 0,
    overlaps: [],
    nothingNew: false
  };

  // تنظیم روزها
  if (plan.days === 'file' && (file.days || []).length) {
    const byN = new Map((cur.days || []).map((d) => [d.n, d]));
    (file.days || []).forEach((fd: DayConfig) => {
      byN.set(fd.n, fd);
    });
    cur.days = Array.from(byN.values()).sort((a, b) => a.n - b.n);
  }

  const addAsNewGroup = (fg: Group, name: string, mine: boolean) => {
    const g: Group = {
      id: newId('grp'),
      name: name,
      order: (cur.groups || []).length + 1,
      mine: mine,
      closedDays: (fg.closedDays || []).slice()
    };
    cur.groups.push(g);
    stats.groupsAdded++;
    peopleOf(file, fg.id).forEach((fp) => {
      const np: Participant = { ...fp, id: newId('p'), nameKey: personKey(fp), groupId: g.id };
      if ((cur.participants || []).some((p) => personKey(p) === personKey(np))) stats.overlaps.push(fp.name);
      cur.participants.push(np);
      stats.peopleAdded++;
      const recs = recordsOf(file, fp.id);
      Object.keys(recs).forEach((d) => {
        if (isEmptyRec(recs[Number(d)])) return;
        cur.records[np.id] = cur.records[np.id] || {};
        cur.records[np.id][Number(d)] = { ...recs[Number(d)] };
        stats.recordsAdded++;
      });
    });
  };

  const copySuffix = (name: string) => {
    let n = 2;
    let out = '';
    do {
      out = name + ' ـ' + Names.toPersianDigits(n++);
    } while (cur.groups.some((g) => g.name === out));
    return out;
  };

  (file.groups || []).forEach((fg) => {
    const gp = plan.groups[fg.id];
    if (!gp || !gp.include) return;

    const tg = gp.target !== 'new' ? cur.groups.find((g) => g.id === gp.target) : undefined;
    if (!tg) {
      addAsNewGroup(fg, fg.name, gp.mine);
      return;
    }
    if (gp.policy === 'both') {
      // فقط اگر تعارض واقعی هست نسخهٔ جدا می‌سازد؛ وگرنه اجتماع عادی
      const probe = analyzeGroups(cur, file, {
        ...plan,
        groups: { ...plan.groups, [fg.id]: { ...gp, target: tg.id } }
      }).find((a) => a.fileGroupId === fg.id);
      if (probe && probe.conflictDays.length) {
        addAsNewGroup(fg, copySuffix(tg.name), gp.mine);
        return;
      }
    }

    const curByKey = new Map(peopleOf(cur, tg.id).map((p) => [personKey(p), p]));
    peopleOf(file, fg.id).forEach((fp) => {
      const cp = curByKey.get(personKey(fp));
      const frecs = recordsOf(file, fp.id);
      if (!cp) {
        const np: Participant = { ...fp, id: newId('p'), nameKey: personKey(fp), groupId: tg.id };
        if ((cur.participants || []).some((p) => personKey(p) === personKey(np)))
          stats.overlaps.push(fp.name);
        cur.participants.push(np);
        stats.peopleAdded++;
        Object.keys(frecs).forEach((d) => {
          if (isEmptyRec(frecs[Number(d)])) return;
          cur.records[np.id] = cur.records[np.id] || {};
          cur.records[np.id][Number(d)] = { ...frecs[Number(d)] };
          stats.recordsAdded++;
        });
        return;
      }

      // مشخصات فرد
      (['habitCount', 'status', 'telegram'] as PersonField[]).forEach((field) => {
        const a = cp[field];
        const b = fp[field];
        if (isEmptyField(field, a) && !isEmptyField(field, b)) {
          (cp as unknown as Record<string, unknown>)[field] = b;
          stats.fieldsFilled++;
        } else if (!isEmptyField(field, a) && !isEmptyField(field, b) && String(a) !== String(b)) {
          const choice = plan.personChoices[fg.id + '|' + personKey(fp) + '|' + field] || 'current';
          if (choice === 'file') {
            (cp as unknown as Record<string, unknown>)[field] = b;
            stats.fieldsReplaced++;
          }
        }
      });

      // رکوردها: اجتماع، و تعارض روز‌به‌روز
      Object.keys(frecs).forEach((d) => {
        const n = Number(d);
        const fr = frecs[n];
        if (isEmptyRec(fr)) return;
        const existing = cur.records[cp.id] && cur.records[cp.id][n];
        if (isEmptyRec(existing)) {
          cur.records[cp.id] = cur.records[cp.id] || {};
          cur.records[cp.id][n] = { ...fr };
          stats.recordsAdded++;
        } else if (!sameRec(existing as DayRecord, fr)) {
          stats.conflictDays++;
          if (gp.policy === 'file') {
            cur.records[cp.id][n] = { ...fr };
            stats.recordsReplaced++;
          }
        }
      });
    });

    // روزهای بسته‌شده: اجتماع
    const closed = new Set([...(tg.closedDays || []), ...(fg.closedDays || [])]);
    const merged = Array.from(closed).sort((a, b) => a - b);
    if (merged.length !== (tg.closedDays || []).length) stats.fieldsFilled++;
    tg.closedDays = merged;
  });

  stats.nothingNew =
    stats.groupsAdded === 0 &&
    stats.peopleAdded === 0 &&
    stats.recordsAdded === 0 &&
    stats.recordsReplaced === 0 &&
    stats.fieldsFilled === 0 &&
    stats.fieldsReplaced === 0 &&
    JSON.stringify(cur.days) === JSON.stringify(currentIn.days);
  return { cohort: cur, stats: stats };
}
