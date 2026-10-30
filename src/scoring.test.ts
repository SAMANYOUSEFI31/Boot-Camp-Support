import { test } from 'vitest';
import assert from 'node:assert/strict';

import { Names } from './names';
import { Scoring, standardDay } from './scoring';
import { ImageExport } from './image-export';
import type { Cohort, Group } from './types';

test('۱. habitCount=3, done=3, hard=3 (روز با ۳ سطح), special=1 -> ۱۰ از ۱۰ (۳ عادت + ۲ روز استاندارد + ۳ سخت + ۲ هدف)', () => {
  const p = { id: 'p1', habitCount: 3 };
  const day = { n: 8, type: 'main', hardLevels: 3, specialMission: true };
  const rec = { done: 3, hard: 3, special: 1 };
  const score = Scoring.dayScore(p, rec, day);
  const max = Scoring.dayMax(p, day, rec);
  assert.equal(score, 10);
  assert.equal(max, 10);
});

test('۲. habitCount=4, done=2, hard=0, special=0 در همان روز -> ۲ از ۱۱', () => {
  const p = { id: 'p2', habitCount: 4 };
  const day = { n: 8, type: 'main', hardLevels: 3, specialMission: true };
  const rec = { done: 2, hard: 0, special: 0 };
  const score = Scoring.dayScore(p, rec, day);
  const max = Scoring.dayMax(p, day, rec);
  assert.equal(score, 2);
  assert.equal(max, 11); // 4 عادت + ۲ روز استاندارد + ۳ سخت + ۲ هدف
});

test('۳. habitCount=1, done=1, hard=2 در روزی با ۲ سطح (بدون توجه به specialMission) -> ۵ از ۷', () => {
  const p = { id: 'p3', habitCount: 1 };
  const day = { n: 10, type: 'main', hardLevels: 2, specialMission: false };
  const rec = { done: 1, hard: 2, special: 0 };
  const score = Scoring.dayScore(p, rec, day);
  const max = Scoring.dayMax(p, day, rec);
  assert.equal(score, 5); // 1 عادت + 2 روز استاندارد + 2 سخت
  assert.equal(max, 7);
});

test('۴. روز بدون کار سخت (hardLevels=0) و با گزارش هدف، habitCount=2, done=2, special=1 -> ۶ از ۶', () => {
  const p = { id: 'p4', habitCount: 2 };
  const day = { n: 11, type: 'main', hardLevels: 0, specialMission: true };
  const rec = { done: 2, hard: 0, special: 1 };
  const score = Scoring.dayScore(p, rec, day);
  const max = Scoring.dayMax(p, day, rec);
  assert.equal(score, 6);
  assert.equal(max, 6);
});

test('۵. hard بزرگتر از hardLevels امروز: به سقف روز clamp میشود', () => {
  const p = { id: 'p5', habitCount: 2 };
  const day = { n: 12, type: 'main', hardLevels: 1, specialMission: false };
  const rec = { done: 2, hard: 3, special: 0 }; // typed 3 when level max is 1
  const score = Scoring.dayScore(p, rec, day);
  assert.equal(score, 5); // 2 عادت + 2 روز استاندارد + 1 (clamp از ۳)
});

test('۶. done بزرگتر از habitCount: validateRecord خطا میدهد و dayScore clamp میکند', () => {
  const p = { id: 'p6', habitCount: 2 };
  const day = { n: 13, type: 'main', hardLevels: 3, specialMission: true };
  const rec = { done: 4, hard: 1, special: 0 };
  const val = Scoring.validateRecord(p, rec, day);
  assert.equal(val.valid, false);
  assert.ok(val.errors.length > 0);
  const score = Scoring.dayScore(p, rec, day);
  assert.equal(score, 5); // done به ۲ clamp می‌شود: 2 + 2 روز استاندارد + 1 سخت
});

test('۷. habitCount=null و done=2 -> حداکثر شامل ۲ عادت', () => {
  const p = { id: 'p7', habitCount: null };
  const day = { n: 14, type: 'main', hardLevels: 3, specialMission: true };
  const rec = { done: 2, hard: 1, special: 0 };
  const max = Scoring.dayMax(p, day, rec);
  assert.equal(max, 7); // 2 عادت + 3 سخت + 2 هدف (بدون روز استاندارد چون habitCount ثبت نشده)
  const score = Scoring.dayScore(p, rec, day);
  assert.equal(score, 3); // 2 عادت + 1 سخت
});

test('۸. روز warmup یا review: امتیاز و حداکثر هر دو صفر و در مجموع نیامده', () => {
  const p = { id: 'p8', habitCount: 3 };
  const warmupDay = { n: 3, type: 'warmup', hardLevels: 0, specialMission: false };
  const reviewDay = { n: 29, type: 'review', hardLevels: 0, specialMission: false };
  const rec = { done: 3, hard: 2, special: 1 };
  assert.equal(Scoring.dayScore(p, rec, warmupDay), 0);
  assert.equal(Scoring.dayMax(p, warmupDay, rec), 0);
  assert.equal(Scoring.dayScore(p, rec, reviewDay), 0);
  assert.equal(Scoring.dayMax(p, reviewDay, rec), 0);
});

test('۹. روز باز در personTotals نیامده؛ روز بسته امده', () => {
  const p = { id: 'p9', habitCount: 3 };
  const cohort = {
    days: [
      { n: 8, type: 'main', hardLevels: 3, specialMission: true },
      { n: 9, type: 'main', hardLevels: 3, specialMission: true }
    ],
    records: {
      p9: {
        8: { done: 3, hard: 3, special: 1 }, // 10/10
        9: { done: 2, hard: 2, special: 0 } // 4/10
      }
    }
  };
  const groupOpen = { id: 'g1', closedDays: [] };
  const resOpen = Scoring.personTotals(p, cohort, groupOpen);
  assert.equal(resOpen.totalScore, 0);
  assert.equal(resOpen.totalMax, 0);

  const groupClosed = { id: 'g1', closedDays: [8] };
  const resClosed = Scoring.personTotals(p, cohort, groupClosed);
  assert.equal(resClosed.totalScore, 10);
  assert.equal(resClosed.totalMax, 10);
  assert.equal(resClosed.percent, 100);
});

test('۱۰. روز بستهشده و نفری که هیچ رکوردی ندارد -> امتیاز ۰، حداکثر = hardLevels + گزارش هدف', () => {
  const p = { id: 'p10', habitCount: null };
  const cohort = {
    days: [{ n: 8, type: 'main', hardLevels: 3, specialMission: true }],
    records: {}
  };
  const group = { id: 'g1', closedDays: [8] };
  const res = Scoring.personTotals(p, cohort, group);
  assert.equal(res.totalScore, 0);
  assert.equal(res.totalMax, 5); // 0 عادت + 3 سخت + 2 هدف
  assert.equal(res.percent, 0);
});

test('۱۱. جمع تجمعی: روز ۸ بسته با ۱۰ از ۱۰ و روز ۹ بسته با ۸ از ۸ -> ۱۳ از ۱۸ و درصد ۷۲', () => {
  // روز ۸: ۳ عادت + ۲ استاندارد + ۳ سخت + ۲ هدف = ۱۰ از ۱۰
  // روز ۹ (یک سطح): done=2 از ۳، hard=1، بدون هدف -> ۳ از ۸ (۳+۲+۱+۲)
  // جمع: ۱۳ از ۱۸ -> ۷۲٪
  const p = { id: 'p11', habitCount: 3 };
  const cohort = {
    days: [
      { n: 8, type: 'main', hardLevels: 3, specialMission: true },
      { n: 9, type: 'main', hardLevels: 1, specialMission: true }
    ],
    records: {
      p11: {
        8: { done: 3, hard: 3, special: 1 },
        9: { done: 2, hard: 1, special: 0 }
      }
    }
  };
  const group = { id: 'g1', closedDays: [8, 9] };
  const totals = Scoring.personTotals(p, cohort, group);
  assert.equal(totals.totalScore, 13);
  assert.equal(totals.totalMax, 18);
  assert.equal(totals.percent, 72);
});

test('۱۲. افراد frozen و left در groupSummary نیستند', () => {
  const cohort = {
    days: [{ n: 8, type: 'main', hardLevels: 3, specialMission: true }],
    participants: [
      { id: 'p_act', groupId: 'g1', status: 'active', habitCount: 3 },
      { id: 'p_froz', groupId: 'g1', status: 'frozen', habitCount: 3 },
      { id: 'p_left', groupId: 'g1', status: 'left', habitCount: 3 }
    ],
    records: {
      p_act: { 8: { done: 3, hard: 3, special: 1 } },
      p_froz: { 8: { done: 3, hard: 3, special: 1 } },
      p_left: { 8: { done: 3, hard: 3, special: 1 } }
    }
  };
  const group = { id: 'g1', closedDays: [8] };
  const summary = Scoring.groupSummary(cohort, group, 8, false);
  assert.equal(summary.activeCount, 1);
  assert.equal(summary.frozenCount, 1);
  assert.equal(summary.leftCount, 1);
  // Only p_act should be included in totalScore and totalMax
  assert.equal(summary.totalScore, 10);
  assert.equal(summary.totalMax, 10);
  assert.equal(summary.percent, 100);
});

test('۱۳. بستن روز و بازکردن دوبارهش مجموع را بهروز میکند', () => {
  const p = { id: 'p13', habitCount: 3 };
  const cohort = {
    days: [{ n: 8, type: 'main', hardLevels: 3, specialMission: true }],
    records: {
      p13: { 8: { done: 3, hard: 3, special: 1 } }
    }
  };
  const group = { id: 'g1', closedDays: [8] };
  let totals = Scoring.personTotals(p, cohort, group);
  assert.equal(totals.totalScore, 10);
  assert.equal(totals.totalMax, 10);

  // Reopen day 8
  group.closedDays = [];
  totals = Scoring.personTotals(p, cohort, group);
  assert.equal(totals.totalScore, 0);
  assert.equal(totals.totalMax, 0);
});

test('۱۴. تغییر hardLevels یک روزِ بسته بعد از ثبت، حداکثر و امتیاز را درست بازمحاسبه میکند', () => {
  const p = { id: 'p14', habitCount: 3 };
  const day = { n: 8, type: 'main', hardLevels: 3, specialMission: true };
  const rec = { done: 3, hard: 3, special: 1 };
  assert.equal(Scoring.dayScore(p, rec, day), 10);
  assert.equal(Scoring.dayMax(p, day, rec), 10);

  // Now change hardLevels to 1
  day.hardLevels = 1;
  assert.equal(Scoring.dayScore(p, rec, day), 8); // 3 عادت + 2 استاندارد + 1 سخت (clamp از ۳) + 2 هدف
  assert.equal(Scoring.dayMax(p, day, rec), 8);
});

test('۱۵. ورودی عددی با رقم فارسی یا عربی («۳» یا «٣») به عدد لاتین تبدیل میشود', () => {
  const p = { id: 'p15', habitCount: 3 };
  const day = { n: 8, type: 'main', hardLevels: 3, specialMission: true };
  const recFa = { done: '۳', hard: '۲', special: '۱' };
  const recAr = { done: '٣', hard: '٢', special: '١' };
  assert.equal(Scoring.dayScore(p, recFa, day), 9);
  assert.equal(Scoring.dayScore(p, recAr, day), 9);
});

test('۱۶. تطابق کامل داده‌های گزارش تصویری Canvas با خروجی و محاسبات اکسل', () => {
  const cohort = {
    name: 'دوره ۱۲',
    startDate: '2026-03-21',
    days: [
      { n: 8, type: 'main', hardLevels: 3, specialMission: true },
      { n: 9, type: 'main', hardLevels: 2, specialMission: true }
    ],
    participants: [
      { id: 'p1', name: 'علی رضایی', groupId: 'g1', status: 'active', habitCount: 3 },
      { id: 'p2', name: 'زهرا موسوی', groupId: 'g1', status: 'active', habitCount: 4 },
      { id: 'p3', name: 'مهدی کریمی', groupId: 'g1', status: 'frozen', habitCount: 3 }
    ],
    records: {
      p1: { 8: { done: 3, hard: 3, special: 1 }, 9: { done: 2, hard: 1, special: 0 } },
      p2: { 8: { done: 2, hard: 0, special: 0 }, 9: { done: 4, hard: 2, special: 1 } },
      p3: { 8: { done: 3, hard: 3, special: 1 } }
    }
  };
  const group = { id: 'g1', name: 'گروه عقاب', closedDays: [8] };

  // آزمون ۱: فقط اعضای فعال (بدون فریز)
  const reportData = ImageExport.getGroupDayReportRows(cohort as unknown as Cohort, group as Group, 8, false);
  assert.equal(reportData.rows.length, 2);

  const row1 = reportData.rows[0];
  assert.equal(row1.dayScore, 10);
  assert.equal(row1.dayMax, 10);
  assert.equal(row1.totalScore, 10);
  assert.equal(row1.totalMax, 10);
  assert.equal(row1.percent, 100);

  const row2 = reportData.rows[1];
  assert.equal(row2.dayScore, 2);
  assert.equal(row2.dayMax, 11);
  assert.equal(row2.totalScore, 2);
  assert.equal(row2.totalMax, 11);
  assert.equal(row2.percent, 18);

  // آزمون ۲: با احتساب افراد فریز
  const reportWithFrozen = ImageExport.getGroupDayReportRows(
    cohort as unknown as Cohort,
    group as Group,
    8,
    true
  );
  assert.equal(reportWithFrozen.rows.length, 3);
  assert.equal(reportWithFrozen.rows[2].status, 'frozen');
  assert.ok(reportWithFrozen.rows[2].name.includes('(فریز)'));
});

// ── قواعد سند مرجع ۱.۲ ──────────────────────────────────────────────

const day2 = { n: 8, type: 'main', hardLevels: 2, specialMission: true };

test('۱۷. دو عادت، هر دو انجام‌شده، بدون کار سخت و هدف -> ۴ (۲ عادت + ۲ روز استاندارد)', () => {
  const p = { id: 'a', habitCount: 2 };
  const rec = { done: 2, hard: 0, special: 0 };
  assert.equal(Scoring.dayScore(p, rec, day2), 4);
  assert.equal(standardDay(p, rec, day2), true);
});

test('۱۸. همان فرد با کار سخت سطح ۲ -> ۶، و با گزارش هدف -> ۸ از ۸', () => {
  const p = { id: 'a', habitCount: 2 };
  assert.equal(Scoring.dayScore(p, { done: 2, hard: 2, special: 0 }, day2), 6);
  const full = { done: 2, hard: 2, special: 1 };
  assert.equal(Scoring.dayScore(p, full, day2), 8);
  assert.equal(Scoring.dayMax(p, day2, full), 8);
});

test('۱۹. دو عادت و فقط یکی انجام‌شده -> ۱ امتیاز و بدون روز استاندارد', () => {
  const p = { id: 'a', habitCount: 2 };
  const rec = { done: 1, hard: 0, special: 0 };
  assert.equal(Scoring.dayScore(p, rec, day2), 1);
  assert.equal(standardDay(p, rec, day2), false);
});

test('۲۰. سقف ۲۱ روز (عادت + روز استاندارد) برای ۱ تا ۴ عادت: ۶۳، ۸۴، ۱۰۵، ۱۲۶', () => {
  const expected = [63, 84, 105, 126];
  expected.forEach((exp, i) => {
    const habits = i + 1;
    const p = { id: 'h' + habits, habitCount: habits };
    const noExtras = { n: 8, type: 'main', hardLevels: 0, specialMission: true };
    const rec = { done: habits, hard: null, special: 0 };
    // امتیاز بدون کار سخت و هدف = عادت + روز استاندارد
    assert.equal(Scoring.dayScore(p, rec, noExtras) * 21, exp);
  });
});

test('۲۱. habitCount برابر null یا ۰ -> روز استاندارد ندارد', () => {
  const rec = { done: 0, hard: 0, special: 0 };
  assert.equal(standardDay({ id: 'n', habitCount: null }, rec, day2), false);
  assert.equal(standardDay({ id: 'z', habitCount: 0 }, rec, day2), false);
  assert.equal(Scoring.dayMax({ id: 'z', habitCount: 0 }, day2, rec), 4); // ۲ سخت + ۲ هدف
});
