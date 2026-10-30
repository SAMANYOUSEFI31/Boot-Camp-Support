import { test } from 'vitest';
import assert from 'node:assert/strict';
import { Store } from './store';
import { Scoring } from './scoring';
import { cleanHabitNames, doneIndexes, habitStatuses, hasHabitNames } from './habits';
import { buildReportRows } from './report-columns';
import { defaultPlan, mergeIntoCohort } from './merge-groups';
import type { Cohort } from './types';

const day = { n: 8, type: 'main' as const, hardLevels: 2, specialMission: true };

function cohort(): Cohort {
  return {
    id: 'c',
    name: 'دوره',
    startDate: '2026-10-23',
    archived: false,
    days: [day],
    groups: [{ id: 'g', name: 'گروه ۱', order: 1, mine: true, closedDays: [] }],
    participants: [
      {
        id: 'p1',
        name: 'سمیه',
        nameKey: 'سمیه',
        telegram: '',
        groupId: 'g',
        status: 'active',
        habitCount: 3,
        habits: ['مطالعه', 'ورزش', '']
      },
      { id: 'p2', name: 'علی', nameKey: 'علی', telegram: '', groupId: 'g', status: 'active', habitCount: 2 }
    ],
    records: {}
  };
}

test('وضعیت هر عادت: انجام شد، نشد، فقط تعداد (قدیمی) و ثبت‌نشده؛ اسم پیش‌فرض «عادت N»', () => {
  const p = cohort().participants[0];
  assert.equal(hasHabitNames(p), true);
  const s = habitStatuses(p, { done: 2, hard: null, special: null, doneHabits: [0, 2] });
  assert.deepEqual(
    s.map((h) => h.state),
    ['done', 'missed', 'done']
  );
  assert.deepEqual(
    s.map((h) => h.label),
    ['مطالعه', 'ورزش', 'عادت ۳']
  );
  assert.deepEqual(
    habitStatuses(p, { done: 2, hard: null, special: null }).map((h) => h.state),
    ['unknown', 'unknown', 'unknown']
  );
  assert.deepEqual(
    habitStatuses(p, null).map((h) => h.state),
    ['none', 'none', 'none']
  );
  assert.deepEqual(doneIndexes(p, { doneHabits: [0, 0, 5, -1, 1] }), [0, 1]); // تکراری و بیرون از تعداد نادیده
  assert.deepEqual(
    cleanHabitNames([' الف  ب ', 'x'.repeat(40), 1, 2, 3, 4, 5]).map((x) => x.length),
    [5, 24, 1, 1]
  );
});

test('امتیاز از روی عادت‌های ثبت‌شدهٔ تک‌تک حساب می‌شود (روز استاندارد فقط با همهٔ آن‌ها)', () => {
  const p = cohort().participants[0];
  const two = { done: 2, hard: null, special: null, doneHabits: [0, 1] };
  assert.equal(Scoring.dayScore(p, two, day), 2);
  const all = { done: 3, hard: null, special: null, doneHabits: [0, 1, 2] };
  assert.equal(Scoring.dayScore(p, all, day), 5); // ۳ عادت + ۲ روز استاندارد
  // done قدیمی ناهمخوان با فهرست: فهرست معتبر است
  assert.equal(Scoring.dayScore(p, { done: 3, hard: null, special: null, doneHabits: [1] }, day), 1);
});

test('toggleHabit: روشن/خاموش‌کردن هر عادت، done هم‌گام؛ «همهٔ عادت‌ها» و «پاک کردن» فهرست را درست می‌کنند', () => {
  const st = Store.getState();
  st.cohorts = [cohort()];
  Store.toggleHabit('c', 'p1', 8, 0);
  Store.toggleHabit('c', 'p1', 8, 2);
  let rec = st.cohorts[0].records.p1[8];
  assert.deepEqual(rec.doneHabits, [0, 2]);
  assert.equal(rec.done, 2);
  Store.toggleHabit('c', 'p1', 8, 0);
  rec = st.cohorts[0].records.p1[8];
  assert.deepEqual(rec.doneHabits, [2]);
  assert.equal(rec.done, 1);
  Store.toggleHabit('c', 'p1', 8, 9); // خارج از تعداد: بی‌اثر
  assert.deepEqual(st.cohorts[0].records.p1[8].doneHabits, [2]);

  Store.batchRecordDay('c', 'g', 8, 'all_habits_done');
  assert.deepEqual(st.cohorts[0].records.p1[8].doneHabits, [0, 1, 2]);
  assert.deepEqual(st.cohorts[0].records.p2[8].doneHabits, [0, 1]);
  Store.batchRecordDay('c', 'g', 8, 'clear_day');
  assert.equal(st.cohorts[0].records.p1[8].doneHabits, undefined);
  assert.equal(st.cohorts[0].records.p1[8].done, null);

  // ثبت دستی تعداد (روش قدیمی) فهرست را بی‌اعتبار می‌کند
  Store.toggleHabit('c', 'p1', 8, 1);
  Store.recordDaily('c', 'p1', 8, { done: 3 });
  assert.equal(st.cohorts[0].records.p1[8].doneHabits, undefined);
});

test('نام عادت‌ها در ذخیرهٔ فرد تمیز می‌شود و گزارش‌ها کدام عادت را نشان می‌دهند', () => {
  const st = Store.getState();
  st.cohorts = [cohort()];
  Store.updateParticipant('c', 'p2', { habits: ['  دعا ', 'خواب'] });
  assert.deepEqual(st.cohorts[0].participants[1].habits, ['دعا', 'خواب']);
  Store.updateParticipant('c', 'p2', { habits: ['', ''] });
  assert.equal(st.cohorts[0].participants[1].habits, undefined);

  const c = cohort();
  c.records = { p1: { 8: { done: 1, hard: null, special: null, doneHabits: [1] } } };
  const rep = buildReportRows(c, c.groups[0], 8);
  assert.equal(rep.ctx.hasHabitNames, true);
  const row = rep.rows[0];
  assert.deepEqual(
    row.habits.map((h) => h.state),
    ['missed', 'done', 'missed']
  );
  assert.equal(row.dayScore, 1);
});

test('ادغام بکاپ: نام عادت‌ها و عادت‌های انجام‌شده از طرف دیگر پر می‌شود؛ رکورد یکسان تعارض نیست', () => {
  const cur = cohort();
  cur.participants[0].habits = undefined; // فعلی اسم ندارد
  cur.records = { p1: { 8: { done: 1, hard: null, special: null, doneHabits: [0] } } };
  const file = cohort();
  file.records = { p1: { 8: { done: 1, hard: null, special: null, doneHabits: [0] } } };
  const r = mergeIntoCohort(cur, file, defaultPlan(cur, file));
  assert.deepEqual(r.cohort.participants[0].habits, ['مطالعه', 'ورزش', '']);
  assert.equal(r.stats.conflictDays, 0);
  // کدام عادت فرق دارد ← تعارض
  file.records.p1[8].doneHabits = [1];
  const r2 = mergeIntoCohort(cur, file, defaultPlan(cur, file));
  assert.equal(r2.stats.conflictDays, 1);
});
