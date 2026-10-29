/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */


/**
 * تبدیل ارقام فارسی و عربی به ارقام لاتین
 */
function toLatinDigits(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[۰-۹]/g, function (d) {
      return d.charCodeAt(0) - 1776;
    })
    .replace(/[٠-٩]/g, function (d) {
      return d.charCodeAt(0) - 1632;
    });
}

/**
 * تبدیل ارقام لاتین به ارقام فارسی
 */
function toPersianDigits(val) {
  if (val === null || val === undefined) return '';
  var faDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(val).replace(/[0-9]/g, function (d) {
    return faDigits[+d];
  });
}

/**
 * نرمال‌سازی دقیق نام برای ساخت nameKey:
 * NFC، حذف نیم‌فاصله، حذف کشیده، حذف اعراب، ي->ی، ك->ک، تبدیل ارقام به لاتین، حذف فاصله‌های متوالی، trim.
 */
function normalizeName(name) {
  if (!name || typeof name !== 'string') return '';
  var s = name.normalize('NFC');
  // تبدیل ارقام فارسی/عربی به لاتین
  s = toLatinDigits(s);
  // تبدیل ي و ك عربی
  s = s.replace(/ي/g, 'ی').replace(/ك/g, 'ک');
  // حذف نیم‌فاصله (U+200C) و کشیده (U+0640)
  s = s.replace(/\u200C/g, '').replace(/\u0640/g, '');
  // حذف اعراب (U+064B تا U+065F و U+0670)
  s = s.replace(/[\u064B-\u065F\u0670]/g, '');
  // حذف نویسه‌های کنترلی متفرقه و علائم نگارشی نامربوط
  s = s.replace(/[ـ\s]+/g, ' ');
  return s.trim().toLowerCase();
}

/**
 * بررسی اینکه آیا سلول یا متنی شامل عبارت «فریز» است
 */
function isFreezeCell(text) {
  if (!text || typeof text !== 'string') return false;
  var norm = normalizeName(text);
  return norm.indexOf('فریز') !== -1;
}

/**
 * فرمت تاریخ شمسی با Intl
 */
function formatShamsi(dateOrIso, options) {
  if (!dateOrIso) return '—';
  try {
    var d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
    if (isNaN(d.getTime())) return '—';
    var defaultOpts = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Tehran'
    };
    var opts = Object.assign({}, defaultOpts, options || {});
    var formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', opts);
    return toPersianDigits(formatter.format(d));
  } catch (e) {
    return String(dateOrIso);
  }
}

/**
 * فرمت تاریخ کوتاه شمسی (مانند: ۱۲ آبان)
 */
function formatShamsiShort(dateOrIso) {
  return formatShamsi(dateOrIso, { month: 'short', day: 'numeric', year: undefined });
}

/**
 * ساخت تاریخ YYYY-MM-DD با اضافه کردن n روز به startDate میلادی
 */
function addDaysToIso(startDateIso, daysToAdd) {
  if (!startDateIso) return '';
  var parts = startDateIso.split('-');
  var d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
  d.setUTCDate(d.getUTCDate() + daysToAdd);
  var y = d.getUTCFullYear();
  var m = String(d.getUTCMonth() + 1).padStart(2, '0');
  var day = String(d.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

/**
 * تمیز کردن نام فایل از نویسه‌های ممنوع
 */
function sanitizeFilename(filename) {
  return String(filename || 'file')
    .replace(/[\/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export const Names = {
  toLatinDigits: toLatinDigits,
  toPersianDigits: toPersianDigits,
  normalizeName: normalizeName,
  isFreezeCell: isFreezeCell,
  formatShamsi: formatShamsi,
  formatShamsiShort: formatShamsiShort,
  addDaysToIso: addDaysToIso,
  sanitizeFilename: sanitizeFilename
};
