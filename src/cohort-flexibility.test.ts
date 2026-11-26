import { test } from 'vitest';
import assert from 'node:assert/strict';
import { Store } from './store';
import { Scoring } from './scoring';
import { buildCohortMatrix } from './report-columns';

test('دوره بدون گرم‌کردن (۰ گرم‌کردن + ۲۱ اصلی + ۲ مرور = ۲۳ روز) درست ساخته و امتیازدهی می‌شود', () => {
  Store.getState().cohorts = [];
  const c = Store.createCohort({
    name: 'دوره بدون گرم‌کردن',
    startDate: '2026-11-01',
    warmupDays: 0,
    mainDays: 21,
    reviewDays: 2
  });
  assert.equal(c.days.length, 23);
  assert.equal(c.days.filter((d) => d.type === 'warmup').length, 0);
  assert.equal(c.days.filter((d) => d.type === 'main').length, 21);
  assert.equal(c.days.filter((d) => d.type === 'review').length, 2);

  const g = Store.addGroup(c.id, { name: 'گروه ۱' })!;
  const [p] = Store.addParticipants(c.id, g.id, [{ name: 'کاربر تست' }]);
  Store.recordDaily(c.id, p.id, 1, { done: 4, doneHabits: [0, 1, 2, 3], hard: 1, special: 1 });
  assert.equal(Scoring.dayScore(p, c.records[p.id][1], c.days[0]), 8);
  assert.equal(Scoring.dayScore(p, c.records[p.id][22], c.days[21]), 0);
});

test('سقف طول دوره روی ۹۰ روز محدود می‌شود و دونیت/سوابق در دوره‌های طولانی معتبر می‌مانند', () => {
  Store.getState().cohorts = [];
  const c = Store.createCohort({
    name: 'دوره بلند',
    startDate: '2026-11-01',
    warmupDays: 10,
    mainDays: 75,
    reviewDays: 20
  });
  assert.equal(c.days.length, 90);

  const g = Store.addGroup(c.id, { name: 'گروه اصلی' })!;
  const [p] = Store.addParticipants(c.id, g.id, [{ name: 'فرد نمونه' }]);
  Store.recordPayment(c.id, p.id, 'donation', 400000, 45);
  assert.equal(Scoring.personTotals(p, c, g, 45).donationScore, 2);

  const backup = Store.validateBackup(JSON.parse(JSON.stringify(Store.getState())));
  assert.equal(backup.ok, true);
});

test('ماتریس روزهای اصلی در دوره بدون گرم‌کردن با تعداد روزهای واقعی هم‌خوان است', () => {
  Store.getState().cohorts = [];
  const c = Store.createCohort({
    name: 'دوره ۲۳ روزه',
    startDate: '2026-11-01',
    warmupDays: 0,
    mainDays: 21,
    reviewDays: 2
  });
  const g = Store.addGroup(c.id, { name: 'گروه آلفا' })!;
  const [p] = Store.addParticipants(c.id, g.id, [{ name: 'شرکت‌کننده ۱' }]);
  Store.recordDaily(c.id, p.id, 1, { done: 4, doneHabits: [0, 1, 2, 3], hard: 2, special: 1 });
  Store.recordPayment(c.id, p.id, 'donation', 200000, 1);

  const matrix = buildCohortMatrix(c, g);
  assert.equal(matrix.mainDays.length, 21);
  assert.equal(matrix.mainDays[0].n, 1);
  assert.equal(c.records[p.id][1].done, 4);
  assert.equal(Scoring.dayScore(p, c.records[p.id][1], matrix.mainDays[0]), 9);
});