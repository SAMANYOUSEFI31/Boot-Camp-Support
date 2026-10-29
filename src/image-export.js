/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

(function (root) {
  'use strict';

  var SupportApp = root.SupportApp || (root.SupportApp = {});
  var Names = SupportApp.Names || {};
  var Scoring = SupportApp.Scoring || {};
  var h = root.React ? root.React.createElement : null;
  var B = root.Bushido || {};

  /**
   * استخراج داده‌های جدول گزارش روز منطبق با اکسل
   * خروجی خالص جهت آزمون و رسم در بوم
   */
  function getGroupDayReportRows(cohort, group, dayN, includeFrozen) {
    if (!cohort || !group) return { title: '', dayShamsi: '', isClosed: false, rows: [] };

    var dayCfg = (cohort.days || []).find(function (d) { return d.n === dayN; }) || {
      n: dayN,
      type: dayN <= 7 ? 'warmup' : dayN >= 29 ? 'review' : 'main',
      hardLevels: 3,
      specialMission: true
    };

    var closedDays = group.closedDays || [];
    var isClosed = closedDays.indexOf(dayN) !== -1;
    var dayDate = Names.addDaysToIso(cohort.startDate, dayN - 1);
    var dayShamsi = Names.formatShamsiShort(dayDate);

    var members = (cohort.participants || []).filter(function (p) {
      if (p.groupId !== group.id) return false;
      if (!includeFrozen && (p.status === 'frozen' || p.status === 'left')) return false;
      return true;
    });

    var rows = members.map(function (p, idx) {
      var rec = (cohort.records && cohort.records[p.id] && cohort.records[p.id][dayN]) || null;
      var totals = Scoring.personTotals(p, cohort, group, dayN);
      var hasRecord = rec && (rec.done != null || rec.hard != null || rec.special != null);

      // عادت‌ها
      var habitsText = '—';
      if (p.habitCount != null) {
        if (rec && rec.done != null) {
          habitsText = Names.toPersianDigits(rec.done) + ' از ' + Names.toPersianDigits(p.habitCount);
        } else {
          habitsText = '— از ' + Names.toPersianDigits(p.habitCount);
        }
      }

      // کار سخت
      var hardText = 'ندارد';
      if (dayCfg.hardLevels > 0) {
        if (rec && rec.hard != null) {
          var hVal = parseInt(rec.hard, 10);
          hardText = hVal > 0 ? ('سطح ' + Names.toPersianDigits(hVal)) : 'انجام نداد';
        } else {
          hardText = 'ثبت‌نشده';
        }
      }

      // مأموریت ویژه
      var specialText = 'ندارد';
      if (dayCfg.specialMission) {
        if (rec && rec.special != null) {
          specialText = rec.special > 0 ? '✓' : '✗';
        } else {
          specialText = 'ثبت‌نشده';
        }
      }

      // امتیاز امروز
      var dayScore = null;
      var dayMax = null;
      var dayScoreText = 'ثبت‌نشده';
      if (hasRecord) {
        dayScore = Scoring.dayScore(p, rec, dayCfg);
        dayMax = Scoring.dayMax(p, dayCfg, rec);
        dayScoreText = Names.toPersianDigits(dayScore) + ' از ' + Names.toPersianDigits(dayMax);
      }

      var totalText = Names.toPersianDigits(totals.totalScore) + ' از ' + Names.toPersianDigits(totals.totalMax);
      var percentText = Names.toPersianDigits(totals.percent) + '٪';

      var displayName = p.name;
      if (p.status === 'frozen') displayName += ' (فریز)';
      else if (p.status === 'left') displayName += ' (خارج)';

      return {
        rowNum: idx + 1,
        participantId: p.id,
        name: displayName,
        rawName: p.name,
        status: p.status,
        habitsText: habitsText,
        hasRecord: !!hasRecord,
        hardText: hardText,
        specialText: specialText,
        dayScore: dayScore,
        dayMax: dayMax,
        dayScoreText: dayScoreText,
        totalScore: totals.totalScore,
        totalMax: totals.totalMax,
        totalText: totalText,
        percent: totals.percent,
        percentText: percentText
      };
    });

    return {
      cohortName: cohort.name || '',
      groupName: group.name || '',
      dayN: dayN,
      dayShamsi: dayShamsi,
      isClosed: isClosed,
      dayCfg: dayCfg,
      rows: rows
    };
  }

  /**
   * مقادیر پیش‌فرض توکن‌ها؛ فقط وقتی tokens.css بارگذاری نشده (مثلاً خارج از مرورگر) استفاده می‌شود.
   */
  var TOKEN_FALLBACK = {
    '--surface-page': '#09090b', '--surface-raised': '#18181b',
    '--text-default': '#f4f4f5', '--text-subtle': '#a1a1aa',
    '--text-success': '#6ee7b7', '--text-warning': '#fcd34d',
    '--icon-success': '#34d399',
    '--border-subtle': 'rgba(255,255,255,0.08)', '--border-default': 'rgba(255,255,255,0.12)',
    '--bg-neutral-subtle': 'rgba(255,255,255,0.08)',
    '--font-sans': "'Vazirmatn', Tahoma, sans-serif"
  };

  /**
   * خواندن توکن‌های دیزاین سیستم از CSS (رنگ، اندازه، فونت) برای رسم روی بوم
   */
  function getTokens() {
    var computed = typeof window !== 'undefined' && window.getComputedStyle ? window.getComputedStyle(document.documentElement) : null;
    function raw(name) {
      var v = computed ? computed.getPropertyValue(name) : '';
      return v && v.trim() ? v.trim() : '';
    }
    function color(name) { return raw(name) || TOKEN_FALLBACK[name]; }
    function px(name, fallbackPx) {
      var n = parseFloat(raw(name));
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
      s1: px('--space-1', 4), s2: px('--space-2', 8), s3: px('--space-3', 12), s4: px('--space-4', 16),
      s6: px('--space-6', 24), s8: px('--space-8', 32), s12: px('--space-12', 48),
      s16: px('--space-16', 64), s20: px('--space-20', 80), s24: px('--space-24', 96),
      rContainer: px('--radius-container', 16), rFull: px('--radius-full', 9999),
      logoMin: px('--logo-min', 32),
      f14: px('--font-size-14', 14), f20: px('--font-size-20', 20), f24: px('--font-size-24', 24),
      f30: px('--font-size-30', 30), f36: px('--font-size-36', 36),
      lhSnug: px('--line-height-snug', 1.4),
      wRegular: px('--font-weight-regular', 400), wSemibold: px('--font-weight-semibold', 600), wBold: px('--font-weight-bold', 700)
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
    ]).then(function () {
      return true;
    }).catch(function (e) {
      console.warn('Font loading check:', e);
      return true; // ادامه با قلم‌های سیستم در صورت شکست
    });
  }

  /**
   * نسبت ابعاد یک SVG از روی viewBox یا width/height (بدون کشیدن لوگو)
   */
  function svgRatio(dataUri, img) {
    try {
      var comma = dataUri.indexOf(',');
      var head = dataUri.slice(0, comma);
      var body = dataUri.slice(comma + 1);
      var svg = /;base64/.test(head) ? atob(body) : decodeURIComponent(body);
      var vb = svg.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/);
      if (vb && parseFloat(vb[2]) > 0) return parseFloat(vb[1]) / parseFloat(vb[2]);
      var w = svg.match(/<svg[^>]*\swidth\s*=\s*["']([\d.]+)/);
      var hh = svg.match(/<svg[^>]*\sheight\s*=\s*["']([\d.]+)/);
      if (w && hh && parseFloat(hh[1]) > 0) return parseFloat(w[1]) / parseFloat(hh[1]);
    } catch (e) {}
    return img && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
  }

  var brandImageCache = {};

  /**
   * بارگذاری لوگوها از SupportApp.Brand (data URI، تا بوم آلوده نشود). اگر نبود، بدون لوگو ادامه می‌دهیم.
   */
  function loadBrandImages() {
    var Brand = SupportApp.Brand || {};
    function load(key) {
      var src = Brand[key];
      if (!src || typeof Image === 'undefined') return Promise.resolve(null);
      if (brandImageCache[src]) return Promise.resolve(brandImageCache[src]);
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          brandImageCache[src] = { img: img, ratio: svgRatio(src, img) };
          resolve(brandImageCache[src]);
        };
        img.onerror = function () { resolve(null); };
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
  function chunkArray(items, size) {
    var chunks = [];
    for (var i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks.length ? chunks : [[]];
  }

  /**
   * خلاصهٔ گروه برای ردیف بالای تصویر (بدون رتبه‌بندی)
   */
  function getGroupSummary(rows) {
    var active = rows.filter(function (r) { return r.status !== 'frozen' && r.status !== 'left'; });
    var registered = active.filter(function (r) { return r.dayScore != null; });
    var perfect = registered.filter(function (r) { return r.dayMax > 0 && r.dayScore === r.dayMax; });
    var avg = active.length
      ? Math.round(active.reduce(function (sum, r) { return sum + (r.percent || 0); }, 0) / active.length)
      : 0;
    return { activeCount: active.length, registeredCount: registered.length, avgPercent: avg, perfectCount: perfect.length };
  }

  function roundRectPath(ctx, x, y, w, hgt, r) {
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
  function fitFont(ctx, T, text, maxWidth, size, minSize, weight) {
    var sz = size;
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
  function wrapNameText(ctx, T, text, maxWidth, size, minSize) {
    var sz = fitFont(ctx, T, text, maxWidth, size, minSize, T.wSemibold);
    if (ctx.measureText(text).width <= maxWidth) return { lines: [text], fontSize: sz };
    var words = text.split(/\s+/);
    if (words.length <= 1) return { lines: [text], fontSize: sz };
    var mid = Math.ceil(words.length / 2);
    return { lines: [words.slice(0, mid).join(' '), words.slice(mid).join(' ')], fontSize: minSize };
  }

  function isDash(text) {
    return text === 'ثبت‌نشده' || text === 'ندارد';
  }

  /**
   * رسم یک بخش از گزارش روی Canvas و تولید Blob و DataURL
   * فقط توکن‌های دیزاین سیستم برای رنگ و اندازه (به‌جز عرض ۱۰۸۰ و مقیاس ۲ که استاندارد خروجی‌اند)
   */
  function renderSingleCanvasPart(reportData, partRows, partIndex, totalParts, brand) {
    var T = getTokens();
    brand = brand || {};
    var scale = 2;
    var width = 1080;
    var dayCfg = reportData.dayCfg || {};
    var showHard = dayCfg.hardLevels > 0;
    var showSpecial = !!dayCfg.specialMission;

    var padX = T.s8;
    var tableX = T.s4;
    var tableW = width - 2 * tableX;
    var rowHeight = T.s20;
    var headRowH = T.s16;

    // ارتفاع بلوک عنوان: سه سطر
    var l1 = Math.round(T.f36 * T.lhSnug);
    var l2 = Math.round(T.f24 * T.lhSnug);
    var l3 = Math.round(T.f20 * T.lhSnug);
    var titleBlockH = l1 + l2 + l3;
    var lockupH = T.s12;
    var headerH = T.s8 + Math.max(titleBlockH, lockupH) + T.s6;
    var summaryH = T.s24;
    var footerH = T.s20;
    var rowsCount = Math.max(1, partRows.length);
    var tableH = headRowH + rowsCount * rowHeight;
    var height = headerH + T.s6 + summaryH + T.s6 + tableH + T.s4 + footerH;

    var canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    var ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.direction = 'rtl';
    ctx.textBaseline = 'middle';

    function setFont(weight, size) { ctx.font = weight + ' ' + size + 'px ' + T.font; }
    function drawLogo(entry, x, y, hgt) {
      if (!entry) return 0;
      var w = hgt * entry.ratio;
      ctx.drawImage(entry.img, x, y, w, hgt);
      return w;
    }

    ctx.fillStyle = T.page;
    ctx.fillRect(0, 0, width, height);

    // ۱. هدر: متن در سمت شروع (راست)، لوگو در سمت پایان (چپ)
    var blockTop = T.s8;
    var blockH = Math.max(titleBlockH, lockupH);
    var textTop = blockTop + (blockH - titleBlockH) / 2;
    var lockupW = brand.lockup ? lockupH * brand.lockup.ratio : 0;
    var textMaxW = width - 2 * padX - (lockupW ? lockupW + T.s6 : 0);

    ctx.textAlign = 'right';
    var partSuffix = totalParts > 1 ? ' · بخش ' + Names.toPersianDigits(partIndex + 1) + ' از ' + Names.toPersianDigits(totalParts) : '';
    var groupTitle = reportData.groupName;
    fitFont(ctx, T, groupTitle, textMaxW, T.f36, T.f24, T.wBold);
    ctx.fillStyle = T.text;
    ctx.fillText(groupTitle, width - padX, textTop + l1 / 2);

    var sub = (reportData.cohortName ? reportData.cohortName + ' · ' : '') +
      'روز ' + Names.toPersianDigits(reportData.dayN) + ' · ' + reportData.dayShamsi + partSuffix;
    fitFont(ctx, T, sub, textMaxW, T.f24, T.f20, T.wRegular);
    ctx.fillStyle = T.subtle;
    ctx.fillText(sub, width - padX, textTop + l1 + l2 / 2);

    var statusLabel = reportData.isClosed ? '● نهایی (روز بسته شده)' : '○ پیش‌نویس (روز هنوز بسته نشده)';
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
    var sum = getGroupSummary(reportData.rows);
    var gap = T.s3;
    var cardW = (width - 2 * tableX - 2 * gap) / 3;
    var cardY = headerH + T.s6;
    var cards = [
      { value: Names.toPersianDigits(sum.registeredCount) + ' از ' + Names.toPersianDigits(sum.activeCount), label: 'ثبت‌شده امروز' },
      { value: Names.toPersianDigits(sum.avgPercent) + '٪', label: 'میانگین درصد گروه' },
      { value: Names.toPersianDigits(sum.perfectCount) + ' نفر', label: 'همهٔ امتیاز امروز را گرفتند' }
    ];
    cards.forEach(function (card, i) {
      var cx = width - tableX - (i + 1) * cardW - i * gap;
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
    var cols = [{ id: 'rowNum', title: 'ردیف', width: T.s12 + T.s1 + T.s1 }];
    cols.push({ id: 'name', title: 'نام و نام خانوادگی', width: 0 });
    cols.push({ id: 'habits', title: 'عادت‌ها', width: 110 });
    if (showHard) cols.push({ id: 'hard', title: 'کار سخت', width: 120 });
    if (showSpecial) cols.push({ id: 'special', title: 'مأموریت', width: 100 });
    cols.push({ id: 'dayScore', title: 'امتیاز امروز', width: 150 });
    cols.push({ id: 'totalScore', title: 'مجموع', width: 140 });
    cols.push({ id: 'percent', title: 'درصد', width: 130 });
    var fixedW = cols.reduce(function (sum2, c) { return sum2 + c.width; }, 0);
    cols.forEach(function (c) { if (c.id === 'name') c.width = tableW - fixedW; });

    var tableTop = cardY + summaryH + T.s6;
    ctx.save();
    roundRectPath(ctx, tableX, tableTop, tableW, tableH, T.rContainer);
    ctx.clip();

    ctx.fillStyle = T.tint;
    ctx.fillRect(tableX, tableTop, tableW, headRowH);
    var x = width - tableX;
    cols.forEach(function (col) {
      setFont(T.wSemibold, T.f20);
      ctx.fillStyle = T.subtle;
      ctx.textAlign = col.id === 'name' ? 'right' : 'center';
      var hx = col.id === 'name' ? x - T.s4 : x - col.width / 2;
      ctx.fillText(col.title, hx, tableTop + headRowH / 2);
      x -= col.width;
    });

    partRows.forEach(function (row, rIdx) {
      var rowY = tableTop + headRowH + rIdx * rowHeight;
      var midY = rowY + rowHeight / 2;
      if (rIdx % 2 === 1) {
        ctx.fillStyle = T.raised;
        ctx.fillRect(tableX, rowY, tableW, rowHeight);
      }
      var unregistered = row.dayScore == null;

      var cx = width - tableX;
      cols.forEach(function (col) {
        var center = cx - col.width / 2;
        ctx.textAlign = 'center';
        if (col.id === 'rowNum') {
          setFont(T.wRegular, T.f24);
          ctx.fillStyle = T.subtle;
          ctx.fillText(Names.toPersianDigits(row.rowNum), center, midY);
        } else if (col.id === 'name') {
          var wrapped = wrapNameText(ctx, T, row.name, col.width - 2 * T.s4, T.f30, T.f24);
          setFont(T.wSemibold, wrapped.fontSize);
          ctx.fillStyle = row.status === 'frozen' || row.status === 'left' ? T.subtle : T.text;
          ctx.textAlign = 'right';
          var tx = cx - T.s4;
          var lineGap = Math.round(wrapped.fontSize * T.lhSnug / 2);
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
            var tagText = 'ثبت نشده';
            var tagW = ctx.measureText(tagText).width + 2 * T.s2;
            var tagH = T.f14 + T.s2;
            var tagY = midY + T.s3 + T.s1;
            roundRectPath(ctx, tx - tagW, tagY - tagH / 2, tagW, tagH, T.rFull);
            ctx.fillStyle = T.tint;
            ctx.fill();
            ctx.fillStyle = T.subtle;
            ctx.textAlign = 'center';
            ctx.fillText(tagText, tx - tagW / 2, tagY);
          }
        } else if (col.id === 'percent') {
          var innerW = col.width - 2 * T.s3;
          var pct = Math.max(0, Math.min(100, row.percent || 0));
          setFont(T.wSemibold, T.f24);
          ctx.fillStyle = T.text;
          ctx.fillText(row.percentText, center, midY - T.s2);
          var barY = midY + T.s4 - T.s1;
          var barX = cx - T.s3 - innerW;
          roundRectPath(ctx, barX, barY, innerW, T.s2, T.rFull);
          ctx.fillStyle = T.track;
          ctx.fill();
          if (pct > 0) {
            var fillW = Math.max(T.s2, innerW * pct / 100);
            roundRectPath(ctx, cx - T.s3 - fillW, barY, fillW, T.s2, T.rFull);
            ctx.fillStyle = T.bar;
            ctx.fill();
          }
        } else {
          var text;
          var weight = T.wRegular;
          var color = T.text;
          if (col.id === 'habits') {
            text = row.habitsText;
          } else if (col.id === 'hard') {
            text = isDash(row.hardText) ? '—' : row.hardText;
            if (row.hardText === 'انجام نداد') color = T.subtle;
          } else if (col.id === 'special') {
            text = isDash(row.specialText) ? '—' : row.specialText;
            color = row.specialText === '✓' ? T.success : T.subtle;
            weight = T.wSemibold;
          } else if (col.id === 'dayScore') {
            text = unregistered ? '—' : row.dayScoreText;
            weight = T.wBold;
            if (!unregistered && row.dayMax > 0 && row.dayScore === row.dayMax) color = T.success;
          } else {
            text = row.totalText;
          }
          if (text === '—') color = T.subtle;
          fitFont(ctx, T, text, col.width - T.s3, T.f30, T.f24, weight);
          ctx.fillStyle = color;
          ctx.fillText(text, center, midY);
        }
        cx -= col.width;
      });
    });
    ctx.restore();
    roundRectPath(ctx, tableX, tableTop, tableW, tableH, T.rContainer);
    ctx.strokeStyle = T.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    // ۴. فوتر: نشان کوچک و نام بوت‌کمپ
    var footerTop = tableTop + tableH + T.s4;
    var footerMid = footerTop + footerH / 2;
    var footText = 'بوت‌کمپ بوشیدو';
    setFont(T.wRegular, T.f20);
    var textW = ctx.measureText(footText).width;
    var markH = T.logoMin;
    var markW = brand.mark ? markH * brand.mark.ratio : 0;
    var groupW = textW + (markW ? markW + T.s3 : 0);
    var startX = (width + groupW) / 2; // لبهٔ راست مجموعه
    ctx.textAlign = 'right';
    ctx.fillStyle = T.subtle;
    ctx.fillText(footText, startX, footerMid);
    if (brand.mark) {
      drawLogo(brand.mark, startX - textW - T.s3 - markW, footerMid - markH / 2, markH);
    }

    return new Promise(function (resolve, reject) {
      try {
        var dataUrl = canvas.toDataURL('image/png');
        if (canvas.toBlob) {
          canvas.toBlob(function (blob) {
            if (blob) {
              resolve({ blob: blob, dataUrl: dataUrl, width: width * scale, height: height * scale });
            } else {
              reject(new Error('خطا در تبدیل بوم به تصویر PNG'));
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
  function generateGroupDayReportImages(cohort, group, dayN, includeFrozen) {
    return Promise.all([ensureFontsLoaded(), loadBrandImages()]).then(function (loaded) {
      var brand = loaded[1];
      var reportData = getGroupDayReportRows(cohort, group, dayN, includeFrozen);
      var rows = reportData.rows;

      if (!rows.length) {
        throw new Error('عضوی در این گروه برای تولید تصویر گزارش وجود ندارد.');
      }

      var chunks = chunkArray(rows, 15);
      var totalParts = chunks.length;

      var promises = chunks.map(function (chunkRows, idx) {
        return renderSingleCanvasPart(reportData, chunkRows, idx, totalParts, brand).then(function (res) {
          var baseFilename = Names.sanitizeFilename(group.name + '_روز-' + dayN);
          var filename = totalParts > 1 ? (baseFilename + '_بخش-' + (idx + 1) + '.png') : (baseFilename + '.png');
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
  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
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
  function shareOrDownloadImage(blob, filename) {
    if (!blob) {
      return Promise.reject(new Error('داده تصویر در دسترس نیست.'));
    }

    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && typeof File !== 'undefined') {
      try {
        var file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          return navigator.share({
            files: [file],
            title: filename,
            text: 'گزارش روزانه بوت‌کمپ بوشیدو'
          }).catch(function (err) {
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
  function ImagePreviewModal(props) {
    var open = props.open;
    var onClose = props.onClose;
    var imagesData = props.imagesData; // { reportData, parts, totalParts }
    var toast = props.toast;

    var [currentPartIdx, setCurrentPartIdx] = root.React.useState(0);
    var [isSharing, setIsSharing] = root.React.useState(false);
    var [notice, setNotice] = root.React.useState(null); // اعلان داخل دیالوگ (نه toast پایین صفحه)

    if (!open || !imagesData || !imagesData.parts || !imagesData.parts.length) return null;

    var parts = imagesData.parts;
    var activePart = parts[currentPartIdx] || parts[0];

    function handleShareOrDownloadSingle() {
      setIsSharing(true);
      shareOrDownloadImage(activePart.blob, activePart.filename)
        .then(function () {
          setIsSharing(false);
          setNotice({ intent: 'success', message: 'تصویر آماده شد.' });
        })
        .catch(function (err) {
          setIsSharing(false);
          setNotice({ intent: 'danger', message: err.message });
        });
    }

    function handleDownloadAllParts() {
      parts.forEach(function (p, idx) {
        setTimeout(function () {
          downloadBlob(p.blob, p.filename);
        }, idx * 400);
      });
      setNotice({ intent: 'success', message: Names.toPersianDigits(parts.length) + ' تصویر دانلود شدند.' });
    }

    var footer = h('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        flexWrap: 'wrap',
        gap: 'var(--space-2)'
      }
    },
      h('div', { style: { display: 'flex', gap: 'var(--space-2)', alignItems: 'center' } },
        parts.length > 1 && h(B.Button, {
          variant: 'secondary',
          size: 'sm',
          iconStart: 'Download',
          onClick: handleDownloadAllParts
        }, 'دانلود همه‌ی ' + Names.toPersianDigits(parts.length) + ' بخش'),
        h(B.Button, {
          variant: 'ghost',
          size: 'sm',
          onClick: onClose
        }, 'بستن')
      ),
      h('div', { style: { display: 'flex', gap: 'var(--space-2)' } },
        h(B.Button, {
          variant: 'primary',
          size: 'sm',
          iconStart: 'Share2',
          loading: isSharing,
          onClick: handleShareOrDownloadSingle
        }, typeof navigator !== 'undefined' && navigator.share ? 'اشتراک‌گذاری در تلگرام / دانلود' : 'دانلود تصویر این بخش')
      )
    );

    return h(B.Dialog, {
      open: open,
      onClose: onClose,
      title: 'پیش‌نمایش تصویر گزارش — ' + imagesData.reportData.groupName + ' (روز ' + Names.toPersianDigits(imagesData.reportData.dayN) + ')',
      description: 'تصویر با استاندارد تلگرام (عرض ۱۰۸۰ پیکسل و کیفیت ۲x) ساخته شده و بدون افت کیفیت قابل ارسال است.',
      footer: footer,
      size: 'lg'
    },
      h('div', { style: { display: 'grid', gap: 'var(--space-3)', padding: 'var(--space-2) 0' } },
        notice && h(B.Alert, { intent: notice.intent, onClose: function () { setNotice(null); } }, notice.message),
        // تب‌های بخش‌ها در صورت چندبخشی بودن
        parts.length > 1 && h('div', { style: { display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', paddingBottom: 4 } },
          parts.map(function (p, idx) {
            return h(B.Button, {
              key: p.filename,
              variant: idx === currentPartIdx ? 'primary' : 'ghost',
              size: 'sm',
              onClick: function () { setCurrentPartIdx(idx); }
            }, 'بخش ' + Names.toPersianDigits(idx + 1) + ' از ' + Names.toPersianDigits(parts.length));
          })
        ),

        // پیش‌نمایش تصویر در محفظه اسکرول‌پذیر
        h('div', {
          style: {
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
          }
        },
          h('img', {
            src: activePart.dataUrl,
            alt: activePart.filename,
            style: {
              width: '100%',
              maxWidth: 720,
              height: 'auto',
              borderRadius: 'var(--radius-sm)',
              display: 'block'
            }
          })
        ),

        h('div', {
          className: 'caption',
          style: {
            color: 'var(--text-muted)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-2)'
          }
        },
          h('span', null, 'نام فایل: ', h('bdi', { dir: 'ltr' }, activePart.filename)),
          h('span', null, 'ابعاد: ۲۱۶۰ × ' + activePart.height + ' پیکسل (شارپ ۲x)')
        )
      )
    );
  }

  SupportApp.ImageExport = {
    getGroupDayReportRows: getGroupDayReportRows,
    getGroupSummary: getGroupSummary,
    generateGroupDayReportImages: generateGroupDayReportImages,
    shareOrDownloadImage: shareOrDownloadImage,
    downloadBlob: downloadBlob,
    ImagePreviewModal: ImagePreviewModal
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupportApp.ImageExport;
  }
})(typeof window !== 'undefined' ? window : globalThis);
