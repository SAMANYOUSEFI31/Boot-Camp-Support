/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { B } from './bushido';
import { Names } from './names';
import { errorMessage } from './errors';
import { Excel } from './excel';
import { ImageExport, ImagePreviewModal, type ImagesData } from './image-export';
import type { Cohort, Group, Toast } from './types';

type LoadingKey = 'day' | 'full' | 'all_day' | 'all_full' | 'image' | 'both';

/**
 * تب گزارش‌ها و دریافت خروجی‌های استاندارد اکسل و تصویر PNG
 */
function ReportsTab(props: { cohort: Cohort; toast?: Toast }) {
  const cohort = props.cohort;
  const toast = props.toast;

  let myGroups: Group[] = (cohort.groups || []).filter(function (g) {
    return g.mine;
  });
  if (!myGroups.length) myGroups = cohort.groups || [];

  const [selectedGroupId, setSelectedGroupId] = useState(myGroups[0] ? myGroups[0].id : '');
  const [selectedDayN, setSelectedDayN] = useState(8);
  const [includeFrozen, setIncludeFrozen] = useState(false);
  const [loadingReport, setLoadingReport] = useState<LoadingKey | null>(null);

  // مودال پیش‌نمایش تصویر
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imagePreviewData, setImagePreviewData] = useState<ImagesData | null>(null);

  const activeGroup =
    myGroups.find(function (g) {
      return g.id === selectedGroupId;
    }) ||
    myGroups[0] ||
    null;
  const mainDays = (cohort.days || []).filter(function (d) {
    return d.type === 'main';
  });

  if (!activeGroup) {
    return (
      <B.Card padding="lg">
        <B.EmptyState
          icon="Inbox"
          title="گروهی برای گزارش وجود ندارد"
          description="ابتدا در تب «گروه‌ها و اعضا» یک گروه بسازید."
        />
      </B.Card>
    );
  }

  function handleExportDay() {
    if (!activeGroup) return;
    setLoadingReport('day');
    Excel.exportGroupDayReport(cohort, activeGroup, selectedDayN, includeFrozen)
      .then(function () {
        setLoadingReport(null);
        if (toast)
          toast.show({
            intent: 'success',
            message: 'گزارش روز ' + Names.toPersianDigits(selectedDayN) + ' دانلود شد.'
          });
      })
      .catch(function (err) {
        setLoadingReport(null);
        if (toast) toast.show({ intent: 'danger', message: errorMessage(err) });
      });
  }

  function handleExportImage() {
    if (!activeGroup) return;
    setLoadingReport('image');
    ImageExport.generateGroupDayReportImages(cohort, activeGroup, selectedDayN, includeFrozen)
      .then(function (result) {
        setLoadingReport(null);
        setImagePreviewData(result);
        setImageModalOpen(true);
      })
      .catch(function (err) {
        setLoadingReport(null);
        if (toast) toast.show({ intent: 'danger', message: errorMessage(err) });
      });
  }

  function handleExportBoth() {
    if (!activeGroup) return;
    setLoadingReport('both');
    Excel.exportGroupDayReport(cohort, activeGroup, selectedDayN, includeFrozen)
      .then(function () {
        return ImageExport.generateGroupDayReportImages(cohort, activeGroup, selectedDayN, includeFrozen);
      })
      .then(function (result) {
        setLoadingReport(null);
        setImagePreviewData(result);
        setImageModalOpen(true);
        if (toast) toast.show({ intent: 'success', message: 'اکسل دانلود شد و تصویر گزارش آماده است.' });
      })
      .catch(function (err) {
        setLoadingReport(null);
        if (toast) toast.show({ intent: 'danger', message: errorMessage(err) });
      });
  }

  function handleExportFullCohort() {
    if (!activeGroup) return;
    setLoadingReport('full');
    Excel.exportGroupFullCohortReport(cohort, activeGroup, includeFrozen)
      .then(function () {
        setLoadingReport(null);
        if (toast)
          toast.show({ intent: 'success', message: 'گزارش کل دوره ' + activeGroup.name + ' دانلود شد.' });
      })
      .catch(function (err) {
        setLoadingReport(null);
        if (toast) toast.show({ intent: 'danger', message: errorMessage(err) });
      });
  }

  function handleExportAllGroupsDay() {
    setLoadingReport('all_day');
    Excel.exportAllMyGroupsReport(cohort, 'day', selectedDayN, includeFrozen)
      .then(function () {
        setLoadingReport(null);
        if (toast) toast.show({ intent: 'success', message: 'گزارش روز برای همه گروه‌ها دانلود شد.' });
      })
      .catch(function (err) {
        setLoadingReport(null);
        if (toast) toast.show({ intent: 'danger', message: errorMessage(err) });
      });
  }

  function handleExportAllGroupsFull() {
    setLoadingReport('all_full');
    Excel.exportAllMyGroupsReport(cohort, 'full', null, includeFrozen)
      .then(function () {
        setLoadingReport(null);
        if (toast) toast.show({ intent: 'success', message: 'گزارش کل دوره برای همه گروه‌ها دانلود شد.' });
      })
      .catch(function (err) {
        setLoadingReport(null);
        if (toast) toast.show({ intent: 'danger', message: errorMessage(err) });
      });
  }

  // آمار کلی دوره
  const totalParticipants = (cohort.participants || []).length;
  const frozenCount = (cohort.participants || []).filter(function (p) {
    return p.status === 'frozen';
  }).length;
  const activeCount = (cohort.participants || []).filter(function (p) {
    return p.status === 'active';
  }).length;

  return (
    <div className="bsh-stack bsh-stack--lg">
      <div>
        <h2 className="heading-md">گزارش‌ها و خروجی‌های اکسل و تصویر</h2>
        <p className="body-sm" style={{ color: 'var(--text-subtle)' }}>
          فایل‌های اکسل استاندارد و تصاویر تمیز تلگرامی (PNG ۱۰۸۰p) برای ارسال مستقیم در گروه‌ها و
          اشتراک‌گذاری.
        </p>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, calc(var(--space-32) + var(--space-8))), 1fr))',
          gap: 'var(--space-3)'
        }}
      >
        <B.Stat label="تعداد کل اعضا" value={Names.toPersianDigits(totalParticipants) + ' نفر'} />
        <B.Stat label="اعضای فعال" value={Names.toPersianDigits(activeCount) + ' نفر'} />
        <B.Stat label="افراد فریز شده" value={Names.toPersianDigits(frozenCount) + ' نفر'} />
        <B.Stat label="تعداد گروه‌های من" value={Names.toPersianDigits(myGroups.length) + ' گروه'} />
      </div>
      <B.Card padding="lg" style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <h3 className="title">انتخاب گروه و روز برای گزارش</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, var(--overlay-width-xs)), 1fr))',
            gap: 'var(--space-4)'
          }}
        >
          <B.Select
            label="انتخاب گروه هدف"
            options={myGroups.map(function (g) {
              return { value: g.id, label: g.name };
            })}
            value={activeGroup ? activeGroup.id : ''}
            onChange={function (e) {
              setSelectedGroupId(e.target.value);
            }}
          />
          <B.Select
            label="انتخاب روز"
            options={mainDays.map(function (d) {
              const dayDate = Names.addDaysToIso(cohort.startDate, d.n - 1);
              return {
                value: String(d.n),
                label: 'روز ' + Names.toPersianDigits(d.n) + ' (' + Names.formatShamsiShort(dayDate) + ')'
              };
            })}
            value={String(selectedDayN)}
            onChange={function (e) {
              setSelectedDayN(parseInt(e.target.value, 10));
            }}
          />
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 'var(--space-2)' }}>
            <B.Checkbox
              label="افراد فریز و خارج‌شده در خروجی بیایند"
              checked={includeFrozen}
              onChange={function (e) {
                setIncludeFrozen(e.target.checked);
              }}
            />
          </div>
        </div>
      </B.Card>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, calc(var(--overlay-width-xs) + var(--space-8))), 1fr))',
          gap: 'var(--space-4)'
        }}
      >
        <B.Card
          padding="lg"
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-2)'
              }}
            >
              <B.Icon name="CalendarDays" size="lg" className="text-brand" />
              <h4 className="title">۱. گزارش روز گروه (اکسل و تصویر)</h4>
            </div>
            <p className="body-sm" style={{ color: 'var(--text-subtle)', marginBottom: 'var(--space-4)' }}>
              مخصوص ارسال در گروه تلگرام در پایان روز. تصویر بهینه ۱۰۸۰ پیکسلی شارپ با فونت Vazirmatn، همراه
              با اکسل دو شیت.
            </p>
          </div>
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <B.Button variant="primary" loading={loadingReport === 'image'} onClick={handleExportImage}>
              خروجی تصویر گزارش (PNG)
            </B.Button>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <B.Button
                variant="secondary"
                iconStart="Share2"
                style={{ flex: 1 }}
                loading={loadingReport === 'day'}
                onClick={handleExportDay}
              >
                دانلود اکسل
              </B.Button>
              <B.Button
                variant="secondary"
                style={{ flex: 1 }}
                loading={loadingReport === 'both'}
                onClick={handleExportBoth}
              >
                خروجی هر دو
              </B.Button>
            </div>
          </div>
        </B.Card>
        <B.Card
          padding="lg"
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-2)'
              }}
            >
              <B.Icon name="ChartColumn" size="lg" className="text-brand" />
              <h4 className="title">۲. ماتریس کل دوره گروه</h4>
            </div>
            <p className="body-sm" style={{ color: 'var(--text-subtle)', marginBottom: 'var(--space-4)' }}>
              ماتریس ۲۱ روز اصلی برای تمام اعضای گروه، امتیاز هر روز در صورت بسته بودن، مجموع تجمعی و درصد
              نهایی.
            </p>
          </div>
          <B.Button
            variant="secondary"
            iconStart="ChartColumn"
            loading={loadingReport === 'full'}
            onClick={handleExportFullCohort}
          >
            {'دانلود اکسل کل دوره ' + (activeGroup ? activeGroup.name : '')}
          </B.Button>
        </B.Card>
        <B.Card
          padding="lg"
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-2)'
              }}
            >
              <B.Icon name="House" size="lg" className="text-brand" />
              <h4 className="title">۳. همه گروه‌ها (گزارش روز)</h4>
            </div>
            <p className="body-sm" style={{ color: 'var(--text-subtle)', marginBottom: 'var(--space-4)' }}>
              یک فایل اکسل واحد شامل شیت‌های مجزا برای تک‌تک گروه‌های مسئولیت من در روز انتخاب‌شده.
            </p>
          </div>
          <B.Button
            variant="secondary"
            iconStart="Inbox"
            loading={loadingReport === 'all_day'}
            onClick={handleExportAllGroupsDay}
          >
            {'دانلود همه گروه‌ها (روز ' + Names.toPersianDigits(selectedDayN) + ')'}
          </B.Button>
        </B.Card>
        <B.Card
          padding="lg"
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-2)'
              }}
            >
              <B.Icon name="Copy" size="lg" className="text-brand" />
              <h4 className="title">۴. همه گروه‌ها (کل دوره)</h4>
            </div>
            <p className="body-sm" style={{ color: 'var(--text-subtle)', marginBottom: 'var(--space-4)' }}>
              یک فایل اکسل جامع شامل شیت ماتریس ۲۱ روزه برای تمام گروه‌های تحت نظارت شما.
            </p>
          </div>
          <B.Button
            variant="secondary"
            iconStart="Copy"
            loading={loadingReport === 'all_full'}
            onClick={handleExportAllGroupsFull}
          >
            دانلود همه گروه‌ها (کل دوره)
          </B.Button>
        </B.Card>
      </div>
      {imageModalOpen && (
        <ImagePreviewModal
          open={imageModalOpen}
          imagesData={imagePreviewData}
          onClose={function () {
            setImageModalOpen(false);
          }}
          toast={toast}
        />
      )}
    </div>
  );
}

export { ReportsTab };
