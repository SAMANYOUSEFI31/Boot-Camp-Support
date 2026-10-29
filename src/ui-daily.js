/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { B } from './bushido.js';
import { Names } from './names.js';
import { Scoring } from './scoring.js';
import { Store } from './store.js';
import { Excel } from './excel.js';
import { ImageExport } from './image-export.js';

const h = React.createElement;


/**
 * محاسبه روز جاری نسبت به تاریخ شروع دوره (۱ تا ۳۰)
 */
function calculateCurrentDayNumber(startDateIso) {
  if (!startDateIso) return 8;
  try {
    var start = new Date(startDateIso + 'T00:00:00');
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays < 1) return 1;
    if (diffDays > 30) return 30;
    return diffDays;
  } catch (e) {
    return 8;
  }
}

/**
 * صفحه ثبت روزانه نتایج (قلب ابزار پشتیبان)
 */
function DailyScoringTab(props) {
  var cohort = props.cohort;
  var toast = props.toast;

  var myGroups = (cohort.groups || []).filter(function (g) { return g.mine; });
  if (!myGroups.length) {
    myGroups = cohort.groups || [];
  }

  var [selectedGroupId, setSelectedGroupId] = React.useState(myGroups[0] ? myGroups[0].id : null);
  var [selectedDayN, setSelectedDayN] = React.useState(calculateCurrentDayNumber(cohort.startDate));
  var [showFrozen, setShowFrozen] = React.useState(false);
  var [saveIndicator, setSaveIndicator] = React.useState(false);

  // حالت نمایش: در موبایل پیش‌فرض 'cards' و در دسکتاپ 'table'
  var isSmallScreen = typeof window !== 'undefined' ? window.innerWidth < 680 : false;
  var [viewMode, setViewMode] = React.useState(isSmallScreen ? 'cards' : 'table');

  // دیالوگ بستن روز
  var [closeDayModalOpen, setCloseDayModalOpen] = React.useState(false);
  var [clearDayConfirmOpen, setClearDayConfirmOpen] = React.useState(false);

  // دیالوگ‌های خروجی
  var [exportModalOpen, setExportModalOpen] = React.useState(false);
  var [imageModalOpen, setImageModalOpen] = React.useState(false);
  var [imagePreviewData, setImagePreviewData] = React.useState(null);
  var [isGeneratingImage, setIsGeneratingImage] = React.useState(false);

  React.useEffect(function () {
    if (myGroups.length && (!selectedGroupId || !myGroups.find(function (g) { return g.id === selectedGroupId; }))) {
      setSelectedGroupId(myGroups[0].id);
    }
  }, [myGroups.length, selectedGroupId]);

  // پاسخگویی به تغییر اندازه پنجره
  React.useEffect(function () {
    function onResize() {
      if (window.innerWidth < 680 && viewMode === 'table') {
        setViewMode('cards');
      }
    }
    window.addEventListener('resize', onResize);
    return function () { window.removeEventListener('resize', onResize); };
  }, [viewMode]);

  var activeGroup = myGroups.find(function (g) { return g.id === selectedGroupId; }) || myGroups[0] || null;

  if (!activeGroup) {
    return h(B.Card, { padding: 'lg' },
      h(B.EmptyState, {
        icon: 'Flame',
        title: 'هیچ گروه فعالی یافت نشد',
        description: 'لطفاً ابتدا در تب «گروه‌ها» حداقل یک گروه بسازید و علامت «مال من است» را بزنید.'
      })
    );
  }

  var dayCfg = (cohort.days || []).find(function (d) { return d.n === selectedDayN; }) || {
    n: selectedDayN,
    type: selectedDayN <= 7 ? 'warmup' : selectedDayN >= 29 ? 'review' : 'main',
    hardLevels: 3,
    specialMission: true
  };

  var closedDays = activeGroup.closedDays || [];
  var isDayClosed = closedDays.indexOf(selectedDayN) !== -1;

  var dayDate = Names.addDaysToIso(cohort.startDate, selectedDayN - 1);
  var dayShamsi = Names.formatShamsiShort(dayDate);

  var dayTypeName = dayCfg.type === 'warmup' ? 'گرم‌کردن' : dayCfg.type === 'review' ? 'مرور' : 'اصلی';

  var members = (cohort.participants || []).filter(function (p) {
    if (p.groupId !== activeGroup.id) return false;
    if (!showFrozen && (p.status === 'frozen' || p.status === 'left')) return false;
    return true;
  });

  // ذخیره کم‌سروصدا
  function triggerSaveIndicator() {
    setSaveIndicator(true);
    setTimeout(function () { setSaveIndicator(false); }, 1500);
  }

  // ثبت یک فیلد
  function handleCellChange(pId, field, value) {
    var val = value;
    if (val === '') val = null;
    var patch = {};
    patch[field] = val;
    Store.recordDaily(cohort.id, pId, selectedDayN, patch);
    triggerSaveIndicator();
  }

  // ابزارهای گروهی
  function handleBatchAction(actionName, label) {
    var rollbackFn = Store.batchRecordDay(cohort.id, activeGroup.id, selectedDayN, actionName);
    triggerSaveIndicator();
    if (toast && rollbackFn) {
      toast.show({
        intent: 'success',
        message: label + ' انجام شد.',
        action: {
          label: 'بازگردانی',
          onClick: rollbackFn
        },
        duration: 10000
      });
    }
  }

  // تولید تصویر با Canvas API
  function handleGenerateImage(includeFrozenOpt) {
    setIsGeneratingImage(true);
    ImageExport.generateGroupDayReportImages(cohort, activeGroup, selectedDayN, includeFrozenOpt || false)
      .then(function (result) {
        setIsGeneratingImage(false);
        setImagePreviewData(result);
        setImageModalOpen(true);
      })
      .catch(function (err) {
        setIsGeneratingImage(false);
        if (toast) toast.show({ intent: 'danger', message: 'خطا در ساخت تصویر: ' + err.message });
      });
  }

  // خروجی ترکیبی اکسل و تصویر
  function handleExportBoth(includeFrozenOpt) {
    setIsGeneratingImage(true);
    Excel.exportGroupDayReport(cohort, activeGroup, selectedDayN, includeFrozenOpt || false)
      .then(function () {
        return ImageExport.generateGroupDayReportImages(cohort, activeGroup, selectedDayN, includeFrozenOpt || false);
      })
      .then(function (result) {
        setIsGeneratingImage(false);
        setImagePreviewData(result);
        setImageModalOpen(true);
        if (toast) toast.show({ intent: 'success', message: 'فایل اکسل دانلود شد و تصویر گزارش آماده است.' });
      })
      .catch(function (err) {
        setIsGeneratingImage(false);
        if (toast) toast.show({ intent: 'danger', message: err.message });
      });
  }

  // محاسبه آمار ثبت‌شده‌ها
  var recordedMembersCount = members.filter(function (p) {
    var rec = cohort.records && cohort.records[p.id] && cohort.records[p.id][selectedDayN];
    return rec && (rec.done != null || rec.hard != null || rec.special != null);
  }).length;

  var totalMembersCount = members.length;
  var unrecordedCount = totalMembersCount - recordedMembersCount;
  var progressPercent = totalMembersCount > 0 ? Math.round((recordedMembersCount / totalMembersCount) * 100) : 0;

  // «بستن روز» تنها دکمهٔ اصلی صفحه است؛ در هر عرض فقط یک نسخهٔ آن دیده می‌شود
  var closeDayButton = isDayClosed ? (
    h(B.Button, {
      variant: 'ghost',
      size: 'sm',
      onClick: function () {
        Store.toggleCloseDay(cohort.id, activeGroup.id, selectedDayN, false);
        if (toast) toast.show({ intent: 'info', message: 'روز دوباره باز شد.' });
      }
    }, 'باز کردن دوباره روز')
  ) : (
    h(B.Button, {
      variant: 'primary',
      size: 'sm',
      iconStart: 'CircleCheck',
      onClick: function () { setCloseDayModalOpen(true); }
    }, 'بستن روز')
  );

  return h('div', { className: 'bsh-stack bsh-daily' },
    // ۱. نوار کنترل بالای صفحه
    h(B.Card, { padding: 'md' },
      h('div', { className: 'bsh-row', style: { justifyContent: 'space-between' } },
        // انتخاب گروه با اسکرول افقی نرم
        h('div', { style: { maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBlock: 'var(--space-1)' } },
          h(B.SegmentedControl, {
            label: 'انتخاب گروه',
            items: myGroups.map(function (g) {
              return { id: g.id, label: g.name };
            }),
            value: activeGroup.id,
            onChange: function (id) { setSelectedGroupId(id); }
          })
        ),

        // ناوبری روزها (روز قبل / روز بعد)
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)' } },
          h(B.IconButton, {
            icon: 'ChevronRight',
            flip: true,
            style: { flex: 'none' },
            label: 'روز قبل',
            disabled: selectedDayN <= 1,
            onClick: function () { setSelectedDayN(function (prev) { return Math.max(1, prev - 1); }); }
          }),
          h('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              background: 'var(--surface-overlay)',
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              flexWrap: 'wrap'
            }
          },
            h('span', { className: 'heading-xs' },
              'روز ' + Names.toPersianDigits(selectedDayN) + ' · ' + dayShamsi + ' · ' + dayTypeName
            ),
            isDayClosed
              ? h(B.Badge, { intent: 'success', emphasis: 'bold', icon: 'Check' }, 'بسته شده')
              : h(B.Badge, { intent: 'warning', emphasis: 'subtle', icon: 'Info' }, 'باز')
          ),
          h(B.IconButton, {
            icon: 'ChevronLeft',
            flip: true,
            style: { flex: 'none' },
            label: 'روز بعد',
            disabled: selectedDayN >= 30,
            onClick: function () { setSelectedDayN(function (prev) { return Math.min(30, prev + 1); }); }
          })
        ),

        // ذخیره کم‌سروصدا + خروجی‌ها + بستن روز (در موبایل این‌ها در نوار پایین‌اند)
        saveIndicator && h('span', {
          className: 'caption',
          style: { color: 'var(--text-success)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }
        },
          h(B.Icon, { name: 'Check', size: 'xs' }),
          'ذخیره شد'
        ),
        h('div', { className: 'bsh-wide-only', style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' } },
          h(B.Button, {
            variant: 'secondary',
            size: 'sm',
            loading: isGeneratingImage,
            onClick: function () { handleGenerateImage(showFrozen); }
          }, 'خروجی تصویر'),
          h(B.Button, {
            variant: 'secondary',
            size: 'sm',
            iconStart: 'Share2',
            onClick: function () { setExportModalOpen(true); }
          }, 'خروجی Excel'),
          h(B.Button, {
            variant: 'secondary',
            size: 'sm',
            loading: isGeneratingImage,
            onClick: function () { handleExportBoth(showFrozen); }
          }, 'خروجی هر دو'),
          closeDayButton
        )
      )
    ),

    // ۲. هدر پیشرفت ثبت روزانه
    dayCfg.type === 'main' && h('div', { className: 'bsh-progress' },
      h('div', { className: 'bsh-row', style: { justifyContent: 'space-between' } },
        h('div', { className: 'bsh-row', style: { gap: 'var(--space-2)' } },
          h('span', { className: 'label-md' }, 'پیشرفت ثبت گروه:'),
          h('span', { className: 'body-md', style: { fontWeight: 700, color: progressPercent === 100 ? 'var(--text-success)' : 'var(--text-default)' } },
            Names.toPersianDigits(recordedMembersCount) + ' از ' + Names.toPersianDigits(totalMembersCount) + ' نفر ثبت شد (' + Names.toPersianDigits(progressPercent) + '٪)'
          )
        ),
        h('div', { className: 'bsh-row' },
          // سوئیچ نمای کارتی / جدولی (در موبایل همیشه کارتی است)
          h('div', { className: 'bsh-wide-only', style: { display: 'flex', background: 'var(--surface-overlay)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-0\\.5)' } },
            h(B.Button, {
              variant: viewMode === 'cards' ? 'secondary' : 'ghost',
              size: 'sm',
              onClick: function () { setViewMode('cards'); }
            }, 'نمای کارتی'),
            h(B.Button, {
              variant: viewMode === 'table' ? 'secondary' : 'ghost',
              size: 'sm',
              onClick: function () { setViewMode('table'); }
            }, 'نمای جدولی')
          ),
          h(B.Switch, {
            label: 'نمایش فریز‌شده‌ها',
            checked: showFrozen,
            onChange: function (e) { setShowFrozen(e.target.checked); }
          })
        )
      ),
      h('div', { className: 'bsh-progress__track', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': progressPercent, 'aria-label': 'پیشرفت ثبت گروه' },
        h('div', {
          className: 'bsh-progress__fill' + (progressPercent === 100 ? ' is-complete' : ''),
          style: { inlineSize: progressPercent + '%' }
        })
      )
    ),

    // نوار ابزارهای گروهی
    dayCfg.type === 'main' && h('div', { className: 'bsh-batch-bar' },
      h(B.Button, {
        variant: 'ghost',
        size: 'sm',
        onClick: function () { handleBatchAction('all_habits_done', 'همه‌ی عادت‌ها انجام شد'); }
      }, 'همه‌ی عادت‌ها انجام شد'),
      dayCfg.specialMission && h(B.Button, {
        variant: 'ghost',
        size: 'sm',
        onClick: function () { handleBatchAction('all_special_done', 'مأموریت همه انجام شد'); }
      }, 'مأموریت همه انجام شد'),
      h(B.Button, {
        variant: 'ghost',
        size: 'sm',
        onClick: function () { setClearDayConfirmOpen(true); }
      }, 'پاک کردن ثبت‌های این روز')
    ),

    // بدنه ثبت روزانه (نمای کارتی یا جدولی)
    dayCfg.type !== 'main' ? (
      h(B.Card, { padding: 'lg' },
        h(B.EmptyState, {
          icon: 'Info',
          title: 'این روز امتیاز ندارد',
          description: dayCfg.type === 'warmup'
            ? 'روزهای ۱ تا ۷ دوره، مرحله گرم‌کردن و آشنایی با عادات هستند و امتیازی برای آنها ثبت نمی‌شود.'
            : 'روزهای ۲۹ و ۳۰ دوره، روزهای مرور پایانی هستند و امتیازی برای آنها ثبت نمی‌شود.'
        })
      )
    ) : viewMode === 'cards' ? (
      h(DailyScoringCardView, {
        cohort: cohort,
        group: activeGroup,
        dayCfg: dayCfg,
        members: members,
        onCellChange: handleCellChange,
        toast: toast
      })
    ) : (
      h(DailyScoringTable, {
        cohort: cohort,
        group: activeGroup,
        dayCfg: dayCfg,
        members: members,
        onCellChange: handleCellChange,
        toast: toast
      })
    ),

    // نوار ثابت پایین فقط در موبایل (با CSS): خروجی‌ها زیر یک منو + تنها دکمهٔ اصلی صفحه
    h('div', { className: 'bsh-daily-bar' },
      h(B.Menu, {
        label: 'خروجی',
        side: 'top',
        trigger: h(B.Button, { variant: 'secondary', size: 'sm', iconStart: 'Share2' }, 'خروجی'),
        items: [
          { label: 'خروجی تصویر', onSelect: function () { handleGenerateImage(showFrozen); } },
          { label: 'خروجی Excel', onSelect: function () { setExportModalOpen(true); } },
          { label: 'خروجی هر دو', onSelect: function () { handleExportBoth(showFrozen); } }
        ]
      }),
      closeDayButton
    ),

    // دیالوگ بستن روز
    closeDayModalOpen && h(B.Dialog, {
      open: closeDayModalOpen,
      onClose: function () { setCloseDayModalOpen(false); },
      title: 'بستن روز ' + Names.toPersianDigits(selectedDayN),
      description: 'با بستن روز، امتیازات این روز در مجموع تجمعی اعضا و گروه لحاظ خواهند شد.',
      footer: h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' } },
        h(B.Button, { variant: 'ghost', onClick: function () { setCloseDayModalOpen(false); } }, 'انصراف'),
        h(B.Button, {
          variant: 'primary',
          onClick: function () {
            Store.toggleCloseDay(cohort.id, activeGroup.id, selectedDayN, true);
            setCloseDayModalOpen(false);
            if (toast) toast.show({ intent: 'success', message: 'روز ' + Names.toPersianDigits(selectedDayN) + ' با موفقیت بسته شد.' });
          }
        }, 'تأیید و بستن روز')
      ),
      size: 'sm'
    },
      h('div', { style: { padding: 'var(--space-2) 0' } },
        unrecordedCount > 0 ? (
          h(B.Alert, { intent: 'warning', title: 'توجه' },
            Names.toPersianDigits(unrecordedCount) + ' نفر هنوز هیچ رکوردی برای امروز ثبت نکرده‌اند. با بستن روز، امتیاز آنها صفر لحاظ خواهد شد.'
          )
        ) : (
          h(B.Alert, { intent: 'success' }, 'همه اعضای فعال برای امروز نتیجه ثبت کرده‌اند.')
        )
      )
    ),

    // دیالوگ پاک کردن ثبت‌های روز
    clearDayConfirmOpen && h(B.Dialog, {
      open: clearDayConfirmOpen,
      onClose: function () { setClearDayConfirmOpen(false); },
      title: 'پاک کردن ثبت‌های روز ' + Names.toPersianDigits(selectedDayN),
      description: 'آیا مطمئنید که می‌خواهید تمام رکوردهای ثبت‌شده امروز برای این گروه پاک شوند؟',
      footer: h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' } },
        h(B.Button, { variant: 'ghost', onClick: function () { setClearDayConfirmOpen(false); } }, 'انصراف'),
        h(B.Button, {
          variant: 'danger-bold',
          onClick: function () {
            setClearDayConfirmOpen(false);
            handleBatchAction('clear_day', 'ثبت‌های امروز پاک شدند');
          }
        }, 'پاک کن')
      ),
      size: 'sm',
      alert: true
    }),

    // دیالوگ دانلود اکسل
    exportModalOpen && h(ExcelGroupDayExportModal, {
      open: exportModalOpen,
      cohort: cohort,
      group: activeGroup,
      dayN: selectedDayN,
      isDayClosed: isDayClosed,
      onClose: function () { setExportModalOpen(false); },
      toast: toast
    }),

    // دیالوگ پیش‌نمایش تصویر گزارش بوشیدو
    imageModalOpen && h(ImageExport.ImagePreviewModal, {
      open: imageModalOpen,
      imagesData: imagePreviewData,
      onClose: function () { setImageModalOpen(false); },
      toast: toast
    })
  );
}

/**
 * نمای کارتی مخصوص موبایل و تبلت با دکمه‌های بزرگ لمسی (حداقل ۴۴ پیکسل)
 */
function DailyScoringCardView(props) {
  var cohort = props.cohort;
  var group = props.group;
  var dayCfg = props.dayCfg;
  var members = props.members;
  var onCellChange = props.onCellChange;
  var toast = props.toast;

  if (!members.length) {
    return h(B.Card, { padding: 'lg' },
      h(B.EmptyState, {
        icon: 'User',
        title: 'عضوی برای ثبت امتیاز وجود ندارد',
        description: 'لطفاً ابتدا از تب «گروه‌ها»، اعضای این گروه را اضافه کنید.'
      })
    );
  }

  return h('div', { style: { display: 'grid', gap: 'var(--space-3)' } },
    members.map(function (p, idx) {
      var rec = (cohort.records && cohort.records[p.id] && cohort.records[p.id][dayCfg.n]) || null;
      return h(ParticipantCard, {
        key: p.id,
        rowIdx: idx,
        participant: p,
        record: rec,
        dayCfg: dayCfg,
        onCellChange: onCellChange,
        toast: toast
      });
    })
  );
}

/**
 * کارت مجزای هر عضو جهت سرعت رندر بالا و عدم افت فریم (Memoized)
 */
var ParticipantCard = React.memo(function ParticipantCard(props) {
  var rowIdx = props.rowIdx;
  var p = props.participant;
  var rec = props.record;
  var dayCfg = props.dayCfg;
  var onCellChange = props.onCellChange;

  var habitCount = p.habitCount;
  var doneVal = rec && rec.done != null ? rec.done : null;
  var hardVal = rec && rec.hard != null ? rec.hard : null;
  var specialVal = rec && rec.special != null ? rec.special : 0;

  var hasRecord = rec && (rec.done != null || rec.hard != null || rec.special != null);
  var dayScoreVal = '—';
  if (hasRecord) {
    var sc = Scoring.dayScore(p, rec, dayCfg);
    var mx = Scoring.dayMax(p, dayCfg, rec);
    dayScoreVal = Names.toPersianDigits(sc) + ' از ' + Names.toPersianDigits(mx);
  }

  // آرایه گزینه‌های عادت (۰ تا habitCount)
  var habitOptions = [];
  if (habitCount != null) {
    for (var i = 0; i <= habitCount; i++) {
      habitOptions.push(i);
    }
  }

  // آرایه سطوح کار سخت (۰ تا hardLevels)
  var hardOptions = [];
  if (dayCfg.hardLevels > 0) {
    for (var hIdx = 0; hIdx <= dayCfg.hardLevels; hIdx++) {
      hardOptions.push(hIdx);
    }
  }

  return h(B.Card, {
    padding: 'md',
    style: {
      borderInlineStart: 'var(--space-1) solid ' + (hasRecord ? 'var(--border-success)' : 'var(--border-default)'),
      background: 'var(--surface-raised)'
    }
  },
    h('div', { style: { display: 'grid', gap: 'var(--space-3)' } },
      // سطر عنوان کارت: نام، وضعیت، و چیپ امتیاز زنده
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minInlineSize: 0, flexWrap: 'wrap' } },
          h('span', { className: 'caption', style: { color: 'var(--text-subtle)', minInlineSize: 'var(--space-5)' } }, Names.toPersianDigits(rowIdx + 1) + '.'),
          h('span', { className: 'body-md', style: { fontWeight: 700 } }, p.name),
          p.status === 'frozen' && h(B.Badge, { intent: 'info', emphasis: 'subtle' }, 'فریز'),
          p.status === 'left' && h(B.Badge, { intent: 'neutral', emphasis: 'subtle' }, 'خارج')
        ),
        h('div', { className: 'bsh-score-chip', 'data-recorded': hasRecord ? 'true' : 'false' }, dayScoreVal)
      ),

      // بخش ۱: عادت‌های انجام‌شده با دکمه‌های بزرگ لمسی
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          h('span', { className: 'caption', style: { color: 'var(--text-subtle)' } }, 'عادت‌های انجام‌شده:'),
          h('span', { className: 'caption', style: { color: 'var(--text-subtle)' } },
            habitCount != null ? ('سقف: ' + Names.toPersianDigits(habitCount) + ' عادت') : 'تعیین‌نشده'
          )
        ),
        habitCount == null ? (
          h('div', { className: 'caption', style: { color: 'var(--text-subtle)', padding: 'var(--space-1) 0' } }, 'تعداد عادت این فرد تعیین نشده است.')
        ) : (
          h('div', { className: 'bsh-opts' },
            habitOptions.map(function (opt) {
              var isSelected = doneVal === opt;
              return h('button', {
                key: opt,
                type: 'button',
                className: 'bsh-opt',
                'aria-pressed': isSelected,
                onClick: function () { onCellChange(p.id, 'done', isSelected ? null : opt); }
              }, Names.toPersianDigits(opt));
            })
          )
        )
      ),

      // بخش ۲: کار سخت
      dayCfg.hardLevels > 0 && h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' } },
        h('span', { className: 'caption', style: { color: 'var(--text-subtle)' } }, 'سطح کار سخت (سقف ' + Names.toPersianDigits(dayCfg.hardLevels) + '):'),
        h('div', { className: 'bsh-opts' },
          hardOptions.map(function (lvl) {
            var isSelected = hardVal === lvl;
            return h('button', {
              key: lvl,
              type: 'button',
              className: 'bsh-opt bsh-opt--hard',
              'aria-pressed': isSelected,
              onClick: function () { onCellChange(p.id, 'hard', isSelected ? null : lvl); }
            }, lvl === 0 ? '۰ (انجام نداد)' : ('سطح ' + Names.toPersianDigits(lvl)));
          })
        )
      ),

      // بخش ۳: مأموریت ویژه
      dayCfg.specialMission && h('div', { className: 'bsh-special-row' },
        h('span', { className: 'body-sm', style: { fontWeight: 500 } }, 'مأموریت ویژه انجام شد'),
        h(B.Switch, {
          checked: specialVal === 1,
          onChange: function (e) { onCellChange(p.id, 'special', e.target.checked ? 1 : 0); }
        })
      )
    )
  );
});

/**
 * جدول ورود سریع امتیازها مخصوص دسکتاپ با فوکوس سریع با فلش‌های کیبورد
 */
function DailyScoringTable(props) {
  var cohort = props.cohort;
  var dayCfg = props.dayCfg;
  var members = props.members;
  var onCellChange = props.onCellChange;
  var toast = props.toast;

  var inputRefs = React.useRef({});

  function focusNextRow(currentRowIdx, colName) {
    var nextRowIdx = currentRowIdx + 1;
    var nextRef = inputRefs.current[nextRowIdx + '_' + colName];
    if (nextRef) {
      nextRef.focus();
      if (nextRef.select) nextRef.select();
    }
  }

  function focusPrevRow(currentRowIdx, colName) {
    var prevRowIdx = currentRowIdx - 1;
    var prevRef = inputRefs.current[prevRowIdx + '_' + colName];
    if (prevRef) {
      prevRef.focus();
      if (prevRef.select) prevRef.select();
    }
  }

  if (!members.length) {
    return h(B.Card, { padding: 'lg' },
      h(B.EmptyState, {
        icon: 'User',
        title: 'عضوی برای ثبت امتیاز وجود ندارد',
        description: 'لطفاً ابتدا از تب «گروه‌ها»، اعضای این گروه را اضافه کنید.'
      })
    );
  }

  return h('div', {
    className: 'bsh-scoring-table-wrap bsh-table-scroll-container',
    style: {
      border: 'var(--border-width-thin) solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)'
    }
  },
    h('table', {
      className: 'bsh-table',
      style: { borderCollapse: 'collapse', width: '100%', minWidth: 'var(--container-md)' }
    },
      h('thead', null,
        h('tr', null,
          h('th', { className: 'label-sm', style: { width: 50, textAlign: 'center' } }, 'ردیف'),
          h('th', {
            className: 'label-sm bsh-sticky-right',
            style: {
              minWidth: 'calc(var(--space-12) * 3.5)'
            }
          }, 'نام و نام خانوادگی'),
          h('th', { className: 'label-sm is-num', style: { textAlign: 'center', width: 110 } }, 'عادت‌های انتخابی'),
          h('th', { className: 'label-sm is-num', style: { textAlign: 'center', width: 130 } }, 'عادت‌های انجام‌شده'),
          h('th', { className: 'label-sm is-num', style: { textAlign: 'center', width: 130 } }, 'کار سخت (۰ تا ' + Names.toPersianDigits(dayCfg.hardLevels) + ')'),
          h('th', { className: 'label-sm is-num', style: { textAlign: 'center', width: 110 } }, 'مأموریت ویژه'),
          h('th', { className: 'label-sm is-num', style: { textAlign: 'center', width: 110 } }, 'امتیاز امروز')
        )
      ),
      h('tbody', null,
        members.map(function (p, rowIdx) {
          var rec = (cohort.records && cohort.records[p.id] && cohort.records[p.id][dayCfg.n]) || null;
          return h(TableRowItem, {
            key: p.id,
            rowIdx: rowIdx,
            participant: p,
            record: rec,
            dayCfg: dayCfg,
            inputRefs: inputRefs,
            onCellChange: onCellChange,
            focusNextRow: focusNextRow,
            focusPrevRow: focusPrevRow,
            toast: toast
          });
        })
      )
    )
  );
}

/**
 * سطر جدول ثبت روزانه به صورت کامپوننت Memoized جهت جلوگیری از لگ در تایپ
 */
var TableRowItem = React.memo(function TableRowItem(props) {
  var rowIdx = props.rowIdx;
  var p = props.participant;
  var rec = props.record;
  var dayCfg = props.dayCfg;
  var inputRefs = props.inputRefs;
  var onCellChange = props.onCellChange;
  var focusNextRow = props.focusNextRow;
  var focusPrevRow = props.focusPrevRow;
  var toast = props.toast;

  var isHabitLocked = p.habitCount == null;
  var doneVal = rec && rec.done != null ? String(rec.done) : '';
  var hardVal = rec && rec.hard != null ? String(rec.hard) : '';
  var specialVal = rec && rec.special != null ? rec.special : 0;

  var dayScoreVal = '—';
  if (rec && (rec.done != null || rec.hard != null || rec.special != null)) {
    var sc = Scoring.dayScore(p, rec, dayCfg);
    var mx = Scoring.dayMax(p, dayCfg, rec);
    dayScoreVal = Names.toPersianDigits(sc) + ' از ' + Names.toPersianDigits(mx);
  }

  return h('tr', null,
    // ردیف
    h('td', { className: 'body-sm is-num', style: { textAlign: 'center', color: 'var(--text-subtle)' } },
      Names.toPersianDigits(rowIdx + 1)
    ),
    // نام چسبان
    h('td', {
      className: 'body-sm bsh-sticky-right',
      style: {
        fontWeight: 600,
        borderInlineEnd: 'var(--border-width-thin) solid var(--border-subtle)'
      }
    },
      p.name,
      p.status === 'frozen' && h('span', { className: 'caption', style: { color: 'var(--text-info)', marginInlineStart: 'var(--space-1)' } }, '(فریز)'),
      p.status === 'left' && h('span', { className: 'caption', style: { color: 'var(--text-subtle)', marginInlineStart: 'var(--space-1)' } }, '(خارج)')
    ),
    // عادت‌های انتخابی
    h('td', { className: 'body-sm is-num', style: { textAlign: 'center' } },
      p.habitCount != null
        ? Names.toPersianDigits(p.habitCount) + ' عادت'
        : h('span', { className: 'caption', style: { color: 'var(--text-subtle)' } }, '— (تعیین نشده)')
    ),
    // عادت‌های انجام‌شده
    h('td', { style: { textAlign: 'center' } },
      isHabitLocked ? (
        h('span', { className: 'caption', style: { color: 'var(--text-subtle)' } }, '—')
      ) : (
        h('input', {
          ref: function (el) { inputRefs.current[rowIdx + '_done'] = el; },
          type: 'text',
          inputMode: 'numeric',
          className: 'bsh-field__input bsh-cell-input body-md',
          value: doneVal !== '' ? Names.toPersianDigits(doneVal) : '',
          placeholder: '—',
          onChange: function (e) {
            var raw = e.target.value;
            if (!raw) {
              onCellChange(p.id, 'done', null);
              return;
            }
            var latin = Names.toLatinDigits(raw);
            var d = parseInt(latin, 10);
            if (isNaN(d)) return;

            if (d > p.habitCount) {
              if (toast) toast.show({ intent: 'danger', message: 'انجام‌شده‌ها نمی‌تواند از انتخابی‌ها بیشتر باشد.' });
              return;
            }
            onCellChange(p.id, 'done', d);
            focusNextRow(rowIdx, 'done');
          },
          onKeyDown: function (e) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
              e.preventDefault();
              focusNextRow(rowIdx, 'done');
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              focusPrevRow(rowIdx, 'done');
            }
          }
        })
      )
    ),
    // کار سخت
    h('td', { style: { textAlign: 'center' } },
      dayCfg.hardLevels === 0 ? (
        h('span', { className: 'caption', style: { color: 'var(--text-subtle)' } }, 'ندارد')
      ) : (
        h('input', {
          ref: function (el) { inputRefs.current[rowIdx + '_hard'] = el; },
          type: 'text',
          inputMode: 'numeric',
          className: 'bsh-field__input bsh-cell-input body-md',
          value: hardVal !== '' ? Names.toPersianDigits(hardVal) : '',
          placeholder: '—',
          onChange: function (e) {
            var raw = e.target.value;
            if (!raw) {
              onCellChange(p.id, 'hard', null);
              return;
            }
            var latin = Names.toLatinDigits(raw);
            var hVal = parseInt(latin, 10);
            if (isNaN(hVal)) return;

            if (hVal > dayCfg.hardLevels) {
              if (toast) toast.show({ intent: 'danger', message: 'سطح کار سخت نمی‌تواند از سقف روز (' + Names.toPersianDigits(dayCfg.hardLevels) + ') بیشتر باشد.' });
              return;
            }
            onCellChange(p.id, 'hard', hVal);
            focusNextRow(rowIdx, 'hard');
          },
          onKeyDown: function (e) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
              e.preventDefault();
              focusNextRow(rowIdx, 'hard');
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              focusPrevRow(rowIdx, 'hard');
            }
          }
        })
      )
    ),
    // مأموریت ویژه
    h('td', { style: { textAlign: 'center' } },
      !dayCfg.specialMission ? (
        h('span', { className: 'caption', style: { color: 'var(--text-subtle)' } }, 'ندارد')
      ) : (
        h(B.Checkbox, {
          checked: specialVal === 1,
          onChange: function (e) {
            onCellChange(p.id, 'special', e.target.checked ? 1 : 0);
          }
        })
      )
    ),
    // امتیاز زنده
    h('td', {
      className: 'body-md is-num',
      style: {
        textAlign: 'center',
        fontWeight: 600,
        color: dayScoreVal === '—' ? 'var(--text-subtle)' : 'var(--text-success)'
      }
    }, dayScoreVal)
  );
});

/**
 * دیالوگ دانلود اکسل گروه برای یک روز
 */
function ExcelGroupDayExportModal(props) {
  var open = props.open;
  var cohort = props.cohort;
  var group = props.group;
  var dayN = props.dayN;
  var isDayClosed = props.isDayClosed;
  var onClose = props.onClose;
  var toast = props.toast;

  var [includeFrozen, setIncludeFrozen] = React.useState(false);
  var [loading, setLoading] = React.useState(false);

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
        if (toast) toast.show({ intent: 'danger', message: err.message });
      });
  }

  var footer = h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' } },
    h(B.Button, { variant: 'ghost', onClick: onClose }, 'انصراف'),
    h(B.Button, {
      variant: 'primary',
      loading: loading,
      onClick: handleDownload
    }, 'دانلود فایل اکسل')
  );

  return h(B.Dialog, {
    open: open,
    onClose: onClose,
    title: 'دانلود اکسل گزارش روز ' + Names.toPersianDigits(dayN) + ' — ' + group.name,
    description: 'این فایل برای اشتراک‌گذاری در گروه تلگرام طراحی شده و هیچ اطلاعات خصوصی ندارد.',
    footer: footer,
    size: 'sm'
  },
    h('div', { style: { display: 'grid', gap: 'var(--space-3)', padding: 'var(--space-2) 0' } },
      !isDayClosed && h(B.Alert, { intent: 'warning', title: 'روز هنوز بسته نشده است' },
        'این روز هنوز بسته نشده و گزارش با برچسب «پیش‌نویس» تولید خواهد شد. آیا ادامه می‌دهید؟'
      ),
      h(B.Checkbox, {
        label: 'افراد فریز‌شده و خارج‌شده هم در گزارش بیایند',
        checked: includeFrozen,
        onChange: function (e) { setIncludeFrozen(e.target.checked); }
      })
    )
  );
}

export const UIDaily = {
  DailyScoringTab: DailyScoringTab
};
