/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * تبدیل ارقام فارسی و عربی به ارقام لاتین
 */
function toLatinDigits(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[۰-۹]/g, function (d) {
      return String(d.charCodeAt(0) - 1776);
    })
    .replace(/[٠-٩]/g, function (d) {
      return String(d.charCodeAt(0) - 1632);
    });
}

/**
 * تبدیل ارقام لاتین به ارقام فارسی
 */
function toPersianDigits(val: unknown): string {
  if (val === null || val === undefined) return '';
  const faDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(val).replace(/[0-9]/g, function (d) {
    return faDigits[+d];
  });
}

/**
 * نرمال‌سازی دقیق نام برای ساخت nameKey:
 * NFC، حذف نیم‌فاصله، حذف کشیده، حذف اعراب، ي->ی، ك->ک، تبدیل ارقام به لاتین، حذف فاصله‌های متوالی، trim.
 */
function normalizeName(name: unknown): string {
  if (!name || typeof name !== 'string') return '';
  let s = name.normalize('NFC');
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
function isFreezeCell(text: unknown): boolean {
  if (!text || typeof text !== 'string') return false;
  const norm = normalizeName(text);
  return norm.indexOf('فریز') !== -1;
}

/**
 * فرمت تاریخ شمسی با Intl
 */
function formatShamsi(
  dateOrIso: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateOrIso) return '—';
  try {
    const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
    if (isNaN(d.getTime())) return '—';
    const defaultOpts = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Tehran'
    };
    const opts = Object.assign({}, defaultOpts, options || {});
    const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', opts);
    return toPersianDigits(formatter.format(d));
  } catch (e) {
    return String(dateOrIso);
  }
}

/**
 * فرمت تاریخ کوتاه شمسی (مانند: ۱۲ آبان)
 */
function formatShamsiShort(dateOrIso: string | Date | null | undefined): string {
  return formatShamsi(dateOrIso, { month: 'short', day: 'numeric', year: undefined });
}

/**
 * ساخت تاریخ YYYY-MM-DD با اضافه کردن n روز به startDate میلادی
 */
function addDaysToIso(startDateIso: string | null | undefined, daysToAdd: number): string {
  if (!startDateIso) return '';
  const parts = startDateIso.split('-');
  const d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
  d.setUTCDate(d.getUTCDate() + daysToAdd);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

/**
 * تمیز کردن نام فایل از نویسه‌های ممنوع
 */
function sanitizeFilename(filename: unknown): string {
  return String(filename || 'file')
    .replace(/[\/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * نام طبیعی دوره از نام فایل: بدون پسوند، با فاصله به‌جای _ و -
 * مثلاً «دوره-آبان_۱۴۰۵.xlsx» ← «دوره آبان ۱۴۰۵»
 */
function cohortNameFromFileName(fileName: unknown): string {
  return String(fileName || '')
    .replace(/\.(xlsx|xls|csv|json|numbers)$/i, '')
    .replace(/^support-backup-/i, '')
    .replace(/-\d{4}-\d{2}-\d{2}$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const Names = {
  cohortNameFromFileName: cohortNameFromFileName,
  toLatinDigits: toLatinDigits,
  toPersianDigits: toPersianDigits,
  normalizeName: normalizeName,
  isFreezeCell: isFreezeCell,
  formatShamsi: formatShamsi,
  formatShamsiShort: formatShamsiShort,
  addDaysToIso: addDaysToIso,
  sanitizeFilename: sanitizeFilename
};
