import { test } from 'vitest';
import assert from 'node:assert/strict';
import { Store } from './store';
import { Scoring } from './scoring';
import { canAssign, normalizeMobile, validateRegistration } from './registration';
import { buildCohortMatrix, buildReportRows, cellText, dataFields, visibleColumns } from './report-columns';
import { defaultPlan, mergeIntoCohort } from './merge-groups';
import { Importer } from './importer';
import type { Cohort } from './types';

const input = { name: 'علی رضایی', phone: '۰۹۱۲۳۴۵۶۷۸۹', age: '۲۵', gender: 'male' };
test('تلگرام اختیاری است؛ @ حذف، مقدار ناسالم رد و در ویرایش قبلی حفظ می‌شود', () => {
  const c = fresh();
  const p = Store.saveRegistration(c.id, { ...input, telegram: '@sample_user' });
  assert.equal(p.telegram, 'sample_user');
  assert.throws(() => Store.saveRegistration(c.id, { ...input, telegram: '12 invalid' }, p.id), /تلگرام/);
  Store.saveRegistration(c.id, input, p.id);
  assert.equal(p.telegram, 'sample_user');
  Store.saveRegistration(c.id, { ...input, telegram: '' }, p.id);
  assert.equal(p.telegram, '');
});
function fresh() {
  Store.getState().cohorts = [];
  const c = Store.createCohort({ name: 'ثبت‌نام', startDate: '2026-11-01' });
  return c;
}

test('ثبت‌نام: موبایل فارسی، +۹۸ و ۰۰۹۸ یکسان‌اند؛ سن و جنسیت الزامی و معتبرند', () => {
  for (const phone of ['۰۹۱۲۳۴۵۶۷۸۹', '+98 912 345 6789', '0098-912-345-6789', '989123456789']) {
    assert.equal(normalizeMobile(phone), '09123456789');
    assert.equal(validateRegistration({ ...input, phone }, []).valid, true);
  }
  for (const patch of [{ phone: '123' }, { phone: '0912345678x' }, { age: '25.5' }, { age: '0' }, { age: '121' }, { gender: '' }, { name: ' ' }]) {
    assert.equal(validateRegistration({ ...input, ...patch }, []).valid, false);
  }
});

test('ثبت‌نام بدون گروه ذخیره می‌شود؛ موبایل تکراری در همان دوره رد و در دورهٔ دیگر پذیرفته می‌شود', () => {
  const c = fresh();
  const p = Store.saveRegistration(c.id, input);
  assert.equal(p.groupId, '');
  assert.equal(p.phone, '09123456789');
  assert.equal(p.age, 25);
  assert.equal(canAssign(p), true);
  const before = JSON.stringify(c);
  assert.throws(() => Store.saveRegistration(c.id, { ...input, phone: '+989123456789' }));
  assert.equal(JSON.stringify(c), before);
  const other = Store.createCohort({ name: 'دورهٔ دیگر' });
  Store.saveRegistration(other.id, input);
  assert.equal(other.participants.length, 1);
  Store.saveRegistration(c.id, { ...input, phone: '09123456780' });
  assert.equal(c.participants.length, 2);
});

test('تخصیص چندنفره اتمی است و هویت، مشخصات، ثبت‌ها و پرداخت‌ها را حفظ می‌کند', () => {
  const c = fresh();
  const group = Store.addGroup(c.id, { name: 'گروه ۱' })!;
  const p = Store.saveRegistration(c.id, input);
  const other = Store.saveRegistration(c.id, { ...input, name: 'سارا', phone: '09123456780', gender: 'female' });
  const before = JSON.stringify(c);
  assert.throws(() => Store.assignRegistrants(c.id, [p.id, 'missing'], group.id));
  assert.equal(JSON.stringify(c), before);
  assert.throws(() => Store.assignRegistrants(c.id, [p.id], 'missing'));
  Store.assignRegistrants(c.id, [p.id, other.id, p.id], group.id);
  assert.equal(c.participants.length, 2);
  assert.equal(p.groupId, group.id);
  assert.equal(other.groupId, group.id);
  assert.equal(p.phone, '09123456789');
  Store.recordDaily(c.id, p.id, 8, { done: 4, doneHabits: [0, 1, 2, 3] });
  Store.recordPayment(c.id, p.id, 'donation', 200000, 8);
  Store.saveRegistration(c.id, { ...input, name: 'علی جدید', age: 26 }, p.id);
  assert.equal(p.groupId, group.id);
  assert.equal(p.age, 26);
  assert.deepEqual(c.records[p.id][8].doneHabits, [0, 1, 2, 3]);
  assert.equal(p.donations?.length, 1);
  assert.throws(() => Store.assignRegistrants(c.id, [p.id], group.id));
});

test('ثبت‌نام ناقص قدیمی گروه‌بندی نمی‌شود؛ تکمیل آن هویت و گروه قبلی را تغییر نمی‌دهد', () => {
  const c = fresh();
  const group = Store.addGroup(c.id, { name: 'گروه' })!;
  const [p] = Store.addParticipants(c.id, '', [{ name: 'قدیمی' }]);
  assert.equal(canAssign(p), false);
  assert.throws(() => Store.assignRegistrants(c.id, [p.id], group.id));
  Store.saveRegistration(c.id, input, p.id);
  Store.assignRegistrants(c.id, [p.id], group.id);
  assert.equal(c.participants.length, 1);
  assert.equal(c.participants[0].id, p.id);
});

test('عضو تازه برای روزهای بستهٔ قبل از گروه‌بندی اخطار یا حداکثر امتیاز نمی‌گیرد', () => {
  const c = fresh();
  const group = Store.addGroup(c.id, { name: 'گروه' })!;
  Store.toggleCloseDay(c.id, group.id, 8, true);
  const p = Store.saveRegistration(c.id, input);
  Store.assignRegistrants(c.id, [p.id], group.id);
  Store.toggleCloseDay(c.id, group.id, 8, true);
  assert.equal(p.warningDays?.length || 0, 0);
  assert.equal(Scoring.personTotals(p, c, group).closedDaysCount, 0);
  assert.equal(buildCohortMatrix(c, group).rows[0].dayScores[0], null);
  Store.toggleCloseDay(c.id, group.id, 9, true);
  assert.deepEqual(p.warningDays, [9]);
});

test('بکاپ و کپی دوره مشخصات و بدون‌گروه بودن را حفظ می‌کنند؛ موبایل ناسالم یا تکراری رد می‌شود', () => {
  const c = fresh();
  const p = Store.saveRegistration(c.id, input);
  Store.addGroup(c.id, { name: 'گروه' });
  const backup = JSON.parse(JSON.stringify(Store.getState()));
  const valid = Store.validateBackup(backup);
  assert.ok(valid.ok);
  if (valid.ok) assert.deepEqual(valid.data.cohorts[0].participants[0], p);
  const copied = Store.createCohort({ name: 'کپی', copyFromCohortId: c.id });
  assert.equal(copied.participants[0].groupId, '');
  assert.equal(copied.participants[0].phone, p.phone);
  const bad = JSON.parse(JSON.stringify(backup));
  bad.cohorts[0].participants[0].age = 25.5;
  assert.equal(Store.validateBackup(bad).ok, false);
  const duplicate = JSON.parse(JSON.stringify(backup));
  duplicate.cohorts[0].participants.push({ ...p, id: 'duplicate' });
  assert.equal(Store.validateBackup(duplicate).ok, false);
});

test('ادغام ثبت‌نامی‌های بدون گروه تکراری نمی‌سازد و افراد هم‌نام با موبایل متفاوت را جدا نگه می‌دارد', () => {
  const c = fresh();
  Store.saveRegistration(c.id, input);
  const file: Cohort = JSON.parse(JSON.stringify(c));
  file.participants[0].id = 'file-id';
  const initial = mergeIntoCohort(c, file, defaultPlan(c, file));
  assert.equal(initial.cohort.participants.length, 1);
  assert.equal(initial.stats.nothingNew, true);
  file.participants[0].phone = '09123456780';
  const merged = mergeIntoCohort(c, file, defaultPlan(c, file));
  assert.equal(merged.cohort.participants.length, 2);
  assert.equal(merged.cohort.participants[1].groupId, '');
});

test('ورود گروه‌بندی از فایل، ثبت‌نامی آماده را جابه‌جا می‌کند، نه این‌که فرد تکراری بسازد', () => {
  const c = fresh();
  const p = Store.saveRegistration(c.id, input);
  const file: Cohort = JSON.parse(JSON.stringify(c));
  file.groups = [{ id: 'file-group', name: 'گروه تازه', order: 1, mine: true, closedDays: [] }];
  file.participants[0].groupId = 'file-group';
  const merged = mergeIntoCohort(c, file, defaultPlan(c, file));
  assert.equal(merged.cohort.participants.length, 1);
  assert.equal(merged.cohort.participants[0].id, p.id);
  assert.equal(merged.cohort.participants[0].phone, p.phone);
  assert.notEqual(merged.cohort.participants[0].groupId, '');
});

test('فایل قدیمی بدون موبایل، فرد گروه‌دار دارای موبایل را تکراری نمی‌کند', () => {
  const c = fresh();
  const p = Store.saveRegistration(c.id, input);
  const group = Store.addGroup(c.id, { name: 'گروه' })!;
  Store.assignRegistrants(c.id, [p.id], group.id);
  const file: Cohort = JSON.parse(JSON.stringify(c));
  delete file.participants[0].phone;
  file.records[p.id] = { 8: { done: 1, doneHabits: [0], hard: null, special: null } };
  const result = mergeIntoCohort(c, file, defaultPlan(c, file));
  assert.equal(result.cohort.participants.length, 1);
  assert.equal(result.cohort.participants[0].phone, p.phone);
  assert.equal(result.cohort.records[p.id][8].done, 1);
});

test('گزارش عمومی و شیت داده، موبایل، سن و جنسیت را منتشر نمی‌کنند', () => {
  const c = fresh();
  const p = Store.saveRegistration(c.id, input);
  const group = Store.addGroup(c.id, { name: 'گروه' })!;
  Store.assignRegistrants(c.id, [p.id], group.id);
  const report = buildReportRows(c, group, 8);
  const headers = dataFields().map((f) => f.header);
  assert.ok(!headers.some((h) => /phone|age|gender/i.test(h)));
  for (const target of ['excel', 'image'] as const) {
    const text = visibleColumns(target, report.ctx).map((col) => cellText(col, report.rows[0], report.ctx, target)).join(' ');
    assert.ok(!text.includes(p.phone!));
  }
});

test('ورود Excel/CSV قدیمی، ثبت‌نامی آماده را تخصیص می‌دهد و هم‌نام مبهم را بدون تغییر داده رد می‌کند', () => {
  const c = fresh();
  const p = Store.saveRegistration(c.id, input);
  const report = Importer.analyzeImport([{
    fileName: 'groups.csv', detectedType: 'grouping_table', rawRows: [['گروه ۱'], [input.name]]
  }]);
  const configs = Object.fromEntries(report.groups.map((g) => [g.id, { name: g.name, selected: true, mine: true }]));
  Importer.applyImport(c.id, report, configs);
  assert.equal(c.participants.length, 1);
  assert.equal(c.participants[0].id, p.id);
  assert.equal(c.participants[0].phone, p.phone);
  assert.notEqual(c.participants[0].groupId, '');
  const other = fresh();
  Store.saveRegistration(other.id, input);
  Store.saveRegistration(other.id, { ...input, phone: '09123456780' });
  const before = JSON.stringify(other);
  assert.throws(() => Importer.applyImport(other.id, report, configs));
  assert.equal(JSON.stringify(other), before);
});
