import test from 'node:test';
import assert from 'node:assert/strict';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Names = require('./names.js');
const Scoring = require('./scoring.js');
const ImageExport = require('./image-export.js');

test('۱. habitCount=3, done=3, hard=3 (روز با ۳ سطح), special=1 (روز ماموریت دارد) -> ۷ از ۷', () => {
  const p = { id: 'p1', habitCount: 3 };
  const day = { n: 8, type: 'main', hardLevels: 3, specialMission: true };
  const rec = { done: 3, hard: 3, special: 1 };
  const score = Scoring.dayScore(p, rec, day);
  const max = Scoring.dayMax(p, day, rec);
  assert.equal(score, 7);
  assert.equal(max, 7);
});

test('۲. habitCount=4, done=2, hard=0, special=0 در همان روز -> ۲ از ۸', () => {
  const p = { id: 'p2', habitCount: 4 };
  const day = { n: 8, type: 'main', hardLevels: 3, specialMission: true };
  const rec = { done: 2, hard: 0, special: 0 };
  const score = Scoring.dayScore(p, rec, day);
  const max = Scoring.dayMax(p, day, rec);
  assert.equal(score, 2);
  assert.equal(max, 8); // 4 habits + 3 hard + 1 special = 8
});

test('۳. habitCount=1, done=1, hard=2 در روزی با ۲ سطح و بدون ماموریت -> ۳ از ۳', () => {
  const p = { id: 'p3', habitCount: 1 };
  const day = { n: 10, type: 'main', hardLevels: 2, specialMission: false };
  const rec = { done: 1, hard: 2, special: 0 };
  const score = Scoring.dayScore(p, rec, day);
  const max = Scoring.dayMax(p, day, rec);
  assert.equal(score, 3);
  assert.equal(max, 3);
});

test('۴. روز بدون کار سخت (hardLevels=0) و با ماموریت، habitCount=2, done=2, special=1 -> ۳ از ۳', () => {
  const p = { id: 'p4', habitCount: 2 };
  const day = { n: 11, type: 'main', hardLevels: 0, specialMission: true };
  const rec = { done: 2, hard: 0, special: 1 };
  const score = Scoring.dayScore(p, rec, day);
  const max = Scoring.dayMax(p, day, rec);
  assert.equal(score, 3);
  assert.equal(max, 3);
});

test('۵. hard بزرگتر از hardLevels امروز: به سقف روز clamp میشود', () => {
  const p = { id: 'p5', habitCount: 2 };
  const day = { n: 12, type: 'main', hardLevels: 1, specialMission: false };
  const rec = { done: 2, hard: 3, special: 0 }; // typed 3 when level max is 1
  const score = Scoring.dayScore(p, rec, day);
  assert.equal(score, 3); // 2 done + 1 (clamped from 3)
});

test('۶. done بزرگتر از habitCount: validateRecord خطا میدهد و dayScore clamp میکند', () => {
  const p = { id: 'p6', habitCount: 2 };
  const day = { n: 13, type: 'main', hardLevels: 3, specialMission: true };
  const rec = { done: 4, hard: 1, special: 0 };
  const val = Scoring.validateRecord(p, rec, day);
  assert.equal(val.valid, false);
  assert.ok(val.errors.length > 0);
  const score = Scoring.dayScore(p, rec, day);
  assert.equal(score, 3); // done clamped to 2 + hard 1 = 3
});

test('۷. habitCount=null و done=2 -> حداکثر شامل ۲ عادت', () => {
  const p = { id: 'p7', habitCount: null };
  const day = { n: 14, type: 'main', hardLevels: 3, specialMission: true };
  const rec = { done: 2, hard: 1, special: 0 };
  const max = Scoring.dayMax(p, day, rec);
  assert.equal(max, 6); // 2 habits + 3 hard + 1 special = 6
  const score = Scoring.dayScore(p, rec, day);
  assert.equal(score, 3); // 2 done + 1 hard = 3
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
        8: { done: 3, hard: 3, special: 1 }, // 7/7
        9: { done: 2, hard: 2, special: 0 }  // 4/7
      }
    }
  };
  const groupOpen = { id: 'g1', closedDays: [] };
  const resOpen = Scoring.personTotals(p, cohort, groupOpen);
  assert.equal(resOpen.totalScore, 0);
  assert.equal(resOpen.totalMax, 0);

  const groupClosed = { id: 'g1', closedDays: [8] };
  const resClosed = Scoring.personTotals(p, cohort, groupClosed);
  assert.equal(resClosed.totalScore, 7);
  assert.equal(resClosed.totalMax, 7);
  assert.equal(resClosed.percent, 100);
});

test('۱۰. روز بستهشده و نفری که هیچ رکوردی ندارد -> امتیاز ۰، حداکثر = hardLevels + ماموریت', () => {
  const p = { id: 'p10', habitCount: null };
  const cohort = {
    days: [{ n: 8, type: 'main', hardLevels: 3, specialMission: true }],
    records: {}
  };
  const group = { id: 'g1', closedDays: [8] };
  const res = Scoring.personTotals(p, cohort, group);
  assert.equal(res.totalScore, 0);
  assert.equal(res.totalMax, 4); // 0 habits + 3 hard + 1 special = 4
  assert.equal(res.percent, 0);
});

test('۱۱. جمع تجمعی: روز ۸ بسته با ۷ از ۷ و روز ۹ بسته با ۳ از ۵ -> ۱۰ از ۱۲ و درصد ۸۳', () => {
  // Day 8: habitCount 3, 3 hard, 1 special -> 7/7
  // Day 9: day has hardLevels 1, specialMission true, habitCount 3 -> dayMax = 3 + 1 + 1 = 5
  // Done = 2, hard = 1, special = 0 -> 3/5
  // Total: 7 + 3 = 10, Max: 7 + 5 = 12. Percent = round(10/12 * 100) = 83.
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
  assert.equal(totals.totalScore, 10);
  assert.equal(totals.totalMax, 12);
  assert.equal(totals.percent, 83);
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
  assert.equal(summary.totalScore, 7);
  assert.equal(summary.totalMax, 7);
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
  assert.equal(totals.totalScore, 7);
  assert.equal(totals.totalMax, 7);

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
  assert.equal(Scoring.dayScore(p, rec, day), 7);
  assert.equal(Scoring.dayMax(p, day, rec), 7);

  // Now change hardLevels to 1
  day.hardLevels = 1;
  assert.equal(Scoring.dayScore(p, rec, day), 5); // 3 done + 1 hard (clamped from 3) + 1 special = 5
  assert.equal(Scoring.dayMax(p, day, rec), 5);  // 3 habit + 1 hard + 1 special = 5
});

test('۱۵. ورودی عددی با رقم فارسی یا عربی («۳» یا «٣») به عدد لاتین تبدیل میشود', () => {
  const p = { id: 'p15', habitCount: 3 };
  const day = { n: 8, type: 'main', hardLevels: 3, specialMission: true };
  const recFa = { done: '۳', hard: '۲', special: '۱' };
  const recAr = { done: '٣', hard: '٢', special: '١' };
  assert.equal(Scoring.dayScore(p, recFa, day), 6);
  assert.equal(Scoring.dayScore(p, recAr, day), 6);
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
  const reportData = ImageExport.getGroupDayReportRows(cohort, group, 8, false);
  assert.equal(reportData.rows.length, 2);

  const row1 = reportData.rows[0];
  assert.equal(row1.dayScore, 7);
  assert.equal(row1.dayMax, 7);
  assert.equal(row1.totalScore, 7);
  assert.equal(row1.totalMax, 7);
  assert.equal(row1.percent, 100);

  const row2 = reportData.rows[1];
  assert.equal(row2.dayScore, 2);
  assert.equal(row2.dayMax, 8);
  assert.equal(row2.totalScore, 2);
  assert.equal(row2.totalMax, 8);
  assert.equal(row2.percent, 25);

  // آزمون ۲: با احتساب افراد فریز
  const reportWithFrozen = ImageExport.getGroupDayReportRows(cohort, group, 8, true);
  assert.equal(reportWithFrozen.rows.length, 3);
  assert.equal(reportWithFrozen.rows[2].status, 'frozen');
  assert.ok(reportWithFrozen.rows[2].name.includes('(فریز)'));
});

