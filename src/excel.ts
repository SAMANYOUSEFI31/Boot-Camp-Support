/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Names } from './names';
import {
  MATRIX_TITLES,
  buildCohortMatrix,
  buildReportRows,
  cellText,
  columnTitle,
  dataFields,
  visibleColumns
} from './report-columns';
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

const colLetter = (n: number) => String.fromCharCode(64 + n);

const styleHeaderCell = (
  cell: { value: unknown; font: unknown; fill: unknown; border: unknown },
  value: string
) => {
  cell.value = value;
  cell.font = FONT_HEADER;
  cell.fill = FILL_HEADER;
  cell.border = BORDER_THIN;
};

/**
 * ساخت شیت گزارش روز برای یک گروه
 * ستون‌ها، عنوان‌ها و مقدارها همه از report-columns.ts می‌آیند.
 */
function buildGroupDayReportSheets(
  workbook: ExcelJSLib,
  cohort: Cohort,
  group: Group,
  dayN: number,
  includeFrozen?: boolean
) {
  const report = buildReportRows(cohort, group, dayN, { includeFrozen: includeFrozen });
  const columns = visibleColumns('excel', report.ctx);
  const lastCol = colLetter(columns.length);

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
    report.dayShamsi +
    ')';
  reportSheet.mergeCells('A1:' + lastCol + '1');
  const cellA1 = reportSheet.getCell('A1');
  cellA1.value = titleText;
  cellA1.font = FONT_TITLE;
  cellA1.alignment = { horizontal: 'center', vertical: 'middle' };
  reportSheet.getRow(1).height = 26;

  // سطر ۲: وضعیت روز
  const statusText = report.isClosed
    ? 'وضعیت: نهایی (روز بسته شده است)'
    : 'وضعیت: پیش‌نویس (روز هنوز بسته نشده است)';
  reportSheet.mergeCells('A2:' + lastCol + '2');
  const cellA2 = reportSheet.getCell('A2');
  cellA2.value = statusText;
  cellA2.font = {
    name: 'Tahoma',
    size: 9,
    italic: true,
    color: { argb: report.isClosed ? 'FF059669' : 'FFD97706' }
  };
  cellA2.alignment = { horizontal: 'center', vertical: 'middle' };

  // سطر ۳: یادآور قانون امتیاز
  reportSheet.mergeCells('A3:' + lastCol + '3');
  const cellA3 = reportSheet.getCell('A3');
  cellA3.value = 'قوانین امتیاز: ' + report.rules.join(' ، ');
  cellA3.font = { name: 'Tahoma', size: 8, color: { argb: 'FF71717A' } };
  cellA3.alignment = { horizontal: 'center', vertical: 'middle' };

  // سطر ۴: سرستون‌ها
  const hRow = reportSheet.getRow(4);
  hRow.height = 22;
  columns.forEach(function (c, idx) {
    const cell = hRow.getCell(idx + 1);
    styleHeaderCell(cell, columnTitle(c, 'excel'));
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    reportSheet.getColumn(idx + 1).width = c.excelWidth;
  });

  // سطرهای داده در شیت گزارش
  report.rows.forEach(function (r, idx) {
    const row = reportSheet.getRow(idx + 5);
    row.height = 20;
    columns.forEach(function (c, cIdx) {
      const cell = row.getCell(cIdx + 1);
      cell.value = cellText(c, r, report.ctx, 'excel');
      cell.font = FONT_TAHOMA;
      cell.alignment = { horizontal: c.kind === 'name' ? 'right' : 'center', vertical: 'middle' };
      cell.border = BORDER_THIN;
    });
  });

  // ۲. شیت داده (ارقام عددی واقعی لاتین برای محاسبات و فرمول‌ها)
  const dataSheet = workbook.addWorksheet(sanitizeSheetName(group.name + '-داده', 'داده'), {
    views: [{ rightToLeft: true }]
  });
  const fields = dataFields();
  const dataHRow = dataSheet.getRow(1);
  fields.forEach(function (f, idx) {
    const cell = dataHRow.getCell(idx + 1);
    cell.value = f.header;
    cell.font = { name: 'Tahoma', size: 9, bold: true };
    cell.alignment = { horizontal: 'center' };
  });
  report.rows.forEach(function (r, idx) {
    const row = dataSheet.getRow(idx + 2);
    fields.forEach(function (f, cIdx) {
      const val = f.value(r);
      if (val !== null && val !== undefined) {
        row.getCell(cIdx + 1).value = val;
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
 * شیت ماتریس کل دوره برای یک گروه (روزها در ستون‌ها)
 * variant 'single': سرستون روز با تاریخ، عرض ستون‌ها و شیت داده؛ 'all': نسخهٔ فشرده برای فایل همهٔ گروه‌ها
 */
function buildFullCohortSheets(
  workbook: ExcelJSLib,
  cohort: Cohort,
  group: Group,
  includeFrozen: boolean | undefined,
  variant: 'single' | 'all'
) {
  const single = variant === 'single';
  const { mainDays, rows } = buildCohortMatrix(cohort, group, { includeFrozen: includeFrozen });
  const totCol = mainDays.length + 3;
  const maxCol = mainDays.length + 4;
  const pctCol = mainDays.length + 5;

  const sheet = workbook.addWorksheet(sanitizeSheetName(group.name, single ? 'ماتریس' : 'گروه'), {
    views: [{ rightToLeft: true, state: 'frozen', xSplit: 2, ySplit: 2 }]
  });

  // سطر ۱: عنوان گروه
  sheet.mergeCells(1, 1, 1, mainDays.length + 5);
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'گزارش کل دوره — ' + cohort.name + ' — ' + group.name;
  titleCell.font = FONT_TITLE;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 24;

  // سطر ۲: سرستون‌ها
  const hRow = sheet.getRow(2);
  hRow.height = 28;
  styleHeaderCell(hRow.getCell(1), MATRIX_TITLES.rowNum);
  styleHeaderCell(hRow.getCell(2), MATRIX_TITLES.name);
  sheet.getColumn(1).width = 7;
  sheet.getColumn(2).width = 22;

  mainDays.forEach(function (d, dIdx) {
    const col = dIdx + 3;
    const cell = hRow.getCell(col);
    const shamsi = Names.formatShamsiShort(Names.addDaysToIso(cohort.startDate, d.n - 1));
    cell.value = 'روز ' + Names.toPersianDigits(d.n) + (single ? '\n' + shamsi : '');
    cell.font = { name: 'Tahoma', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = FILL_HEADER;
    cell.alignment = single
      ? { horizontal: 'center', vertical: 'middle', wrapText: true }
      : { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDER_THIN;
    sheet.getColumn(col).width = single ? 10 : 9;
  });

  styleHeaderCell(hRow.getCell(totCol), MATRIX_TITLES.total);
  styleHeaderCell(hRow.getCell(maxCol), MATRIX_TITLES.max);
  styleHeaderCell(hRow.getCell(pctCol), MATRIX_TITLES.percent);
  if (single) {
    sheet.getColumn(totCol).width = 12;
    sheet.getColumn(maxCol).width = 12;
    sheet.getColumn(pctCol).width = 10;
  }

  // سطرهای افراد
  const centered = { horizontal: 'center', vertical: 'middle' };
  rows.forEach(function (r, mIdx) {
    const row = sheet.getRow(mIdx + 3);
    row.height = 20;

    const put = function (col: number, value: string, align: object) {
      const cell = row.getCell(col);
      cell.value = value;
      cell.font = FONT_TAHOMA;
      cell.alignment = align;
      cell.border = BORDER_THIN;
    };
    put(1, Names.toPersianDigits(r.rowNum), centered);
    put(2, r.name, { horizontal: 'right', vertical: 'middle' });
    r.dayScores.forEach(function (sc, dIdx) {
      // فقط اگر روز بسته شده باشد امتیاز را نشان بده، وگرنه خالی
      put(dIdx + 3, sc == null ? '' : Names.toPersianDigits(sc), centered);
    });
    put(totCol, Names.toPersianDigits(r.totalScore), centered);
    put(maxCol, Names.toPersianDigits(r.totalMax), centered);
    put(pctCol, Names.toPersianDigits(r.percent) + '٪', centered);
  });

  if (!single) return;

  // شیت داده لاتین
  const dataSheet = workbook.addWorksheet(sanitizeSheetName(group.name + '-داده', 'داده'), {
    views: [{ rightToLeft: true }]
  });
  const dataHeaders = ['ردیف', 'نام'].concat(
    mainDays.map(function (d) {
      return 'Day' + d.n;
    }),
    [MATRIX_TITLES.dataTotal, MATRIX_TITLES.dataMax, MATRIX_TITLES.dataPercent]
  );
  const dHRow = dataSheet.getRow(1);
  dataHeaders.forEach(function (dh, idx) {
    dHRow.getCell(idx + 1).value = dh;
  });
  rows.forEach(function (r, mIdx) {
    const row = dataSheet.getRow(mIdx + 2);
    row.getCell(1).value = r.rowNum;
    row.getCell(2).value = r.rawName;
    r.dayScores.forEach(function (sc, dIdx) {
      if (sc != null) row.getCell(dIdx + 3).value = sc;
    });
    row.getCell(totCol).value = r.totalScore;
    row.getCell(maxCol).value = r.totalMax;
    row.getCell(pctCol).value = r.percent;
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

    buildFullCohortSheets(workbook, cohort, group, includeFrozen, 'single');

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
    }

    // گزارش کل دوره برای همه گروه‌ها
    myGroups.forEach(function (g) {
      buildFullCohortSheets(workbook, cohort, g, includeFrozen, 'all');
    });
    const fullFn = 'بوشیدو-' + cohort.name + '-همه-گروه‌ها-کل-دوره';
    return downloadWorkbook(workbook, fullFn);
  });
}

export const Excel = {
  loadExcelJS: loadExcelJS,
  exportGroupDayReport: exportGroupDayReport,
  exportGroupFullCohortReport: exportGroupFullCohortReport,
  exportAllMyGroupsReport: exportAllMyGroupsReport
};
