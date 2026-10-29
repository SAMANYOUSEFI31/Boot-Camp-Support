/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Names } from './names';
import { Scoring } from './scoring';
import type { Cohort, Group } from './types';

// کتابخانهٔ ExcelJS از CDN می‌آید و تایپ ندارد
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcelJSLib = any;

const EXCELJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
const isExcelJsLoading = false;
let excelJsLoadPromise: Promise<ExcelJSLib> | null = null;

/**
 * بارگذاری تنبل کتابخانه ExcelJS
 */
function loadExcelJS(): Promise<ExcelJSLib> {
  if (window.ExcelJS) {
    return Promise.resolve(window.ExcelJS);
  }
  if (excelJsLoadPromise) {
    return excelJsLoadPromise;
  }

  excelJsLoadPromise = new Promise(function (resolve, reject) {
    const script = document.createElement('script');
    script.src = EXCELJS_CDN;
    script.onload = function () {
      if (window.ExcelJS) {
        resolve(window.ExcelJS);
      } else {
        reject(new Error('کتابخانه ExcelJS بارگذاری نشد.'));
      }
    };
    script.onerror = function () {
      reject(
        new Error(
          'برای ساخت یا خواندن فایل اکسل یک‌بار اینترنت لازم است. لطفاً اتصال اینترنت خود را بررسی کنید.'
        )
      );
    };
    document.head.appendChild(script);
  });

  return excelJsLoadPromise;
}

/**
 * تمیز کردن نام شیت برای رعایت محدودیت‌های اکسل (حداکثر ۳۱ کاراکتر و بدون نویسه‌های ممنوع)
 */
function sanitizeSheetName(name: unknown, fallback: string): string {
  let s = String(name || fallback || 'Sheet')
    .replace(/[\\/?*\[\]:]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > 31) s = s.slice(0, 31);
  return s || 'Sheet';
}

/**
 * استایل مشترک شیت‌ها
 */
const FONT_TAHOMA = { name: 'Tahoma', size: 10 };
const FONT_HEADER = { name: 'Tahoma', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
const FONT_TITLE = { name: 'Tahoma', size: 12, bold: true };
const FILL_HEADER = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27272A' } };
const BORDER_THIN = {
  top: { style: 'thin', color: { argb: 'FFD4D4D8' } },
  left: { style: 'thin', color: { argb: 'FFD4D4D8' } },
  bottom: { style: 'thin', color: { argb: 'FFD4D4D8' } },
  right: { style: 'thin', color: { argb: 'FFD4D4D8' } }
};

/**
 * دانلود بایت‌های ورک‌بوک
 */
function downloadWorkbook(workbook: ExcelJSLib, filename: string) {
  return workbook.xlsx.writeBuffer().then(function (buffer: ArrayBuffer) {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = Names.sanitizeFilename(filename) + '.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2000);
  });
}

/**
 * ساخت شیت گزارش روز برای یک گروه
 */
function buildGroupDayReportSheets(
  workbook: ExcelJSLib,
  cohort: Cohort,
  group: Group,
  dayN: number,
  includeFrozen?: boolean
) {
  const dayCfg = (cohort.days || []).find(function (d) {
    return d.n === dayN;
  }) || {
    n: dayN,
    type: 'main',
    hardLevels: 3,
    specialMission: true
  };

  const closedDays = group.closedDays || [];
  const isClosed = closedDays.indexOf(dayN) !== -1;
  const dayDate = Names.addDaysToIso(cohort.startDate, dayN - 1);
  const dayShamsi = Names.formatShamsiShort(dayDate);

  // اعضای گروه
  const members = (cohort.participants || []).filter(function (p) {
    if (p.groupId !== group.id) return false;
    if (!includeFrozen && (p.status === 'frozen' || p.status === 'left')) return false;
    return true;
  });

  // ۱. شیت گزارش (RTL، متنی، ارقام فارسی، مناسب نمایش و چاپ)
  const reportSheet = workbook.addWorksheet(sanitizeSheetName(group.name, 'گزارش'), {
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
  const titleText =
    'بوت‌کمپ بوشیدو — ' +
    cohort.name +
    ' — ' +
    group.name +
    ' — روز ' +
    Names.toPersianDigits(dayN) +
    ' (' +
    dayShamsi +
    ')';
  reportSheet.mergeCells('A1:H1');
  const cellA1 = reportSheet.getCell('A1');
  cellA1.value = titleText;
  cellA1.font = FONT_TITLE;
  cellA1.alignment = { horizontal: 'center', vertical: 'middle' };
  reportSheet.getRow(1).height = 26;

  // سطر ۲: وضعیت روز
  const statusText = isClosed
    ? 'وضعیت: نهایی (روز بسته شده است)'
    : 'وضعیت: پیش‌نویس (روز هنوز بسته نشده است)';
  reportSheet.mergeCells('A2:H2');
  const cellA2 = reportSheet.getCell('A2');
  cellA2.value = statusText;
  cellA2.font = {
    name: 'Tahoma',
    size: 9,
    italic: true,
    color: { argb: isClosed ? 'FF059669' : 'FFD97706' }
  };
  cellA2.alignment = { horizontal: 'center', vertical: 'middle' };

  // سطر ۳: یادآور قانون امتیاز
  const rules = ['هر عادت ۱ امتیاز'];
  if (dayCfg.hardLevels > 0)
    rules.push('کار سخت سطح ۱ تا ' + Names.toPersianDigits(dayCfg.hardLevels) + ' امتیاز');
  if (dayCfg.specialMission) rules.push('مأموریت ویژه ۱ امتیاز');
  reportSheet.mergeCells('A3:H3');
  const cellA3 = reportSheet.getCell('A3');
  cellA3.value = 'قوانین امتیاز: ' + rules.join(' ، ');
  cellA3.font = { name: 'Tahoma', size: 8, color: { argb: 'FF71717A' } };
  cellA3.alignment = { horizontal: 'center', vertical: 'middle' };

  // سطر ۴: سرستون‌ها
  const headers = [
    'ردیف',
    'نام',
    'عادت‌ها',
    'کار سخت',
    'مأموریت ویژه',
    'امتیاز امروز',
    'مجموع تا امروز',
    'درصد'
  ];
  const colWidths = [8, 24, 14, 14, 14, 14, 16, 12];
  const hRow = reportSheet.getRow(4);
  hRow.height = 22;
  headers.forEach(function (h, idx) {
    const col = idx + 1;
    const cell = hRow.getCell(col);
    cell.value = h;
    cell.font = FONT_HEADER;
    cell.fill = FILL_HEADER;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDER_THIN;
    reportSheet.getColumn(col).width = colWidths[idx];
  });

  // سطرهای داده در شیت گزارش
  members.forEach(function (p, idx) {
    const rowNum = idx + 5;
    const row = reportSheet.getRow(rowNum);
    row.height = 20;

    const rec = (cohort.records && cohort.records[p.id] && cohort.records[p.id][dayN]) || null;
    const totals = Scoring.personTotals(p, cohort, group, dayN);

    const hasRecord = rec && (rec.done != null || rec.hard != null || rec.special != null);

    // عادت‌ها
    let habitsText = '—';
    if (p.habitCount != null) {
      if (rec && rec.done != null) {
        habitsText = Names.toPersianDigits(rec.done) + ' از ' + Names.toPersianDigits(p.habitCount);
      } else {
        habitsText = '— از ' + Names.toPersianDigits(p.habitCount);
      }
    }

    // کار سخت
    let hardText = 'ندارد';
    if (dayCfg.hardLevels > 0) {
      if (rec && rec.hard != null) {
        const hVal = Number(rec.hard);
        hardText = hVal > 0 ? 'سطح ' + Names.toPersianDigits(hVal) : 'انجام نداد';
      } else {
        hardText = 'ثبت‌نشده';
      }
    }

    // مأموریت ویژه
    let specialText = 'ندارد';
    if (dayCfg.specialMission) {
      if (rec && rec.special != null) {
        specialText = rec.special > 0 ? '✓' : '✗';
      } else {
        specialText = 'ثبت‌نشده';
      }
    }

    // امتیاز امروز
    let dayScoreText = 'ثبت‌نشده';
    if (hasRecord) {
      const sc = Scoring.dayScore(p, rec, dayCfg);
      const mx = Scoring.dayMax(p, dayCfg, rec);
      dayScoreText = Names.toPersianDigits(sc) + ' از ' + Names.toPersianDigits(mx);
    }

    const totalText =
      Names.toPersianDigits(totals.totalScore) + ' از ' + Names.toPersianDigits(totals.totalMax);
    const percentText = Names.toPersianDigits(totals.percent) + '٪';

    const vals = [
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
      const cell = row.getCell(cIdx + 1);
      cell.value = v;
      cell.font = FONT_TAHOMA;
      cell.alignment = { horizontal: cIdx === 1 ? 'right' : 'center', vertical: 'middle' };
      cell.border = BORDER_THIN;
    });
  });

  // ۲. شیت داده (ارقام عددی واقعی لاتین برای محاسبات و فرمول‌ها)
  const dataSheet = workbook.addWorksheet(sanitizeSheetName(group.name + '-داده', 'داده'), {
    views: [{ rightToLeft: true }]
  });

  const dataHeaders = [
    'ردیف',
    'نام',
    'habitCount',
    'done',
    'hard',
    'special',
    'dayScore',
    'dayMax',
    'totalScore',
    'totalMax',
    'percent'
  ];
  const dataHRow = dataSheet.getRow(1);
  dataHeaders.forEach(function (h, idx) {
    const cell = dataHRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Tahoma', size: 9, bold: true };
    cell.alignment = { horizontal: 'center' };
  });

  members.forEach(function (p, idx) {
    const rNum = idx + 2;
    const row = dataSheet.getRow(rNum);
    const rec = (cohort.records && cohort.records[p.id] && cohort.records[p.id][dayN]) || null;
    const totals = Scoring.personTotals(p, cohort, group, dayN);

    const d = rec && rec.done != null ? Number(rec.done) : null;
    const h = rec && rec.hard != null ? Number(rec.hard) : null;
    const s = rec && rec.special != null ? Number(rec.special) : null;

    const sc = rec && (d != null || h != null || s != null) ? Scoring.dayScore(p, rec, dayCfg) : null;
    const mx = rec && (d != null || h != null || s != null) ? Scoring.dayMax(p, dayCfg, rec) : null;

    const rowData = [
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
      const cell = row.getCell(cIdx + 1);
      if (val !== null && val !== undefined) {
        cell.value = val;
      }
    });
  });
}

/**
 * ۱. خروجی اکسل گزارش روز یک گروه
 */
function exportGroupDayReport(cohort: Cohort, group: Group, dayN: number, includeFrozen?: boolean) {
  return loadExcelJS().then(function (ExcelJS) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bushido Support Tool';
    workbook.created = new Date();

    buildGroupDayReportSheets(workbook, cohort, group, dayN, includeFrozen);

    const filename = 'بوشیدو-' + cohort.name + '-' + group.name + '-روز' + dayN;
    return downloadWorkbook(workbook, filename);
  });
}

/**
 * ۲. خروجی اکسل گزارش کل دوره یک گروه
 */
function exportGroupFullCohortReport(cohort: Cohort, group: Group, includeFrozen?: boolean) {
  return loadExcelJS().then(function (ExcelJS) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bushido Support Tool';
    workbook.created = new Date();

    const mainDays = (cohort.days || []).filter(function (d) {
      return d.type === 'main';
    });
    const closedDays = group.closedDays || [];

    const members = (cohort.participants || []).filter(function (p) {
      if (p.groupId !== group.id) return false;
      if (!includeFrozen && (p.status === 'frozen' || p.status === 'left')) return false;
      return true;
    });

    // شیت ماتریس گزارش
    const sheet = workbook.addWorksheet(sanitizeSheetName(group.name, 'ماتریس'), {
      views: [{ rightToLeft: true, state: 'frozen', xSplit: 2, ySplit: 2 }]
    });

    // سطر ۱: عنوان گروه
    const title = 'گزارش کل دوره — ' + cohort.name + ' — ' + group.name;
    sheet.mergeCells(1, 1, 1, mainDays.length + 5);
    const titleCell = sheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = FONT_TITLE;
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 24;

    // سطر ۲: سرستون‌ها
    const hRow = sheet.getRow(2);
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
      const col = dIdx + 3;
      const dayDate = Names.addDaysToIso(cohort.startDate, d.n - 1);
      const shamsi = Names.formatShamsiShort(dayDate);
      const cell = hRow.getCell(col);
      cell.value = 'روز ' + Names.toPersianDigits(d.n) + '\n' + shamsi;
      cell.font = { name: 'Tahoma', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = FILL_HEADER;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = BORDER_THIN;
      sheet.getColumn(col).width = 10;
    });

    const totCol = mainDays.length + 3;
    const maxCol = mainDays.length + 4;
    const pctCol = mainDays.length + 5;

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
      const row = sheet.getRow(mIdx + 3);
      row.height = 20;

      row.getCell(1).value = Names.toPersianDigits(mIdx + 1);
      row.getCell(1).font = FONT_TAHOMA;
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(1).border = BORDER_THIN;

      row.getCell(2).value =
        p.name + (p.status === 'frozen' ? ' (فریز)' : p.status === 'left' ? ' (خارج)' : '');
      row.getCell(2).font = FONT_TAHOMA;
      row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(2).border = BORDER_THIN;

      mainDays.forEach(function (d, dIdx) {
        const col = dIdx + 3;
        const cell = row.getCell(col);
        cell.border = BORDER_THIN;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = FONT_TAHOMA;

        // فقط اگر روز بسته شده باشد امتیاز را نشان بده، وگرنه خالی
        if (closedDays.indexOf(d.n) !== -1) {
          const rec = (cohort.records && cohort.records[p.id] && cohort.records[p.id][d.n]) || null;
          const sc = Scoring.dayScore(p, rec, d);
          cell.value = Names.toPersianDigits(sc);
        } else {
          cell.value = '';
        }
      });

      const totals = Scoring.personTotals(p, cohort, group);
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
    const dataSheet = workbook.addWorksheet(sanitizeSheetName(group.name + '-داده', 'داده'), {
      views: [{ rightToLeft: true }]
    });

    const dataHeaders = ['ردیف', 'نام'].concat(
      mainDays.map(function (d) {
        return 'Day' + d.n;
      }),
      ['totalScore', 'totalMax', 'percent']
    );

    const dHRow = dataSheet.getRow(1);
    dataHeaders.forEach(function (dh, idx) {
      dHRow.getCell(idx + 1).value = dh;
    });

    members.forEach(function (p, mIdx) {
      const row = dataSheet.getRow(mIdx + 2);
      row.getCell(1).value = mIdx + 1;
      row.getCell(2).value = p.name;

      mainDays.forEach(function (d, dIdx) {
        const col = dIdx + 3;
        if (closedDays.indexOf(d.n) !== -1) {
          const rec = (cohort.records && cohort.records[p.id] && cohort.records[p.id][d.n]) || null;
          row.getCell(col).value = Scoring.dayScore(p, rec, d);
        }
      });

      const totals = Scoring.personTotals(p, cohort, group);
      row.getCell(totCol).value = totals.totalScore;
      row.getCell(maxCol).value = totals.totalMax;
      row.getCell(pctCol).value = totals.percent;
    });

    const filename = 'بوشیدو-' + cohort.name + '-' + group.name + '-کل-دوره';
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
function exportAllMyGroupsReport(
  cohort: Cohort,
  mode: 'day' | 'full',
  dayN: number | null,
  includeFrozen?: boolean
) {
  return loadExcelJS().then(function (ExcelJS) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bushido Support Tool';
    workbook.created = new Date();

    let myGroups = (cohort.groups || []).filter(function (g) {
      return g.mine;
    });
    if (!myGroups.length) {
      myGroups = cohort.groups || [];
    }

    if (mode === 'day') {
      myGroups.forEach(function (g) {
        buildGroupDayReportSheets(workbook, cohort, g, dayN as number, includeFrozen);
      });
      const fn = 'بوشیدو-' + cohort.name + '-همه-گروه‌ها-روز' + dayN;
      return downloadWorkbook(workbook, fn);
    } else {
      // گزارش کل دوره برای همه گروه‌ها
      myGroups.forEach(function (g) {
        const mainDays = (cohort.days || []).filter(function (d) {
          return d.type === 'main';
        });
        const closedDays = g.closedDays || [];
        const members = (cohort.participants || []).filter(function (p) {
          if (p.groupId !== g.id) return false;
          if (!includeFrozen && (p.status === 'frozen' || p.status === 'left')) return false;
          return true;
        });

        const sheet = workbook.addWorksheet(sanitizeSheetName(g.name, 'گروه'), {
          views: [{ rightToLeft: true, state: 'frozen', xSplit: 2, ySplit: 2 }]
        });

        sheet.mergeCells(1, 1, 1, mainDays.length + 5);
        const titleCell = sheet.getCell('A1');
        titleCell.value = 'گزارش کل دوره — ' + cohort.name + ' — ' + g.name;
        titleCell.font = FONT_TITLE;
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(1).height = 24;

        const hRow = sheet.getRow(2);
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
          const col = dIdx + 3;
          const cell = hRow.getCell(col);
          cell.value = 'روز ' + Names.toPersianDigits(d.n);
          cell.font = { name: 'Tahoma', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = FILL_HEADER;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = BORDER_THIN;
          sheet.getColumn(col).width = 9;
        });

        const totCol = mainDays.length + 3;
        const maxCol = mainDays.length + 4;
        const pctCol = mainDays.length + 5;

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
          const row = sheet.getRow(mIdx + 3);
          row.height = 20;

          row.getCell(1).value = Names.toPersianDigits(mIdx + 1);
          row.getCell(1).font = FONT_TAHOMA;
          row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
          row.getCell(1).border = BORDER_THIN;

          row.getCell(2).value =
            p.name + (p.status === 'frozen' ? ' (فریز)' : p.status === 'left' ? ' (خارج)' : '');
          row.getCell(2).font = FONT_TAHOMA;
          row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
          row.getCell(2).border = BORDER_THIN;

          mainDays.forEach(function (d, dIdx) {
            const col = dIdx + 3;
            const cell = row.getCell(col);
            cell.border = BORDER_THIN;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.font = FONT_TAHOMA;

            if (closedDays.indexOf(d.n) !== -1) {
              const rec = (cohort.records && cohort.records[p.id] && cohort.records[p.id][d.n]) || null;
              const sc = Scoring.dayScore(p, rec, d);
              cell.value = Names.toPersianDigits(sc);
            } else {
              cell.value = '';
            }
          });

          const totals = Scoring.personTotals(p, cohort, g);
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

      const fullFn = 'بوشیدو-' + cohort.name + '-همه-گروه‌ها-کل-دوره';
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
