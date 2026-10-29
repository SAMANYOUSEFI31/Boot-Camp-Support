import { test } from 'vitest';
import assert from 'node:assert/strict';
import { Names } from './names.js';
import { Importer } from './importer.js';

test('بررسی معیارهای پذیرش ورود فایل‌های نمونه (۸۵ نفر در ۵ گروه، مغایرت سمیه سعدی، ۳ نفر بدون گروه، ۵ فریز)', () => {
  const sampleData = Importer.generateSampleFilesData();

  const filesData = [
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
  const counts = analysis.groups.map(g => analysis.stats.groupCounts[g.id]);
  assert.deepEqual(counts, [14, 18, 21, 15, 17]);
  assert.equal(analysis.stats.totalParticipants, 85);

  // ۲. گزارش ناهمخوانی: سمیه سعدی در جدول گروه‌بندی گروه ۵ و در لیست ثبت‌نامی گروه ۴
  const somayehConflict = analysis.inconsistencies.find(
    inc => inc.name === 'سمیه سعدی' && inc.type === 'group_conflict'
  );
  assert.ok(somayehConflict, 'مغایرت سمیه سعدی باید ثبت شده باشد');
  assert.equal(somayehConflict.groupTable, 'گروه ۵');
  assert.equal(somayehConflict.groupReg, 'گروه ۴');

  // ۳. سه نفر بدون گروه در لیست ثبت‌نامی
  const noGroupNames = ['محمدحسین بهرامیان', 'خجو محمودی', 'مائده خلیلی'];
  noGroupNames.forEach(name => {
    const found = analysis.inconsistencies.find(
      inc => inc.name === name && inc.type === 'not_in_grouping'
    );
    assert.ok(found, `باید مغایرت ${name} ثبت شده باشد`);
  });

  // ۴. پنج نفر فریز شده
  assert.equal(analysis.stats.frozenCount, 5);
});
