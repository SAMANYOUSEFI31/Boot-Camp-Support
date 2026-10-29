/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

(function (root) {
  'use strict';

  var SupportApp = root.SupportApp || (root.SupportApp = {});

  /**
   * لوگوی بوشیدو به‌صورت data URI (نسخهٔ سفید).
   * چرا data URI؟ وقتی index.html مستقیم از روی دیسک باز می‌شود، تصویر جدا بوم را «آلوده» می‌کند
   * و ذخیرهٔ PNG خطا می‌دهد. فایل‌های اصلی در brand/ می‌مانند.
   *
   * مقدار خالی یعنی لوگو هنوز اضافه نشده؛ برنامه و تصویر خروجی بدون آن درست کار می‌کنند.
   */
  SupportApp.Brand = {
    markWhite: '',
    lockupWhite: ''
  };

  /**
   * favicon از روی نشان: نشان سفید روی زمینهٔ surface-page (تا در تب روشن مرورگر هم دیده شود)
   */
  function applyFavicon() {
    var mark = SupportApp.Brand.markWhite;
    if (!mark || typeof document === 'undefined') return;
    var bg = getComputedStyle(document.documentElement).getPropertyValue('--surface-page').trim();
    if (!bg) return;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<rect width="64" height="64" rx="12" fill="' + bg + '"/>' +
      '<image href="' + mark + '" x="12" y="12" width="40" height="40" preserveAspectRatio="xMidYMid meet"/></svg>';
    var link = document.querySelector('link[rel="icon"]') || document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
    if (!link.parentNode) document.head.appendChild(link);
  }

  applyFavicon();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupportApp.Brand;
  }
})(typeof window !== 'undefined' ? window : globalThis);
