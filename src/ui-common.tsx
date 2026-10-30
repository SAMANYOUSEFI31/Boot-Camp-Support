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
  if (!isoDate) return 'هرگز';
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
function saveJsonFile(filename: string, data: unknown) {
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
const downloadJson = saveJsonFile;

function makeJsonFile(filename: string, data: unknown): File {
  return new File([JSON.stringify(data, null, 2)], filename, { type: 'application/json' });
}

/** آیا مرورگر می‌تواند فایل را با «ارسال» (Web Share) به تلگرام و برنامه‌های دیگر بدهد؟ */
function canShareFiles(filename: string): boolean {
  try {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [makeJsonFile(filename, {})] })
    );
  } catch (e) {
    return false;
  }
}

/**
 * ارسال فایل JSON با فهرست ارسال سیستم (تلگرام ← Saved Messages و ...).
 * خروجی true یعنی ارسال شد؛ false یعنی کاربر فهرست را بست (خطا نیست).
 */
function shareJsonFile(filename: string, data: unknown): Promise<boolean> {
  return navigator
    .share({ files: [makeJsonFile(filename, data)], title: filename })
    .then(function () {
      return true;
    })
    .catch(function (err) {
      if (err && err.name === 'AbortError') return false;
      throw err;
    });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
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
  onOpenBackup: () => void;
}

function Header(props: HeaderProps) {
  const state = props.state;
  const activeCohort = props.activeCohort;
  const onOpenCohortModal = props.onOpenCohortModal;
  const onOpenImportWizard = props.onOpenImportWizard;
  const onOpenRestoreModal = props.onOpenRestoreModal;
  const onOpenBackup = props.onOpenBackup;

  const cohorts = state.cohorts || [];

  const cohortOptions = cohorts.map(function (c) {
    return {
      value: c.id,
      label: c.name + (c.archived ? ' (آرشیو)' : '')
    };
  });

  const backupOverdue = Store.isBackupOverdue();

  // بکاپ دکمهٔ جدا دارد؛ منو فقط کارهای کم‌تکرار را نگه می‌دارد
  const menuItems: MenuProps['items'] = [
    {
      label: 'ورود افراد از Excel یا CSV',
      icon: 'Inbox',
      onSelect: onOpenImportWizard
    },
    {
      label: 'ساخت دوره جدید',
      icon: 'Plus',
      onSelect: function () {
        onOpenCohortModal('new');
      }
    },
    {
      label: 'بازگردانی بکاپ',
      icon: 'ExternalLink',
      onSelect: onOpenRestoreModal
    },
    { divider: true },
    {
      label: 'آزمون‌های محاسبه (فنی)',
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
            <span className="heading-xs bsh-header__title">پشتیبان بوشیدو</span>
          </div>
        </div>
        <div className="bsh-header__cohortwrap">
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
              آرشیو
            </B.Badge>
          )}
        </div>
        <div
          className="bsh-header__actions"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
        >
          <B.Button
            variant="secondary"
            size="sm"
            iconStart={backupOverdue ? 'TriangleAlert' : 'Share2'}
            onClick={onOpenBackup}
            aria-label={backupOverdue ? 'بکاپ (وقتش رسیده)' : 'بکاپ'}
          >
            بکاپ
          </B.Button>
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
function BackupReminderBanner(props: { onOpenBackup: () => void }) {
  const [snoozed, setSnoozed] = useState(isBannerSnoozed());
  if (snoozed || !Store.isBackupOverdue()) return null;

  return (
    <div className="bsh-banner-wrap bsh-banner">
      <B.Alert
        intent="warning"
        title="وقت بکاپ گرفتن است"
        onClose={function () {
          try {
            sessionStorage.setItem(BANNER_SNOOZE_KEY, '1');
          } catch (e) {}
          setSnoozed(true);
        }}
        action={
          <B.Button size="sm" variant="secondary" onClick={props.onOpenBackup}>
            بکاپ بگیر
          </B.Button>
        }
      >
        اطلاعات فقط در همین مرورگر ذخیره می‌شود.
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
        title="برنامه در چند تب باز است"
        action={
          <B.Button
            size="sm"
            variant="secondary"
            onClick={function () {
              Store.clearMultiTabWarning();
              window.location.reload();
            }}
          >
            صفحه را تازه کن
          </B.Button>
        }
      >
        در تب دیگری هم باز است یا داده‌ها تغییر کرده. برای این‌که اطلاعات روی هم نوشته نشود، فقط یک تب را باز
        نگه دار و این صفحه را تازه کن.
      </B.Alert>
    </div>
  );
}

export {
  formatRelativeBackupTime,
  saveJsonFile,
  shareJsonFile,
  canShareFiles,
  downloadBeforeRestoreBackup,
  Header,
  BackupReminderBanner,
  MultiTabWarningBanner
};
