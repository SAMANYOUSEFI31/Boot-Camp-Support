/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

(function (root) {
  'use strict';

  var SupportApp = root.SupportApp || (root.SupportApp = {});
  var h = root.React.createElement;
  var B = root.Bushido;
  var Names = SupportApp.Names || {};
  var Store = SupportApp.Store || {};

  /**
   * محاسبه زمان گذشته به زبان ساده فارسی
   * مثلاً: «۳ روز پیش»، «امروز»، «دیروز»، «هرگز»
   */
  function formatRelativeBackupTime(isoDate) {
    if (!isoDate) return 'هرگز بکاپ گرفته نشده';
    var then = new Date(isoDate).getTime();
    var now = Date.now();
    var diffMs = now - then;
    if (diffMs < 0) diffMs = 0;

    var diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    var diffDays = Math.floor(diffHours / 24);

    if (diffDays === 0) {
      if (diffHours === 0) return 'همین امروز';
      return Names.toPersianDigits(diffHours) + ' ساعت پیش';
    } else if (diffDays === 1) {
      return 'دیروز';
    } else {
      return Names.toPersianDigits(diffDays) + ' روز پیش';
    }
  }

  /**
   * دانلود یک آبجکت به صورت فایل JSON
   */
  function downloadJson(filename, data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * بکاپ همهٔ دوره‌ها
   */
  function downloadAllBackup() {
    var data = Store.buildBackupData(Store.getState());
    downloadJson('support-backup-' + Names.sanitizeFilename('همه-دوره‌ها') + '-' + todayStr() + '.json', data);
    Store.recordBackupTime();
  }

  /**
   * بکاپ فقط یک دوره
   */
  function downloadCohortBackup(cohort) {
    if (!cohort) return;
    var data = Store.buildBackupData(Store.getState(), cohort.id);
    downloadJson('support-backup-دوره-' + Names.sanitizeFilename(cohort.name) + '-' + todayStr() + '.json', data);
    Store.recordBackupTime();
  }

  /**
   * نسخهٔ احتیاطی از وضعیت فعلی، پیش از جایگزینی کامل (زمان آخرین بکاپ را عوض نمی‌کند)
   */
  function downloadBeforeRestoreBackup() {
    downloadJson('support-before-restore-' + todayStr() + '.json', Store.buildBackupData(Store.getState()));
  }

  /**
   * نوار بالای صفحه (Header)
   * انتخابگر دوره، وضعیت آخرین بکاپ، منوی ابزار
   */
  function Header(props) {
    var state = props.state;
    var activeCohort = props.activeCohort;
    var onOpenCohortModal = props.onOpenCohortModal;
    var onOpenImportWizard = props.onOpenImportWizard;
    var onOpenBackupModal = props.onOpenBackupModal;
    var onOpenRestoreModal = props.onOpenRestoreModal;

    var cohorts = state.cohorts || [];

    var cohortOptions = cohorts.map(function (c) {
      return {
        value: c.id,
        label: c.name + (c.archived ? ' (آرشیو)' : '')
      };
    });

    var menuItems = [
      {
        label: 'ورود از اکسل / CSV',
        icon: 'Inbox',
        onSelect: onOpenImportWizard
      },
      {
        label: 'دانلود بکاپ این دوره',
        icon: 'Copy',
        disabled: !activeCohort,
        onSelect: function () { downloadCohortBackup(activeCohort); }
      },
      {
        label: 'دانلود بکاپ همهٔ دوره‌ها',
        icon: 'Copy',
        onSelect: downloadAllBackup
      },
      {
        label: 'بازگردانی از فایل بکاپ',
        icon: 'ExternalLink',
        onSelect: onOpenRestoreModal
      },
      { divider: true },
      {
        label: 'ساخت دوره جدید',
        icon: 'Plus',
        onSelect: function () { onOpenCohortModal('new'); }
      },
      {
        label: 'مشاهده آزمون‌های موتور محاسبات',
        icon: 'CircleCheck',
        onSelect: function () { window.open('tests.html', '_blank'); }
      }
    ];

    var backupStatusText = 'آخرین بکاپ: ' + formatRelativeBackupTime(state.lastBackupAt);

    return h('header', {
      className: 'bsh-header',
      style: {
        background: 'var(--surface-raised)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: 'var(--space-3) var(--space-4)',
        position: 'sticky',
        top: 0,
        zIndex: 20
      }
    },
      h('div', {
        style: {
          maxWidth: 1280,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-3)',
          flexWrap: 'wrap'
        }
      },
        // بخش راست: برند و انتخاب دوره
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)' } },
            (SupportApp.Brand && SupportApp.Brand.markWhite)
              ? h('img', {
                src: SupportApp.Brand.markWhite,
                alt: 'لوگوی بوشیدو',
                style: { height: 'var(--logo-min)', width: 'auto', display: 'block', marginInlineEnd: 'var(--space-1)' }
              })
              : h(B.Icon, { name: 'Flame', size: 'lg', className: 'text-brand' }),
            h('span', { className: 'heading-xs' }, 'پشتیبان بوشیدو')
          ),
          cohorts.length > 0 && h('div', { style: { minWidth: 160 } },
            h(B.Select, {
              size: 'sm',
              options: cohortOptions,
              value: activeCohort ? activeCohort.id : '',
              onChange: function (e) {
                Store.setActiveCohortId(e.target.value);
              }
            })
          ),
          activeCohort && activeCohort.archived && h(B.Badge, { intent: 'warning', emphasis: 'subtle' }, 'فقط‌خواندنی (آرشیو)')
        ),

        // بخش چپ: وضعیت بکاپ و منوی ابزار
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-3)' } },
          h('span', {
            className: 'caption',
            style: { color: 'var(--text-muted)', whiteSpace: 'nowrap' }
          }, backupStatusText),
          h(B.Menu, {
            trigger: h(B.Button, {
              variant: 'secondary',
              size: 'sm',
              iconStart: 'Settings'
            }, 'ابزارها'),
            items: menuItems
          })
        )
      )
    );
  }

  /**
   * بنر هشدار نیاز به بکاپ
   */
  function BackupReminderBanner(props) {
    var overdue = Store.isBackupOverdue();
    if (!overdue) return null;

    return h('div', { style: { maxWidth: 1024, margin: 'var(--space-3) auto 0 auto', padding: '0 var(--space-4)' } },
      h(B.Alert, {
        intent: 'warning',
        title: 'یادآوری تهیه پشتیبان',
        action: h(B.Button, {
          size: 'sm',
          variant: 'primary',
          onClick: downloadAllBackup
        }, 'دانلود بکاپ همهٔ دوره‌ها')
      }, 'اگر حافظه یا تاریخچه مرورگر پاک شود، اطلاعات از بین می‌رود. لطفاً فایل پشتیبان دریافت کنید.')
    );
  }

  /**
   * هشدار باز بودن تب‌های همزمان
   */
  function MultiTabWarningBanner() {
    var hasConflict = Store.getMultiTabWarning();
    if (!hasConflict) return null;

    return h('div', { style: { maxWidth: 1024, margin: 'var(--space-3) auto 0 auto', padding: '0 var(--space-4)' } },
      h(B.Alert, {
        intent: 'danger',
        title: 'هشدار باز بودن همزمان چند تب',
        action: h(B.Button, {
          size: 'sm',
          variant: 'secondary',
          onClick: function () {
            Store.clearMultiTabWarning();
            window.location.reload();
          }
        }, 'تازه‌سازی صفحه')
      }, 'این برنامه در تب دیگری باز است یا داده‌ها تغییر کرده‌اند. برای جلوگیری از بازنویسی تصادفی اطلاعات، این صفحه را تازه‌سازی کنید.')
    );
  }

  SupportApp.UICommon = {
    formatRelativeBackupTime: formatRelativeBackupTime,
    downloadBeforeRestoreBackup: downloadBeforeRestoreBackup,
    Header: Header,
    BackupReminderBanner: BackupReminderBanner,
    MultiTabWarningBanner: MultiTabWarningBanner
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupportApp.UICommon;
  }
})(typeof window !== 'undefined' ? window : globalThis);
