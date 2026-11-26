/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Names } from './names';
import { Store } from './store';
import { Excel } from './excel';
import { MAX_HABITS, REQUIRED_HABITS } from './habits';
import { canAssign, normalizeMobile, validateRegistration } from './registration';
import { reconcileWarnings } from './membership';
import type { Cohort, Gender, Group, Participant, ParticipantStatus } from './types';

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
  phone?: string;
  age?: number;
  gender?: Gender;
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
  text = text.replace(/^\uFEFF/, '');
  const source = String(text);
  const firstLine = source.split(/\r?\n/, 1)[0];
  const delimiters = [',', ';', '\t'];
  const count = (delimiter: string) => {
    let quoted = false;
    let total = 0;
    for (const char of firstLine) {
      if (char === '"') quoted = !quoted;
      else if (!quoted && char === delimiter) total++;
    }
    return total;
  };
  const delimiter = delimiters.reduce((best, d) => count(d) > count(best) ? d : best, ',');
  const rows: RawRows = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  const pushCell = () => {
    const cell = value.trim();
    row.push(/^'[=+\-@]/.test(cell) ? cell.slice(1) : cell);
    value = '';
  };
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && char === delimiter) pushCell();
    else if (!quoted && (char === '\n' || char === '\r')) {
      pushCell();
      if (row.some(Boolean)) rows.push(row);
      row = [];
      if (char === '\r' && source[i + 1] === '\n') i++;
    } else value += char;
  }
  if (quoted) throw new Error('گیومه‌های CSV بسته نشده‌اند؛ فایل را دوباره ذخیره کن.');
  pushCell();
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

const PROFILE_HEADERS = ['نام', 'موبایل', 'سن', 'جنسیت', 'تلگرام', 'گروه'];

function registrationFileRows(cohort?: Cohort): RawRows {
  if (!cohort) return [PROFILE_HEADERS, ['فرد آزمایشی', '09000000001', '25', 'مرد', 'sample_user', '']];
  return [PROFILE_HEADERS, ...cohort.participants.map((p) => [
    p.name, p.phone || '', p.age === undefined ? '' : String(p.age),
    p.gender === 'male' ? 'مرد' : p.gender === 'female' ? 'زن' : '', p.telegram,
    cohort.groups.find((g) => g.id === p.groupId)?.name || ''
  ])];
}

function serializeCSV(rows: RawRows): string {
  return '\uFEFF' + rows.map((row) => row.map((cell) => {
    const safe = /^\s*[=+\-@]/.test(cell) ? "'" + cell : cell;
    return '"' + safe.replace(/"/g, '""') + '"';
  }).join(',')).join('\r\n');
}

function registrationJSON(rows: RawRows) {
  return rows.slice(1).map((r) => ({
    name: r[0], phone: r[1], age: r[2], gender: r[3], telegram: r[4], group: r[5]
  }));
}

function parseRegistrationJSON(text: string): RawRows {
  const data: unknown = JSON.parse(text.replace(/^\uFEFF/, ''));
  if (data && typeof data === 'object' && 'cohorts' in data) {
    throw new Error('این فایل بکاپ است. از «ابزارها ← بازگردانی بکاپ» استفاده کن تا سابقه و پرداخت‌ها حفظ شوند.');
  }
  const people: unknown = Array.isArray(data) ? data :
    data && typeof data === 'object' && 'participants' in data ? data.participants : null;
  if (!Array.isArray(people)) throw new Error('JSON باید آرایه افراد یا آبجکت دارای participants باشد؛ قالب را دانلود کن.');
  const rows = people.map((p: unknown, index) => {
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('ردیف ' + (index + 1) + ' در JSON معتبر نیست.');
    const person = p as Record<string, unknown>;
    return ['name', 'phone', 'age', 'gender', 'telegram', 'group'].map((key, i) => {
      const value = person[key] ?? person[PROFILE_HEADERS[i]] ?? '';
      if (typeof value !== 'string' && typeof value !== 'number') throw new Error('مقدار ' + key + ' در JSON معتبر نیست.');
      return String(value);
    });
  });
  return [PROFILE_HEADERS, ...rows];
}

/**
 * خواندن فایل با ExcelJS یا FileReader
 */
function readFileData(file: File): Promise<{ fileName: string; type: 'csv' | 'xlsx' | 'json'; rawRows: RawRows }> {
  return new Promise(function (resolve, reject) {
    const name = file.name.toLowerCase();
    const isCsv = name.endsWith('.csv');

    const isJson = name.endsWith('.json');
    if (name.endsWith('.numbers')) {
      reject(
        new Error(
          'فایل Numbers مستقیم خوانده نمی‌شود. در Numbers از «File ← Export To ← Excel» (یا CSV) خروجی بگیر و آن را وارد کن.'
        )
      );
      return;
    }
    if (!isCsv && !isJson && !name.endsWith('.xlsx')) {
      reject(new Error('فقط فایل Excel (.xlsx)، CSV یا JSON را می‌شود وارد کرد.'));
      return;
    }

    if (isCsv || isJson) {
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const text = e.target?.result;
          if (typeof text !== 'string') throw new Error('محتوای فایل متنی خوانده نشد.');
          const rows = isJson ? parseRegistrationJSON(text) : parseCSV(text);
          resolve({ fileName: file.name, type: isJson ? 'json' : 'csv', rawRows: rows });
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
                  return reject(
                    new Error('در فایل Excel برگه‌ای پیدا نشد. فایل را باز کن، ذخیره کن و دوباره امتحان کن.')
                  );
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
  // اگر ستونی حاوی «نام» و دیگری حاوی «تلگرام» یا «گروه» باشد
  let hasNameCol = false;
  let hasTelegramCol = false;
  let hasGroupCol = false;

  headerRow.forEach(function (h) {
    const s = String(h || '').toLowerCase();
    if (s.indexOf('نام') !== -1 || s === 'name') hasNameCol = true;
    if (s.indexOf('تلگرام') !== -1 || s.indexOf('telegram') !== -1) hasTelegramCol = true;
    if (s.indexOf('گروه') !== -1 || s.indexOf('group') !== -1) hasGroupCol = true;
  });

  if (hasNameCol && (hasTelegramCol || hasGroupCol || headerRow.some((h) => /موبایل|شماره|سن|جنسیت|phone|age|gender/i.test(h)))) {
    return 'registrants_list';
  }

  // در غیر این صورت معمولاً جدول گروه‌بندی است
  return 'grouping_table';
}

/**
 * استخراج افراد و گروه‌ها از «جدول گروه‌بندی»
 */
function cleanImportLabel(value: string): string {
  return value.replace(/\s*[-–]?\s*[\(（]?\s*فریز(?:\s*شده)?[\)）]?/g, '').trim();
}

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
      const cleanName = cleanImportLabel(cellVal);
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
  let phoneColIdx = -1;
  let ageColIdx = -1;
  let genderColIdx = -1;

  headerRow.forEach(function (h, idx) {
    const s = String(h || '')
      .trim()
      .toLowerCase();
    if (nameColIdx === -1 && (s.indexOf('نام') !== -1 || s === 'name')) nameColIdx = idx;
    if (telegramColIdx === -1 && (s.indexOf('تلگرام') !== -1 || s.indexOf('telegram') !== -1))
      telegramColIdx = idx;
    if (groupColIdx === -1 && (s.indexOf('گروه') !== -1 || s.indexOf('group') !== -1)) groupColIdx = idx;
    if (phoneColIdx === -1 && /موبایل|شماره|phone|mobile/.test(s)) phoneColIdx = idx;
    if (ageColIdx === -1 && (s === 'سن' || s === 'age')) ageColIdx = idx;
    if (genderColIdx === -1 && (s === 'جنسیت' || s === 'gender')) genderColIdx = idx;
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
    if (!nameVal) {
      if (row.some((cell) => cell?.trim())) throw new Error('ردیف ' + (r + 1) + ': نام فرد خالی است.');
      continue;
    }

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

    const cleanName = cleanImportLabel(nameVal);
    const suppliedPhone = (row[phoneColIdx] || '').trim();
    const suppliedAge = Names.toLatinDigits(row[ageColIdx] || '').trim();
    const suppliedGender = (row[genderColIdx] || '').trim().toLowerCase();
    const phone = suppliedPhone ? normalizeMobile(suppliedPhone) : undefined;
    const age = suppliedAge ? Number(suppliedAge) : undefined;
    const gender = suppliedGender === 'مرد' || suppliedGender === 'male' ? 'male' :
      suppliedGender === 'زن' || suppliedGender === 'female' ? 'female' : undefined;
    const validation = validateRegistration({
      name: cleanName, phone: suppliedPhone, age: suppliedAge, gender: gender || '', telegram: telegramVal
    }, []);
    const errors = [
      validation.errors.name, validation.errors.telegram,
      suppliedPhone ? validation.errors.phone : undefined,
      suppliedAge ? validation.errors.age : undefined,
      suppliedGender ? validation.errors.gender : undefined
    ].filter((error): error is string => !!error);
    if (suppliedAge && !/^\d+$/.test(suppliedAge)) errors.push('سن باید عدد صحیح باشد.');
    if (suppliedGender && !gender) errors.push('جنسیت باید مرد یا زن باشد.');
    if (errors.length) throw new Error('ردیف ' + (r + 1) + ': ' + errors.join(' '));

    let gName = cleanImportLabel(groupVal);
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
      telegram: validation.telegram,
      phone, age, gender,
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
      if (groupingData) throw new Error('در هر ورود فقط یک جدول گروه‌بندی انتخاب کن؛ فایل‌ها را جداگانه وارد کن.');
      groupingData = parseGroupingTable(f.rawRows);
      groupingData.fileName = f.fileName;
    } else {
      if (registrantsData) throw new Error('در هر ورود فقط یک فهرست افراد انتخاب کن؛ فایل‌ها را جداگانه وارد کن.');
      registrantsData = parseRegistrantsList(f.rawRows);
      registrantsData.fileName = f.fileName;
    }
    if (!groupingData && !registrantsData) throw new Error('فایلی برای ورود انتخاب نشده است.');
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

    const regMapByNameKey = new Map<string, ParsedParticipant[]>();
    registrantsData.participants.forEach(function (rp) {
      regMapByNameKey.set(rp.nameKey, [...(regMapByNameKey.get(rp.nameKey) || []), rp]);
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

      const matches = regMapByNameKey.get(gp.nameKey) || [];
      if (matches.length > 1) throw new Error('«' + gp.name + '» هم‌نام دارد؛ گروه را در فهرست دارای موبایل مشخص کن.');
      const matchedReg = matches[0];
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
        phone: matchedReg?.phone,
        age: matchedReg?.age,
        gender: matchedReg?.gender,
        groupId: gp.groupId,
        groupName: gp.groupName,
        status: finalStatus,
        habitCount: null
      });
    });

    // افرادی که در لیست ثبت‌نامی هستند اما در جدول گروه‌بندی نیستند
    registrantsData.participants.forEach(function (rp) {
      if (!seenKeysInGrouping[rp.nameKey]) {
        report.participants.push({ ...rp, id: 'p_imp_' + Math.random().toString(36).slice(2, 8), groupId: '', groupName: '' });
        if (rp.status === 'frozen') report.frozenParticipants.push(rp.name);
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
      const identity = p.phone || p.nameKey;
      if (seen[identity]) {
        report.duplicates.push(p.name);
        report.inconsistencies.push({
          type: 'duplicate',
          text: 'نام تکراری «' + p.name + '» مشاهده شد.'
        });
      }
      seen[identity] = true;

      if (p.status === 'frozen') {
        report.frozenParticipants.push(p.name);
      }

      report.participants.push({
        id: 'p_imp_' + Math.random().toString(36).slice(2, 8),
        name: p.name,
        nameKey: p.nameKey,
        telegram: p.telegram,
        phone: p.phone,
        age: p.age,
        gender: p.gender,
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
  if (!report.participants.length) throw new Error('فایل هیچ فردی برای ورود ندارد؛ ردیف‌ها و عنوان ستون‌ها را بررسی کن.');
  return report;
}

/**
 * اعمال ادغام در دوره فعال بر اساس قواعد مشخص‌شده:
 * تطبیق با موبایل یا نام یکتا، تکمیل مشخصات خالی و انتخاب صریح برای تفاوت‌ها.
 * پیش‌نمایش روی کپی ساخته می‌شود؛ فایل ناسالم یا تصمیم ناقص تغییری ایجاد نمی‌کند.
 */
let lastImportBackup: {
  cohortId: string;
  groups: Group[];
  participants: Participant[];
  records: Cohort['records'];
} | null = null;

export interface ImportConflict {
  key: string;
  name: string;
  field: string;
  current: string;
  incoming: string;
}
export type ImportDecisions = Record<string, 'keep' | 'file'>;

function prepareImport(
  cohort: Cohort,
  analyzedReport: ImportReport,
  selectedGroupsMap: Record<string, GroupConfig>,
  decisions: ImportDecisions = {}
) {
  const targetGroups: Group[] = JSON.parse(JSON.stringify(cohort.groups || []));
  const targetParticipants: Participant[] = JSON.parse(JSON.stringify(cohort.participants || []));
  const conflicts: ImportConflict[] = [];
  let selectedPeople = 0;

  // مپ کردن گروه‌های واردشده به گروه‌های واقعی دوره
  const importedToRealGroupId: Record<string, string> = {};

  analyzedReport.groups.forEach(function (ig) {
    const groupConfig = selectedGroupsMap[ig.id];
    if (!groupConfig || !groupConfig.selected) {
      // این گروه انتخاب نشده است
      return;
    }

    const finalName = (groupConfig.name ?? ig.name).trim();
    if (!finalName) throw new Error('نام گروه انتخاب‌شده نمی‌تواند خالی باشد.');
    const isMine = groupConfig.mine !== false;

    // بررسی آیا گروهی با این نام در دوره وجود دارد
    const existingGroup = targetGroups.find(function (g) {
      return Names.normalizeName(g.name) === Names.normalizeName(finalName);
    });

    if (existingGroup) {
      importedToRealGroupId[ig.id] = existingGroup.id;
      existingGroup.mine = isMine;
    } else {
      let newGroupId = 'grp_import_' + ig.id;
      while (targetGroups.some((g) => g.id === newGroupId)) newGroupId += '_copy';
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
  const fileIdentities = new Set<string>();
  analyzedReport.participants.forEach(function (ip) {
    const realGId = importedToRealGroupId[ip.groupId] || '';
    if (ip.groupId && !realGId) {
      // گروه این فرد وارد نشده
      return;
    }
    selectedPeople++;

    const identity = ip.phone || ip.nameKey;
    if (fileIdentities.has(identity)) throw new Error('فرد تکراری در فایل: ' + ip.name + '؛ ردیف‌های تکراری را اصلاح کن.');
    fileIdentities.add(identity);
    const byPhone = ip.phone ? targetParticipants.filter((p) => p.phone === ip.phone) : [];
    const matches = byPhone.length ? byPhone : targetParticipants.filter((p) =>
      Names.normalizeName(p.name) === ip.nameKey && (!ip.phone || !p.phone));
    if (matches.length > 1) {
      throw new Error('چند ثبت‌نامی هم‌نام هستند؛ آن‌ها را از فهرست ثبت‌نام با انتخاب فرد گروه‌بندی کن.');
    }
    const existingP = matches[0];
    if (existingP) {
      const choose = (field: string, current: string, incoming: string) => {
        const key = ip.id + ':' + field;
        conflicts.push({ key, name: existingP.name, field, current, incoming });
        return decisions[key] === 'file';
      };
      const setField = <K extends 'name' | 'phone' | 'age' | 'gender' | 'telegram'>(field: K, label: string) => {
        const value = ip[field];
        if (value === undefined || value === '') return;
        const current = existingP[field];
        const display = (v: string | number) => field === 'gender' ? (v === 'male' ? 'مرد' : 'زن') : String(v);
        if (current === undefined || current === '' ||
            (current !== value && choose(label, display(current), display(value)))) {
          existingP[field] = value;
        }
      };
      setField('name', 'نام');
      setField('phone', 'موبایل');
      setField('age', 'سن');
      setField('gender', 'جنسیت');
      setField('telegram', 'تلگرام');
      existingP.nameKey = Names.normalizeName(existingP.name);
      if (realGId && !existingP.groupId) {
        if (!canAssign(existingP)) throw new Error('ثبت‌نام فرد بدون گروه ناقص یا غیرفعال است؛ ابتدا تکمیلش کن: ' + existingP.name);
        existingP.groupId = realGId;
      } else if (realGId && existingP.groupId !== realGId) {
        const current = targetGroups.find((g) => g.id === existingP.groupId)?.name || existingP.groupId;
        const incoming = targetGroups.find((g) => g.id === realGId)!.name;
        if (choose('گروه', current, incoming)) existingP.groupId = realGId;
      }
      if (ip.status === 'frozen' && existingP.status !== 'frozen' &&
          choose('وضعیت', existingP.status === 'active' ? 'فعال' : 'خارج‌شده', 'فریز')) existingP.status = 'frozen';
    } else {
      // فرد جدید
      const newP: Participant = {
        id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        name: ip.name,
        nameKey: ip.nameKey,
        telegram: ip.telegram || '',
        phone: ip.phone,
        age: ip.age,
        gender: ip.gender,
        groupId: realGId,
        status: ip.status || 'active',
        habitCount: MAX_HABITS,
        habits: [...REQUIRED_HABITS, '']
      };
      targetParticipants.push(newP);
    }
  });
  if (!selectedPeople) throw new Error('هیچ فردی برای ورود انتخاب نشده است؛ یک گروه را انتخاب کن.');
  const phones = targetParticipants.map((p) => p.phone).filter(Boolean);
  if (new Set(phones).size !== phones.length) throw new Error('نتیجه ورود موبایل تکراری دارد؛ انتخاب مشخصات را اصلاح کن.');
  return { groups: targetGroups, participants: targetParticipants, conflicts };
}

function applyImport(
  cohortId: string,
  analyzedReport: ImportReport,
  selectedGroupsMap: Record<string, GroupConfig>,
  decisions: ImportDecisions = {}
) {
  const cohort = Store.getState().cohorts.find((c) => c.id === cohortId);
  if (!cohort) throw new Error('دوره‌ای انتخاب نشده. اول یک دوره بساز یا انتخاب کن.');
  const plan = prepareImport(cohort, analyzedReport, selectedGroupsMap, decisions);
  if (plan.conflicts.some((c) => !decisions[c.key])) throw new Error('برای هر تفاوت، حفظ مقدار فعلی یا استفاده از فایل را انتخاب کن.');
  lastImportBackup = {
    cohortId, groups: JSON.parse(JSON.stringify(cohort.groups)),
    participants: JSON.parse(JSON.stringify(cohort.participants)),
    records: JSON.parse(JSON.stringify(cohort.records))
  };
  cohort.groups = plan.groups;
  cohort.participants = plan.participants;
  reconcileWarnings(cohort);
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
  registrationFileRows,
  registrationJSON,
  parseRegistrationJSON,
  serializeCSV,
  prepareImport,
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
