import { test } from 'vitest';
import assert from 'node:assert/strict';
import { Store } from './store';
import type { AppState, Cohort } from './types';
import { donationScore, donationTotal, membership } from './membership';

function cohort(id: string, name: string, startDate = '2026-10-01'): Cohort {
  return {
    id,
    name,
    startDate,
    archived: false,
    days: [],
    groups: [{ id: 'g1', name: 'گروه ۱', order: 1, mine: true, closedDays: [] }],
    participants: [
      { id: 'p1', name: 'الف', nameKey: 'الف', telegram: '', groupId: 'g1', status: 'active', habitCount: 3 }
    ],
    records: { p1: { 1: { done: 2, hard: null, special: null } } }
  };
}
const state = (...cohorts: Cohort[]): AppState => ({
  schemaVersion: 1,
  activeCohortId: cohorts[0] ? cohorts[0].id : null,
  lastBackupAt: null,
  lastChangeAt: '2026-10-30T00:00:00.000Z',
  cohorts
});

test('تغییر نام دورهٔ ورودی: نام تازه اعمال می‌شود و ورودی دست نمی‌خورد', () => {
  const incoming = [cohort('x', 'مهر')];
  const r = Store.mergeCohorts(state(), incoming, { rename: { 0: '  مهر ۱۴۰۵ ' } });
  assert.equal(r.state.cohorts[0].name, 'مهر ۱۴۰۵');
  assert.equal(incoming[0].name, 'مهر');
});

test('تغییر نام، تکراری‌بودن را حل می‌کند: با نام تازه دورهٔ جدا اضافه می‌شود', () => {
  const current = state(cohort('a', 'مهر'));
  // همان نام و تاریخ: تکراری است و پیش‌فرض رد می‌شود
  assert.equal(Store.mergeCohorts(current, [cohort('b', 'مهر')], {}).report.skipped.length, 1);
  // با نام تازه تکراری نیست
  const r = Store.mergeCohorts(current, [cohort('b', 'مهر')], { rename: { 0: 'مهر - گروه دوم' } });
  assert.equal(r.report.added.length, 1);
  assert.equal(r.state.cohorts.length, 2);
});

test('نسخهٔ جدا: پسوند فقط وقتی لازم است که نام از قبل گرفته شده باشد', () => {
  const current = state(cohort('a', 'مهر'));
  const same = Store.mergeCohorts(current, [cohort('a', 'مهر')], {
    decisions: { 0: 'copy' },
    newId: () => 'n1'
  });
  assert.notEqual(same.state.cohorts[1].name, 'مهر');
  const renamed = Store.mergeCohorts(current, [cohort('a', 'مهر')], {
    decisions: { 0: 'copy' },
    rename: { 0: 'مهر - کپی من' },
    newId: () => 'n2'
  });
  assert.equal(renamed.state.cohorts[1].name, 'مهر - کپی من');
  assert.equal(renamed.state.cohorts[1].participants.length, 1);
});

test('مهاجرت به نسخهٔ ۲: گزارش هدف در روزهای main فعال می‌شود و رکوردها دست‌نخورده می‌مانند', () => {
  const old = state(cohort('c1', 'قدیمی'));
  old.schemaVersion = 1;
  old.cohorts[0].days = [
    { n: 1, type: 'warmup', hardLevels: 0, specialMission: false },
    { n: 8, type: 'main', hardLevels: 3, specialMission: false }
  ];
  const res = Store.validateBackup(JSON.parse(JSON.stringify(old)));
  assert.ok(res.ok);
  if (!res.ok) return;
  const c = res.data.cohorts[0];
  assert.equal(res.data.schemaVersion, 4);
  assert.equal(c.days[0].specialMission, false);
  assert.equal(c.days[1].specialMission, true);
  assert.deepEqual(c.records, old.cohorts[0].records);
});

function freshCohort() {
  const c = cohort('rules', 'قانون جدید');
  c.days = Array.from({ length: 12 }, (_, i) => ({
    n: i + 1, type: 'main' as const, hardLevels: 3, specialMission: true
  }));
  c.records = {};
  c.participants[0].habitCount = 5;
  c.participants[0].habits = ['تنظیم خواب', 'مطالعه', 'ورزش', 'ژورنال‌نویسی', ''];
  Store.getState().cohorts = [c];
  return c;
}

test('هر روز ناقص یک اخطار؛ بعد از سه اخطار خروج و خریدهای نامحدود با هر بار یک جان', () => {
  const c = freshCohort();
  const p = c.participants[0];
  for (let day = 1; day <= 3; day++) {
    Store.recordDaily(c.id, p.id, day, { doneHabits: day === 1 ? [0, 1, 2] : [], done: 0 });
    Store.toggleCloseDay(c.id, 'g1', day, true);
    Store.toggleCloseDay(c.id, 'g1', day, true);
    assert.equal(membership(p).warnings, day);
  }
  assert.equal(p.status, 'left');
  assert.equal(p.expelledForWarnings, true);
  for (let day = 4; day <= 12; day++) {
    assert.throws(() => Store.recordPayment(c.id, p.id, 'life', 200000, day));

    assert.equal(p.status, 'left');

    assert.equal(membership(p).remaining, 0);

    assert.equal(donationScore(p), 0);
  }
  assert.deepEqual(p.lifePayments ?? [], []);
});

test('عادت پنجم اخطار ندارد؛ فریز و خارج در بستن روز تازه اخطار نمی‌گیرند', () => {
  const c = freshCohort();
  const p = c.participants[0];
  Store.recordDaily(c.id, p.id, 1, { doneHabits: [0, 1, 2, 3], done: 4 });
  Store.toggleCloseDay(c.id, 'g1', 1, true);
  assert.equal(membership(p).warnings, 0);
  p.status = 'frozen';
  Store.toggleCloseDay(c.id, 'g1', 2, true);
  p.status = 'left';
  Store.toggleCloseDay(c.id, 'g1', 3, true);
  assert.equal(membership(p).warnings, 0);
});

test('باز کردن و بستن روز اخطار تکراری نمی‌سازد؛ اصلاح روز بسته خروج را برمی‌گرداند', () => {
  const c = freshCohort();
  const p = c.participants[0];
  for (let day = 1; day <= 3; day++) Store.toggleCloseDay(c.id, 'g1', day, true);
  assert.equal(p.status, 'left');
  Store.toggleCloseDay(c.id, 'g1', 3, false);
  assert.equal(membership(p).warnings, 2);
  assert.equal(p.status, 'active');
  Store.toggleCloseDay(c.id, 'g1', 3, true);
  assert.equal(membership(p).warnings, 3);
  Store.recordDaily(c.id, p.id, 2, { doneHabits: [0, 1, 2, 3], done: 4 });
  assert.equal(membership(p).warnings, 2);
  assert.equal(p.status, 'active');
});

test('دونیت سقف قطعی دارد؛ مبالغ کوچک جمع می‌شوند و پرداخت نامعتبر هیچ تغییری نمی‌دهد', () => {
  const c = freshCohort();
  const p = c.participants[0];
  Store.recordPayment(c.id, p.id, 'donation', 100000, 1);
  assert.equal(donationScore(p), 0);
  Store.recordPayment(c.id, p.id, 'donation', 100000, 2);
  assert.equal(donationScore(p), 1);
  Store.recordPayment(c.id, p.id, 'donation', 800000, 3);
  assert.equal(donationTotal(p), 1000000);
  assert.equal(donationScore(p), 5);
  const before = JSON.stringify(p);
  for (const amount of [1, -1, 0, 1.5, NaN]) {
    assert.throws(() => Store.recordPayment(c.id, p.id, 'donation', amount, 4));
    assert.equal(JSON.stringify(p), before);
  }
  assert.throws(() => Store.recordPayment(c.id, p.id, 'life', 200000, 4));
});

test('بکاپ نسخهٔ جدید، پرداخت‌ها و اخطارها را حفظ و پرداخت ناسالم را رد می‌کند', () => {
  const c = freshCohort();
  for (let day = 1; day <= 3; day++) Store.toggleCloseDay(c.id, 'g1', day, true);
  Store.recordPayment(c.id, 'p1', 'donation', 400000, 4);
  const backup = { ...state(c), schemaVersion: 3 };
  const result = Store.validateBackup(JSON.parse(JSON.stringify(backup)));
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.data.cohorts[0].participants[0], c.participants[0]);
  const bad = JSON.parse(JSON.stringify(backup));
  bad.cohorts[0].participants[0].donations[0].amount = 1000001;
  assert.equal(Store.validateBackup(bad).ok, false);
});

test('پس از اصلاح روزهای قدیمی، خرید جان همچنان دقیقاً یک اخطار جدید را پوشش می‌دهد', () => {
  const c = freshCohort();
  const p = c.participants[0];
  for (let day = 1; day <= 4; day++) {
    Store.recordDaily(c.id, p.id, day, { done: 4, doneHabits: [0, 1, 2, 3] });
    Store.toggleCloseDay(c.id, 'g1', day, true);
  }
  for (let day = 1; day <= 4; day++) Store.recordDaily(c.id, p.id, day, { done: 0, doneHabits: [] });
  assert.equal(membership(p).warnings, 4);

  assert.throws(() => Store.recordPayment(c.id, p.id, 'life', 200000, 5));

  assert.equal(membership(p).remaining, 0);

  assert.equal(p.status, 'left');
});
