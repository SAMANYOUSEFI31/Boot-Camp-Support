import { test } from 'vitest';
import assert from 'node:assert/strict';
import { placeOverlay } from './overlay-positioning';

const base = {
  anchor: { left: 600, top: 200, width: 44, height: 44 },
  viewport: { left: 0, top: 0, width: 1024, height: 800 },
  panel: { width: 300, height: 220 },
  rtl: true, alignEnd: false, preferTop: false, margin: 16, gap: 8
};

test('منو کنار دکمه با هم‌ترازی RTL/LTR باز می‌شود و از لبه‌های افقی بیرون نمی‌رود', () => {
  assert.equal(placeOverlay(base).left, 344);
  assert.equal(placeOverlay({ ...base, rtl: false }).left, 600);
  assert.equal(placeOverlay({ ...base, alignEnd: true }).left, 600);
  assert.equal(placeOverlay({ ...base, rtl: false, alignEnd: true }).left, 344);
  assert.equal(placeOverlay({ ...base, anchor: { ...base.anchor, left: 0 } }).left, 16);
  assert.equal(placeOverlay({ ...base, rtl: false, anchor: { ...base.anchor, left: 980 } }).left, 708);
});

test('نزدیک پایین صفحه منو بالای دکمه باز و پنل بلند به فضای واقعی محدود می‌شود', () => {
  const anchor = { ...base.anchor, top: 700 };
  const above = placeOverlay({ ...base, anchor });
  assert.equal(above.top, 472);
  assert.ok(above.top + base.panel.height <= anchor.top - base.gap);
  const tall = placeOverlay({ ...base, anchor, panel: { width: 300, height: 1000 } });
  assert.equal(tall.top, 16);
  assert.equal(tall.maxHeight, 676);
  const below = placeOverlay({ ...base, preferTop: true, anchor: { ...base.anchor, top: 20 } });
  assert.equal(below.top, 72);
});

test('گوشی و نمای افقی کوتاه شیت پایین دارند؛ نقطه شکست ۶۴۰ دقیق رعایت می‌شود', () => {
  for (const width of [360, 390, 640]) {
    const result = placeOverlay({ ...base, viewport: { ...base.viewport, width } });
    assert.equal(result.compact, true);
    assert.equal(result.left, 16);
    assert.equal(result.width, width - 32);
    assert.equal(result.top, 564);
  }
  assert.equal(placeOverlay({ ...base, viewport: { ...base.viewport, width: 641 } }).compact, false);
  assert.equal(placeOverlay({ ...base, viewport: { ...base.viewport, height: 520 } }).compact, true);
});

test('پنل با باز شدن کیبورد و جابه‌جایی visualViewport در بخش قابل مشاهده می‌ماند', () => {
  const result = placeOverlay({
    ...base, viewport: { left: 20, top: 300, width: 390, height: 280 },
    panel: { width: 300, height: 600 }
  });
  assert.equal(result.left, 36);
  assert.equal(result.top, 316);
  assert.equal(result.width, 358);
  assert.equal(result.maxHeight, 248);
});

test('در اندازه‌های گوشی، تبلت و لپ‌تاپ تمام پنل داخل حاشیه امن viewport می‌ماند', () => {
  for (const width of [360, 640, 768, 1024, 1280]) {
    for (const height of [360, 800]) {
      for (const left of [16, width / 2, width - 60]) {
        for (const top of [16, height / 2, height - 60]) {
          const result = placeOverlay({
            ...base, viewport: { left: 0, top: 0, width, height },
            anchor: { left, top, width: 44, height: 44 },
            panel: { width: 450, height: 900 }
          });
          assert.ok(result.left >= 16);
          assert.ok(result.left + result.width <= width - 16);
          assert.ok(result.top >= 16);
          assert.ok(result.top + Math.min(900, result.maxHeight) <= height - 16);
        }
      }
    }
  }
});
