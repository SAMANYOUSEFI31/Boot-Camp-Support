/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { B } from './bushido';
import { Names } from './names';
import { buildReportRows, cellText, columnTitle, visibleColumns } from './report-columns';
import type { ReportColumn, ReportRow, ReportRowsData as ReportData } from './report-columns';
import { Brand } from './brand';
import type { Cohort, Group, Toast } from './types';

export interface ImagePart {
  partIndex: number;
  totalParts: number;
  filename: string;
  blob: Blob | null;
  dataUrl: string;
  width: number;
  height: number;
  rowsCount: number;
}

export interface ImagesData {
  reportData: ReportData;
  parts: ImagePart[];
  totalParts: number;
}

interface BrandImage {
  img: HTMLImageElement;
  ratio: number;
}
interface BrandImages {
  lockup: BrandImage | null;
  mark: BrandImage | null;
}
type Tokens = ReturnType<typeof getTokens>;
interface RenderedPart {
  blob: Blob | null;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * ردیف‌های گزارش روز (همان منبع اکسل: report-columns.ts)
 * خروجی خالص جهت آزمون و رسم در بوم
 */
function getGroupDayReportRows(
  cohort: Cohort,
  group: Group,
  dayN: number,
  includeFrozen?: boolean
): ReportData {
  return buildReportRows(cohort, group, dayN, { includeFrozen: includeFrozen });
}

/**
 * مقادیر پیش‌فرض توکن‌ها؛ فقط وقتی tokens.css بارگذاری نشده (مثلاً خارج از مرورگر) استفاده می‌شود.
 */
const TOKEN_FALLBACK = {
  '--surface-page': '#09090b',
  '--surface-raised': '#18181b',
  '--text-default': '#f4f4f5',
  '--text-subtle': '#a1a1aa',
  '--text-success': '#6ee7b7',
  '--text-warning': '#fcd34d',
  '--icon-success': '#34d399',
  '--border-subtle': 'rgba(255,255,255,0.08)',
  '--border-default': 'rgba(255,255,255,0.12)',
  '--bg-neutral-subtle': 'rgba(255,255,255,0.08)',
  '--font-sans': "'Vazirmatn', Tahoma, sans-serif"
};

/**
 * خواندن توکن‌های دیزاین سیستم از CSS (رنگ، اندازه، فونت) برای رسم روی بوم
 */
function getTokens() {
  const computed =
    typeof window !== 'undefined' && window.getComputedStyle
      ? window.getComputedStyle(document.documentElement)
      : null;
  function raw(name: string): string {
    const v = computed ? computed.getPropertyValue(name) : '';
    return v && v.trim() ? v.trim() : '';
  }
  function color(name: string): string {
    return raw(name) || TOKEN_FALLBACK[name as keyof typeof TOKEN_FALLBACK];
  }
  function px(name: string, fallbackPx: number): number {
    const n = parseFloat(raw(name));
    return isNaN(n) ? fallbackPx : n;
  }
  return {
    font: raw('--font-sans') || TOKEN_FALLBACK['--font-sans'],
    page: color('--surface-page'),
    raised: color('--surface-raised'),
    text: color('--text-default'),
    subtle: color('--text-subtle'),
    success: color('--text-success'),
    warning: color('--text-warning'),
    bar: color('--icon-success'),
    track: color('--bg-neutral-subtle'),
    tint: color('--bg-neutral-subtle'),
    border: color('--border-subtle'),
    borderStrong: color('--border-default'),
    s1: px('--space-1', 4),
    s2: px('--space-2', 8),
    s3: px('--space-3', 12),
    s4: px('--space-4', 16),
    s6: px('--space-6', 24),
    s8: px('--space-8', 32),
    s12: px('--space-12', 48),
    s16: px('--space-16', 64),
    s20: px('--space-20', 80),
    s24: px('--space-24', 96),
    rContainer: px('--radius-container', 16),
    rFull: px('--radius-full', 9999),
    logoMin: px('--logo-min', 32),
    f14: px('--font-size-14', 14),
    f20: px('--font-size-20', 20),
    f24: px('--font-size-24', 24),
    f30: px('--font-size-30', 30),
    f36: px('--font-size-36', 36),
    lhSnug: px('--line-height-snug', 1.4),
    wRegular: px('--font-weight-regular', 400),
    wSemibold: px('--font-weight-semibold', 600),
    wBold: px('--font-weight-bold', 700)
  };
}

/**
 * اطمینان از بارگذاری قلم وزیرمتن برای جلوگیری از کشیده شدن بوم با فونت ناقص
 */
function ensureFontsLoaded() {
  if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) {
    return Promise.resolve();
  }
  return Promise.all([
    document.fonts.load('400 30px Vazirmatn'),
    document.fonts.load('600 30px Vazirmatn'),
    document.fonts.load('700 36px Vazirmatn')
  ])
    .then(function () {
      return true;
    })
    .catch(function (e) {
      console.warn('Font loading check:', e);
      return true; // ادامه با قلم‌های سیستم در صورت شکست
    });
}

/**
 * نسبت ابعاد یک SVG از روی viewBox یا width/height (بدون کشیدن لوگو)
 */
function svgRatioFromText(svg: string): number | null {
  const vb = svg.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/);
  if (vb && parseFloat(vb[2]) > 0) return parseFloat(vb[1]) / parseFloat(vb[2]);
  const w = svg.match(/<svg[^>]*\swidth\s*=\s*["']([\d.]+)/);
  const hh = svg.match(/<svg[^>]*\sheight\s*=\s*["']([\d.]+)/);
  if (w && hh && parseFloat(hh[1]) > 0) return parseFloat(w[1]) / parseFloat(hh[1]);
  return null;
}

async function svgRatio(src: string, img: HTMLImageElement): Promise<number> {
  try {
    let svg: string;
    if (src.startsWith('data:')) {
      const comma = src.indexOf(',');
      const body = src.slice(comma + 1);
      svg = /;base64/.test(src.slice(0, comma)) ? atob(body) : decodeURIComponent(body);
    } else {
      svg = await (await fetch(src)).text();
    }
    const r = svgRatioFromText(svg);
    if (r) return r;
  } catch (e) {
    // ادامه با اندازهٔ طبیعی تصویر
  }
  return img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
}

const brandImageCache: Record<string, BrandImage> = {};

/**
 * بارگذاری لوگوها از Brand. اگر نبود یا بارگذاری نشد، بدون لوگو ادامه می‌دهیم.
 */
function loadBrandImages(): Promise<BrandImages> {
  function load(key: keyof typeof Brand): Promise<BrandImage | null> {
    const src = Brand[key];
    if (!src || typeof Image === 'undefined') return Promise.resolve(null);
    if (brandImageCache[src]) return Promise.resolve(brandImageCache[src]);
    return new Promise<BrandImage | null>(function (resolve) {
      const img = new Image();
      img.onload = function () {
        svgRatio(src, img).then(function (ratio) {
          brandImageCache[src] = { img: img, ratio: ratio };
          resolve(brandImageCache[src]);
        });
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = src;
    });
  }
  return Promise.all([load('lockupWhite'), load('markWhite')]).then(function (r) {
    return { lockup: r[0], mark: r[1] };
  });
}

/**
 * تقسیم اعضا به دسته‌های حداکثر ۱۵ نفری طبق دستورالعمل
 */
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks.length ? chunks : [[]];
}

/**
 * خلاصهٔ گروه برای ردیف بالای تصویر (بدون رتبه‌بندی)
 */
function getGroupSummary(rows: ReportRow[]) {
  const active = rows.filter(function (r) {
    return r.status !== 'frozen' && r.status !== 'left';
  });
  const registered = active.filter(function (r) {
    return r.dayScore != null;
  });
  const perfect = registered.filter(function (r) {
    return (r.dayMax as number) > 0 && r.dayScore === r.dayMax;
  });
  const avg = active.length
    ? Math.round(
        active.reduce(function (sum, r) {
          return sum + (r.percent || 0);
        }, 0) / active.length
      )
    : 0;
  return {
    activeCount: active.length,
    registeredCount: registered.length,
    avgPercent: avg,
    perfectCount: perfect.length
  };
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  hgt: number,
  r: number
) {
  r = Math.min(r, w / 2, hgt / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + hgt - r);
  ctx.arcTo(x + w, y + hgt, x + w - r, y + hgt, r);
  ctx.lineTo(x + r, y + hgt);
  ctx.arcTo(x, y + hgt, x, y + hgt - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * کوچک کردن قلم تا متن در عرض مجاز جا شود (حداقل minSize)
 */
function fitFont(
  ctx: CanvasRenderingContext2D,
  T: Tokens,
  text: string,
  maxWidth: number,
  size: number,
  minSize: number,
  weight: number | string
): number {
  let sz = size;
  ctx.font = weight + ' ' + sz + 'px ' + T.font;
  while (sz > minSize && ctx.measureText(text).width > maxWidth) {
    sz -= 1;
    ctx.font = weight + ' ' + sz + 'px ' + T.font;
  }
  return sz;
}

/**
 * نام بلند: اول کوچک کردن قلم، بعد شکستن به دو سطر
 */
function wrapNameText(
  ctx: CanvasRenderingContext2D,
  T: Tokens,
  text: string,
  maxWidth: number,
  size: number,
  minSize: number
) {
  const sz = fitFont(ctx, T, text, maxWidth, size, minSize, T.wSemibold);
  if (ctx.measureText(text).width <= maxWidth) return { lines: [text], fontSize: sz };
  const words = text.split(/\s+/);
  if (words.length <= 1) return { lines: [text], fontSize: sz };
  const mid = Math.ceil(words.length / 2);
  return { lines: [words.slice(0, mid).join(' '), words.slice(mid).join(' ')], fontSize: minSize };
}

interface HabitChip {
  text: string;
  tone: 'success' | 'subtle';
  w: number;
}
type HabitLine = HabitChip[];

/**
 * چیدمان سطر در حالت «عادت‌های نام‌دار»: بلوک نام (یک یا دو خط) و زیرش خط(های) عادت‌ها
 */
function layoutHabitRow(
  mctx: CanvasRenderingContext2D,
  T: Tokens,
  row: ReportRow,
  avail: number,
  nameText: string,
  minH: number
) {
  const wrapped = wrapNameText(mctx, T, nameText, avail, T.f30, T.f24);
  const unregistered = row.dayScore == null;
  const topH = wrapped.lines.length === 2 ? 68 : unregistered ? 60 : 44;

  const items: { text: string; tone: 'success' | 'subtle' }[] = [];
  const known = row.habits.filter(function (h) {
    return h.state === 'done' || h.state === 'missed';
  });
  if (row.habits.length && known.length === 0 && row.habits.every((h) => h.state === 'unknown')) {
    // رکورد قدیمی: فقط تعداد معلوم است
    items.push({
      text:
        Names.toPersianDigits(row.breakdown.habits) +
        ' از ' +
        Names.toPersianDigits(row.habits.length) +
        ' عادت (کدام‌ها ثبت نشده)',
      tone: 'subtle'
    });
  } else {
    row.habits.forEach(function (h) {
      const mark = h.state === 'done' ? '✓ ' : h.state === 'missed' ? '✗ ' : '— ';
      items.push({ text: mark + h.label, tone: h.state === 'done' ? 'success' : 'subtle' });
    });
  }
  if (row.standardDay) items.push({ text: 'روز استاندارد ✓', tone: 'success' });

  const lines: HabitLine[] = [];
  let cur: HabitLine = [];
  let curW = 0;
  items.forEach(function (it) {
    mctx.font = (it.tone === 'success' ? T.wSemibold : T.wRegular) + ' ' + T.f20 + 'px ' + T.font;
    let text = it.text;
    while (mctx.measureText(text).width > avail && text.length > 2) text = text.slice(0, -2) + '…';
    const w = mctx.measureText(text).width;
    if (cur.length && curW + T.s4 + w > avail) {
      lines.push(cur);
      cur = [];
      curW = 0;
    }
    cur.push({ text: text, tone: it.tone, w: w });
    curW += (cur.length > 1 ? T.s4 : 0) + w;
  });
  if (cur.length) lines.push(cur);

  const h = Math.max(minH, 14 + topH + (lines.length ? 8 + lines.length * 30 : 0) + 14);
  return { h: h, mainMid: 14 + topH / 2, topH: topH, lines: lines };
}

/**
 * رسم یک بخش از گزارش روی Canvas و تولید Blob و DataURL
 * فقط توکن‌های دیزاین سیستم برای رنگ و اندازه (به‌جز عرض ۱۰۸۰ و مقیاس ۲ که استاندارد خروجی‌اند)
 */
function renderSingleCanvasPart(
  reportData: ReportData,
  partRows: ReportRow[],
  partIndex: number,
  totalParts: number,
  brandImages?: BrandImages
): Promise<RenderedPart> {
  const T = getTokens();
  const brand: Partial<BrandImages> = brandImages || {};
  const scale = 2;
  const width = 1080;

  const padX = T.s8;
  const tableX = T.s4;
  const tableW = width - 2 * tableX;
  const rowHeight = T.s20;
  const headRowH = T.s16;

  // ارتفاع بلوک عنوان: سه سطر
  const l1 = Math.round(T.f36 * T.lhSnug);
  const l2 = Math.round(T.f24 * T.lhSnug);
  const l3 = Math.round(T.f20 * T.lhSnug);
  const titleBlockH = l1 + l2 + l3;
  const lockupH = T.s12;
  const headerH = T.s8 + Math.max(titleBlockH, lockupH) + T.s6;
  const summaryH = T.s24;
  const footerH = T.s20;
  // ستون‌ها از فهرست مشترک report-columns.ts می‌آیند
  const cols: { def: ReportColumn; title: string; width: number }[] = visibleColumns(
    'image',
    reportData.ctx
  ).map(function (def) {
    return { def: def, title: columnTitle(def, 'image'), width: def.imageWidth };
  });
  const fixedW = cols.reduce(function (sum2, c) {
    return sum2 + c.width;
  }, 0);
  cols.forEach(function (c) {
    if (c.def.kind === 'name') c.width = tableW - fixedW;
  });

  // حالت جزئیات: وقتی دست‌کم یک فرد عادت نام‌دار دارد، زیر نام هر فرد وضعیت تک‌تک عادت‌ها نوشته می‌شود
  const detailed = reportData.ctx.hasHabitNames;
  const nameCol = cols.find(function (c) {
    return c.def.kind === 'name';
  });
  const indexW = cols.length && cols[0].def.kind === 'index' ? cols[0].width : 0;
  const mctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
  if (mctx) mctx.direction = 'rtl';
  const layouts = partRows.map(function (row) {
    return detailed && mctx && nameCol
      ? layoutHabitRow(
          mctx,
          T,
          row,
          nameCol.width - 2 * T.s4,
          cellText(nameCol.def, row, reportData.ctx, 'image'),
          rowHeight
        )
      : { h: rowHeight, mainMid: rowHeight / 2, topH: 0, lines: [] as HabitLine[] };
  });
  const rowsTotal = layouts.length
    ? layouts.reduce(function (sum2, l) {
        return sum2 + l.h;
      }, 0)
    : rowHeight;
  const rowOffsets: number[] = [];
  layouts.reduce(function (acc, l) {
    rowOffsets.push(acc);
    return acc + l.h;
  }, 0);
  const tableH = headRowH + rowsTotal;
  const height = headerH + T.s6 + summaryH + T.s6 + tableH + T.s4 + footerH;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  if (!ctx) throw new Error('این مرورگر نمی‌تواند تصویر بسازد. مرورگر دیگری را امتحان کن.');
  ctx.scale(scale, scale);
  ctx.direction = 'rtl';
  ctx.textBaseline = 'middle';

  function setFont(weight: number | string, size: number) {
    ctx.font = weight + ' ' + size + 'px ' + T.font;
  }
  function drawLogo(entry: BrandImage | null | undefined, x: number, y: number, hgt: number) {
    if (!entry) return 0;
    const w = hgt * entry.ratio;
    ctx.drawImage(entry.img, x, y, w, hgt);
    return w;
  }

  ctx.fillStyle = T.page;
  ctx.fillRect(0, 0, width, height);

  // ۱. هدر: متن در سمت شروع (راست)، لوگو در سمت پایان (چپ)
  const blockTop = T.s8;
  const blockH = Math.max(titleBlockH, lockupH);
  const textTop = blockTop + (blockH - titleBlockH) / 2;
  const lockupW = brand.lockup ? lockupH * brand.lockup.ratio : 0;
  const textMaxW = width - 2 * padX - (lockupW ? lockupW + T.s6 : 0);

  ctx.textAlign = 'right';
  const partSuffix =
    totalParts > 1
      ? ' · بخش ' + Names.toPersianDigits(partIndex + 1) + ' از ' + Names.toPersianDigits(totalParts)
      : '';
  const groupTitle = reportData.groupName;
  fitFont(ctx, T, groupTitle, textMaxW, T.f36, T.f24, T.wBold);
  ctx.fillStyle = T.text;
  ctx.fillText(groupTitle, width - padX, textTop + l1 / 2);

  const sub =
    (reportData.cohortName ? reportData.cohortName + ' · ' : '') +
    'روز ' +
    Names.toPersianDigits(reportData.dayN) +
    ' · ' +
    reportData.dayShamsi +
    partSuffix;
  fitFont(ctx, T, sub, textMaxW, T.f24, T.f20, T.wRegular);
  ctx.fillStyle = T.subtle;
  ctx.fillText(sub, width - padX, textTop + l1 + l2 / 2);

  const statusLabel = reportData.isClosed ? '● نهایی (روز بسته شده)' : '○ پیش‌نویس (روز هنوز بسته نشده)';
  setFont(T.wRegular, T.f20);
  ctx.fillStyle = reportData.isClosed ? T.success : T.warning;
  ctx.fillText(statusLabel, width - padX, textTop + l1 + l2 + l3 / 2);

  if (brand.lockup) {
    drawLogo(brand.lockup, padX, blockTop + (blockH - lockupH) / 2, lockupH);
  }

  // خط جداکننده
  ctx.strokeStyle = T.borderStrong;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, headerH - 0.5);
  ctx.lineTo(width - padX, headerH - 0.5);
  ctx.stroke();

  // ۲. ردیف خلاصه
  const sum = getGroupSummary(reportData.rows);
  const gap = T.s3;
  const cardW = (width - 2 * tableX - 2 * gap) / 3;
  const cardY = headerH + T.s6;
  const cards = [
    {
      value: Names.toPersianDigits(sum.registeredCount) + ' از ' + Names.toPersianDigits(sum.activeCount),
      label: 'ثبت‌شده در این روز'
    },
    { value: Names.toPersianDigits(sum.avgPercent) + '٪', label: 'میانگین درصد گروه' },
    { value: Names.toPersianDigits(sum.perfectCount) + ' نفر', label: 'امتیاز کامل گرفتند' }
  ];
  cards.forEach(function (card, i) {
    const cx = width - tableX - (i + 1) * cardW - i * gap;
    roundRectPath(ctx, cx, cardY, cardW, summaryH, T.rContainer);
    ctx.fillStyle = T.raised;
    ctx.fill();
    ctx.strokeStyle = T.border;
    ctx.stroke();
    ctx.textAlign = 'center';
    setFont(T.wBold, T.f30);
    ctx.fillStyle = T.text;
    ctx.fillText(card.value, cx + cardW / 2, cardY + summaryH * 0.38);
    fitFont(ctx, T, card.label, cardW - 2 * T.s3, T.f20, T.f14, T.wRegular);
    ctx.fillStyle = T.subtle;
    ctx.fillText(card.label, cx + cardW / 2, cardY + summaryH * 0.74);
  });

  // ۳. جدول
  const tableTop = cardY + summaryH + T.s6;
  ctx.save();
  roundRectPath(ctx, tableX, tableTop, tableW, tableH, T.rContainer);
  ctx.clip();

  ctx.fillStyle = T.tint;
  ctx.fillRect(tableX, tableTop, tableW, headRowH);
  let x = width - tableX;
  cols.forEach(function (col) {
    setFont(T.wSemibold, T.f20);
    ctx.fillStyle = T.subtle;
    ctx.textAlign = col.def.kind === 'name' ? 'right' : 'center';
    const hx = col.def.kind === 'name' ? x - T.s4 : x - col.width / 2;
    ctx.fillText(col.title, hx, tableTop + headRowH / 2);
    x -= col.width;
  });

  partRows.forEach(function (row, rIdx) {
    const lay = layouts[rIdx];
    const rowY = tableTop + headRowH + rowOffsets[rIdx];
    const midY = rowY + lay.mainMid;
    if (rIdx % 2 === 1) {
      ctx.fillStyle = T.raised;
      ctx.fillRect(tableX, rowY, tableW, lay.h);
    }
    const unregistered = row.dayScore == null;

    let cx = width - tableX;
    cols.forEach(function (col) {
      const center = cx - col.width / 2;
      ctx.textAlign = 'center';
      if (col.def.kind === 'index') {
        setFont(T.wRegular, T.f24);
        ctx.fillStyle = T.subtle;
        ctx.fillText(cellText(col.def, row, reportData.ctx, 'image'), center, midY);
      } else if (col.def.kind === 'name') {
        const wrapped = wrapNameText(
          ctx,
          T,
          cellText(col.def, row, reportData.ctx, 'image'),
          col.width - 2 * T.s4,
          T.f30,
          T.f24
        );
        setFont(T.wSemibold, wrapped.fontSize);
        ctx.fillStyle = row.status === 'frozen' || row.status === 'left' ? T.subtle : T.text;
        ctx.textAlign = 'right';
        const tx = cx - T.s4;
        const lineGap = Math.round((wrapped.fontSize * T.lhSnug) / 2);
        if (wrapped.lines.length === 2) {
          ctx.fillText(wrapped.lines[0], tx, midY - lineGap);
          ctx.fillText(wrapped.lines[1], tx, midY + lineGap);
        } else if (unregistered) {
          ctx.fillText(wrapped.lines[0], tx, midY - T.s2);
        } else {
          ctx.fillText(wrapped.lines[0], tx, midY);
        }
        if (unregistered && wrapped.lines.length === 1) {
          setFont(T.wRegular, T.f14);
          const tagText = 'ثبت‌نشده';
          const tagW = ctx.measureText(tagText).width + 2 * T.s2;
          const tagH = T.f14 + T.s2;
          const tagY = midY + T.s3 + T.s1;
          roundRectPath(ctx, tx - tagW, tagY - tagH / 2, tagW, tagH, T.rFull);
          ctx.fillStyle = T.tint;
          ctx.fill();
          ctx.fillStyle = T.subtle;
          ctx.textAlign = 'center';
          ctx.fillText(tagText, tx - tagW / 2, tagY);
        }
      } else if (col.def.kind === 'percent') {
        const innerW = col.width - 2 * T.s3;
        const pct = Math.max(0, Math.min(100, row.percent || 0));
        setFont(T.wSemibold, T.f24);
        ctx.fillStyle = T.text;
        ctx.fillText(cellText(col.def, row, reportData.ctx, 'image'), center, midY - T.s2);
        const barY = midY + T.s4 - T.s1;
        const barX = cx - T.s3 - innerW;
        roundRectPath(ctx, barX, barY, innerW, T.s2, T.rFull);
        ctx.fillStyle = T.track;
        ctx.fill();
        if (pct > 0) {
          const fillW = Math.max(T.s2, (innerW * pct) / 100);
          roundRectPath(ctx, cx - T.s3 - fillW, barY, fillW, T.s2, T.rFull);
          ctx.fillStyle = T.bar;
          ctx.fill();
        }
      } else {
        const text = cellText(col.def, row, reportData.ctx, 'image');
        const weight =
          col.def.weight === 'bold' ? T.wBold : col.def.weight === 'semibold' ? T.wSemibold : T.wRegular;
        const tone = col.def.tone ? col.def.tone(row, 'image') : undefined;
        let color = tone === 'success' ? T.success : tone === 'subtle' ? T.subtle : T.text;
        if (text === '—') color = T.subtle;
        fitFont(ctx, T, text, col.width - T.s3, T.f30, T.f24, weight);
        ctx.fillStyle = color;
        ctx.fillText(text, center, midY);
      }
      cx -= col.width;
    });

    // جزئیات عادت‌ها زیر نام: ✓ انجام شد، ✗ انجام نشد
    if (lay.lines.length) {
      let ly = rowY + lay.mainMid - lay.topH / 2 + lay.topH + 8 + 15;
      lay.lines.forEach(function (line) {
        let hx = width - tableX - indexW - T.s4;
        ctx.textAlign = 'right';
        line.forEach(function (chip) {
          setFont(chip.tone === 'success' ? T.wSemibold : T.wRegular, T.f20);
          ctx.fillStyle = chip.tone === 'success' ? T.success : T.subtle;
          ctx.fillText(chip.text, hx, ly);
          hx -= chip.w + T.s4;
        });
        ly += 30;
      });
    }
  });
  ctx.restore();
  roundRectPath(ctx, tableX, tableTop, tableW, tableH, T.rContainer);
  ctx.strokeStyle = T.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  // ۴. فوتر: نشان کوچک و نام بوت‌کمپ
  const footerTop = tableTop + tableH + T.s4;
  const footerMid = footerTop + footerH / 2;
  const footText = 'بوت‌کمپ بوشیدو';
  setFont(T.wRegular, T.f20);
  const textW = ctx.measureText(footText).width;
  const markH = T.logoMin;
  const markW = brand.mark ? markH * brand.mark.ratio : 0;
  const groupW = textW + (markW ? markW + T.s3 : 0);
  const startX = (width + groupW) / 2; // لبهٔ راست مجموعه
  ctx.textAlign = 'right';
  ctx.fillStyle = T.subtle;
  ctx.fillText(footText, startX, footerMid);
  if (brand.mark) {
    drawLogo(brand.mark, startX - textW - T.s3 - markW, footerMid - markH / 2, markH);
  }

  return new Promise<RenderedPart>(function (resolve, reject) {
    try {
      const dataUrl = canvas.toDataURL('image/png');
      if (canvas.toBlob) {
        canvas.toBlob(function (blob) {
          if (blob) {
            resolve({ blob: blob, dataUrl: dataUrl, width: width * scale, height: height * scale });
          } else {
            reject(new Error('تصویر ساخته نشد. دوباره امتحان کن.'));
          }
        }, 'image/png');
      } else {
        resolve({ blob: null, dataUrl: dataUrl, width: width * scale, height: height * scale });
      }
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * تولید تصاویر گزارش روز یک گروه (با تکه‌بندی خودکار اگر بیشتر از ۱۵ نفر باشد)
 */
function generateGroupDayReportImages(
  cohort: Cohort,
  group: Group,
  dayN: number,
  includeFrozen?: boolean
): Promise<ImagesData> {
  return Promise.all([ensureFontsLoaded(), loadBrandImages()]).then(function (loaded) {
    const brand = loaded[1];
    const reportData = getGroupDayReportRows(cohort, group, dayN, includeFrozen);
    const rows = reportData.rows;

    if (!rows.length) {
      throw new Error('فردی در این گروه نیست. اول افراد را به گروه اضافه کن.');
    }

    const chunks = chunkArray(rows, 15);
    const totalParts = chunks.length;

    const promises = chunks.map(function (chunkRows, idx): Promise<ImagePart> {
      return renderSingleCanvasPart(reportData, chunkRows, idx, totalParts, brand).then(function (res) {
        const baseFilename = Names.sanitizeFilename(group.name + '_روز-' + dayN);
        const filename = totalParts > 1 ? baseFilename + '_بخش-' + (idx + 1) + '.png' : baseFilename + '.png';
        return {
          partIndex: idx,
          totalParts: totalParts,
          filename: filename,
          blob: res.blob,
          dataUrl: res.dataUrl,
          width: res.width,
          height: res.height,
          rowsCount: chunkRows.length
        };
      });
    });

    return Promise.all(promises).then(function (parts) {
      return {
        reportData: reportData,
        parts: parts,
        totalParts: totalParts
      };
    });
  });
}

/**
 * دانلود مستقیم یک تصویر
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 2000);
}

/**
 * اشتراک‌گذاری یا دانلود هوشمند
 * اگر navigator.canShare با فایل پشتیبانی شود (موبایل)، شیت تلگرام/پیام‌رسان باز می‌شود؛
 * در غیر این صورت فایل به طور مستقیم دانلود می‌گردد.
 */
function shareOrDownloadImage(blob: Blob | null, filename: string): Promise<void> {
  if (!blob) {
    return Promise.reject(new Error('تصویر آماده نیست. دوباره بساز.'));
  }

  if (
    typeof navigator !== 'undefined' &&
    navigator.share &&
    navigator.canShare &&
    typeof File !== 'undefined'
  ) {
    try {
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        return navigator
          .share({
            files: [file],
            title: filename,
            text: 'گزارش روزانه بوت‌کمپ بوشیدو'
          })
          .catch(function (err) {
            // اگر کاربر انصراف داد، نیازی به خطا نیست
            if (err.name !== 'AbortError') {
              downloadBlob(blob, filename);
            }
          });
      }
    } catch (e) {
      // فال‌بک به دانلود در صورت هرگونه محدودیت
    }
  }

  downloadBlob(blob, filename);
  return Promise.resolve();
}

/**
 * دیالوگ پیش‌نمایش تصویر گزارش روز قبل از ارسال/دانلود
 * ریسپانسیو و اسکرول‌پذیر در موبایل و دسکتاپ
 */
interface ImagePreviewModalProps {
  open: boolean;
  onClose: () => void;
  imagesData: ImagesData | null;
  toast?: Toast;
}

function ImagePreviewModal(props: ImagePreviewModalProps) {
  const open = props.open;
  const onClose = props.onClose;
  const imagesData = props.imagesData; // { reportData, parts, totalParts }

  const [currentPartIdx, setCurrentPartIdx] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const [notice, setNotice] = useState<{ intent: 'success' | 'danger'; message: string } | null>(null); // اعلان داخل دیالوگ (نه toast پایین صفحه)

  if (!open || !imagesData || !imagesData.parts || !imagesData.parts.length) return null;

  const parts = imagesData.parts;
  const activePart = parts[currentPartIdx] || parts[0];

  function handleShareOrDownloadSingle() {
    setIsSharing(true);
    shareOrDownloadImage(activePart.blob, activePart.filename)
      .then(function () {
        setIsSharing(false);
        setNotice({ intent: 'success', message: 'تصویر دانلود یا ارسال شد.' });
      })
      .catch(function (err) {
        setIsSharing(false);
        setNotice({ intent: 'danger', message: err.message });
      });
  }

  function handleDownloadAllParts() {
    parts.forEach(function (p, idx) {
      setTimeout(function () {
        if (p.blob) downloadBlob(p.blob, p.filename);
      }, idx * 400);
    });
    setNotice({ intent: 'success', message: Names.toPersianDigits(parts.length) + ' تصویر دانلود شدند.' });
  }

  const footer = (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        flexWrap: 'wrap',
        gap: 'var(--space-2)'
      }}
    >
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        {parts.length > 1 && (
          <B.Button variant="secondary" size="sm" onClick={handleDownloadAllParts}>
            {'دانلود هر ' + Names.toPersianDigits(parts.length) + ' تصویر'}
          </B.Button>
        )}
        <B.Button variant="ghost" size="sm" onClick={onClose}>
          بستن
        </B.Button>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <B.Button
          variant="primary"
          size="sm"
          iconStart="Share2"
          loading={isSharing}
          onClick={handleShareOrDownloadSingle}
        >
          {typeof navigator !== 'undefined' && 'share' in navigator
            ? 'ارسال یا دانلود تصویر'
            : 'دانلود تصویر'}
        </B.Button>
      </div>
    </div>
  );

  return (
    <B.Dialog
      open={open}
      onClose={onClose}
      title={
        'تصویر گزارش — ' +
        imagesData.reportData.groupName +
        ' (روز ' +
        Names.toPersianDigits(imagesData.reportData.dayN) +
        ')'
      }
      description="آمادهٔ فرستادن در تلگرام است. دانلودش کن یا مستقیم بفرست."
      footer={footer}
      size="lg"
    >
      <div style={{ display: 'grid', gap: 'var(--space-3)', padding: 'var(--space-2) 0' }}>
        {notice && (
          <B.Alert
            intent={notice.intent}
            onClose={function () {
              setNotice(null);
            }}
          >
            {notice.message}
          </B.Alert>
        )}
        {parts.length > 1 && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', paddingBottom: 4 }}>
            {parts.map(function (p, idx) {
              return (
                <B.Button
                  key={p.filename}
                  variant={idx === currentPartIdx ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={function () {
                    setCurrentPartIdx(idx);
                  }}
                >
                  {'بخش ' + Names.toPersianDigits(idx + 1) + ' از ' + Names.toPersianDigits(parts.length)}
                </B.Button>
              );
            })}
          </div>
        )}
        <div
          style={{
            background: 'var(--surface-overlay)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxHeight: '60vh',
            overflowY: 'auto',
            overflowX: 'auto'
          }}
        >
          <img
            src={activePart.dataUrl}
            alt={activePart.filename}
            style={{
              width: '100%',
              maxWidth: 720,
              height: 'auto',
              borderRadius: 'var(--radius-sm)',
              display: 'block'
            }}
          />
        </div>
        <div
          className="caption"
          style={{
            color: 'var(--text-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-2)'
          }}
        >
          <span>
            {'نام فایل: '}
            <bdi dir="ltr">{activePart.filename}</bdi>
          </span>
          <span>{'اندازه: ۲۱۶۰ × ' + Names.toPersianDigits(activePart.height) + ' پیکسل'}</span>
        </div>
      </div>
    </B.Dialog>
  );
}

export const ImageExport = {
  getGroupDayReportRows: getGroupDayReportRows,
  getGroupSummary: getGroupSummary,
  generateGroupDayReportImages: generateGroupDayReportImages,
  shareOrDownloadImage: shareOrDownloadImage,
  downloadBlob: downloadBlob
};

export { ImagePreviewModal };
