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
   * خواندن رنگ‌های تمیز از متغیرهای CSS توکن‌ها با فال‌بک تم تیره
   */
  function getThemeColors() {
    var computed = typeof window !== 'undefined' && window.getComputedStyle ? window.getComputedStyle(document.documentElement) : null;
    function getVal(varName, fallback) {
      if (!computed) return fallback;
      var val = computed.getPropertyValue(varName);
      if (!val || !val.trim()) return fallback;
      return val.trim();
    }

    return {
      bgPage: getVal('--surface-page', '#09090b'),
      bgRaised: getVal('--surface-raised', '#18181b'),
      bgOverlay: getVal('--surface-overlay', '#27272a'),
      bgRowAlt: '#121215',
      bgRowHeader: '#1e1e24',
      textBase: getVal('--text-base', '#fafafa'),
      textMuted: getVal('--text-muted', '#a1a1aa'),
      border: getVal('--border-subtle', '#27272a'),
      borderStrong: getVal('--border-default', '#3f3f46'),
      brand: getVal('--brand-500', '#e11d48'),
      brandSubtle: '#4c0519',
      success: getVal('--emerald-400', '#34d399'),
      warning: getVal('--amber-400', '#fbbf24')
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
      document.fonts.load('400 28px Vazirmatn'),
      document.fonts.load('700 28px Vazirmatn'),
      document.fonts.load('700 36px Vazirmatn')
    ]).then(function () {
      return true;
    }).catch(function (e) {
      console.warn('Font loading check:', e);
      return true; // ادامه با قلم‌های سیستم در صورت شکست
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
   * شکستن هوشمندانه متن طولانی نام بدون خط سه‌نقطه (...)
   */
  function wrapNameText(ctx, text, maxWidth, initialFontSize) {
    ctx.font = '600 ' + initialFontSize + 'px Vazirmatn, Tahoma, sans-serif';
    var textWidth = ctx.measureText(text).width;
    if (textWidth <= maxWidth) {
      return { lines: [text], fontSize: initialFontSize };
    }

    // کاهش اندازه قلم تا ۲۲ پیکسل
    for (var sz = initialFontSize - 2; sz >= 22; sz -= 2) {
      ctx.font = '600 ' + sz + 'px Vazirmatn, Tahoma, sans-serif';
      if (ctx.measureText(text).width <= maxWidth) {
        return { lines: [text], fontSize: sz };
      }
    }

    // در صورت طولانی بودن زیاد، تقسیم به دو سطر
    var words = text.split(/\s+/);
    if (words.length <= 1) {
      return { lines: [text], fontSize: 22 };
    }

    var mid = Math.ceil(words.length / 2);
    var line1 = words.slice(0, mid).join(' ');
    var line2 = words.slice(mid).join(' ');
    return { lines: [line1, line2], fontSize: 22 };
  }

  /**
   * رسم یک بخش از گزارش روی Canvas و تولید Blob و DataURL
   */
  function renderSingleCanvasPart(reportData, partRows, partIndex, totalParts) {
    var colors = getThemeColors();
    var scale = 2; // ضریب مقیاس ۲ برای خروجی بسیار شارپ و باکیفیت
    var width = 1080;
    var rowHeight = 72;
    var headerRowHeight = 76;
    var topBannerHeight = 160;
    var footerHeight = 56;

    var rowsCount = Math.max(1, partRows.length);
    var height = topBannerHeight + headerRowHeight + (rowsCount * rowHeight) + footerHeight;

    var canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;

    var ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // پیش‌زمینه کل بوم
    ctx.fillStyle = colors.bgPage;
    ctx.fillRect(0, 0, width, height);

    // ۱. هدر بوم
    ctx.fillStyle = colors.bgRaised;
    ctx.fillRect(0, 0, width, topBannerHeight);

    // خط نشانگر برند بوشیدو در بالای بوم
    ctx.fillStyle = colors.brand;
    ctx.fillRect(0, 0, width, 6);

    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // عنوان اصلی
    var titleSuffix = totalParts > 1 ? ' — بخش ' + Names.toPersianDigits(partIndex + 1) + ' از ' + Names.toPersianDigits(totalParts) : '';
    var titleText = 'بوت‌کمپ بوشیدو — ' + reportData.cohortName + ' — ' + reportData.groupName + titleSuffix;
    ctx.font = '700 34px Vazirmatn, Tahoma, sans-serif';
    ctx.fillStyle = colors.textBase;
    ctx.fillText(titleText, width / 2, 45);

    // زیرعنوان روز و تاریخ شمسی و وضعیت
    var subtitleText = 'گزارش روز ' + Names.toPersianDigits(reportData.dayN) + ' (' + reportData.dayShamsi + ')';
    ctx.font = '600 24px Vazirmatn, Tahoma, sans-serif';
    ctx.fillStyle = colors.textMuted;
    ctx.fillText(subtitleText, width / 2, 85);

    // نشان وضعیت (بسته شده / پیش‌نویس)
    var statusLabel = reportData.isClosed ? '● وضعیت: نهایی (روز بسته شده)' : '○ وضعیت: پیش‌نویس (روز هنوز بسته نشده)';
    ctx.font = '500 20px Vazirmatn, Tahoma, sans-serif';
    ctx.fillStyle = reportData.isClosed ? colors.success : colors.warning;
    ctx.fillText(statusLabel, width / 2, 120);

    // خط جداکننده زیر هدر
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, topBannerHeight);
    ctx.lineTo(width, topBannerHeight);
    ctx.stroke();

    // ستون‌های جدول
    // عرض کل: 1080
    // ردیف: 70 | نام: 260 | عادت‌ها: 140 | کار سخت: 130 | مأموریت: 120 | امتیاز امروز: 150 | مجموع: 130 | درصد: 80
    var columns = [
      { id: 'rowNum', title: 'ردیف', width: 70, align: 'center' },
      { id: 'name', title: 'نام و نام خانوادگی', width: 260, align: 'right' },
      { id: 'habits', title: 'عادت‌ها', width: 140, align: 'center' },
      { id: 'hard', title: 'کار سخت', width: 130, align: 'center' },
      { id: 'special', title: 'مأموریت', width: 120, align: 'center' },
      { id: 'dayScore', title: 'امتیاز امروز', width: 150, align: 'center' },
      { id: 'totalScore', title: 'مجموع', width: 130, align: 'center' },
      { id: 'percent', title: 'درصد', width: 80, align: 'center' }
    ];

    // ۲. سرستون‌های جدول
    var tableTop = topBannerHeight;
    ctx.fillStyle = colors.bgRowHeader;
    ctx.fillRect(0, tableTop, width, headerRowHeight);

    var currentX = width; // شروع از راست به چپ در RTL
    ctx.strokeStyle = colors.borderStrong;
    ctx.lineWidth = 1;

    columns.forEach(function (col) {
      var nextX = currentX - col.width;

      // خط عمودی چپ ستون
      ctx.beginPath();
      ctx.moveTo(nextX, tableTop);
      ctx.lineTo(nextX, tableTop + headerRowHeight);
      ctx.stroke();

      // متن سرستون
      ctx.font = '700 24px Vazirmatn, Tahoma, sans-serif';
      ctx.fillStyle = colors.textBase;
      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var textCenterX = currentX - (col.width / 2);
      ctx.fillText(col.title, textCenterX, tableTop + (headerRowHeight / 2));

      currentX = nextX;
    });

    // خط زیر سرستون
    ctx.beginPath();
    ctx.moveTo(0, tableTop + headerRowHeight);
    ctx.lineTo(width, tableTop + headerRowHeight);
    ctx.stroke();

    // ۳. سطرهای داده
    var startY = tableTop + headerRowHeight;

    partRows.forEach(function (row, rIdx) {
      var rowY = startY + (rIdx * rowHeight);

      // رنگ متناوب پس‌زمینه سطر
      ctx.fillStyle = (rIdx % 2 === 0) ? colors.bgPage : colors.bgRaised;
      ctx.fillRect(0, rowY, width, rowHeight);

      // رسم ستون‌ها
      var colX = width;
      columns.forEach(function (col) {
        var nextColX = colX - col.width;

        // خط عمودی
        ctx.strokeStyle = colors.border;
        ctx.beginPath();
        ctx.moveTo(nextColX, rowY);
        ctx.lineTo(nextColX, rowY + rowHeight);
        ctx.stroke();

        ctx.direction = 'rtl';
        ctx.textBaseline = 'middle';

        if (col.id === 'rowNum') {
          ctx.font = '500 24px Vazirmatn, Tahoma, sans-serif';
          ctx.fillStyle = colors.textMuted;
          ctx.textAlign = 'center';
          ctx.fillText(Names.toPersianDigits(row.rowNum), colX - (col.width / 2), rowY + (rowHeight / 2));
        } else if (col.id === 'name') {
          var wrapped = wrapNameText(ctx, row.name, col.width - 32, 26);
          ctx.font = '600 ' + wrapped.fontSize + 'px Vazirmatn, Tahoma, sans-serif';
          ctx.fillStyle = row.status === 'frozen' ? colors.textMuted : colors.textBase;
          ctx.textAlign = 'right';

          var textRight = colX - 16;
          if (wrapped.lines.length === 1) {
            ctx.fillText(wrapped.lines[0], textRight, rowY + (rowHeight / 2));
          } else {
            ctx.fillText(wrapped.lines[0], textRight, rowY + (rowHeight / 2) - 14);
            ctx.fillText(wrapped.lines[1], textRight, rowY + (rowHeight / 2) + 14);
          }
        } else if (col.id === 'habits') {
          ctx.font = '500 24px Vazirmatn, Tahoma, sans-serif';
          ctx.fillStyle = colors.textBase;
          ctx.textAlign = 'center';
          ctx.fillText(row.habitsText, colX - (col.width / 2), rowY + (rowHeight / 2));
        } else if (col.id === 'hard') {
          ctx.font = '500 22px Vazirmatn, Tahoma, sans-serif';
          ctx.fillStyle = row.hardText === 'انجام نداد' ? colors.textMuted : colors.textBase;
          ctx.textAlign = 'center';
          ctx.fillText(row.hardText, colX - (col.width / 2), rowY + (rowHeight / 2));
        } else if (col.id === 'special') {
          ctx.font = '600 24px Vazirmatn, Tahoma, sans-serif';
          ctx.fillStyle = row.specialText === '✓' ? colors.success : row.specialText === '✗' ? colors.brand : colors.textMuted;
          ctx.textAlign = 'center';
          ctx.fillText(row.specialText, colX - (col.width / 2), rowY + (rowHeight / 2));
        } else if (col.id === 'dayScore') {
          ctx.font = '700 26px Vazirmatn, Tahoma, sans-serif';
          ctx.fillStyle = (row.dayScore != null && row.dayScore > 0) ? colors.success : colors.textMuted;
          ctx.textAlign = 'center';
          ctx.fillText(row.dayScoreText, colX - (col.width / 2), rowY + (rowHeight / 2));
        } else if (col.id === 'totalScore') {
          ctx.font = '600 24px Vazirmatn, Tahoma, sans-serif';
          ctx.fillStyle = colors.textBase;
          ctx.textAlign = 'center';
          ctx.fillText(row.totalText, colX - (col.width / 2), rowY + (rowHeight / 2));
        } else if (col.id === 'percent') {
          ctx.font = '700 24px Vazirmatn, Tahoma, sans-serif';
          ctx.fillStyle = colors.brand;
          ctx.textAlign = 'center';
          ctx.fillText(row.percentText, colX - (col.width / 2), rowY + (rowHeight / 2));
        }

        colX = nextColX;
      });

      // خط افقی زیر هر سطر
      ctx.strokeStyle = colors.border;
      ctx.beginPath();
      ctx.moveTo(0, rowY + rowHeight);
      ctx.lineTo(width, rowY + rowHeight);
      ctx.stroke();
    });

    // ۴. فوتر بوم
    var footerY = height - footerHeight;
    ctx.fillStyle = colors.bgRaised;
    ctx.fillRect(0, footerY, width, footerHeight);

    ctx.font = '500 18px Vazirmatn, Tahoma, sans-serif';
    ctx.fillStyle = colors.textMuted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('بوت‌کمپ عادت‌سازی بوشیدو — سامانه داخلی مدیریت و پشتیبانی گروه‌ها', width / 2, footerY + (footerHeight / 2));

    // کادر بیرونی کل جدول
    ctx.strokeStyle = colors.borderStrong;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);

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
    return ensureFontsLoaded().then(function () {
      var reportData = getGroupDayReportRows(cohort, group, dayN, includeFrozen);
      var rows = reportData.rows;

      if (!rows.length) {
        throw new Error('عضوی در این گروه برای تولید تصویر گزارش وجود ندارد.');
      }

      var chunks = chunkArray(rows, 15);
      var totalParts = chunks.length;

      var promises = chunks.map(function (chunkRows, idx) {
        return renderSingleCanvasPart(reportData, chunkRows, idx, totalParts).then(function (res) {
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

    if (!open || !imagesData || !imagesData.parts || !imagesData.parts.length) return null;

    var parts = imagesData.parts;
    var activePart = parts[currentPartIdx] || parts[0];

    function handleShareOrDownloadSingle() {
      setIsSharing(true);
      shareOrDownloadImage(activePart.blob, activePart.filename)
        .then(function () {
          setIsSharing(false);
          if (toast) toast.show({ intent: 'success', message: 'تصویر ' + activePart.filename + ' آماده شد.' });
        })
        .catch(function (err) {
          setIsSharing(false);
          if (toast) toast.show({ intent: 'danger', message: err.message });
        });
    }

    function handleDownloadAllParts() {
      parts.forEach(function (p, idx) {
        setTimeout(function () {
          downloadBlob(p.blob, p.filename);
        }, idx * 400);
      });
      if (toast) toast.show({ intent: 'success', message: Names.toPersianDigits(parts.length) + ' تصویر دانلود شدند.' });
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
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
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
          h('span', null, 'نام فایل: ' + activePart.filename),
          h('span', null, 'ابعاد: ۲۱۶۰ × ' + activePart.height + ' پیکسل (شارپ ۲x)')
        )
      )
    );
  }

  SupportApp.ImageExport = {
    getGroupDayReportRows: getGroupDayReportRows,
    generateGroupDayReportImages: generateGroupDayReportImages,
    shareOrDownloadImage: shareOrDownloadImage,
    downloadBlob: downloadBlob,
    ImagePreviewModal: ImagePreviewModal
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupportApp.ImageExport;
  }
})(typeof window !== 'undefined' ? window : globalThis);
