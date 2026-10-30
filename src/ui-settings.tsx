/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { B } from './bushido';
import { HelpHint } from './help-hint';
import { Names } from './names';
import { Store } from './store';
import type { Cohort, DayConfig, Toast } from './types';

/**
 * تب تنظیمات
 */
function SettingsTab(props: { cohort: Cohort; toast?: Toast }) {
  const cohort = props.cohort;
  const toast = props.toast;

  const [subTab, setSubTab] = useState('days'); // 'days' | 'danger'
  const [dangerModalOpen, setDangerModalOpen] = useState(false);
  const [dangerConfirmText, setDangerConfirmText] = useState('');

  // بازه روزها برای اعمال دسته‌جمعی
  const [rangeStart, setRangeStart] = useState('8');
  const [rangeEnd, setRangeEnd] = useState('28');
  const [rangeHard, setRangeHard] = useState('3');

  const days = cohort.days || [];

  function handleDayChange<K extends keyof DayConfig>(dayN: number, field: K, value: DayConfig[K]) {
    const updated = days.map(function (d) {
      if (d.n === dayN) {
        const copy = Object.assign({}, d);
        copy[field] = value;
        // گزارش هدف در همهٔ روزهای main فعال است
        if (field === 'type' && value === 'main') copy.specialMission = true;
        return copy;
      }
      return d;
    });
    Store.updateDaysConfig(cohort.id, updated);
    if (toast)
      toast.show({ intent: 'success', message: 'تنظیمات روز ' + Names.toPersianDigits(dayN) + ' ذخیره شد.' });
  }

  function handleCopyFromPrev(dayN: number) {
    if (dayN <= 1) return;
    const prev = days.find(function (d) {
      return d.n === dayN - 1;
    });
    if (!prev) return;
    const updated = days.map(function (d) {
      if (d.n === dayN) {
        return Object.assign({}, d, {
          type: prev.type,
          hardLevels: prev.hardLevels,
          specialMission: prev.specialMission
        });
      }
      return d;
    });
    Store.updateDaysConfig(cohort.id, updated);
    if (toast)
      toast.show({
        intent: 'success',
        message: 'روز ' + Names.toPersianDigits(dayN) + ' مثل روز قبلش شد.'
      });
  }

  function handleApplyToRange() {
    const start = parseInt(rangeStart, 10);
    const end = parseInt(rangeEnd, 10);
    const hard = parseInt(rangeHard, 10);
    if (isNaN(start) || isNaN(end) || start > end || start < 1 || end > 30) {
      if (toast)
        toast.show({
          intent: 'danger',
          message: 'بازه درست نیست. «از» و «تا» را بین ۱ و ۳۰ بنویس و «از» را کوچک‌تر یا مساوی «تا» بگذار.'
        });
      return;
    }

    const updated = days.map(function (d) {
      if (d.n >= start && d.n <= end) {
        return Object.assign({}, d, {
          hardLevels: hard,
          specialMission: d.type === 'main' ? true : d.specialMission
        });
      }
      return d;
    });
    Store.updateDaysConfig(cohort.id, updated);
    if (toast)
      toast.show({
        intent: 'success',
        message:
          'تنظیمات به روزهای ' +
          Names.toPersianDigits(start) +
          ' تا ' +
          Names.toPersianDigits(end) +
          ' اعمال شد.'
      });
  }

  function handleConfirmClearAll() {
    if (dangerConfirmText.trim() !== 'پاک کن') return;
    Store.clearAllData();
    setDangerModalOpen(false);
    setDangerConfirmText('');
    if (toast) toast.show({ intent: 'danger', message: 'همهٔ داده‌ها پاک شد.' });
    window.location.reload();
  }

  return (
    <div className="bsh-stack bsh-stack--lg">
      <div>
        <h2 className="heading-md">تنظیمات</h2>
        <p className="body-sm" style={{ color: 'var(--text-subtle)' }}>
          نوع و کار سخت هر روز دوره، آرشیو و پاک کردن داده‌ها.
        </p>
      </div>
      <B.Tabs
        items={[
          { id: 'days', label: 'روزهای دوره' },
          { id: 'danger', label: 'آرشیو و منطقهٔ خطر' }
        ]}
        value={subTab}
        onChange={function (id) {
          setSubTab(id);
        }}
      />
      {subTab === 'days' ? (
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <B.Card padding="md">
            <div className="title" style={{ marginBottom: 'var(--space-2)' }}>
              تنظیم سریع چند روز
            </div>
            <p className="caption" style={{ color: 'var(--text-subtle)', marginBlockEnd: 'var(--space-3)' }}>
              گزارش هدف هر روز ۲ امتیاز و اختیاری است.
            </p>
            <div className="bsh-help-row" style={{ marginBlockEnd: 'var(--space-3)' }}>
              <HelpHint help="dayTypes" visibleLabel />
              <HelpHint help="hardLevel" visibleLabel />
              <HelpHint help="scoring" visibleLabel />
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: 'var(--space-3)',
                alignItems: 'flex-end'
              }}
            >
              <B.TextField
                label="از روز"
                type="number"
                value={rangeStart}
                onChange={function (e) {
                  setRangeStart(e.target.value);
                }}
              />
              <B.TextField
                label="تا روز"
                type="number"
                value={rangeEnd}
                onChange={function (e) {
                  setRangeEnd(e.target.value);
                }}
              />
              <B.Select
                label="بیشترین سطح کار سخت"
                options={[
                  { value: '0', label: 'بدون کار سخت' },
                  { value: '1', label: 'تا سطح ۱' },
                  { value: '2', label: 'تا سطح ۲' },
                  { value: '3', label: 'تا سطح ۳' }
                ]}
                value={rangeHard}
                onChange={function (e) {
                  setRangeHard(e.target.value);
                }}
              />
              <div>
                <B.Button variant="secondary" onClick={handleApplyToRange}>
                  اعمال روی این روزها
                </B.Button>
              </div>
            </div>
          </B.Card>
          <div
            style={{
              overflowX: 'auto',
              border: 'var(--border-width-thin) solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <table
              className="bsh-table"
              style={{ borderCollapse: 'collapse', width: '100%', minWidth: 'var(--container-sm)' }}
            >
              <thead>
                <tr>
                  <th className="label-sm is-num" style={{ textAlign: 'center', width: 'var(--space-16)' }}>
                    روز
                  </th>
                  <th className="label-sm" style={{ minWidth: 'var(--space-32)' }}>
                    تاریخ شمسی
                  </th>
                  <th className="label-sm" style={{ minWidth: 'var(--space-32)' }}>
                    نوع روز
                  </th>
                  <th className="label-sm" style={{ minWidth: 'var(--space-32)' }}>
                    سطح کار سخت
                  </th>
                  <th className="label-sm" style={{ minWidth: 'var(--space-24)', textAlign: 'center' }}>
                    اقدام
                  </th>
                </tr>
              </thead>
              <tbody>
                {days.map(function (d) {
                  const dayDate = Names.addDaysToIso(cohort.startDate, d.n - 1);
                  const dayShamsi = Names.formatShamsi(dayDate);

                  return (
                    <tr key={d.n}>
                      <td className="body-sm is-num" style={{ textAlign: 'center', fontWeight: 600 }}>
                        {Names.toPersianDigits(d.n)}
                      </td>
                      <td className="body-sm">{dayShamsi}</td>
                      <td>
                        <B.Select
                          size="sm"
                          options={[
                            { value: 'warmup', label: 'گرم‌کردن' },
                            { value: 'main', label: 'اصلی' },
                            { value: 'review', label: 'مرور' }
                          ]}
                          value={d.type}
                          onChange={function (e) {
                            handleDayChange(d.n, 'type', e.target.value);
                          }}
                        />
                      </td>
                      <td>
                        <B.Select
                          size="sm"
                          disabled={d.type !== 'main'}
                          options={[
                            { value: '0', label: 'بدون کار سخت' },
                            { value: '1', label: 'تا سطح ۱' },
                            { value: '2', label: 'تا سطح ۲' },
                            { value: '3', label: 'تا سطح ۳' }
                          ]}
                          value={String(d.hardLevels != null ? d.hardLevels : 3)}
                          onChange={function (e) {
                            handleDayChange(d.n, 'hardLevels', parseInt(e.target.value, 10));
                          }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {d.n > 1 && (
                          <B.Button
                            variant="ghost"
                            size="sm"
                            onClick={function () {
                              handleCopyFromPrev(d.n);
                            }}
                          >
                            مثل روز قبل کن
                          </B.Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // منطقه‌ی خطر
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <B.Card padding="lg">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-3)'
              }}
            >
              <div>
                <div className="title">
                  آرشیو کردن این دوره <HelpHint help="archive" />
                </div>
                <p className="body-sm" style={{ color: 'var(--text-subtle)' }}>
                  دورهٔ آرشیو در فهرست دوره‌ها برچسب «آرشیو» می‌گیرد. ثبت و گزارش‌ها همچنان کار می‌کنند.
                </p>
              </div>
              <B.Switch
                label={cohort.archived ? 'دوره آرشیو شده است' : 'آرشیو نیست'}
                checked={!!cohort.archived}
                onChange={function (e) {
                  Store.archiveCohort(cohort.id, e.target.checked);
                  if (toast)
                    toast.show({
                      intent: 'info',
                      message: e.target.checked ? 'دوره آرشیو شد.' : 'دوره از آرشیو خارج شد.'
                    });
                }}
              />
            </div>
          </B.Card>
          <B.Card padding="lg">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-3)'
              }}
            >
              <div>
                <div className="title">بررسی محاسبات</div>
                <p className="body-sm" style={{ color: 'var(--text-subtle)' }}>
                  آزمون‌های محاسبهٔ امتیاز را در همین مرورگر اجرا می‌کند. فقط برای بررسی فنی است.
                </p>
              </div>
              <B.Button
                variant="secondary"
                iconStart="ExternalLink"
                onClick={function () {
                  window.open('tests.html', '_blank');
                }}
              >
                اجرای آزمون‌ها
              </B.Button>
            </div>
          </B.Card>
          <B.Card
            padding="lg"
            style={{
              border: 'var(--border-width-thin) solid var(--border-danger-subtle)',
              background: 'var(--surface-overlay)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-2)'
              }}
            >
              <B.Icon name="OctagonAlert" size="lg" className="text-danger" />
              <h3 className="heading-sm" style={{ color: 'var(--text-danger)' }}>
                پاک کردن همهٔ داده‌ها
              </h3>
              <HelpHint help="danger" />
            </div>
            <p className="body-sm" style={{ color: 'var(--text-subtle)', marginBottom: 'var(--space-4)' }}>
              همهٔ دوره‌ها، گروه‌ها، افراد و امتیازهای این مرورگر پاک می‌شود و برگشت ندارد. اول بکاپ بگیر.
            </p>
            <B.Button
              variant="danger-bold"
              iconStart="Trash2"
              onClick={function () {
                setDangerConfirmText('');
                setDangerModalOpen(true);
              }}
            >
              پاک کردن همهٔ داده‌ها
            </B.Button>
          </B.Card>
        </div>
      )}
      {dangerModalOpen && (
        <B.Dialog
          open={dangerModalOpen}
          onClose={function () {
            setDangerModalOpen(false);
          }}
          title="پاک کردن همهٔ داده‌ها"
          description="برگشت ندارد. برای روشن شدن دکمه، «پاک کن» را بنویس."
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <B.Button
                variant="ghost"
                onClick={function () {
                  setDangerModalOpen(false);
                }}
              >
                انصراف
              </B.Button>
              <B.Button
                variant="danger-bold"
                disabled={dangerConfirmText.trim() !== 'پاک کن'}
                onClick={handleConfirmClearAll}
              >
                پاک کن
              </B.Button>
            </div>
          }
          size="sm"
          alert={true}
        >
          <div style={{ padding: 'var(--space-2) 0' }}>
            <B.TextField
              label="بنویس: پاک کن"
              value={dangerConfirmText}
              placeholder="پاک کن"
              onChange={function (e) {
                setDangerConfirmText(e.target.value);
              }}
            />
          </div>
        </B.Dialog>
      )}
    </div>
  );
}

export { SettingsTab };
