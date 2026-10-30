import { test } from 'vitest';
import assert from 'node:assert/strict';
import { Store } from './store';
import type { AppState, Cohort } from './types';

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
  assert.equal(res.data.schemaVersion, 2);
  assert.equal(c.days[0].specialMission, false);
  assert.equal(c.days[1].specialMission, true);
  assert.deepEqual(c.records, old.cohorts[0].records);
});
