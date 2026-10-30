/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { B } from '../bushido';
import { Names } from '../names';
import { Excel } from '../excel';
import { errorMessage } from '../errors';
import type { Cohort, Group, Toast } from '../types';

/**
 * دیالوگ دانلود اکسل گروه برای یک روز
 */
interface ExcelExportModalProps {
  open: boolean;
  cohort: Cohort;
  group: Group;
  dayN: number;
  isDayClosed: boolean;
  onClose: () => void;
  toast?: Toast;
}

export function ExcelGroupDayExportModal(props: ExcelExportModalProps) {
  const open = props.open;
  const cohort = props.cohort;
  const group = props.group;
  const dayN = props.dayN;
  const isDayClosed = props.isDayClosed;
  const onClose = props.onClose;
  const toast = props.toast;

  const [includeFrozen, setIncludeFrozen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  function handleDownload() {
    setLoading(true);
    Excel.exportGroupDayReport(cohort, group, dayN, includeFrozen)
      .then(function () {
        setLoading(false);
        if (toast) toast.show({ intent: 'success', message: 'فایل اکسل با موفقیت دانلود شد.' });
        onClose();
      })
      .catch(function (err) {
        setLoading(false);
        if (toast) toast.show({ intent: 'danger', message: errorMessage(err) });
      });
  }

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
      <B.Button variant="ghost" onClick={onClose}>
        انصراف
      </B.Button>
      <B.Button variant="primary" loading={loading} onClick={handleDownload}>
        دانلود فایل اکسل
      </B.Button>
    </div>
  );

  return (
    <B.Dialog
      open={open}
      onClose={onClose}
      title={'دانلود اکسل گزارش روز ' + Names.toPersianDigits(dayN) + ' — ' + group.name}
      description="این فایل برای اشتراک‌گذاری در گروه تلگرام طراحی شده و هیچ اطلاعات خصوصی ندارد."
      footer={footer}
      size="sm"
    >
      <div style={{ display: 'grid', gap: 'var(--space-3)', padding: 'var(--space-2) 0' }}>
        {!isDayClosed && (
          <B.Alert intent="warning" title="روز هنوز بسته نشده است">
            این روز هنوز بسته نشده و گزارش با برچسب «پیش‌نویس» تولید خواهد شد. آیا ادامه می‌دهید؟
          </B.Alert>
        )}
        <B.Checkbox
          label="افراد فریز‌شده و خارج‌شده هم در گزارش بیایند"
          checked={includeFrozen}
          onChange={function (e) {
            setIncludeFrozen(e.target.checked);
          }}
        />
      </div>
    </B.Dialog>
  );
}
