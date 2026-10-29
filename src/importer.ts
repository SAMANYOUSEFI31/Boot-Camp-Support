/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Names } from './names';
import { Store } from './store';
import { Excel } from './excel';
import type { Cohort, Group, Participant, ParticipantStatus } from './types';

export type RawRows = string[][];
export type StructureType = 'grouping_table' | 'registrants_list';

interface ParsedGroup {
  id: string;
  name: string;
  order: number;
  mine: boolean;
  colIdx?: number;
}
interface ParsedParticipant {
  name: string;
  nameKey: string;
  telegram: string;
  groupId: string;
  groupName: string;
  status: ParticipantStatus;
  habitCount: null;
}
interface ParsedTable {
  groups: ParsedGroup[];
  participants: ParsedParticipant[];
  fileName?: string;
}
export interface ImportFile {
  fileName: string;
  detectedType: StructureType;
  rawRows: RawRows;
}
export interface ReportParticipant extends ParsedParticipant {
  id: string;
}
export interface Inconsistency {
  type: string;
  text: string;
  name?: string;
  groupName?: string;
  groupTable?: string;
  groupReg?: string;
}
export interface ImportReport {
  groups: ParsedGroup[];
  participants: ReportParticipant[];
  inconsistencies: Inconsistency[];
  frozenParticipants: string[];
  duplicates: string[];
  stats: { totalParticipants: number; groupCounts: Record<string, number>; frozenCount: number };
}
export interface GroupConfig {
  name?: string;
  mine?: boolean;
  selected?: boolean;
}

/**
 * پارس ساده فایل CSV با پشتیبانی از کاما، سمیکالن، تب و مقادیر داخل گیومه
 */
function parseCSV(text: unknown): RawRows {
  if (!text || typeof text !== 'string') return [];
  const lines = text.split(/\r?\n/);
  const rows: RawRows = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    let delimiter = ',';
    if (line.indexOf('\t') !== -1) delimiter = '\t';
    else if (line.indexOf(';') !== -1 && line.indexOf(',') === -1) delimiter = ';';

    const row: string[] = [];
    let inQuote = false;
    let curVal = '';

    for (let c = 0; c < line.length; c++) {
      const char = line[c];
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
function readFileData(file: File): Promise<{ fileName: string; type: 'csv' | 'xlsx'; rawRows: RawRows }> {
  return new Promise(function (resolve, reject) {
    const name = file.name.toLowerCase();
    const isCsv = name.endsWith('.csv');

    if (isCsv) {
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const text = e.target?.result as string;
          const rows = parseCSV(text);
          resolve({ fileName: file.name, type: 'csv', rawRows: rows });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file, 'utf-8');
    } else {
      // فایل XLSX
      Excel.loadExcelJS()
        .then(function (ExcelJS) {
          const reader = new FileReader();
          reader.onload = function (e) {
            const buffer = e.target?.result;
            const wb = new ExcelJS.Workbook();
            wb.xlsx
              .load(buffer)
              .then(function () {
                const ws = wb.worksheets[0];
                if (!ws) {
                  return reject(new Error('هیچ برگه فعالی در فایل اکسل یافت نشد.'));
                }
                const rows: RawRows = [];
                ws.eachRow({ includeEmpty: false }, function (row: any) {
                  const rVals: string[] = [];
                  row.eachCell({ includeEmpty: true }, function (cell: any, colNum: number) {
                    const v = cell.text !== undefined ? cell.text : cell.value;
                    rVals[colNum - 1] = v != null ? String(v).trim() : '';
                  });
                  rows.push(rVals);
                });
                resolve({ fileName: file.name, type: 'xlsx', rawRows: rows });
              })
              .catch(reject);
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        })
        .catch(reject);
    }
  });
}

/**
 * تشخیص نوع ساختار فایل
 * نوع ۱: «جدول گروه‌بندی» (grouping_table) - هر ستون یک گروه است
 * نوع ۲: «لیست ثبت‌نامی» (registrants_list) - ستون‌های نام، تلگرام، گروه
 */
function detectStructureType(rawRows: RawRows | null | undefined): StructureType {
  if (!rawRows || !rawRows.length) return 'grouping_table';

  const headerRow = rawRows[0] || [];
  const headerStr = headerRow.join(' ').toLowerCase();

  // اگر ستونی حاوی «نام» و دیگری حاوی «تلگرام» یا «گروه» باشد
  let hasNameCol = false;
  let hasTelegramCol = false;
  let hasGroupCol = false;

  headerRow.forEach(function (h) {
    const s = String(h || '');
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
function parseGroupingTable(rawRows: RawRows | null | undefined): ParsedTable {
  if (!rawRows || !rawRows.length) return { groups: [], participants: [] };

  const headerRow = rawRows[0] || [];
  const groups: ParsedGroup[] = [];
  const participants: ParsedParticipant[] = [];

  // هر ستون یک گروه است
  headerRow.forEach(function (colHeader, colIdx) {
    const rawH = String(colHeader || '').trim();
    if (!rawH) return;

    let groupName = rawH;
    // اگر سرستون فقط عدد بود، پیشوند «گروه » بگذار
    const latinDigits = Names.toLatinDigits(rawH);
    if (/^\d+$/.test(latinDigits)) {
      groupName = 'گروه ' + Names.toPersianDigits(latinDigits);
    }

    const groupId = 'imp_grp_' + colIdx;
    groups.push({
      id: groupId,
      name: groupName,
      colIdx: colIdx,
      order: colIdx + 1,
      mine: true
    });

    // سطرهای زیر سرستون
    for (let r = 1; r < rawRows.length; r++) {
      const cellVal = (rawRows[r] && rawRows[r][colIdx]) != null ? String(rawRows[r][colIdx]).trim() : '';
      if (!cellVal) continue;

      const isFrozen = Names.isFreezeCell(cellVal);
      // تمیز کردن نام در صورتی که کلمه فریز در آن نوشته شده بود
      const cleanName = cellVal.replace(/[\(（]?\s*فریز\s*شده?[\)）]?/g, '').trim();
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
function parseRegistrantsList(rawRows: RawRows | null | undefined): ParsedTable {
  if (!rawRows || !rawRows.length) return { groups: [], participants: [] };

  const headerRow = rawRows[0] || [];
  let nameColIdx = -1;
  let telegramColIdx = -1;
  let groupColIdx = -1;

  headerRow.forEach(function (h, idx) {
    const s = String(h || '')
      .trim()
      .toLowerCase();
    if (nameColIdx === -1 && s.indexOf('نام') !== -1) nameColIdx = idx;
    if (telegramColIdx === -1 && (s.indexOf('تلگرام') !== -1 || s.indexOf('telegram') !== -1))
      telegramColIdx = idx;
    if (groupColIdx === -1 && (s.indexOf('گروه') !== -1 || s.indexOf('group') !== -1)) groupColIdx = idx;
  });

  if (nameColIdx === -1) {
    // اگر ستون نام پیدا نشد، ستون اول را به عنوان نام در نظر بگیر
    nameColIdx = 0;
  }

  const groupMap: Record<string, ParsedGroup> = {};
  const participants: ParsedParticipant[] = [];

  for (let r = 1; r < rawRows.length; r++) {
    const row = rawRows[r] || [];
    const nameVal = row[nameColIdx] != null ? String(row[nameColIdx]).trim() : '';
    if (!nameVal) continue;

    const telegramVal =
      telegramColIdx !== -1 && row[telegramColIdx] != null ? String(row[telegramColIdx]).trim() : '';
    const groupVal = groupColIdx !== -1 && row[groupColIdx] != null ? String(row[groupColIdx]).trim() : '';

    // بررسی فریز بودن در تمام سلول‌های سطر
    let isFrozen = false;
    for (let c = 0; c < row.length; c++) {
      if (Names.isFreezeCell(String(row[c] || ''))) {
        isFrozen = true;
        break;
      }
    }

    const cleanName = nameVal.replace(/[\(（]?\s*فریز\s*شده?[\)）]?/g, '').trim();

    let gName = groupVal;
    const gLatin = Names.toLatinDigits(gName);
    if (/^\d+$/.test(gLatin)) {
      gName = 'گروه ' + Names.toPersianDigits(gLatin);
    }

    let gId = '';
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

  const groups = Object.values(groupMap);
  return { groups: groups, participants: participants };
}

/**
 * تحلیل و مقایسه فایل‌ها و استخراج گزارش ناهمخوانی‌ها
 */
function analyzeImport(filesData: ImportFile[]): ImportReport {
  let groupingData: ParsedTable | null = null;
  let registrantsData: ParsedTable | null = null;

  for (const f of filesData) {
    if (f.detectedType === 'grouping_table') {
      groupingData = parseGroupingTable(f.rawRows);
      groupingData.fileName = f.fileName;
    } else {
      registrantsData = parseRegistrantsList(f.rawRows);
      registrantsData.fileName = f.fileName;
    }
  }

  const report: ImportReport = {
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

    const regMapByNameKey: Record<string, ParsedParticipant> = {};
    registrantsData.participants.forEach(function (rp) {
      regMapByNameKey[rp.nameKey] = rp;
    });

    const seenKeysInGrouping: Record<string, boolean> = {};

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

      const matchedReg = regMapByNameKey[gp.nameKey];
      let finalTelegram = '';
      let finalStatus = gp.status;

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
            text:
              '«' +
              gp.name +
              '» در جدول گروه‌بندی ' +
              gp.groupName +
              ' و در لیست ثبت‌نامی ' +
              matchedReg.groupName +
              ' است (جدول گروه‌بندی معتبر است).'
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
          text:
            '«' + rp.name + '» در لیست ثبت‌نامی موجود است اما گروهی برای او در جدول گروه‌بندی تعیین نشده است.'
        });
      }
    });
  } else {
    // فقط یک فایل وارد شده است
    const single = (groupingData || registrantsData) as ParsedTable;
    report.groups = single.groups.map(function (g) {
      return {
        id: g.id,
        name: g.name,
        order: g.order,
        mine: true
      };
    });

    const seen: Record<string, boolean> = {};
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
    const count = report.participants.filter(function (p) {
      return p.groupId === g.id;
    }).length;
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
let lastImportBackup: {
  cohortId: string;
  groups: Group[];
  participants: Participant[];
  records: Cohort['records'];
} | null = null;

function applyImport(
  cohortId: string,
  analyzedReport: ImportReport,
  selectedGroupsMap: Record<string, GroupConfig>
) {
  const state = Store.getState();
  const cohort = (state.cohorts || []).find(function (c) {
    return c.id === cohortId;
  });
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

  const targetGroups = cohort.groups || [];
  const targetParticipants = cohort.participants || [];

  // مپ کردن گروه‌های واردشده به گروه‌های واقعی دوره
  const importedToRealGroupId: Record<string, string> = {};

  analyzedReport.groups.forEach(function (ig) {
    const groupConfig = selectedGroupsMap[ig.id];
    if (!groupConfig || !groupConfig.selected) {
      // این گروه انتخاب نشده است
      return;
    }

    const finalName = groupConfig.name || ig.name;
    const isMine = groupConfig.mine !== false;

    // بررسی آیا گروهی با این نام در دوره وجود دارد
    const existingGroup = targetGroups.find(function (g) {
      return g.name.trim() === finalName.trim();
    });

    if (existingGroup) {
      importedToRealGroupId[ig.id] = existingGroup.id;
      existingGroup.mine = isMine;
    } else {
      const newGroupId = 'grp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
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
  const existingParticipantsByKey: Record<string, Participant> = {};
  targetParticipants.forEach(function (p) {
    existingParticipantsByKey[p.nameKey] = p;
  });

  analyzedReport.participants.forEach(function (ip) {
    const realGId = importedToRealGroupId[ip.groupId];
    if (!realGId) {
      // گروه این فرد وارد نشده
      return;
    }

    const existingP = existingParticipantsByKey[ip.nameKey];
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
      const newP: Participant = {
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
  const backup = lastImportBackup;
  const state = Store.getState();
  const cohort = (state.cohorts || []).find(function (c) {
    return c.id === backup.cohortId;
  });
  if (!cohort) return false;

  cohort.groups = backup.groups;
  cohort.participants = backup.participants;
  cohort.records = backup.records;

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
  const groupSizes = [14, 18, 21, 15, 17];
  const groupNames = ['گروه ۱', 'گروه ۲', 'گروه ۳', 'گروه ۴', 'گروه ۵'];

  const sampleNamesPool = [
    'علی رضایی',
    'رضا کریمی',
    'محمد حسینی',
    'مهدی صادقی',
    'حسین موسوی',
    'امیرحسین ابراهیمی',
    'علیرضا اسدی',
    'سعید جعفری',
    'پژمان مرادی',
    'امیر مرادی',
    'یاسین عزیزی',
    'نیما حیدری',
    'سجاد رحیمی',
    'فرزاد شریفی',
    'فاطمه احمدی',
    'زهرا کاظمی',
    'مریم باقری',
    'نرگس نوری',
    'سارا یوسفی',
    'الهام رستمی',
    'سمیرا قاسم‌پور',
    'مونا صالحی',
    'فرشته بهرامی',
    'محدثه کرمی',
    'مهسا داوودی',
    'الهه شجاعی',
    'سمانه ملکی',
    'ندا فلاحی',
    'شیرین نجفی',
    'آیدا حیدری',
    'رویا سعیدی',
    'مهناز اکبری',
    'پویا احمدی',
    'آرش کمالی',
    'میلاد قنبری',
    'سینا فتحی',
    'کیانوش باقرزاده',
    'احسان مقدسی',
    'حمیدرضا حاتمی',
    'شاهین طاهری',
    'سامان پاشایی',
    'هومن خسروی',
    'پارسا افشار',
    'مهران یزدانی',
    'بابک رفیعی',
    'بهرام میرزایی',
    'مجید قاسمی',
    'کیوان غفاری',
    'نوید فرهمند',
    'بهزاد صفری',
    'دانیال راد',
    'آرمان ستاری',
    'سهراب نامدار',
    'نازنین امینی',
    'پریسا بیات',
    'شیما صبوری',
    'نسیم میرزایی',
    'روژین حسینی',
    'شقایق دادخواه',
    'نگین فتاحی',
    'سپیده روزبهانی',
    'زهره فرجی',
    'کتایون محمودی',
    'لیلا جلالی',
    'نسرین شمس',
    'طاهره عباسی',
    'عاطفه سعادت',
    'مهدیه رضایی',
    'کامران رسولی',
    'امید صیادی',
    'نوید گودرزی',
    'امین سرلک',
    'سهیل فرهمند',
    'بهنام جوادی',
    'منصور کیانی',
    'مسعود هدایتی',
    'فرهاد فدوی',
    'سیاوش سهرابی',
    'سروش جهان‌بین',
    'وحید طاهری',
    'صادق شفیعی',
    'جواد پورمحمد',
    'ایمان ربیعی',
    'فرید رهنما',
    'سمیه سعدی'
  ];

  // جدول گروه‌بندی (سطر اول سرستون‌ها و زیرش نام‌ها)
  const maxRows = Math.max.apply(null, groupSizes);
  const groupingTableRows = [];
  groupingTableRows.push(groupNames);

  let currentPoolIdx = 0;
  const groupColumns: string[][] = [];

  groupSizes.forEach(function (size, gIdx) {
    const col = [];
    for (let i = 0; i < size; i++) {
      let name = sampleNamesPool[currentPoolIdx++];
      // مشخص کردن فریز شده‌ها
      if (currentPoolIdx === 5 || currentPoolIdx === 25 || currentPoolIdx === 45) {
        name = name + ' (فریز)';
      }
      col.push(name);
    }
    groupColumns.push(col);
  });

  // اضافه کردن ردیف‌ها
  for (let r = 0; r < maxRows; r++) {
    const row = [];
    for (let g = 0; g < 5; g++) {
      row.push(groupColumns[g][r] || '');
    }
    groupingTableRows.push(row);
  }

  // لیست ثبت‌نامی (نام، آیدی تلگرام، گروه)
  const registrantsRows = [];
  registrantsRows.push(['نام و نام خانوادگی', 'آیدی تلگرام', 'شماره موبایل', 'گروه اختصاص‌یافته']);

  currentPoolIdx = 0;
  groupSizes.forEach(function (size, gIdx) {
    for (let i = 0; i < size; i++) {
      const originalName = sampleNamesPool[currentPoolIdx++];
      let gAssigned = groupNames[gIdx];

      // مغایرت ۱: سمیه سعدی در جدول گروهبندی گروه ۵ و در لیست ثبت‌نامی گروه ۴ است
      if (originalName === 'سمیه سعدی') {
        gAssigned = 'گروه ۴';
      }

      let isFroz = false;
      // ۵ نفر فریز شده: ۳ نفر در هر دو + ۲ نفر در لیست ثبت نامی
      if (
        currentPoolIdx === 5 ||
        currentPoolIdx === 25 ||
        currentPoolIdx === 45 ||
        currentPoolIdx === 65 ||
        currentPoolIdx === 80
      ) {
        isFroz = true;
      }

      const tel = '@user_' + currentPoolIdx;
      const row = [
        originalName,
        tel,
        '0912' + Math.floor(1000000 + Math.random() * 9000000), // این شماره نباید وارد شود
        isFroz ? gAssigned + ' - فریز' : gAssigned
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
