import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Excel } from './excel';
import { ImageExport } from './image-export';
import { REPORT_COLUMNS, cellText, visibleColumns } from './report-columns';
import type { ReportColumn } from './report-columns';
import type { Cohort } from './types';

/**
 * مقایسهٔ خروجی‌های گزارش با نسخهٔ مرجع (golden).
 * ExcelJS با یک ورک‌بوک ساختگی جایگزین می‌شود که همهٔ مقدارهای سلول‌ها را ثبت می‌کند.
 * اگر عمداً ستون یا متنی را عوض کردید: GOLDEN_WRITE=1 npx vitest run src/report-golden.test.ts
 */
const GOLDEN = process.cwd() + '/src/fixtures/report-golden.json';

type Sheet = {
  name: string;
  merges: unknown[];
  cells: Record<string, unknown>;
  widths: Record<number, number>;
};

function fakeExcel(captured: { name: string; sheets: Sheet[] }[]) {
  class Workbook {
    sheets: Sheet[] = [];
    xlsx = {
      writeBuffer: () => {
        captured.push({ name: '', sheets: this.sheets });
        return Promise.resolve(new ArrayBuffer(1));
      }
    };
    addWorksheet(name: string) {
      const sheet: Sheet = { name, merges: [], cells: {}, widths: {} };
      this.sheets.push(sheet);
      const cell = (r: number, c: number) => ({
        set value(v: unknown) {
          sheet.cells[r + ',' + c] = v;
        },
        get value() {
          return sheet.cells[r + ',' + c];
        }
      });
      const colLetter = (s: string) => s.charCodeAt(0) - 64;
      return {
        mergeCells: (...a: unknown[]) => sheet.merges.push(a),
        getCell: (a: string | number, b?: number) =>
          typeof a === 'string' ? cell(parseInt(a.slice(1), 10), colLetter(a)) : cell(a, b as number),
        getRow: (r: number) => ({ getCell: (c: number) => cell(r, c) }),
        getColumn: (c: number) => ({
          set width(w: number) {
            sheet.widths[c] = w;
          }
        })
      };
    }
  }
  return Workbook;
}

function sampleCohort(): Cohort {
  const days = [] as Cohort['days'];
  for (let i = 1; i <= 30; i++) {
    const type = i <= 7 ? 'warmup' : i > 28 ? 'review' : 'main';
    days.push({
      n: i,
      type,
      hardLevels: type !== 'main' ? 0 : i === 9 ? 0 : i === 10 ? 2 : 3,
      specialMission: true
    });
  }
  const mk = (
    id: string,
    name: string,
    g: string,
    status: 'active' | 'frozen' | 'left',
    habitCount: number | null
  ) => ({
    id,
    name,
    nameKey: name,
    telegram: '',
    groupId: g,
    status,
    habitCount
  });
  return {
    id: 'c1',
    name: 'دوره آبان ۱۴۰۵',
    startDate: '2026-10-23',
    archived: false,
    days,
    groups: [
      { id: 'g1', name: 'گروه عقاب', order: 1, mine: true, closedDays: [8, 9] },
      { id: 'g2', name: 'گروه شاهین', order: 2, mine: true, closedDays: [] }
    ],
    participants: [
      mk('p1', 'سمیه سعدی', 'g1', 'active', 2),
      mk('p2', 'علی رضایی', 'g1', 'active', 3),
      mk('p3', 'مریم احمدی', 'g1', 'active', null),
      mk('p4', 'کامران', 'g1', 'frozen', 3),
      mk('p5', 'زهرا کریمی', 'g1', 'active', 4),
      mk('p6', 'امیر محمدی', 'g2', 'active', 1),
      mk('p7', 'سارا نوروزی', 'g2', 'left', 2)
    ],
    records: {
      p1: { 8: { done: 2, hard: 2, special: 1 }, 9: { done: 2, hard: null, special: 0 } },
      p2: { 8: { done: 1, hard: 0, special: 0 }, 9: { done: 3, hard: null, special: 1 } },
      p3: { 8: { done: 2, hard: 1, special: null } },
      p4: { 8: { done: 3, hard: 3, special: 1 } },
      p6: { 8: { done: 1, hard: 3, special: 1 } }
    }
  } as unknown as Cohort;
}

async function collectExcel() {
  const captured: { name: string; sheets: Sheet[] }[] = [];
  (window as unknown as { ExcelJS: unknown }).ExcelJS = { Workbook: fakeExcel(captured) };
  (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:x';
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = () => {};

  const c = sampleCohort();
  const out: Record<string, Sheet[]> = {};
  const run = async (key: string, fn: () => Promise<unknown>) => {
    captured.length = 0;
    await fn();
    out[key] = captured[0].sheets;
  };
  const g1 = c.groups[0];
  await run('day8', () => Excel.exportGroupDayReport(c, g1, 8, false));
  await run('day8-frozen', () => Excel.exportGroupDayReport(c, g1, 8, true));
  await run('day9-nohard', () => Excel.exportGroupDayReport(c, g1, 9, false));
  await run('day10-open', () => Excel.exportGroupDayReport(c, g1, 10, false));
  await run('full-g1', () => Excel.exportGroupFullCohortReport(c, g1, false));
  await run('all-day8', () => Excel.exportAllMyGroupsReport(c, 'day', 8, false));
  await run('all-full', () => Excel.exportAllMyGroupsReport(c, 'full', null, false));
  return out;
}

/** نمای ردیف‌های تصویر؛ متن‌ها همان‌هایی‌اند که ستون‌های مشترک تولید می‌کنند */
export function imageView(c: Cohort) {
  const out: Record<string, unknown> = {};
  for (const [key, g, d, f] of [
    ['d8', 0, 8, false],
    ['d8f', 0, 8, true],
    ['d9', 0, 9, false],
    ['d10', 0, 10, false],
    ['g2d8', 1, 8, false]
  ] as const) {
    const rd = ImageExport.getGroupDayReportRows(c, c.groups[g], d, f);
    const text = (id: string, r: (typeof rd.rows)[number]) =>
      cellText(REPORT_COLUMNS.find((col) => col.id === id) as ReportColumn, r, rd.ctx, 'excel');
    out[key] = {
      dayShamsi: rd.dayShamsi,
      isClosed: rd.isClosed,
      rows: rd.rows.map((r) => ({
        rowNum: r.rowNum,
        name: r.name,
        status: r.status,
        habitsText: text('habits', r),
        standardDay: r.standardDay,
        hardText: text('hard', r),
        specialText: text('goal', r),
        dayScore: r.dayScore,
        dayMax: r.dayMax,
        dayScoreText: text('dayScore', r),
        totalScore: r.totalScore,
        totalMax: r.totalMax,
        totalText: text('total', r),
        percent: r.percent,
        percentText: text('percent', r)
      }))
    };
  }
  return out;
}

test('golden: خروجی اکسل و ردیف‌های تصویر با نسخهٔ مرجع یکی است', async () => {
  const c = sampleCohort();
  const actual = JSON.parse(JSON.stringify({ excel: await collectExcel(), image: imageView(c) }));
  if (process.env.GOLDEN_WRITE === '1') {
    fs.writeFileSync(GOLDEN, JSON.stringify(actual, null, 1));
    return;
  }
  const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  assert.deepEqual(actual, golden);
});

test('افزودن یک ستون به فهرست مشترک: هم اکسل (گزارش و شیت داده) و هم تصویر آن را دارند', async () => {
  const trial: ReportColumn = {
    id: 'trial',
    title: 'آزمایشی',
    kind: 'text',
    excelWidth: 10,
    imageWidth: 100,
    text: () => 'X',
    data: [{ header: 'trialData', group: 'score', value: () => 7 }]
  };
  REPORT_COLUMNS.splice(2, 0, trial);
  try {
    const captured: { name: string; sheets: Sheet[] }[] = [];
    (window as unknown as { ExcelJS: unknown }).ExcelJS = { Workbook: fakeExcel(captured) };
    const c = sampleCohort();
    await Excel.exportGroupDayReport(c, c.groups[0], 8, false);
    const [report, data] = captured[0].sheets;
    assert.ok(Object.values(report.cells).includes('آزمایشی'));
    assert.ok(Object.values(report.cells).includes('X'));
    assert.ok(Object.values(data.cells).includes('trialData'));
    assert.ok(Object.values(data.cells).includes(7));

    const rd = ImageExport.getGroupDayReportRows(c, c.groups[0], 8, false);
    const imageCols = visibleColumns('image', rd.ctx);
    assert.ok(imageCols.some((col) => col.id === 'trial'));
    assert.equal(cellText(trial, rd.rows[0], rd.ctx, 'image'), 'X');
  } finally {
    REPORT_COLUMNS.splice(2, 1);
  }
});
