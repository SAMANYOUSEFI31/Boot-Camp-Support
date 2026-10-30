/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { B } from './bushido';
import { Names } from './names';
import { Store } from './store';
import { Brand } from './brand';
import type { AppState, Cohort } from './types';
import type { MenuProps } from '../ds/components';

/**
 * محاسبه زمان گذشته به زبان ساده فارسی
 * مثلاً: «۳ روز پیش»، «امروز»، «دیروز»، «هرگز»
 */
function formatRelativeBackupTime(isoDate: string | null | undefined): string {
  if (!isoDate) return 'هرگز بکاپ گرفته نشده';
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  let diffMs = now - then;
  if (diffMs < 0) diffMs = 0;

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

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
function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * بکاپ همهٔ دوره‌ها
 */
function downloadAllBackup() {
  const data = Store.buildBackupData(Store.getState());
  downloadJson('support-backup-' + Names.sanitizeFilename('همه-دوره‌ها') + '-' + todayStr() + '.json', data);
  Store.recordBackupTime();
}

/**
 * بکاپ فقط یک دوره
 */
function downloadCohortBackup(cohort: Cohort | null) {
  if (!cohort) return;
  const data = Store.buildBackupData(Store.getState(), cohort.id);
  downloadJson(
    'support-backup-دوره-' + Names.sanitizeFilename(cohort.name) + '-' + todayStr() + '.json',
    data
  );
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
interface HeaderProps {
  state: AppState;
  activeCohort: Cohort | null;
  onOpenCohortModal: (mode?: 'new' | 'edit') => void;
  onOpenImportWizard: () => void;
  onOpenRestoreModal: () => void;
}

function Header(props: HeaderProps) {
  const state = props.state;
  const activeCohort = props.activeCohort;
  const onOpenCohortModal = props.onOpenCohortModal;
  const onOpenImportWizard = props.onOpenImportWizard;
  const onOpenRestoreModal = props.onOpenRestoreModal;

  const cohorts = state.cohorts || [];

  const cohortOptions = cohorts.map(function (c) {
    return {
      value: c.id,
      label: c.name + (c.archived ? ' (آرشیو)' : '')
    };
  });

  const backupStatusText = 'آخرین بکاپ: ' + formatRelativeBackupTime(state.lastBackupAt);

  const menuItems: MenuProps['items'] = [
    {
      label: backupStatusText,
      disabled: true
    },
    { divider: true },
    {
      label: 'ورود از اکسل / CSV',
      icon: 'Inbox',
      onSelect: onOpenImportWizard
    },
    {
      label: 'دانلود بکاپ این دوره',
      icon: 'Copy',
      disabled: !activeCohort,
      onSelect: function () {
        downloadCohortBackup(activeCohort);
      }
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
      onSelect: function () {
        onOpenCohortModal('new');
      }
    },
    {
      label: 'مشاهده آزمون‌های موتور محاسبات',
      icon: 'CircleCheck',
      onSelect: function () {
        window.open('tests.html', '_blank');
      }
    }
  ];

  return (
    <header
      className="bsh-header"
      style={{
        background: 'var(--surface-raised)',
        borderBottom: 'var(--border-width-thin) solid var(--border-subtle)',
        padding: 'var(--space-3) var(--space-4)',
        position: 'sticky',
        top: 0
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-3)',
          flexWrap: 'wrap'
        }}
      >
        <div
          className="bsh-header__brand"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {Brand && Brand.markWhite ? (
              <img
                src={Brand.markWhite}
                alt="لوگوی بوشیدو"
                style={{
                  height: 'var(--logo-min)',
                  width: 'auto',
                  display: 'block',
                  marginInlineEnd: 'var(--space-1)'
                }}
              />
            ) : (
              <B.Icon name="Flame" size="lg" className="text-brand" />
            )}
            <span className="heading-xs">پشتیبان بوشیدو</span>
          </div>
          {cohorts.length > 0 && (
            <div className="bsh-header__cohort">
              <B.Select
                size="sm"
                options={cohortOptions}
                value={activeCohort ? activeCohort.id : ''}
                onChange={function (e) {
                  Store.setActiveCohortId(e.target.value);
                }}
              />
            </div>
          )}
          {activeCohort && activeCohort.archived && (
            <B.Badge intent="warning" emphasis="subtle">
              فقط‌خواندنی (آرشیو)
            </B.Badge>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span
            className="caption bsh-backup-status"
            style={{ color: 'var(--text-subtle)', whiteSpace: 'nowrap' }}
          >
            {backupStatusText}
          </span>
          <B.Menu
            trigger={
              <B.Button variant="secondary" size="sm" iconStart="Settings">
                ابزارها
              </B.Button>
            }
            align="end"
            items={menuItems}
          />
        </div>
      </div>
    </header>
  );
}

const BANNER_SNOOZE_KEY = 'bsh_backup_banner_snoozed';

function isBannerSnoozed() {
  try {
    return sessionStorage.getItem(BANNER_SNOOZE_KEY) === '1';
  } catch (e) {
    return false;
  }
}

/**
 * بنر هشدار نیاز به بکاپ (قابل بستن تا بعد؛ در موبایل جمع‌وجور)
 */
function BackupReminderBanner() {
  const [snoozed, setSnoozed] = useState(isBannerSnoozed());
  if (snoozed || !Store.isBackupOverdue()) return null;

  return (
    <div className="bsh-banner-wrap bsh-banner">
      <B.Alert
        intent="warning"
        title="یادآوری تهیه پشتیبان"
        onClose={function () {
          try {
            sessionStorage.setItem(BANNER_SNOOZE_KEY, '1');
          } catch (e) {}
          setSnoozed(true);
        }}
        action={
          <B.Button size="sm" variant="secondary" onClick={downloadAllBackup}>
            دانلود بکاپ همهٔ دوره‌ها
          </B.Button>
        }
      >
        اگر حافظه یا تاریخچه مرورگر پاک شود، اطلاعات از بین می‌رود. لطفاً فایل پشتیبان دریافت کنید.
      </B.Alert>
    </div>
  );
}

/**
 * هشدار باز بودن تب‌های همزمان
 */
function MultiTabWarningBanner() {
  const hasConflict = Store.getMultiTabWarning();
  if (!hasConflict) return null;

  return (
    <div className="bsh-banner-wrap">
      <B.Alert
        intent="danger"
        title="هشدار باز بودن همزمان چند تب"
        action={
          <B.Button
            size="sm"
            variant="secondary"
            onClick={function () {
              Store.clearMultiTabWarning();
              window.location.reload();
            }}
          >
            تازه‌سازی صفحه
          </B.Button>
        }
      >
        این برنامه در تب دیگری باز است یا داده‌ها تغییر کرده‌اند. برای جلوگیری از بازنویسی تصادفی اطلاعات، این
        صفحه را تازه‌سازی کنید.
      </B.Alert>
    </div>
  );
}

export {
  formatRelativeBackupTime,
  downloadBeforeRestoreBackup,
  Header,
  BackupReminderBanner,
  MultiTabWarningBanner
};
