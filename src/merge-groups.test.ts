import { test } from 'vitest';
import assert from 'node:assert/strict';
import { Store } from './store';
import {
  analyzeGroups,
  cohortMatchKey,
  defaultPlan,
  diffDays,
  findMergeTarget,
  mergeIntoCohort,
  normalizeGroupName
} from './merge-groups';
import type { AppState, Cohort } from './types';

let seq = 0;
const ids = () => 'id' + ++seq;

function person(id: string, name: string, groupId: string, extra: Partial<Cohort['participants'][0]> = {}) {
  return {
    id,
    name,
    nameKey: name,
    telegram: '',
    groupId,
    status: 'active' as const,
    habitCount: 2,
    ...extra
  };
}
function cohort(over: Partial<Cohort>): Cohort {
  return {
    id: 'c',
    name: 'دوره آبان',
    startDate: '2026-10-23',
    archived: false,
    days: [{ n: 8, type: 'main', hardLevels: 3, specialMission: true }],
    groups: [],
    participants: [],
    records: {},
    ...over
  };
}
const rec = (done: number, hard: number | null = null, special: number | null = null) => ({
  done,
  hard,
  special
});

// پشتیبان ۱: گروه ۱ با رکورد؛ گروه ۲ خالی
const supporterA = () =>
  cohort({
    groups: [
      { id: 'a1', name: 'گروه ۱', order: 1, mine: true, closedDays: [8] },
      { id: 'a2', name: 'گروه ۲', order: 2, mine: false, closedDays: [] }
    ],
    participants: [person('pa1', 'سمیه سعدی', 'a1'), person('pa2', 'علی رضایی', 'a2')],
    records: { pa1: { 8: rec(2, 1, 1) } }
  });
// پشتیبان ۲: گروه ۳ با رکورد و گروه ۲ بدون رکورد
const supporterB = () =>
  cohort({
    id: 'other',
    groups: [
      { id: 'b3', name: 'گروه 3', order: 1, mine: true, closedDays: [8] },
      { id: 'b2', name: 'گروه 2', order: 2, mine: false, closedDays: [] }
    ],
    participants: [person('pb1', 'مریم احمدی', 'b3'), person('pb2', 'علی رضایی', 'b2')],
    records: { pb1: { 8: rec(1) } }
  });

test('تطبیق نام گروه: «۱»، «1»، «گروه ۱»، «گروه 1» یکی‌اند؛ نام دوره با ارقام فارسی/لاتین', () => {
  const k = normalizeGroupName('گروه ۱');
  assert.equal(normalizeGroupName('1'), k);
  assert.equal(normalizeGroupName('۱'), k);
  assert.equal(normalizeGroupName('گروه 1'), k);
  assert.equal(
    cohortMatchKey({ name: 'دوره  ۱۴۰۵', startDate: '2026-10-23' }),
    cohortMatchKey({ name: 'دوره 1405', startDate: '2026-10-23' })
  );
  assert.equal(findMergeTarget([supporterA()], { ...supporterB(), name: ' دوره آبان ' }), 0);
});

test('گروه جدید همراه افراد، رکوردها و closedDays اضافه می‌شود؛ گروه بدون رکورد پیش‌فرض خاموش است', () => {
  const cur = supporterA();
  const file = supporterB();
  const plan = defaultPlan(cur, file);
  assert.equal(plan.groups.b3.include, true);
  assert.equal(plan.groups.b3.target, 'new');
  assert.equal(plan.groups.b2.include, false);
  assert.equal(plan.groups.b2.target, 'a2'); // «گروه 2» با «گروه ۲» یکی شد
  const { cohort: out, stats } = mergeIntoCohort(cur, file, plan, ids);
  assert.equal(out.groups.length, 3);
  const g = out.groups.find((x) => x.name === 'گروه 3');
  assert.ok(g);
  assert.deepEqual(g!.closedDays, [8]);
  const p = out.participants.find((x) => x.name === 'مریم احمدی');
  assert.ok(p && p.groupId === g!.id);
  assert.equal(out.records[p!.id][8].done, 1);
  assert.equal(stats.groupsAdded, 1);
  assert.equal(stats.recordsAdded, 1);
  assert.equal(cur.groups.length, 2); // ورودی دست نخورد
});

test('ورود دوبارهٔ همان فایل: چیز تازه‌ای نیست و تعارض حساب نمی‌شود', () => {
  const cur = supporterA();
  const again = supporterA();
  const r = mergeIntoCohort(
    cur,
    again,
    {
      ...defaultPlan(cur, again),
      groups: {
        a1: { include: true, target: 'a1', policy: 'current', mine: true },
        a2: { include: true, target: 'a2', policy: 'current', mine: true }
      }
    },
    ids
  );
  assert.equal(r.stats.nothingNew, true);
  assert.equal(r.stats.conflictDays, 0);
  assert.deepEqual(r.cohort, cur);
});

test('گروهی که فقط یک طرف رکورد دارد پر می‌شود و habitCount خالی از طرف دیگر می‌آید', () => {
  const cur = supporterA();
  cur.groups[0].closedDays = [];
  cur.records = {}; // گروه فعلی رکوردی ندارد
  cur.participants[0].habitCount = null;
  const file = supporterA();
  const plan = defaultPlan(cur, file);
  assert.equal(plan.groups.a1.target, 'a1');
  const { cohort: out, stats } = mergeIntoCohort(cur, file, plan, ids);
  assert.equal(out.participants.find((p) => p.name === 'سمیه سعدی')!.habitCount, 2);
  assert.equal(out.records.pa1[8].done, 2);
  assert.deepEqual(out.groups[0].closedDays, [8]);
  assert.equal(stats.fieldsFilled >= 1, true);
  assert.equal(stats.recordsAdded, 1);
});

test('تعارض روزی: پیش‌فرض رونویسی نمی‌شود؛ «نسخهٔ فایل» فقط روز تعارضی را می‌آورد؛ «هر دو» گروه ـ۲ می‌سازد', () => {
  const cur = supporterA();
  cur.records.pa1[9] = rec(1); // روزی که فقط در فعلی است
  const file = supporterA();
  file.records.pa1 = { 8: rec(0), 10: rec(2) }; // روز ۸ تعارض؛ روز ۱۰ فقط فایل
  const base = defaultPlan(cur, file);
  const a = analyzeGroups(cur, file, base).find((x) => x.fileGroupId === 'a1')!;
  assert.deepEqual(a.conflictDays, [8]);

  const keep = mergeIntoCohort(cur, file, base, ids).cohort;
  assert.equal(keep.records.pa1[8].done, 2); // نسخهٔ فعلی ماند
  assert.equal(keep.records.pa1[10].done, 2); // روز تازه آمد
  assert.equal(keep.records.pa1[9].done, 1);

  const take = mergeIntoCohort(
    cur,
    file,
    { ...base, groups: { ...base.groups, a1: { ...base.groups.a1, policy: 'file' } } },
    ids
  ).cohort;
  assert.equal(take.records.pa1[8].done, 0);
  assert.equal(take.records.pa1[9].done, 1); // روزِ فقط-فعلی پاک نشد

  const both = mergeIntoCohort(
    cur,
    file,
    { ...base, groups: { ...base.groups, a1: { ...base.groups.a1, policy: 'both' } } },
    ids
  ).cohort;
  assert.ok(both.groups.some((g) => g.name === 'گروه ۱ ـ۲'));
  assert.equal(both.records.pa1[8].done, 2);
});

test('مشخصات متفاوت فرد پرسیده می‌شود؛ تنظیم روزها خلاصه می‌شود؛ ادغام در mergeCohorts با targets کار می‌کند', () => {
  const cur = supporterA();
  const file = supporterA();
  file.participants[0].status = 'frozen';
  file.days = [{ n: 8, type: 'main', hardLevels: 2, specialMission: true }];
  const plan = defaultPlan(cur, file);
  const diff = analyzeGroups(cur, file, plan).find((x) => x.fileGroupId === 'a1')!.personDiffs;
  assert.equal(diff.length, 1);
  assert.equal(diff[0].field, 'status');
  assert.deepEqual(diffDays(cur, file).summary, ['۱ روز با سطح کار سخت متفاوت']);

  const st: AppState = {
    schemaVersion: 2,
    activeCohortId: 'c',
    lastBackupAt: null,
    lastChangeAt: '',
    cohorts: [cur]
  };
  const r = Store.mergeCohorts(st, [file], {
    targets: { 0: 'c' },
    plans: { 0: { ...plan, days: 'file', personChoices: { [diff[0].key]: 'file' } } },
    newId: ids
  });
  assert.equal(r.report.merged.length, 1);
  assert.equal(r.state.cohorts.length, 1);
  assert.equal(r.state.cohorts[0].participants[0].status, 'frozen');
  assert.equal(r.state.cohorts[0].days[0].hardLevels, 2);
});
