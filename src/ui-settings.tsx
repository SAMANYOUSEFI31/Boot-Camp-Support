/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { B } from './bushido';
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
  const [rangeSpecial, setRangeSpecial] = useState(true);

  const days = cohort.days || [];

  function handleDayChange<K extends keyof DayConfig>(dayN: number, field: K, value: DayConfig[K]) {
    const updated = days.map(function (d) {
      if (d.n === dayN) {
        const copy = Object.assign({}, d);
        copy[field] = value;
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
        message: 'تنظیمات از روز ' + Names.toPersianDigits(dayN - 1) + ' کپی شد.'
      });
  }

  function handleApplyToRange() {
    const start = parseInt(rangeStart, 10);
    const end = parseInt(rangeEnd, 10);
    const hard = parseInt(rangeHard, 10);
    if (isNaN(start) || isNaN(end) || start > end || start < 1 || end > 30) {
      if (toast) toast.show({ intent: 'danger', message: 'بازه روزها نامعتبر است.' });
      return;
    }

    const updated = days.map(function (d) {
      if (d.n >= start && d.n <= end) {
        return Object.assign({}, d, {
          hardLevels: hard,
          specialMission: rangeSpecial
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
    if (toast) toast.show({ intent: 'danger', message: 'تمام داده‌های برنامه پاک شدند.' });
    window.location.reload();
  }

  return (
    <div className="bsh-stack bsh-stack--lg">
      <div>
        <h2 className="heading-md">تنظیمات دوره و سیستم</h2>
        <p className="body-sm" style={{ color: 'var(--text-subtle)' }}>
          پیکربندی روزهای ۳۰‌گانه دوره فعال، پشتیبان‌گیری، تست‌ها و پاکسازی حافظه.
        </p>
      </div>
      <B.Tabs
        items={[
          { id: 'days', label: 'تنظیمات روزها (۳۰ روز)' },
          { id: 'danger', label: 'منطقه‌ی خطر و مدیریت داده‌ها' }
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
              اعمال سریع به بازه‌ای از روزها
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
                label="سطح کار سخت"
                options={[
                  { value: '0', label: 'بدون کار سخت (۰)' },
                  { value: '1', label: '۱ سطح' },
                  { value: '2', label: '۲ سطح' },
                  { value: '3', label: '۳ سطح' }
                ]}
                value={rangeHard}
                onChange={function (e) {
                  setRangeHard(e.target.value);
                }}
              />
              <div style={{ paddingBottom: 'var(--space-2)' }}>
                <B.Checkbox
                  label="مأموریت ویژه دارد"
                  checked={rangeSpecial}
                  onChange={function (e) {
                    setRangeSpecial(e.target.checked);
                  }}
                />
              </div>
              <div>
                <B.Button variant="secondary" onClick={handleApplyToRange}>
                  اعمال به بازه
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
                  <th className="label-sm is-num" style={{ textAlign: 'center', width: 60 }}>
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
                  <th className="label-sm" style={{ minWidth: 120, textAlign: 'center' }}>
                    مأموریت ویژه
                  </th>
                  <th className="label-sm" style={{ minWidth: 100, textAlign: 'center' }}>
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
                            { value: '0', label: 'بدون کار سخت (۰)' },
                            { value: '1', label: '۱ سطح' },
                            { value: '2', label: '۲ سطح' },
                            { value: '3', label: '۳ سطح' }
                          ]}
                          value={String(d.hardLevels != null ? d.hardLevels : 3)}
                          onChange={function (e) {
                            handleDayChange(d.n, 'hardLevels', parseInt(e.target.value, 10));
                          }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <B.Checkbox
                          disabled={d.type !== 'main'}
                          checked={!!d.specialMission}
                          onChange={function (e) {
                            handleDayChange(d.n, 'specialMission', e.target.checked);
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
                            کپی از روز قبل
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
                <div className="title">آرشیو کردن این دوره</div>
                <p className="body-sm" style={{ color: 'var(--text-subtle)' }}>
                  با آرشیو کردن دوره، ثبت روزانه برای آن قفل و فقط‌خواندنی می‌شود، اما امکان دریافت گزارش اکسل
                  باقی می‌ماند.
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
                <div className="title">آزمون‌های صحت محاسبات</div>
                <p className="body-sm" style={{ color: 'var(--text-subtle)' }}>
                  بررسی ۱۵ تست اجباری موتور امتیازدهی در مرورگر.
                </p>
              </div>
              <B.Button
                variant="secondary"
                iconStart="ExternalLink"
                onClick={function () {
                  window.open('tests.html', '_blank');
                }}
              >
                اجرای صفحه تست‌ها
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
                منطقه‌ی خطر: پاک‌کردن همه‌ی داده‌ها
              </h3>
            </div>
            <p className="body-sm" style={{ color: 'var(--text-subtle)', marginBottom: 'var(--space-4)' }}>
              با این کار تمام دوره‌ها، گروه‌ها، افراد و رکوردهای ثبت‌شده در این مرورگر به طور کامل و غیرقابل
              بازگشت پاک خواهند شد. حتماً قبل از این کار، فایل پشتیبان (بکاپ) دریافت کنید.
            </p>
            <B.Button
              variant="danger-bold"
              iconStart="Trash2"
              onClick={function () {
                setDangerConfirmText('');
                setDangerModalOpen(true);
              }}
            >
              پاک کردن همه‌ی داده‌ها
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
          title="هشدار: حذف کامل تمام اطلاعات برنامه"
          description="این عملیات غیرقابل بازگشت است. برای فعال شدن دکمه حذف، عبارت دقیق «پاک کن» را در کادر زیر بنویسید:"
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
              label="عبارت تأیید (پاک کن)"
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
