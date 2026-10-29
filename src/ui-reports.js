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
  var Excel = SupportApp.Excel || {};
  var ImageExport = SupportApp.ImageExport || {};
  var Scoring = SupportApp.Scoring || {};

  /**
   * تب گزارش‌ها و دریافت خروجی‌های استاندارد اکسل و تصویر PNG
   */
  function ReportsTab(props) {
    var cohort = props.cohort;
    var toast = props.toast;

    var myGroups = (cohort.groups || []).filter(function (g) { return g.mine; });
    if (!myGroups.length) myGroups = cohort.groups || [];

    var [selectedGroupId, setSelectedGroupId] = root.React.useState(myGroups[0] ? myGroups[0].id : '');
    var [selectedDayN, setSelectedDayN] = root.React.useState(8);
    var [includeFrozen, setIncludeFrozen] = root.React.useState(false);
    var [loadingReport, setLoadingReport] = root.React.useState(null); // 'day' | 'full' | 'all_day' | 'all_full' | 'image' | 'both' | null

    // مودال پیش‌نمایش تصویر
    var [imageModalOpen, setImageModalOpen] = root.React.useState(false);
    var [imagePreviewData, setImagePreviewData] = root.React.useState(null);

    var activeGroup = myGroups.find(function (g) { return g.id === selectedGroupId; }) || myGroups[0] || null;
    var mainDays = (cohort.days || []).filter(function (d) { return d.type === 'main'; });

    function handleExportDay() {
      if (!activeGroup) return;
      setLoadingReport('day');
      Excel.exportGroupDayReport(cohort, activeGroup, selectedDayN, includeFrozen)
        .then(function () {
          setLoadingReport(null);
          if (toast) toast.show({ intent: 'success', message: 'گزارش روز ' + Names.toPersianDigits(selectedDayN) + ' دانلود شد.' });
        })
        .catch(function (err) {
          setLoadingReport(null);
          if (toast) toast.show({ intent: 'danger', message: err.message });
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
          if (toast) toast.show({ intent: 'danger', message: err.message });
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
          if (toast) toast.show({ intent: 'danger', message: err.message });
        });
    }

    function handleExportFullCohort() {
      if (!activeGroup) return;
      setLoadingReport('full');
      Excel.exportGroupFullCohortReport(cohort, activeGroup, includeFrozen)
        .then(function () {
          setLoadingReport(null);
          if (toast) toast.show({ intent: 'success', message: 'گزارش کل دوره ' + activeGroup.name + ' دانلود شد.' });
        })
        .catch(function (err) {
          setLoadingReport(null);
          if (toast) toast.show({ intent: 'danger', message: err.message });
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
          if (toast) toast.show({ intent: 'danger', message: err.message });
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
          if (toast) toast.show({ intent: 'danger', message: err.message });
        });
    }

    // آمار کلی دوره
    var totalParticipants = (cohort.participants || []).length;
    var frozenCount = (cohort.participants || []).filter(function (p) { return p.status === 'frozen'; }).length;
    var activeCount = (cohort.participants || []).filter(function (p) { return p.status === 'active'; }).length;

    return h('div', { style: { display: 'grid', gap: 'var(--space-6)' } },
      h('div', null,
        h('h2', { className: 'heading-md' }, 'گزارش‌ها و خروجی‌های اکسل و تصویر'),
        h('p', { className: 'body-sm', style: { color: 'var(--text-muted)' } },
          'فایل‌های اکسل استاندارد و تصاویر تمیز تلگرامی (PNG ۱۰۸۰p) برای ارسال مستقیم در گروه‌ها و اشتراک‌گذاری.'
        )
      ),

      // خلاصه آمار دوره
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' } },
        h(B.Card, { padding: 'md' },
          h(B.Stat, { label: 'تعداد کل اعضا', value: Names.toPersianDigits(totalParticipants) + ' نفر' })
        ),
        h(B.Card, { padding: 'md' },
          h(B.Stat, { label: 'اعضای فعال', value: Names.toPersianDigits(activeCount) + ' نفر' })
        ),
        h(B.Card, { padding: 'md' },
          h(B.Stat, { label: 'افراد فریز شده', value: Names.toPersianDigits(frozenCount) + ' نفر' })
        ),
        h(B.Card, { padding: 'md' },
          h(B.Stat, { label: 'تعداد گروه‌های من', value: Names.toPersianDigits(myGroups.length) + ' گروه' })
        )
      ),

      // تنظیمات مشترک گزارش‌ها
      h(B.Card, { padding: 'lg', style: { display: 'grid', gap: 'var(--space-4)' } },
        h('h3', { className: 'title' }, 'انتخاب گروه و روز برای گزارش'),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' } },
          h(B.Select, {
            label: 'انتخاب گروه هدف',
            options: myGroups.map(function (g) { return { value: g.id, label: g.name }; }),
            value: activeGroup ? activeGroup.id : '',
            onChange: function (e) { setSelectedGroupId(e.target.value); }
          }),
          h(B.Select, {
            label: 'انتخاب روز',
            options: mainDays.map(function (d) {
              var dayDate = Names.addDaysToIso(cohort.startDate, d.n - 1);
              return {
                value: String(d.n),
                label: 'روز ' + Names.toPersianDigits(d.n) + ' (' + Names.formatShamsiShort(dayDate) + ')'
              };
            }),
            value: String(selectedDayN),
            onChange: function (e) { setSelectedDayN(parseInt(e.target.value, 10)); }
          }),
          h('div', { style: { display: 'flex', alignItems: 'flex-end', paddingBottom: 'var(--space-2)' } },
            h(B.Checkbox, {
              label: 'افراد فریز و خارج‌شده در خروجی بیایند',
              checked: includeFrozen,
              onChange: function (e) { setIncludeFrozen(e.target.checked); }
            })
          )
        )
      ),

      // کارت‌های انواع خروجی اکسل و تصویر
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' } },
        // خروجی ۱: گزارش روز گروه (اکسل و تصویر)
        h(B.Card, { padding: 'lg', style: { display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } },
          h('div', null,
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' } },
              h(B.Icon, { name: 'CalendarDays', size: 'lg', className: 'text-brand' }),
              h('h4', { className: 'title' }, '۱. گزارش روز گروه (اکسل و تصویر)')
            ),
            h('p', { className: 'body-sm', style: { color: 'var(--text-muted)', marginBottom: 'var(--space-4)' } },
              'مخصوص ارسال در گروه تلگرام در پایان روز. تصویر بهینه ۱۰۸۰ پیکسلی شارپ با فونت Vazirmatn، همراه با اکسل دو شیت.'
            )
          ),
          h('div', { style: { display: 'grid', gap: 'var(--space-2)' } },
            h(B.Button, {
              variant: 'primary',
              iconStart: 'Image',
              loading: loadingReport === 'image',
              onClick: handleExportImage
            }, 'خروجی تصویر گزارش (PNG)'),
            h('div', { style: { display: 'flex', gap: 'var(--space-2)' } },
              h(B.Button, {
                variant: 'secondary',
                iconStart: 'Share2',
                style: { flex: 1 },
                loading: loadingReport === 'day',
                onClick: handleExportDay
              }, 'دانلود اکسل'),
              h(B.Button, {
                variant: 'secondary',
                iconStart: 'FolderArchive',
                style: { flex: 1 },
                loading: loadingReport === 'both',
                onClick: handleExportBoth
              }, 'خروجی هر دو')
            )
          )
        ),

        // خروجی ۲: گزارش کل دوره یک گروه
        h(B.Card, { padding: 'lg', style: { display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } },
          h('div', null,
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' } },
              h(B.Icon, { name: 'ChartColumn', size: 'lg', className: 'text-brand' }),
              h('h4', { className: 'title' }, '۲. ماتریس کل دوره گروه')
            ),
            h('p', { className: 'body-sm', style: { color: 'var(--text-muted)', marginBottom: 'var(--space-4)' } },
              'ماتریس ۲۱ روز اصلی برای تمام اعضای گروه، امتیاز هر روز در صورت بسته بودن، مجموع تجمعی و درصد نهایی.'
            )
          ),
          h(B.Button, {
            variant: 'secondary',
            iconStart: 'ChartColumn',
            loading: loadingReport === 'full',
            onClick: handleExportFullCohort
          }, 'دانلود اکسل کل دوره ' + (activeGroup ? activeGroup.name : ''))
        ),

        // خروجی ۳: همه گروه‌های من در یک فایل (روز)
        h(B.Card, { padding: 'lg', style: { display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } },
          h('div', null,
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' } },
              h(B.Icon, { name: 'House', size: 'lg', className: 'text-brand' }),
              h('h4', { className: 'title' }, '۳. همه گروه‌ها (گزارش روز)')
            ),
            h('p', { className: 'body-sm', style: { color: 'var(--text-muted)', marginBottom: 'var(--space-4)' } },
              'یک فایل اکسل واحد شامل شیت‌های مجزا برای تک‌تک گروه‌های مسئولیت من در روز انتخاب‌شده.'
            )
          ),
          h(B.Button, {
            variant: 'secondary',
            iconStart: 'Inbox',
            loading: loadingReport === 'all_day',
            onClick: handleExportAllGroupsDay
          }, 'دانلود همه گروه‌ها (روز ' + Names.toPersianDigits(selectedDayN) + ')')
        ),

        // خروجی ۴: همه گروه‌های من در یک فایل (کل دوره)
        h(B.Card, { padding: 'lg', style: { display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } },
          h('div', null,
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' } },
              h(B.Icon, { name: 'Copy', size: 'lg', className: 'text-brand' }),
              h('h4', { className: 'title' }, '۴. همه گروه‌ها (کل دوره)')
            ),
            h('p', { className: 'body-sm', style: { color: 'var(--text-muted)', marginBottom: 'var(--space-4)' } },
              'یک فایل اکسل جامع شامل شیت ماتریس ۲۱ روزه برای تمام گروه‌های تحت نظارت شما.'
            )
          ),
          h(B.Button, {
            variant: 'secondary',
            iconStart: 'Copy',
            loading: loadingReport === 'all_full',
            onClick: handleExportAllGroupsFull
          }, 'دانلود همه گروه‌ها (کل دوره)')
        )
      ),

      // دیالوگ پیش‌نمایش تصویر گزارش
      imageModalOpen && h(ImageExport.ImagePreviewModal, {
        open: imageModalOpen,
        imagesData: imagePreviewData,
        onClose: function () { setImageModalOpen(false); },
        toast: toast
      })
    );
  }

  SupportApp.UIReports = {
    ReportsTab: ReportsTab
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupportApp.UIReports;
  }
})(typeof window !== 'undefined' ? window : globalThis);
