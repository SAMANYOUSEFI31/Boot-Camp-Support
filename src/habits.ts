/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Names } from './names';
import type { DayRecord, Participant } from './types';

/**
 * عادت‌های نام‌دار هر فرد.
 * - Participant.habits: نام عادت‌ها به ترتیب (اختیاری)
 * - DayRecord.doneHabits: اندیس (از ۰) عادت‌های انجام‌شدهٔ آن روز؛ done همیشه تعداد همین‌هاست.
 * رکورد قدیمی فقط done دارد: «چند تا» معلوم است ولی «کدام‌ها» نه.
 */

export const MAX_HABITS = 4;
export const MAX_HABIT_NAME = 24;

export type HabitState = 'done' | 'missed' | 'unknown' | 'none';

export interface HabitStatus {
  index: number;
  /** نام نوشته‌شده یا «عادت N» */
  label: string;
  named: boolean;
  /**
   * done/missed: کدام‌ها ثبت شده؛ unknown: فقط تعداد ثبت شده؛ none: هنوز چیزی ثبت نشده
   */
  state: HabitState;
}

export function cleanHabitNames(names: unknown): string[] {
  if (!Array.isArray(names)) return [];
  return names.slice(0, MAX_HABITS).map((n) => String(n == null ? '' : n).replace(/\s+/g, ' ').trim().slice(0, MAX_HABIT_NAME));
}

export function habitCapOf(p: Pick<Participant, 'habitCount'>): number {
  const n = p.habitCount == null ? 0 : parseInt(String(p.habitCount), 10);
  return Math.max(0, Math.min(MAX_HABITS, isNaN(n) ? 0 : n));
}

/** نام نمایشی عادت شمارهٔ i (از ۰) */
export function habitLabel(p: Pick<Participant, 'habits'>, i: number): { label: string; named: boolean } {
  const raw = p.habits && p.habits[i] ? String(p.habits[i]).trim() : '';
  return raw ? { label: raw, named: true } : { label: 'عادت ' + Names.toPersianDigits(i + 1), named: false };
}

/** آیا دست‌کم یکی از عادت‌های این فرد (در حد تعدادش) اسم دارد؟ */
export function hasHabitNames(p: Pick<Participant, 'habits' | 'habitCount'>): boolean {
  const cap = habitCapOf(p);
  for (let i = 0; i < cap; i++) if (p.habits && p.habits[i] && String(p.habits[i]).trim()) return true;
  return false;
}

/** اندیس‌های انجام‌شده (یکتا و در حد تعداد عادت)، یا null اگر رکورد قدیمی فقط تعداد دارد */
export function doneIndexes(
  p: Pick<Participant, 'habitCount'>,
  rec: Partial<DayRecord> | null | undefined
): number[] | null {
  if (!rec || !Array.isArray(rec.doneHabits)) return null;
  const cap = habitCapOf(p);
  const set = new Set<number>();
  rec.doneHabits.forEach((v) => {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 0 && n < cap) set.add(n);
  });
  return Array.from(set).sort((a, b) => a - b);
}

/** وضعیت هر عادت فرد در یک روز (برای رابط، تصویر و Excel) */
export function habitStatuses(
  p: Pick<Participant, 'habits' | 'habitCount'>,
  rec: Partial<DayRecord> | null | undefined
): HabitStatus[] {
  const cap = habitCapOf(p);
  const idx = doneIndexes(p, rec);
  const recorded = !!rec && (rec.done != null || Array.isArray(rec.doneHabits));
  const out: HabitStatus[] = [];
  for (let i = 0; i < cap; i++) {
    const l = habitLabel(p, i);
    let state: HabitState = 'none';
    if (recorded) state = idx ? (idx.indexOf(i) !== -1 ? 'done' : 'missed') : 'unknown';
    out.push({ index: i, label: l.label, named: l.named, state: state });
  }
  return out;
}
