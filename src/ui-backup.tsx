/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { B } from './bushido';
import { Names } from './names';
import { Store } from './store';
import { HelpHint } from './help-hint';
import { formatRelativeBackupTime, saveJsonFile, shareJsonFile, canShareFiles } from './ui-common';
import type { Cohort, Toast } from './types';

type Scope = 'all' | 'one';

/**
 * دیالوگ بکاپ: یک جا برای «ارسال به تلگرام (Saved Messages) یا برنامهٔ دیگر» و «دانلود فایل».
 * ارسال با Web Share انجام می‌شود؛ برنامه نمی‌تواند خودش Saved Messages را انتخاب کند، کاربر آن را در فهرست می‌زند.
 */
export function BackupDialog(props: {
  open: boolean;
  onClose: () => void;
  activeCohort: Cohort | null;
  lastBackupAt: string | null;
  onOpenRestore: () => void;
  toast?: Toast;
}) {
  const { open, onClose, activeCohort, lastBackupAt, onOpenRestore, toast } = props;
  const cohortCount = (Store.getState().cohorts || []).length;
  const [scope, setScope] = useState<Scope>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setScope('all');
      setBusy(false);
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const one = scope === 'one' && activeCohort ? activeCohort : null;
  const data = Store.buildBackupData(Store.getState(), one ? one.id : null);
  const today = new Date().toISOString().slice(0, 10);
  const filename = one
    ? 'support-backup-دوره-' + Names.sanitizeFilename(one.name) + '-' + today + '.json'
    : 'support-backup-' + Names.sanitizeFilename('همه-دوره‌ها') + '-' + today + '.json';
  const canShare = canShareFiles(filename);

  const done = (message: string) => {
    Store.recordBackupTime();
    if (toast) toast.show({ intent: 'success', message: message });
    onClose();
  };

  const handleShare = () => {
    setBusy(true);
    setError('');
    shareJsonFile(filename, data)
      .then((shared) => {
        setBusy(false);
        if (shared) done('بکاپ ارسال شد. اگر Saved Messages را انتخاب کردی، در تلگرام ذخیره است.');
      })
      .catch(() => {
        setBusy(false);
        setError('ارسال نشد. «دانلود فایل» را بزن و فایل را خودت در تلگرام بفرست.');
      });
  };

  const handleDownload = () => {
    saveJsonFile(filename, data);
    done('بکاپ دانلود شد. فایل را جای امنی نگه دار.');
  };

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
      <B.Button variant="ghost" onClick={onClose}>
        بستن
      </B.Button>
      <B.Button variant={canShare ? 'secondary' : 'primary'} iconStart="Copy" onClick={handleDownload}>
        دانلود فایل
      </B.Button>
      {canShare && (
        <B.Button variant="primary" iconStart="Share2" loading={busy} onClick={handleShare}>
          ارسال به تلگرام
        </B.Button>
      )}
    </div>
  );

  return (
    <B.Dialog
      open={open}
      onClose={onClose}
      title="بکاپ"
      description={'آخرین بکاپ: ' + formatRelativeBackupTime(lastBackupAt)}
      footer={footer}
      size="sm"
    >
      <div style={{ display: 'grid', gap: 'var(--space-4)', padding: 'var(--space-2) 0' }}>
        {error && <B.Alert intent="danger">{error}</B.Alert>}
        {cohortCount > 1 && activeCohort && (
          <B.RadioGroup
            legend="چه چیزی؟"
            name="backup-scope"
            orientation="vertical"
            value={scope}
            onChange={(v) => setScope(v as Scope)}
            options={[
              { value: 'all', label: 'همهٔ دوره‌ها (پیشنهادی)' },
              { value: 'one', label: 'فقط دورهٔ «' + activeCohort.name + '»' }
            ]}
          />
        )}
        {canShare ? (
          <B.Alert intent="info" title="ذخیره در تلگرام">
            «ارسال به تلگرام» را بزن، در فهرست Telegram و بعد «Saved Messages» را انتخاب کن. برنامه نمی‌تواند
            Saved Messages را خودش انتخاب کند.
          </B.Alert>
        ) : (
          <B.Alert intent="info" title="ارسال مستقیم در این مرورگر نیست">
            فایل را دانلود کن و در تلگرام به Saved Messages بفرست. گوشی موبایل معمولاً «ارسال» را هم دارد.
          </B.Alert>
        )}
        <div className="bsh-help-row">
          <HelpHint help="backupWhy" visibleLabel />
          <B.Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onClose();
              onOpenRestore();
            }}
          >
            بازگردانی بکاپ
          </B.Button>
        </div>
      </div>
    </B.Dialog>
  );
}
