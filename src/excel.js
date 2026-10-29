/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Names } from './names.js';
import { Scoring } from './scoring.js';


var EXCELJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
var isExcelJsLoading = false;
var excelJsLoadPromise = null;

/**
 * بارگذاری تنبل کتابخانه ExcelJS
 */
function loadExcelJS() {
  if (window.ExcelJS) {
    return Promise.resolve(window.ExcelJS);
  }
  if (excelJsLoadPromise) {
    return excelJsLoadPromise;
  }

  excelJsLoadPromise = new Promise(function (resolve, reject) {
    var script = document.createElement('script');
    script.src = EXCELJS_CDN;
    script.onload = function () {
      if (window.ExcelJS) {
        resolve(window.ExcelJS);
      } else {
        reject(new Error('کتابخانه ExcelJS بارگذاری نشد.'));
      }
    };
    script.onerror = function () {
      reject(new Error('برای ساخت یا خواندن فایل اکسل یک‌بار اینترنت لازم است. لطفاً اتصال اینترنت خود را بررسی کنید.'));
    };
    document.head.appendChild(script);
  });

  return excelJsLoadPromise;
}

/**
 * تمیز کردن نام شیت برای رعایت محدودیت‌های اکسل (حداکثر ۳۱ کاراکتر و بدون نویسه‌های ممنوع)
 */
function sanitizeSheetName(name, fallback) {
  var s = (name || fallback || 'Sheet')
    .replace(/[\\/?*\[\]:]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > 31) s = s.slice(0, 31);
  return s || 'Sheet';
}

/**
 * استایل مشترک شیت‌ها
 */
var FONT_TAHOMA = { name: 'Tahoma', size: 10 };
var FONT_HEADER = { name: 'Tahoma', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
var FONT_TITLE = { name: 'Tahoma', size: 12, bold: true };
var FILL_HEADER = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27272A' } };
var BORDER_THIN = {
  top: { style: 'thin', color: { argb: 'FFD4D4D8' } },
  left: { style: 'thin', color: { argb: 'FFD4D4D8' } },
  bottom: { style: 'thin', color: { argb: 'FFD4D4D8' } },
  right: { style: 'thin', color: { argb: 'FFD4D4D8' } }
};

/**
 * دانلود بایت‌های ورک‌بوک
 */
function downloadWorkbook(workbook, filename) {
  return workbook.xlsx.writeBuffer().then(function (buffer) {
    var blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = Names.sanitizeFilename(filename) + '.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  });
}

/**
 * ساخت شیت گزارش روز برای یک گروه
 */
function buildGroupDayReportSheets(workbook, cohort, group, dayN, includeFrozen) {
  var dayCfg = (cohort.days || []).find(function (d) { return d.n === dayN; }) || {
    n: dayN,
    type: 'main',
    hardLevels: 3,
    specialMission: true
  };

  var closedDays = group.closedDays || [];
  var isClosed = closedDays.indexOf(dayN) !== -1;
  var dayDate = Names.addDaysToIso(cohort.startDate, dayN - 1);
  var dayShamsi = Names.formatShamsiShort(dayDate);

  // اعضای گروه
  var members = (cohort.participants || []).filter(function (p) {
    if (p.groupId !== group.id) return false;
    if (!includeFrozen && (p.status === 'frozen' || p.status === 'left')) return false;
    return true;
  });

  // ۱. شیت گزارش (RTL، متنی، ارقام فارسی، مناسب نمایش و چاپ)
  var reportSheet = workbook.addWorksheet(sanitizeSheetName(group.name, 'گزارش'), {
    views: [{ rightToLeft: true, state: 'frozen', xSplit: 2, ySplit: 4 }]
  });

  // تنظیمات صفحه برای A4 افقی
  reportSheet.pageSetup = {
    orientation: 'landscape',
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0
  };

  // سطر ۱: عنوان ادغام‌شده
  var titleText = 'بوت‌کمپ بوشیدو — ' + cohort.name + ' — ' + group.name + ' — روز ' + Names.toPersianDigits(dayN) + ' (' + dayShamsi + ')';
  reportSheet.mergeCells('A1:H1');
  var cellA1 = reportSheet.getCell('A1');
  cellA1.value = titleText;
  cellA1.font = FONT_TITLE;
  cellA1.alignment = { horizontal: 'center', vertical: 'middle' };
  reportSheet.getRow(1).height = 26;

  // سطر ۲: وضعیت روز
  var statusText = isClosed ? 'وضعیت: نهایی (روز بسته شده است)' : 'وضعیت: پیش‌نویس (روز هنوز بسته نشده است)';
  reportSheet.mergeCells('A2:H2');
  var cellA2 = reportSheet.getCell('A2');
  cellA2.value = statusText;
  cellA2.font = { name: 'Tahoma', size: 9, italic: true, color: { argb: isClosed ? 'FF059669' : 'FFD97706' } };
  cellA2.alignment = { horizontal: 'center', vertical: 'middle' };

  // سطر ۳: یادآور قانون امتیاز
  var rules = ['هر عادت ۱ امتیاز'];
  if (dayCfg.hardLevels > 0) rules.push('کار سخت سطح ۱ تا ' + Names.toPersianDigits(dayCfg.hardLevels) + ' امتیاز');
  if (dayCfg.specialMission) rules.push('مأموریت ویژه ۱ امتیاز');
  reportSheet.mergeCells('A3:H3');
  var cellA3 = reportSheet.getCell('A3');
  cellA3.value = 'قوانین امتیاز: ' + rules.join(' ، ');
  cellA3.font = { name: 'Tahoma', size: 8, color: { argb: 'FF71717A' } };
  cellA3.alignment = { horizontal: 'center', vertical: 'middle' };

  // سطر ۴: سرستون‌ها
  var headers = ['ردیف', 'نام', 'عادت‌ها', 'کار سخت', 'مأموریت ویژه', 'امتیاز امروز', 'مجموع تا امروز', 'درصد'];
  var colWidths = [8, 24, 14, 14, 14, 14, 16, 12];
  var hRow = reportSheet.getRow(4);
  hRow.height = 22;
  headers.forEach(function (h, idx) {
    var col = idx + 1;
    var cell = hRow.getCell(col);
    cell.value = h;
    cell.font = FONT_HEADER;
    cell.fill = FILL_HEADER;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDER_THIN;
    reportSheet.getColumn(col).width = colWidths[idx];
  });

  // سطرهای داده در شیت گزارش
  members.forEach(function (p, idx) {
    var rowNum = idx + 5;
    var row = reportSheet.getRow(rowNum);
    row.height = 20;

    var rec = (cohort.records && cohort.records[p.id] && cohort.records[p.id][dayN]) || null;
    var totals = Scoring.personTotals(p, cohort, group, dayN);

    var hasRecord = rec && (rec.done != null || rec.hard != null || rec.special != null);

    // عادت‌ها
    var habitsText = '—';
    if (p.habitCount != null) {
      if (rec && rec.done != null) {
        habitsText = Names.toPersianDigits(rec.done) + ' از ' + Names.toPersianDigits(p.habitCount);
      } else {
        habitsText = '— از ' + Names.toPersianDigits(p.habitCount);
      }
    }

    // کار سخت
    var hardText = 'ندارد';
    if (dayCfg.hardLevels > 0) {
      if (rec && rec.hard != null) {
        var hVal = parseInt(rec.hard, 10);
        hardText = hVal > 0 ? ('سطح ' + Names.toPersianDigits(hVal)) : 'انجام نداد';
      } else {
        hardText = 'ثبت‌نشده';
      }
    }

    // مأموریت ویژه
    var specialText = 'ندارد';
    if (dayCfg.specialMission) {
      if (rec && rec.special != null) {
        specialText = rec.special > 0 ? '✓' : '✗';
      } else {
        specialText = 'ثبت‌نشده';
      }
    }

    // امتیاز امروز
    var dayScoreText = 'ثبت‌نشده';
    if (hasRecord) {
      var sc = Scoring.dayScore(p, rec, dayCfg);
      var mx = Scoring.dayMax(p, dayCfg, rec);
      dayScoreText = Names.toPersianDigits(sc) + ' از ' + Names.toPersianDigits(mx);
    }

    var totalText = Names.toPersianDigits(totals.totalScore) + ' از ' + Names.toPersianDigits(totals.totalMax);
    var percentText = Names.toPersianDigits(totals.percent) + '٪';

    var vals = [
      Names.toPersianDigits(idx + 1),
      p.name + (p.status === 'frozen' ? ' (فریز)' : p.status === 'left' ? ' (خارج)' : ''),
      habitsText,
      hardText,
      specialText,
      dayScoreText,
      totalText,
      percentText
    ];

    vals.forEach(function (v, cIdx) {
      var cell = row.getCell(cIdx + 1);
      cell.value = v;
      cell.font = FONT_TAHOMA;
      cell.alignment = { horizontal: cIdx === 1 ? 'right' : 'center', vertical: 'middle' };
      cell.border = BORDER_THIN;
    });
  });

  // ۲. شیت داده (ارقام عددی واقعی لاتین برای محاسبات و فرمول‌ها)
  var dataSheet = workbook.addWorksheet(sanitizeSheetName(group.name + '-داده', 'داده'), {
    views: [{ rightToLeft: true }]
  });

  var dataHeaders = [
    'ردیف', 'نام', 'habitCount', 'done', 'hard', 'special',
    'dayScore', 'dayMax', 'totalScore', 'totalMax', 'percent'
  ];
  var dataHRow = dataSheet.getRow(1);
  dataHeaders.forEach(function (h, idx) {
    var cell = dataHRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Tahoma', size: 9, bold: true };
    cell.alignment = { horizontal: 'center' };
  });

  members.forEach(function (p, idx) {
    var rNum = idx + 2;
    var row = dataSheet.getRow(rNum);
    var rec = (cohort.records && cohort.records[p.id] && cohort.records[p.id][dayN]) || null;
    var totals = Scoring.personTotals(p, cohort, group, dayN);

    var d = rec && rec.done != null ? parseInt(rec.done, 10) : null;
    var h = rec && rec.hard != null ? parseInt(rec.hard, 10) : null;
    var s = rec && rec.special != null ? parseInt(rec.special, 10) : null;

    var sc = (rec && (d != null || h != null || s != null)) ? Scoring.dayScore(p, rec, dayCfg) : null;
    var mx = (rec && (d != null || h != null || s != null)) ? Scoring.dayMax(p, dayCfg, rec) : null;

    var rowData = [
      idx + 1,
      p.name,
      p.habitCount != null ? p.habitCount : null,
      d,
      h,
      s,
      sc,
      mx,
      totals.totalScore,
      totals.totalMax,
      totals.percent
    ];

    rowData.forEach(function (val, cIdx) {
      var cell = row.getCell(cIdx + 1);
      if (val !== null && val !== undefined) {
        cell.value = val;
      }
    });
  });
}

/**
 * ۱. خروجی اکسل گزارش روز یک گروه
 */
function exportGroupDayReport(cohort, group, dayN, includeFrozen) {
  return loadExcelJS().then(function (ExcelJS) {
    var workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bushido Support Tool';
    workbook.created = new Date();

    buildGroupDayReportSheets(workbook, cohort, group, dayN, includeFrozen);

    var filename = 'بوشیدو-' + cohort.name + '-' + group.name + '-روز' + dayN;
    return downloadWorkbook(workbook, filename);
  });
}

/**
 * ۲. خروجی اکسل گزارش کل دوره یک گروه
 */
function exportGroupFullCohortReport(cohort, group, includeFrozen) {
  return loadExcelJS().then(function (ExcelJS) {
    var workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bushido Support Tool';
    workbook.created = new Date();

    var mainDays = (cohort.days || []).filter(function (d) { return d.type === 'main'; });
    var closedDays = group.closedDays || [];

    var members = (cohort.participants || []).filter(function (p) {
      if (p.groupId !== group.id) return false;
      if (!includeFrozen && (p.status === 'frozen' || p.status === 'left')) return false;
      return true;
    });

    // شیت ماتریس گزارش
    var sheet = workbook.addWorksheet(sanitizeSheetName(group.name, 'ماتریس'), {
      views: [{ rightToLeft: true, state: 'frozen', xSplit: 2, ySplit: 2 }]
    });

    // سطر ۱: عنوان گروه
    var title = 'گزارش کل دوره — ' + cohort.name + ' — ' + group.name;
    sheet.mergeCells(1, 1, 1, mainDays.length + 5);
    var titleCell = sheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = FONT_TITLE;
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 24;

    // سطر ۲: سرستون‌ها
    var hRow = sheet.getRow(2);
    hRow.height = 28;
    hRow.getCell(1).value = 'ردیف';
    hRow.getCell(1).font = FONT_HEADER;
    hRow.getCell(1).fill = FILL_HEADER;
    hRow.getCell(1).border = BORDER_THIN;
    sheet.getColumn(1).width = 7;

    hRow.getCell(2).value = 'نام';
    hRow.getCell(2).font = FONT_HEADER;
    hRow.getCell(2).fill = FILL_HEADER;
    hRow.getCell(2).border = BORDER_THIN;
    sheet.getColumn(2).width = 22;

    mainDays.forEach(function (d, dIdx) {
      var col = dIdx + 3;
      var dayDate = Names.addDaysToIso(cohort.startDate, d.n - 1);
      var shamsi = Names.formatShamsiShort(dayDate);
      var cell = hRow.getCell(col);
      cell.value = 'روز ' + Names.toPersianDigits(d.n) + '\n' + shamsi;
      cell.font = { name: 'Tahoma', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = FILL_HEADER;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = BORDER_THIN;
      sheet.getColumn(col).width = 10;
    });

    var totCol = mainDays.length + 3;
    var maxCol = mainDays.length + 4;
    var pctCol = mainDays.length + 5;

    hRow.getCell(totCol).value = 'مجموع';
    hRow.getCell(totCol).font = FONT_HEADER;
    hRow.getCell(totCol).fill = FILL_HEADER;
    hRow.getCell(totCol).border = BORDER_THIN;
    sheet.getColumn(totCol).width = 12;

    hRow.getCell(maxCol).value = 'حداکثر';
    hRow.getCell(maxCol).font = FONT_HEADER;
    hRow.getCell(maxCol).fill = FILL_HEADER;
    hRow.getCell(maxCol).border = BORDER_THIN;
    sheet.getColumn(maxCol).width = 12;

    hRow.getCell(pctCol).value = 'درصد';
    hRow.getCell(pctCol).font = FONT_HEADER;
    hRow.getCell(pctCol).fill = FILL_HEADER;
    hRow.getCell(pctCol).border = BORDER_THIN;
    sheet.getColumn(pctCol).width = 10;

    // سطرهای افراد
    members.forEach(function (p, mIdx) {
      var row = sheet.getRow(mIdx + 3);
      row.height = 20;

      row.getCell(1).value = Names.toPersianDigits(mIdx + 1);
      row.getCell(1).font = FONT_TAHOMA;
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(1).border = BORDER_THIN;

      row.getCell(2).value = p.name + (p.status === 'frozen' ? ' (فریز)' : p.status === 'left' ? ' (خارج)' : '');
      row.getCell(2).font = FONT_TAHOMA;
      row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(2).border = BORDER_THIN;

      mainDays.forEach(function (d, dIdx) {
        var col = dIdx + 3;
        var cell = row.getCell(col);
        cell.border = BORDER_THIN;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = FONT_TAHOMA;

        // فقط اگر روز بسته شده باشد امتیاز را نشان بده، وگرنه خالی
        if (closedDays.indexOf(d.n) !== -1) {
          var rec = (cohort.records && cohort.records[p.id] && cohort.records[p.id][d.n]) || null;
          var sc = Scoring.dayScore(p, rec, d);
          cell.value = Names.toPersianDigits(sc);
        } else {
          cell.value = '';
        }
      });

      var totals = Scoring.personTotals(p, cohort, group);
      row.getCell(totCol).value = Names.toPersianDigits(totals.totalScore);
      row.getCell(totCol).font = FONT_TAHOMA;
      row.getCell(totCol).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(totCol).border = BORDER_THIN;

      row.getCell(maxCol).value = Names.toPersianDigits(totals.totalMax);
      row.getCell(maxCol).font = FONT_TAHOMA;
      row.getCell(maxCol).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(maxCol).border = BORDER_THIN;

      row.getCell(pctCol).value = Names.toPersianDigits(totals.percent) + '٪';
      row.getCell(pctCol).font = FONT_TAHOMA;
      row.getCell(pctCol).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(pctCol).border = BORDER_THIN;
    });

    // شیت داده لاتین
    var dataSheet = workbook.addWorksheet(sanitizeSheetName(group.name + '-داده', 'داده'), {
      views: [{ rightToLeft: true }]
    });

    var dataHeaders = ['ردیف', 'نام'].concat(
      mainDays.map(function (d) { return 'Day' + d.n; }),
      ['totalScore', 'totalMax', 'percent']
    );

    var dHRow = dataSheet.getRow(1);
    dataHeaders.forEach(function (dh, idx) {
      dHRow.getCell(idx + 1).value = dh;
    });

    members.forEach(function (p, mIdx) {
      var row = dataSheet.getRow(mIdx + 2);
      row.getCell(1).value = mIdx + 1;
      row.getCell(2).value = p.name;

      mainDays.forEach(function (d, dIdx) {
        var col = dIdx + 3;
        if (closedDays.indexOf(d.n) !== -1) {
          var rec = (cohort.records && cohort.records[p.id] && cohort.records[p.id][d.n]) || null;
          row.getCell(col).value = Scoring.dayScore(p, rec, d);
        }
      });

      var totals = Scoring.personTotals(p, cohort, group);
      row.getCell(totCol).value = totals.totalScore;
      row.getCell(maxCol).value = totals.totalMax;
      row.getCell(pctCol).value = totals.percent;
    });

    var filename = 'بوشیدو-' + cohort.name + '-' + group.name + '-کل-دوره';
    return downloadWorkbook(workbook, filename);
  });
}

/**
 * ۳. خروجی اکسل همه گروه‌های من در یک فایل
 * @param {Object} cohort دوره
 * @param {'day'|'full'} mode نوع گزارش ('day' یا 'full')
 * @param {number} [dayN] شماره روز در صورت mode === 'day'
 * @param {boolean} includeFrozen
 */
function exportAllMyGroupsReport(cohort, mode, dayN, includeFrozen) {
  return loadExcelJS().then(function (ExcelJS) {
    var workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bushido Support Tool';
    workbook.created = new Date();

    var myGroups = (cohort.groups || []).filter(function (g) { return g.mine; });
    if (!myGroups.length) {
      myGroups = cohort.groups || [];
    }

    if (mode === 'day') {
      myGroups.forEach(function (g) {
        buildGroupDayReportSheets(workbook, cohort, g, dayN, includeFrozen);
      });
      var fn = 'بوشیدو-' + cohort.name + '-همه-گروه‌ها-روز' + dayN;
      return downloadWorkbook(workbook, fn);
    } else {
      // گزارش کل دوره برای همه گروه‌ها
      myGroups.forEach(function (g) {
        var mainDays = (cohort.days || []).filter(function (d) { return d.type === 'main'; });
        var closedDays = g.closedDays || [];
        var members = (cohort.participants || []).filter(function (p) {
          if (p.groupId !== g.id) return false;
          if (!includeFrozen && (p.status === 'frozen' || p.status === 'left')) return false;
          return true;
        });

        var sheet = workbook.addWorksheet(sanitizeSheetName(g.name, 'گروه'), {
          views: [{ rightToLeft: true, state: 'frozen', xSplit: 2, ySplit: 2 }]
        });

        sheet.mergeCells(1, 1, 1, mainDays.length + 5);
        var titleCell = sheet.getCell('A1');
        titleCell.value = 'گزارش کل دوره — ' + cohort.name + ' — ' + g.name;
        titleCell.font = FONT_TITLE;
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(1).height = 24;

        var hRow = sheet.getRow(2);
        hRow.height = 28;
        hRow.getCell(1).value = 'ردیف';
        hRow.getCell(1).font = FONT_HEADER;
        hRow.getCell(1).fill = FILL_HEADER;
        hRow.getCell(1).border = BORDER_THIN;
        sheet.getColumn(1).width = 7;

        hRow.getCell(2).value = 'نام';
        hRow.getCell(2).font = FONT_HEADER;
        hRow.getCell(2).fill = FILL_HEADER;
        hRow.getCell(2).border = BORDER_THIN;
        sheet.getColumn(2).width = 22;

        mainDays.forEach(function (d, dIdx) {
          var col = dIdx + 3;
          var cell = hRow.getCell(col);
          cell.value = 'روز ' + Names.toPersianDigits(d.n);
          cell.font = { name: 'Tahoma', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = FILL_HEADER;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = BORDER_THIN;
          sheet.getColumn(col).width = 9;
        });

        var totCol = mainDays.length + 3;
        var maxCol = mainDays.length + 4;
        var pctCol = mainDays.length + 5;

        hRow.getCell(totCol).value = 'مجموع';
        hRow.getCell(totCol).font = FONT_HEADER;
        hRow.getCell(totCol).fill = FILL_HEADER;
        hRow.getCell(totCol).border = BORDER_THIN;

        hRow.getCell(maxCol).value = 'حداکثر';
        hRow.getCell(maxCol).font = FONT_HEADER;
        hRow.getCell(maxCol).fill = FILL_HEADER;
        hRow.getCell(maxCol).border = BORDER_THIN;

        hRow.getCell(pctCol).value = 'درصد';
        hRow.getCell(pctCol).font = FONT_HEADER;
        hRow.getCell(pctCol).fill = FILL_HEADER;
        hRow.getCell(pctCol).border = BORDER_THIN;

        members.forEach(function (p, mIdx) {
          var row = sheet.getRow(mIdx + 3);
          row.height = 20;

          row.getCell(1).value = Names.toPersianDigits(mIdx + 1);
          row.getCell(1).font = FONT_TAHOMA;
          row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
          row.getCell(1).border = BORDER_THIN;

          row.getCell(2).value = p.name + (p.status === 'frozen' ? ' (فریز)' : p.status === 'left' ? ' (خارج)' : '');
          row.getCell(2).font = FONT_TAHOMA;
          row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
          row.getCell(2).border = BORDER_THIN;

          mainDays.forEach(function (d, dIdx) {
            var col = dIdx + 3;
            var cell = row.getCell(col);
            cell.border = BORDER_THIN;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.font = FONT_TAHOMA;

            if (closedDays.indexOf(d.n) !== -1) {
              var rec = (cohort.records && cohort.records[p.id] && cohort.records[p.id][d.n]) || null;
              var sc = Scoring.dayScore(p, rec, d);
              cell.value = Names.toPersianDigits(sc);
            } else {
              cell.value = '';
            }
          });

          var totals = Scoring.personTotals(p, cohort, g);
          row.getCell(totCol).value = Names.toPersianDigits(totals.totalScore);
          row.getCell(totCol).font = FONT_TAHOMA;
          row.getCell(totCol).alignment = { horizontal: 'center', vertical: 'middle' };
          row.getCell(totCol).border = BORDER_THIN;

          row.getCell(maxCol).value = Names.toPersianDigits(totals.totalMax);
          row.getCell(maxCol).font = FONT_TAHOMA;
          row.getCell(maxCol).alignment = { horizontal: 'center', vertical: 'middle' };
          row.getCell(maxCol).border = BORDER_THIN;

          row.getCell(pctCol).value = Names.toPersianDigits(totals.percent) + '٪';
          row.getCell(pctCol).font = FONT_TAHOMA;
          row.getCell(pctCol).alignment = { horizontal: 'center', vertical: 'middle' };
          row.getCell(pctCol).border = BORDER_THIN;
        });
      });

      var fullFn = 'بوشیدو-' + cohort.name + '-همه-گروه‌ها-کل-دوره';
      return downloadWorkbook(workbook, fullFn);
    }
  });
}

export const Excel = {
  loadExcelJS: loadExcelJS,
  exportGroupDayReport: exportGroupDayReport,
  exportGroupFullCohortReport: exportGroupFullCohortReport,
  exportAllMyGroupsReport: exportAllMyGroupsReport
};
