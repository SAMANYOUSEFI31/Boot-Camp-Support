import { test } from 'vitest';
import assert from 'node:assert/strict';
import { Names } from './names';
import { Importer, type ImportFile } from './importer';
import { Store } from './store';

test('بررسی معیارهای پذیرش ورود فایل‌های نمونه (۸۵ نفر در ۵ گروه، مغایرت سمیه سعدی، ۳ نفر بدون گروه، ۵ فریز)', () => {
  const sampleData = Importer.generateSampleFilesData();

  const filesData: ImportFile[] = [
    {
      fileName: 'groups-table-sample.xlsx',
      detectedType: 'grouping_table',
      rawRows: sampleData.groupingTableRows
    },
    {
      fileName: 'registrants-sample.xlsx',
      detectedType: 'registrants_list',
      rawRows: sampleData.registrantsRows
    }
  ];

  const analysis = Importer.analyzeImport(filesData);

  // ۱. بررسی ۵ گروه و تعداد افراد در هر گروه: ۱۴، ۱۸، ۲۱، ۱۵، ۱۷ (مجموعاً ۸۵ نفر)
  assert.equal(analysis.groups.length, 5);
  const counts = analysis.groups.map((g) => analysis.stats.groupCounts[g.id]);
  assert.deepEqual(counts, [14, 18, 21, 15, 17]);
  assert.equal(analysis.stats.totalParticipants, 88);
  assert.equal(analysis.participants.filter((p) => !p.groupId).length, 3);

  // ۲. گزارش ناهمخوانی: سمیه سعدی در جدول گروه‌بندی گروه ۵ و در لیست ثبت‌نامی گروه ۴
  const somayehConflict = analysis.inconsistencies.find(
    (inc) => inc.name === 'سمیه سعدی' && inc.type === 'group_conflict'
  );
  assert.ok(somayehConflict, 'مغایرت سمیه سعدی باید ثبت شده باشد');
  assert.equal(somayehConflict.groupTable, 'گروه ۵');
  assert.equal(somayehConflict.groupReg, 'گروه ۴');

  // ۳. سه نفر بدون گروه در لیست ثبت‌نامی
  const noGroupNames = ['محمدحسین بهرامیان', 'خجو محمودی', 'مائده خلیلی'];
  noGroupNames.forEach((name) => {
    const found = analysis.inconsistencies.find((inc) => inc.name === name && inc.type === 'not_in_grouping');
    assert.ok(found, `باید مغایرت ${name} ثبت شده باشد`);
  });

  // ۴. پنج نفر فریز شده
  assert.equal(analysis.stats.frozenCount, 5);
});

test('نام طبیعی دوره از نام فایل', () => {
  assert.equal(Names.cohortNameFromFileName('دوره-آبان_۱۴۰۵.xlsx'), 'دوره آبان ۱۴۰۵');
  assert.equal(Names.cohortNameFromFileName('support-backup-دوره-مهر-2026-10-29.json'), 'دوره مهر');
  assert.equal(Names.cohortNameFromFileName(''), '');
});

test('فایل بکاپ یا Numbers در ورود اکسل با پیام فارسی رد می‌شود', async () => {
  const json = new File(['{"cohorts":[]}'], 'b.json');
  await assert.rejects(Importer.readFileData(json), /بکاپ/);
  const numbers = new File(['x'], 'list.numbers');
  await assert.rejects(Importer.readFileData(numbers), /Numbers/);
});

test('قالب CSV و JSON ثبت‌نام کامل را بدون گروه وارد می‌کنند؛ ورود مجدد تکراری نمی‌سازد', () => {
  for (const format of ['csv', 'json']) {
    const c = Store.createCohort({ name: 'آزمون ' + format });
    const rows = Importer.registrationFileRows();
    const readRows = format === 'csv' ? Importer.parseCSV(Importer.serializeCSV(rows)) :
      Importer.parseRegistrationJSON(JSON.stringify(Importer.registrationJSON(rows)));
    assert.equal(Importer.detectStructureType(readRows), 'registrants_list');
    const report = Importer.analyzeImport([{ fileName: 'test.' + format, detectedType: 'registrants_list', rawRows: readRows }]);
    Importer.applyImport(c.id, report, {});
    assert.equal(c.participants.length, 1);
    assert.equal(c.participants[0].groupId, '');
    assert.equal(c.participants[0].phone, '09000000001');
    assert.equal(c.participants[0].age, 25);
    assert.equal(c.participants[0].telegram, 'sample_user');
    Importer.applyImport(c.id, report, {});
    assert.equal(c.participants.length, 1);
  }
});

test('CSV گیومه، چندخطی، جداکننده و مقادیر شبیه فرمول را سالم رفت‌وبرگشت می‌دهد', () => {
  const rows = [['نام', 'تلگرام'], ['نام "نمونه", دوم\nسطر دوم', 'sample_user'], ['=1+1', '@sample_user']];
  assert.deepEqual(Importer.parseCSV(Importer.serializeCSV(rows)), rows);
  assert.deepEqual(Importer.parseCSV('نام;سن\nنمونه;25'), [['نام', 'سن'], ['نمونه', '25']]);
  assert.throws(() => Importer.parseCSV('نام\n"ناقص'), /گیومه/);
});

test('ورود تفاوت گروه و مشخصات، انتخاب مستقل می‌خواهد و تا تأیید داده را تغییر نمی‌دهد', () => {
  const c = Store.createCohort({ name: 'تفاوت‌ها' });
  const g = Store.addGroup(c.id, { name: 'گروه فعلی' })!;
  const p = Store.saveRegistration(c.id, { name: 'فرد نمونه', phone: '09000000001', age: 25, gender: 'male', telegram: '@sample_user' });
  Store.assignRegistrants(c.id, [p.id], g.id);
  c.records[p.id] = { 1: { done: 5, hard: 3, special: 1 } };
  p.donations = [{ id: 'receipt', amount: 200000, dayN: 1, paidAt: '2026-11-25T00:00:00Z' }];
  const report = Importer.analyzeImport([{
    fileName: 'new.csv', detectedType: 'registrants_list',
    rawRows: [['نام', 'موبایل', 'سن', 'جنسیت', 'تلگرام', 'گروه'],
      ['نام جدید', '+989000000001', '26', 'مرد', 'sample_user', 'گروه جدید']]
  }]);
  const config = Object.fromEntries(report.groups.map((g) => [g.id, { name: g.name, selected: true }]));
  const before = JSON.stringify(c);
  const plan = Importer.prepareImport(c, report, config);
  assert.deepEqual(plan.conflicts.map((x) => x.field).sort(), ['سن', 'نام', 'گروه'].sort());
  assert.throws(() => Importer.applyImport(c.id, report, config), /تفاوت/);
  assert.equal(JSON.stringify(c), before);
  const decisions = Object.fromEntries(plan.conflicts.map((x) => [x.key, x.field === 'سن' ? 'keep' as const : 'file' as const]));
  Importer.applyImport(c.id, report, config, decisions);
  assert.equal(c.participants[0].name, 'نام جدید');
  assert.equal(c.participants[0].age, 25);
  assert.equal(c.groups.find((x) => x.id === c.participants[0].groupId)?.name, 'گروه جدید');
  assert.equal(c.participants[0].donations?.[0].id, 'receipt');
  assert.deepEqual(c.records[p.id][1], { done: 5, hard: 3, special: 1 });
  assert.equal(Importer.rollbackLastImport(), true);
  assert.equal(c.participants[0].name, p.name);
  assert.equal(c.participants[0].groupId, g.id);
});

test('ردیف ناسالم و موبایل تکراری هیچ فرد یا گروهی اضافه نمی‌کند؛ هم‌نام با موبایل جدا مجاز است', () => {
  const header = ['نام', 'موبایل', 'سن', 'جنسیت'];
  for (const row of [['نمونه', '123', '25', 'مرد'], ['نمونه', '09000000001', '25.5', 'مرد'], ['نمونه', '09000000001', '25', 'نامعتبر']]) {
    assert.throws(() => Importer.parseRegistrantsList([header, row]), /ردیف 2/);
  }
  const c = Store.createCohort({ name: 'تکراری' });
  const report = Importer.analyzeImport([{
    fileName: 'test.csv', detectedType: 'registrants_list',
    rawRows: [header, ['هم‌نام', '09000000001', '25', 'مرد'], ['هم‌نام', '09000000001', '26', 'مرد']]
  }]);
  const before = JSON.stringify(c);
  assert.throws(() => Importer.applyImport(c.id, report, {}), /تکراری/);
  assert.equal(JSON.stringify(c), before);
  report.participants[1].phone = '09000000002';
  Importer.applyImport(c.id, report, {});
  assert.equal(c.participants.length, 2);
});

test('فایل‌های CSV و JSON افراد از مسیر واقعی خواندن فایل پذیرفته می‌شوند؛ فایل خالی یا بدون نام رد می‌شود', async () => {
  const rows = Importer.registrationFileRows();
  for (const [name, content] of [
    ['people.csv', Importer.serializeCSV(rows)],
    ['people.json', JSON.stringify({ participants: Importer.registrationJSON(rows) })]
  ]) {
    const read = await Importer.readFileData(new File([content], name));
    assert.deepEqual(read.rawRows, rows);
    assert.equal(Importer.analyzeImport([{ fileName: name, detectedType: Importer.detectStructureType(read.rawRows), rawRows: read.rawRows }]).participants.length, 1);
  }
  assert.throws(() => Importer.parseRegistrantsList([['نام', 'سن'], ['', '25']]), /نام/);
  assert.throws(() => Importer.analyzeImport([{ fileName: 'empty.csv', detectedType: 'registrants_list', rawRows: [['نام', 'سن']] }]), /هیچ فردی/);
});
