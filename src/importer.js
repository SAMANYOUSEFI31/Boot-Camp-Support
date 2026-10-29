/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Names } from './names.js';
import { Store } from './store.js';
import { Excel } from './excel.js';


/**
 * پارس ساده فایل CSV با پشتیبانی از کاما، سمیکالن، تب و مقادیر داخل گیومه
 */
function parseCSV(text) {
  if (!text || typeof text !== 'string') return [];
  var lines = text.split(/\r?\n/);
  var rows = [];

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;

    var delimiter = ',';
    if (line.indexOf('\t') !== -1) delimiter = '\t';
    else if (line.indexOf(';') !== -1 && line.indexOf(',') === -1) delimiter = ';';

    var row = [];
    var inQuote = false;
    var curVal = '';

    for (var c = 0; c < line.length; c++) {
      var char = line[c];
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === delimiter && !inQuote) {
        row.push(curVal.trim());
        curVal = '';
      } else {
        curVal += char;
      }
    }
    row.push(curVal.trim());
    rows.push(row);
  }
  return rows;
}

/**
 * خواندن فایل با ExcelJS یا FileReader
 */
function readFileData(file) {
  return new Promise(function (resolve, reject) {
    var name = file.name.toLowerCase();
    var isCsv = name.endsWith('.csv');

    if (isCsv) {
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var text = e.target.result;
          var rows = parseCSV(text);
          resolve({ fileName: file.name, type: 'csv', rawRows: rows });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file, 'utf-8');
    } else {
      // فایل XLSX
      Excel.loadExcelJS().then(function (ExcelJS) {
        var reader = new FileReader();
        reader.onload = function (e) {
          var buffer = e.target.result;
          var wb = new ExcelJS.Workbook();
          wb.xlsx.load(buffer).then(function () {
            var ws = wb.worksheets[0];
            if (!ws) {
              return reject(new Error('هیچ برگه فعالی در فایل اکسل یافت نشد.'));
            }
            var rows = [];
            ws.eachRow({ includeEmpty: false }, function (row) {
              var rVals = [];
              row.eachCell({ includeEmpty: true }, function (cell, colNum) {
                var v = cell.text !== undefined ? cell.text : cell.value;
                rVals[colNum - 1] = v != null ? String(v).trim() : '';
              });
              rows.push(rVals);
            });
            resolve({ fileName: file.name, type: 'xlsx', rawRows: rows });
          }).catch(reject);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      }).catch(reject);
    }
  });
}

/**
 * تشخیص نوع ساختار فایل
 * نوع ۱: «جدول گروه‌بندی» (grouping_table) - هر ستون یک گروه است
 * نوع ۲: «لیست ثبت‌نامی» (registrants_list) - ستون‌های نام، تلگرام، گروه
 */
function detectStructureType(rawRows) {
  if (!rawRows || !rawRows.length) return 'grouping_table';

  var headerRow = rawRows[0] || [];
  var headerStr = headerRow.join(' ').toLowerCase();

  // اگر ستونی حاوی «نام» و دیگری حاوی «تلگرام» یا «گروه» باشد
  var hasNameCol = false;
  var hasTelegramCol = false;
  var hasGroupCol = false;

  headerRow.forEach(function (h) {
    var s = String(h || '');
    if (s.indexOf('نام') !== -1) hasNameCol = true;
    if (s.indexOf('تلگرام') !== -1 || s.indexOf('telegram') !== -1) hasTelegramCol = true;
    if (s.indexOf('گروه') !== -1 || s.indexOf('group') !== -1) hasGroupCol = true;
  });

  if (hasNameCol && (hasTelegramCol || hasGroupCol)) {
    return 'registrants_list';
  }

  // در غیر این صورت معمولاً جدول گروه‌بندی است
  return 'grouping_table';
}

/**
 * استخراج افراد و گروه‌ها از «جدول گروه‌بندی»
 */
function parseGroupingTable(rawRows) {
  if (!rawRows || !rawRows.length) return { groups: [], participants: [] };

  var headerRow = rawRows[0] || [];
  var groups = [];
  var participants = [];

  // هر ستون یک گروه است
  headerRow.forEach(function (colHeader, colIdx) {
    var rawH = String(colHeader || '').trim();
    if (!rawH) return;

    var groupName = rawH;
    // اگر سرستون فقط عدد بود، پیشوند «گروه » بگذار
    var latinDigits = Names.toLatinDigits(rawH);
    if (/^\d+$/.test(latinDigits)) {
      groupName = 'گروه ' + Names.toPersianDigits(latinDigits);
    }

    var groupId = 'imp_grp_' + colIdx;
    groups.push({
      id: groupId,
      name: groupName,
      colIdx: colIdx,
      order: colIdx + 1,
      mine: true
    });

    // سطرهای زیر سرستون
    for (var r = 1; r < rawRows.length; r++) {
      var cellVal = (rawRows[r] && rawRows[r][colIdx]) != null ? String(rawRows[r][colIdx]).trim() : '';
      if (!cellVal) continue;

      var isFrozen = Names.isFreezeCell(cellVal);
      // تمیز کردن نام در صورتی که کلمه فریز در آن نوشته شده بود
      var cleanName = cellVal.replace(/[\(（]?\s*فریز\s*شده?[\)）]?/g, '').trim();
      if (!cleanName) continue;

      participants.push({
        name: cleanName,
        nameKey: Names.normalizeName(cleanName),
        telegram: '',
        groupId: groupId,
        groupName: groupName,
        status: isFrozen ? 'frozen' : 'active',
        habitCount: null
      });
    }
  });

  return { groups: groups, participants: participants };
}

/**
 * استخراج افراد از «لیست ثبت‌نامی»
 * رعایت حریم خصوصی: عدم ذخیره شماره تلفن، سن، مبلغ و...
 */
function parseRegistrantsList(rawRows) {
  if (!rawRows || !rawRows.length) return { groups: [], participants: [] };

  var headerRow = rawRows[0] || [];
  var nameColIdx = -1;
  var telegramColIdx = -1;
  var groupColIdx = -1;

  headerRow.forEach(function (h, idx) {
    var s = String(h || '').trim().toLowerCase();
    if (nameColIdx === -1 && s.indexOf('نام') !== -1) nameColIdx = idx;
    if (telegramColIdx === -1 && (s.indexOf('تلگرام') !== -1 || s.indexOf('telegram') !== -1)) telegramColIdx = idx;
    if (groupColIdx === -1 && (s.indexOf('گروه') !== -1 || s.indexOf('group') !== -1)) groupColIdx = idx;
  });

  if (nameColIdx === -1) {
    // اگر ستون نام پیدا نشد، ستون اول را به عنوان نام در نظر بگیر
    nameColIdx = 0;
  }

  var groupMap = {};
  var participants = [];

  for (var r = 1; r < rawRows.length; r++) {
    var row = rawRows[r] || [];
    var nameVal = row[nameColIdx] != null ? String(row[nameColIdx]).trim() : '';
    if (!nameVal) continue;

    var telegramVal = telegramColIdx !== -1 && row[telegramColIdx] != null ? String(row[telegramColIdx]).trim() : '';
    var groupVal = groupColIdx !== -1 && row[groupColIdx] != null ? String(row[groupColIdx]).trim() : '';

    // بررسی فریز بودن در تمام سلول‌های سطر
    var isFrozen = false;
    for (var c = 0; c < row.length; c++) {
      if (Names.isFreezeCell(String(row[c] || ''))) {
        isFrozen = true;
        break;
      }
    }

    var cleanName = nameVal.replace(/[\(（]?\s*فریز\s*شده?[\)）]?/g, '').trim();

    var gName = groupVal;
    var gLatin = Names.toLatinDigits(gName);
    if (/^\d+$/.test(gLatin)) {
      gName = 'گروه ' + Names.toPersianDigits(gLatin);
    }

    var gId = '';
    if (gName) {
      if (!groupMap[gName]) {
        groupMap[gName] = {
          id: 'imp_reg_grp_' + Object.keys(groupMap).length,
          name: gName,
          order: Object.keys(groupMap).length + 1,
          mine: true
        };
      }
      gId = groupMap[gName].id;
    }

    participants.push({
      name: cleanName,
      nameKey: Names.normalizeName(cleanName),
      telegram: telegramVal.replace(/^@/, '').trim(),
      groupId: gId,
      groupName: gName,
      status: isFrozen ? 'frozen' : 'active',
      habitCount: null
    });
  }

  var groups = Object.values(groupMap);
  return { groups: groups, participants: participants };
}

/**
 * تحلیل و مقایسه فایل‌ها و استخراج گزارش ناهمخوانی‌ها
 */
function analyzeImport(filesData) {
  var groupingData = null;
  var registrantsData = null;

  filesData.forEach(function (f) {
    if (f.detectedType === 'grouping_table') {
      groupingData = parseGroupingTable(f.rawRows);
      groupingData.fileName = f.fileName;
    } else {
      registrantsData = parseRegistrantsList(f.rawRows);
      registrantsData.fileName = f.fileName;
    }
  });

  var report = {
    groups: [],
    participants: [],
    inconsistencies: [],
    frozenParticipants: [],
    duplicates: [],
    stats: {
      totalParticipants: 0,
      groupCounts: {},
      frozenCount: 0
    }
  };

  // سناریوی ۱: ورود همزمان دو فایل (جدول گروه‌بندی + لیست ثبت‌نامی)
  if (groupingData && registrantsData) {
    // قانون صریح: جدول گروه‌بندی معتبر است و گروه‌ها را می‌سازد
    report.groups = groupingData.groups.map(function (g) {
      return {
        id: g.id,
        name: g.name,
        order: g.order,
        mine: true
      };
    });

    var regMapByNameKey = {};
    registrantsData.participants.forEach(function (rp) {
      regMapByNameKey[rp.nameKey] = rp;
    });

    var seenKeysInGrouping = {};

    groupingData.participants.forEach(function (gp) {
      // بررسی نام تکراری در جدول گروه‌بندی
      if (seenKeysInGrouping[gp.nameKey]) {
        report.duplicates.push(gp.name);
        report.inconsistencies.push({
          type: 'duplicate',
          text: 'نام تکراری «' + gp.name + '» در جدول گروه‌بندی مشاهده شد.'
        });
      }
      seenKeysInGrouping[gp.nameKey] = true;

      var matchedReg = regMapByNameKey[gp.nameKey];
      var finalTelegram = '';
      var finalStatus = gp.status;

      if (matchedReg) {
        finalTelegram = matchedReg.telegram || '';
        if (matchedReg.status === 'frozen') {
          finalStatus = 'frozen';
        }

        // بررسی ناهمخوانی گروه بین دو فایل
        if (matchedReg.groupName && matchedReg.groupName !== gp.groupName) {
          report.inconsistencies.push({
            type: 'group_conflict',
            name: gp.name,
            groupTable: gp.groupName,
            groupReg: matchedReg.groupName,
            text: '«' + gp.name + '» در جدول گروه‌بندی ' + gp.groupName + ' و در لیست ثبت‌نامی ' + matchedReg.groupName + ' است (جدول گروه‌بندی معتبر است).'
          });
        }
      } else {
        // در جدول گروه‌بندی هست اما در لیست ثبت‌نامی نیست
        report.inconsistencies.push({
          type: 'not_in_reg',
          name: gp.name,
          text: '«' + gp.name + '» در جدول گروه‌بندی موجود است اما در لیست ثبت‌نامی یافت نشد.'
        });
      }

      if (finalStatus === 'frozen') {
        report.frozenParticipants.push(gp.name);
      }

      report.participants.push({
        id: 'p_imp_' + Math.random().toString(36).slice(2, 8),
        name: gp.name,
        nameKey: gp.nameKey,
        telegram: finalTelegram,
        groupId: gp.groupId,
        groupName: gp.groupName,
        status: finalStatus,
        habitCount: null
      });
    });

    // افرادی که در لیست ثبت‌نامی هستند اما در جدول گروه‌بندی نیستند
    registrantsData.participants.forEach(function (rp) {
      if (!seenKeysInGrouping[rp.nameKey]) {
        report.inconsistencies.push({
          type: 'not_in_grouping',
          name: rp.name,
          text: '«' + rp.name + '» در لیست ثبت‌نامی موجود است اما گروهی برای او در جدول گروه‌بندی تعیین نشده است.'
        });
      }
    });
  } else {
    // فقط یک فایل وارد شده است
    var single = groupingData || registrantsData;
    report.groups = single.groups.map(function (g) {
      return {
        id: g.id,
        name: g.name,
        order: g.order,
        mine: true
      };
    });

    var seen = {};
    single.participants.forEach(function (p) {
      if (seen[p.nameKey]) {
        report.duplicates.push(p.name);
        report.inconsistencies.push({
          type: 'duplicate',
          text: 'نام تکراری «' + p.name + '» مشاهده شد.'
        });
      }
      seen[p.nameKey] = true;

      if (p.status === 'frozen') {
        report.frozenParticipants.push(p.name);
      }

      report.participants.push({
        id: 'p_imp_' + Math.random().toString(36).slice(2, 8),
        name: p.name,
        nameKey: p.nameKey,
        telegram: p.telegram,
        groupId: p.groupId,
        groupName: p.groupName,
        status: p.status,
        habitCount: null
      });
    });
  }

  // بررسی گروه‌های خالی
  report.groups.forEach(function (g) {
    var count = report.participants.filter(function (p) { return p.groupId === g.id; }).length;
    report.stats.groupCounts[g.id] = count;
    if (count === 0) {
      report.inconsistencies.push({
        type: 'empty_group',
        groupName: g.name,
        text: 'گروه «' + g.name + '» هیچ عضوی ندارد.'
      });
    }
  });

  report.stats.totalParticipants = report.participants.length;
  report.stats.frozenCount = report.frozenParticipants.length;

  return report;
}

/**
 * اعمال ادغام در دوره فعال بر اساس قواعد مشخص‌شده:
 * - نام موجود (بر اساس nameKey) را حفظ کن و فقط آیدی تلگرام خالی را تکمیل کن.
 * - نام‌های جدید را اضافه کن.
 * - هرگز چیزی را پاک نکن.
 * - فقط گروه‌هایی که تیک «مال من است» خورده‌اند را وارد کن.
 * - ذخیره کپی قبل از اعمال برای پشتیبانی از دکمه «بازگردانی آخرین ورود».
 */
var lastImportBackup = null;

function applyImport(cohortId, analyzedReport, selectedGroupsMap) {
  var Store = Store;
  var state = Store.getState();
  var cohort = (state.cohorts || []).find(function (c) { return c.id === cohortId; });
  if (!cohort) {
    throw new Error('دوره فعال یافت نشد.');
  }

  // ذخیره کپی در حافظه برای Undo
  lastImportBackup = {
    cohortId: cohortId,
    groups: JSON.parse(JSON.stringify(cohort.groups || [])),
    participants: JSON.parse(JSON.stringify(cohort.participants || [])),
    records: JSON.parse(JSON.stringify(cohort.records || {}))
  };

  var targetGroups = cohort.groups || [];
  var targetParticipants = cohort.participants || [];

  // مپ کردن گروه‌های واردشده به گروه‌های واقعی دوره
  var importedToRealGroupId = {};

  analyzedReport.groups.forEach(function (ig) {
    var groupConfig = selectedGroupsMap[ig.id];
    if (!groupConfig || !groupConfig.selected) {
      // این گروه انتخاب نشده است
      return;
    }

    var finalName = groupConfig.name || ig.name;
    var isMine = groupConfig.mine !== false;

    // بررسی آیا گروهی با این نام در دوره وجود دارد
    var existingGroup = targetGroups.find(function (g) {
      return g.name.trim() === finalName.trim();
    });

    if (existingGroup) {
      importedToRealGroupId[ig.id] = existingGroup.id;
      existingGroup.mine = isMine;
    } else {
      var newGroupId = 'grp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      importedToRealGroupId[ig.id] = newGroupId;
      targetGroups.push({
        id: newGroupId,
        name: finalName,
        order: targetGroups.length + 1,
        mine: isMine,
        closedDays: []
      });
    }
  });

  // ادغام افراد
  var existingParticipantsByKey = {};
  targetParticipants.forEach(function (p) {
    existingParticipantsByKey[p.nameKey] = p;
  });

  analyzedReport.participants.forEach(function (ip) {
    var realGId = importedToRealGroupId[ip.groupId];
    if (!realGId) {
      // گروه این فرد وارد نشده
      return;
    }

    var existingP = existingParticipantsByKey[ip.nameKey];
    if (existingP) {
      // نام موجود: حفظ کن و اگر آیدی تلگرام نداشت پر کن
      if (!existingP.telegram && ip.telegram) {
        existingP.telegram = ip.telegram;
      }
      if (existingP.status === 'active' && ip.status === 'frozen') {
        existingP.status = 'frozen';
      }
    } else {
      // فرد جدید
      var newP = {
        id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        name: ip.name,
        nameKey: ip.nameKey,
        telegram: ip.telegram || '',
        groupId: realGId,
        status: ip.status || 'active',
        habitCount: null
      };
      targetParticipants.push(newP);
      existingParticipantsByKey[ip.nameKey] = newP;
    }
  });

  cohort.groups = targetGroups;
  cohort.participants = targetParticipants;

  Store.saveImmediately();
  return true;
}

/**
 * بازگردانی آخرین ورود (Undo Import)
 */
function rollbackLastImport() {
  if (!lastImportBackup) return false;
  var Store = Store;
  var state = Store.getState();
  var cohort = (state.cohorts || []).find(function (c) { return c.id === lastImportBackup.cohortId; });
  if (!cohort) return false;

  cohort.groups = lastImportBackup.groups;
  cohort.participants = lastImportBackup.participants;
  cohort.records = lastImportBackup.records;

  lastImportBackup = null;
  Store.saveImmediately();
  return true;
}

function hasRollbackAvailable() {
  return !!lastImportBackup;
}

/**
 * تولیدکننده داده‌های نمونه فایل‌های مورد نیاز آزمون پذیرش:
 * ۵ گروه با ۱۴، ۱۸، ۲۱، ۱۵ و ۱۷ نفر (مجموعاً ۸۵ نفر)
 * سمیه سعدی در جدول گروهبندی گروه ۵ و در لیست ثبت‌نامی گروه ۴
 * سه نفر (محمدحسین بهرامیان، خجو محمودی، مائده خلیلی) بدون گروه در لیست ثبت‌نامی
 * ۵ نفر فریز شده
 */
function generateSampleFilesData() {
  var groupSizes = [14, 18, 21, 15, 17];
  var groupNames = ['گروه ۱', 'گروه ۲', 'گروه ۳', 'گروه ۴', 'گروه ۵'];

  var sampleNamesPool = [
    'علی رضایی', 'رضا کریمی', 'محمد حسینی', 'مهدی صادقی', 'حسین موسوی',
    'امیرحسین ابراهیمی', 'علیرضا اسدی', 'سعید جعفری', 'پژمان مرادی', 'امیر مرادی',
    'یاسین عزیزی', 'نیما حیدری', 'سجاد رحیمی', 'فرزاد شریفی',
    'فاطمه احمدی', 'زهرا کاظمی', 'مریم باقری', 'نرگس نوری', 'سارا یوسفی',
    'الهام رستمی', 'سمیرا قاسم‌پور', 'مونا صالحی', 'فرشته بهرامی', 'محدثه کرمی',
    'مهسا داوودی', 'الهه شجاعی', 'سمانه ملکی', 'ندا فلاحی', 'شیرین نجفی',
    'آیدا حیدری', 'رویا سعیدی', 'مهناز اکبری',
    'پویا احمدی', 'آرش کمالی', 'میلاد قنبری', 'سینا فتحی', 'کیانوش باقرزاده',
    'احسان مقدسی', 'حمیدرضا حاتمی', 'شاهین طاهری', 'سامان پاشایی', 'هومن خسروی',
    'پارسا افشار', 'مهران یزدانی', 'بابک رفیعی', 'بهرام میرزایی', 'مجید قاسمی',
    'کیوان غفاری', 'نوید فرهمند', 'بهزاد صفری', 'دانیال راد', 'آرمان ستاری', 'سهراب نامدار',
    'نازنین امینی', 'پریسا بیات', 'شیما صبوری', 'نسیم میرزایی', 'روژین حسینی',
    'شقایق دادخواه', 'نگین فتاحی', 'سپیده روزبهانی', 'زهره فرجی', 'کتایون محمودی',
    'لیلا جلالی', 'نسرین شمس', 'طاهره عباسی', 'عاطفه سعادت', 'مهدیه رضایی',
    'کامران رسولی', 'امید صیادی', 'نوید گودرزی', 'امین سرلک', 'سهیل فرهمند',
    'بهنام جوادی', 'منصور کیانی', 'مسعود هدایتی', 'فرهاد فدوی', 'سیاوش سهرابی',
    'سروش جهان‌بین', 'وحید طاهری', 'صادق شفیعی', 'جواد پورمحمد', 'ایمان ربیعی',
    'فرید رهنما', 'سمیه سعدی'
  ];

  // جدول گروه‌بندی (سطر اول سرستون‌ها و زیرش نام‌ها)
  var maxRows = Math.max.apply(null, groupSizes);
  var groupingTableRows = [];
  groupingTableRows.push(groupNames);

  var currentPoolIdx = 0;
  var groupColumns = [];

  groupSizes.forEach(function (size, gIdx) {
    var col = [];
    for (var i = 0; i < size; i++) {
      var name = sampleNamesPool[currentPoolIdx++];
      // مشخص کردن فریز شده‌ها
      if (currentPoolIdx === 5 || currentPoolIdx === 25 || currentPoolIdx === 45) {
        name = name + ' (فریز)';
      }
      col.push(name);
    }
    groupColumns.push(col);
  });

  // اضافه کردن ردیف‌ها
  for (var r = 0; r < maxRows; r++) {
    var row = [];
    for (var g = 0; g < 5; g++) {
      row.push(groupColumns[g][r] || '');
    }
    groupingTableRows.push(row);
  }

  // لیست ثبت‌نامی (نام، آیدی تلگرام، گروه)
  var registrantsRows = [];
  registrantsRows.push(['نام و نام خانوادگی', 'آیدی تلگرام', 'شماره موبایل', 'گروه اختصاص‌یافته']);

  currentPoolIdx = 0;
  groupSizes.forEach(function (size, gIdx) {
    for (var i = 0; i < size; i++) {
      var originalName = sampleNamesPool[currentPoolIdx++];
      var gAssigned = groupNames[gIdx];

      // مغایرت ۱: سمیه سعدی در جدول گروهبندی گروه ۵ و در لیست ثبت‌نامی گروه ۴ است
      if (originalName === 'سمیه سعدی') {
        gAssigned = 'گروه ۴';
      }

      var isFroz = false;
      // ۵ نفر فریز شده: ۳ نفر در هر دو + ۲ نفر در لیست ثبت نامی
      if (currentPoolIdx === 5 || currentPoolIdx === 25 || currentPoolIdx === 45 || currentPoolIdx === 65 || currentPoolIdx === 80) {
        isFroz = true;
      }

      var tel = '@user_' + currentPoolIdx;
      var row = [
        originalName,
        tel,
        '0912' + Math.floor(1000000 + Math.random() * 9000000), // این شماره نباید وارد شود
        isFroz ? (gAssigned + ' - فریز') : gAssigned
      ];
      registrantsRows.push(row);
    }
  });

  // ۳ نفر بدون گروه در لیست ثبت‌نامی
  registrantsRows.push(['محمدحسین بهرامیان', '@m_bahramian', '09121111111', '']);
  registrantsRows.push(['خجو محمودی', '@khojo_m', '09122222222', '']);
  registrantsRows.push(['مائده خلیلی', '@maedeh_kh', '09123333333', '']);

  return {
    groupingTableRows: groupingTableRows,
    registrantsRows: registrantsRows
  };
}

export const Importer = {
  parseCSV: parseCSV,
  readFileData: readFileData,
  detectStructureType: detectStructureType,
  parseGroupingTable: parseGroupingTable,
  parseRegistrantsList: parseRegistrantsList,
  analyzeImport: analyzeImport,
  applyImport: applyImport,
  rollbackLastImport: rollbackLastImport,
  hasRollbackAvailable: hasRollbackAvailable,
  generateSampleFilesData: generateSampleFilesData
};
