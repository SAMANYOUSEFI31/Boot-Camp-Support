import { test } from 'vitest';
import assert from 'node:assert/strict';
import { Scoring } from './scoring';
import type { DayConfig, Participant } from './types';

const day: DayConfig = { n: 8, type: 'main', hardLevels: 3, specialMission: true };
const participant: Participant = {
  id: 'p', name: 'علی', nameKey: 'علی', telegram: '', groupId: 'g', status: 'active', habitCount: 5
};

test('روز کامل بدون دونیت دقیقاً ۱۱ امتیاز دارد', () => {
  const record = { done: 5, doneHabits: [0, 1, 2, 3, 4], hard: 3, special: 1 };
  assert.deepEqual(Scoring.dayBreakdown(participant, record, day), {
    habits: 5, standard: 2, hard: 3, goal: 1, total: 11
  });
  assert.equal(Scoring.dayMax(participant, day), 11);
});

test('روز استاندارد فقط چهار عادت اصلی را لازم دارد؛ عادت پنجم جبران عادت اصلی نیست', () => {
  const required = { done: 4, doneHabits: [0, 1, 2, 3], hard: 0, special: 0 };
  assert.equal(Scoring.standardDay(participant, required, day), true);
  assert.equal(Scoring.dayScore(participant, required, day), 6);
  const missed = { ...required, doneHabits: [0, 1, 2, 4] };
  assert.equal(Scoring.standardDay(participant, missed, day), false);
  assert.equal(Scoring.dayScore(participant, missed, day), 4);
  assert.equal(Scoring.standardDay(participant, { done: 4 }, day), false);
});

test('ورودی فارسی، سطح کار سخت و مأموریت ویژه درست محاسبه می‌شوند', () => {
  assert.equal(Scoring.dayScore(participant, { done: '۲', hard: '۳', special: '۱' }, day), 6);
  assert.equal(Scoring.dayScore(participant, { done: 0, hard: 99, special: 0 }, day), 3);
  for (const hard of [-1, '1.5', '2x', 4]) {
    assert.equal(Scoring.validateRecord(participant, { hard }, day).valid, false);
  }
  assert.equal(Scoring.validateRecord(participant, { done: 6 }, day).valid, false);
  assert.equal(Scoring.validateRecord(participant, { special: 2 }, day).valid, false);
});

test('گرم‌کردن و مرور نه امتیاز روز دارند نه روز استاندارد', () => {
  for (const type of ['warmup', 'review'] as const) {
    const config = { ...day, type };
    const record = { done: 5, doneHabits: [0, 1, 2, 3, 4], hard: 3, special: 1 };
    assert.equal(Scoring.dayScore(participant, record, config), 0);
    assert.equal(Scoring.dayMax(participant, config), 0);
    assert.equal(Scoring.standardDay(participant, record, config), false);
  }
});

test('امتیاز روزهای بسته + دونیت کل دوره؛ خرید جان هیچ امتیازی ندارد', () => {
  const p = { ...participant, donations: [
    { id: 'a', amount: 100000, dayN: 8, paidAt: '2026-11-01T00:00:00Z' },
    { id: 'b', amount: 900000, dayN: 9, paidAt: '2026-11-02T00:00:00Z' }
  ] };
  const cohort = { days: [day, { ...day, n: 9 }], records: {
    p: { 8: { done: 5, doneHabits: [0, 1, 2, 3, 4], hard: 3, special: 1 },
      9: { done: 5, doneHabits: [0, 1, 2, 3, 4], hard: 3, special: 1 } }
  } };
  const totals = Scoring.personTotals(p, cohort, { id: 'g', closedDays: [8] }, 8);
  assert.equal(totals.totalScore, 11);
  assert.equal(totals.totalMax, 16);
  assert.equal(totals.donationScore, 0);
  const full = Scoring.personTotals(p, cohort, { id: 'g', closedDays: [8, 9] });
  assert.equal(full.totalScore, 27);
  assert.equal(full.totalMax, 27);
  assert.equal(full.percent, 100);
});

test('کار سخت تک‌سطحی (hardLevels: 1) در صورت انجام ۳ امتیاز می‌دهد', () => {
  const singleDay: DayConfig = { n: 5, type: 'main', hardLevels: 1, specialMission: true };
  assert.equal(Scoring.dayMax(participant, singleDay), 11);
  assert.deepEqual(
    Scoring.dayBreakdown(participant, { done: 0, hard: 1, special: 0 }, singleDay),
    { habits: 0, standard: 0, hard: 3, goal: 0, total: 3 }
  );
  assert.equal(Scoring.dayScore(participant, { done: 0, hard: 0, special: 0 }, singleDay), 0);
  assert.equal(Scoring.validateRecord(participant, { hard: 2 }, singleDay).valid, false);
});
