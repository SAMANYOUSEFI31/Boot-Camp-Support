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
  var Scoring = SupportApp.Scoring || {};
  var Excel = SupportApp.Excel || {};
  var ImageExport = SupportApp.ImageExport || {};

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

    var [selectedGroupId, setSelectedGroupId] = root.React.useState(myGroups[0] ? myGroups[0].id : null);
    var [selectedDayN, setSelectedDayN] = root.React.useState(calculateCurrentDayNumber(cohort.startDate));
    var [showFrozen, setShowFrozen] = root.React.useState(false);
    var [saveIndicator, setSaveIndicator] = root.React.useState(false);

    // حالت نمایش: در موبایل پیش‌فرض 'cards' و در دسکتاپ 'table'
    var isSmallScreen = typeof window !== 'undefined' ? window.innerWidth < 680 : false;
    var [viewMode, setViewMode] = root.React.useState(isSmallScreen ? 'cards' : 'table');

    // دیالوگ بستن روز
    var [closeDayModalOpen, setCloseDayModalOpen] = root.React.useState(false);
    var [clearDayConfirmOpen, setClearDayConfirmOpen] = root.React.useState(false);

    // دیالوگ‌های خروجی
    var [exportModalOpen, setExportModalOpen] = root.React.useState(false);
    var [imageModalOpen, setImageModalOpen] = root.React.useState(false);
    var [imagePreviewData, setImagePreviewData] = root.React.useState(null);
    var [isGeneratingImage, setIsGeneratingImage] = root.React.useState(false);

    root.React.useEffect(function () {
      if (myGroups.length && (!selectedGroupId || !myGroups.find(function (g) { return g.id === selectedGroupId; }))) {
        setSelectedGroupId(myGroups[0].id);
      }
    }, [myGroups.length, selectedGroupId]);

    // پاسخگویی به تغییر اندازه پنجره
    root.React.useEffect(function () {
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

    return h('div', { style: { display: 'grid', gap: 'var(--space-4)', paddingBottom: 'var(--space-12)' } },
      // ۱. نوار کنترل بالای صفحه
      h(B.Card, { padding: 'md' },
        h('div', {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--space-3)',
            flexWrap: 'wrap'
          }
        },
          // انتخاب گروه با اسکرول افقی نرم
          h('div', { style: { maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' } },
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
                borderRadius: 'var(--radius-md)'
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
              label: 'روز بعد',
              disabled: selectedDayN >= 30,
              onClick: function () { setSelectedDayN(function (prev) { return Math.min(30, prev + 1); }); }
            })
          ),

          // دکمه‌های اکشن اصلی و خروجی‌ها (فقط یک دکمه اصلی مجاز است)
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' } },
            saveIndicator && h('span', {
              className: 'caption',
              style: { color: 'var(--emerald-400)', display: 'flex', alignItems: 'center', gap: 4 }
            },
              h(B.Icon, { name: 'Check', size: 'xs' }),
              'ذخیره شد'
            ),

            // خروجی تصویر (ثانویه)
            h(B.Button, {
              variant: 'secondary',
              size: 'sm',
              iconStart: 'Image',
              loading: isGeneratingImage,
              onClick: function () { handleGenerateImage(showFrozen); }
            }, 'خروجی تصویر'),

            // خروجی اکسل (ثانویه)
            h(B.Button, {
              variant: 'secondary',
              size: 'sm',
              iconStart: 'Share2',
              onClick: function () { setExportModalOpen(true); }
            }, 'خروجی Excel'),

            // خروجی هر دو (ثانویه)
            h(B.Button, {
              variant: 'secondary',
              size: 'sm',
              iconStart: 'FolderArchive',
              loading: isGeneratingImage,
              onClick: function () { handleExportBoth(showFrozen); }
            }, 'خروجی هر دو'),

            // دکمه بستن روز (تنها دکمه اصلی صفحه)
            isDayClosed ? (
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
            )
          )
        )
      ),

      // ۲. هدر پیشرفت ثبت روزانه (چسبان و شکیل)
      dayCfg.type === 'main' && h('div', {
        style: {
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3) var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)'
        }
      },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)' } },
            h('span', { className: 'label-md' }, 'پیشرفت ثبت گروه:'),
            h('span', { className: 'body-md', style: { fontWeight: 700, color: progressPercent === 100 ? 'var(--emerald-400)' : 'var(--text-base)' } },
              Names.toPersianDigits(recordedMembersCount) + ' از ' + Names.toPersianDigits(totalMembersCount) + ' نفر ثبت شد (' + Names.toPersianDigits(progressPercent) + '٪)'
            )
          ),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-3)' } },
            // سوئیچ نمای کارتی / جدولی
            h('div', { style: { display: 'flex', background: 'var(--surface-overlay)', borderRadius: 'var(--radius-sm)', padding: 2 } },
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
        // نوار میله‌ای پیشرفت
        h('div', {
          style: {
            width: '100%',
            height: 6,
            background: 'var(--surface-overlay)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden'
          }
        },
          h('div', {
            style: {
              width: progressPercent + '%',
              height: '100%',
              background: progressPercent === 100 ? 'var(--emerald-500)' : 'var(--brand-500)',
              transition: 'width 0.3s ease'
            }
          })
        )
      ),

      // نوار ابزارهای گروهی
      dayCfg.type === 'main' && h('div', {
        style: {
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
          gap: 'var(--space-2)',
          flexWrap: 'wrap'
        }
      },
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

      // نوار ثابت پایین برای موبایل جهت ثبت آسان با یک دست
      isSmallScreen && h('div', {
        style: {
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          background: 'var(--surface-raised)',
          borderTop: '1px solid var(--border-default)',
          padding: 'var(--space-2) var(--space-4)',
          paddingBottom: 'calc(var(--space-2) + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.4)'
        }
      },
        h('div', { style: { display: 'flex', gap: 'var(--space-2)' } },
          h(B.Button, {
            variant: 'secondary',
            size: 'sm',
            iconStart: 'Image',
            onClick: function () { handleGenerateImage(showFrozen); }
          }, 'تصویر'),
          h(B.Button, {
            variant: 'secondary',
            size: 'sm',
            iconStart: 'Share2',
            onClick: function () { setExportModalOpen(true); }
          }, 'اکسل')
        ),
        isDayClosed ? (
          h(B.Button, {
            variant: 'ghost',
            size: 'sm',
            onClick: function () {
              Store.toggleCloseDay(cohort.id, activeGroup.id, selectedDayN, false);
              if (toast) toast.show({ intent: 'info', message: 'روز باز شد.' });
            }
          }, 'باز کردن روز')
        ) : (
          h(B.Button, {
            variant: 'primary',
            size: 'sm',
            iconStart: 'CircleCheck',
            onClick: function () { setCloseDayModalOpen(true); }
          }, 'بستن روز')
        )
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
  var ParticipantCard = root.React.memo(function ParticipantCard(props) {
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
        borderRight: hasRecord ? '4px solid var(--emerald-500)' : '4px solid var(--border-default)',
        background: 'var(--surface-raised)'
      }
    },
      h('div', { style: { display: 'grid', gap: 'var(--space-3)' } },
        // سطر عنوان کارت: نام، وضعیت، و چیپ امتیاز زنده
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)' } },
            h('span', { className: 'caption', style: { color: 'var(--text-muted)', minWidth: 20 } }, Names.toPersianDigits(rowIdx + 1) + '.'),
            h('span', { className: 'body-md', style: { fontWeight: 700 } }, p.name),
            p.status === 'frozen' && h(B.Badge, { intent: 'info', emphasis: 'subtle' }, 'فریز'),
            p.status === 'left' && h(B.Badge, { intent: 'neutral', emphasis: 'subtle' }, 'خارج')
          ),
          h('div', {
            style: {
              background: hasRecord ? 'var(--emerald-950)' : 'var(--surface-overlay)',
              color: hasRecord ? 'var(--emerald-400)' : 'var(--text-muted)',
              border: '1px solid ' + (hasRecord ? 'var(--emerald-800)' : 'var(--border-subtle)'),
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: '13px'
            }
          }, dayScoreVal)
        ),

        // بخش ۱: عادت‌های انجام‌شده با دکمه‌های بزرگ لمسی
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' } },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            h('span', { className: 'caption', style: { color: 'var(--text-muted)' } }, 'عادت‌های انجام‌شده:'),
            h('span', { className: 'caption', style: { color: 'var(--text-muted)' } },
              habitCount != null ? ('سقف: ' + Names.toPersianDigits(habitCount) + ' عادت') : 'تعیین‌نشده'
            )
          ),
          habitCount == null ? (
            h('div', { className: 'caption', style: { color: 'var(--text-muted)', padding: 'var(--space-1) 0' } }, 'تعداد عادت این فرد تعیین نشده است.')
          ) : (
            h('div', { style: { display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' } },
              habitOptions.map(function (opt) {
                var isSelected = doneVal === opt;
                return h('button', {
                  key: opt,
                  type: 'button',
                  onClick: function () { onCellChange(p.id, 'done', isSelected ? null : opt); },
                  style: {
                    minWidth: 44,
                    minHeight: 44,
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid ' + (isSelected ? 'var(--brand-500)' : 'var(--border-default)'),
                    background: isSelected ? 'var(--brand-500)' : 'var(--surface-overlay)',
                    color: isSelected ? '#ffffff' : 'var(--text-base)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 16
                  }
                }, Names.toPersianDigits(opt));
              })
            )
          )
        ),

        // بخش ۲: کار سخت
        dayCfg.hardLevels > 0 && h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' } },
          h('span', { className: 'caption', style: { color: 'var(--text-muted)' } }, 'سطح کار سخت (سقف ' + Names.toPersianDigits(dayCfg.hardLevels) + '):'),
          h('div', { style: { display: 'flex', gap: 'var(--space-2)' } },
            hardOptions.map(function (lvl) {
              var isSelected = hardVal === lvl;
              return h('button', {
                key: lvl,
                type: 'button',
                onClick: function () { onCellChange(p.id, 'hard', isSelected ? null : lvl); },
                style: {
                  minWidth: 44,
                  minHeight: 44,
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid ' + (isSelected ? 'var(--emerald-500)' : 'var(--border-default)'),
                  background: isSelected ? 'var(--emerald-600)' : 'var(--surface-overlay)',
                  color: isSelected ? '#ffffff' : 'var(--text-base)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 15
                }
              }, lvl === 0 ? '۰ (انجام نداد)' : ('سطح ' + Names.toPersianDigits(lvl)));
            })
          )
        ),

        // بخش ۳: مأموریت ویژه
        dayCfg.specialMission && h('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface-overlay)',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-md)',
            minHeight: 44
          }
        },
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

    var inputRefs = root.React.useRef({});

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
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)'
      }
    },
      h('table', {
        className: 'bsh-table',
        style: { borderCollapse: 'collapse', width: '100%', minWidth: 720 }
      },
        h('thead', null,
          h('tr', null,
            h('th', { className: 'label-sm', style: { width: 50, textAlign: 'center' } }, 'ردیف'),
            h('th', {
              className: 'label-sm bsh-sticky-right',
              style: {
                background: 'var(--surface-raised)',
                minWidth: 170
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
  var TableRowItem = root.React.memo(function TableRowItem(props) {
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
      h('td', { className: 'body-sm is-num', style: { textAlign: 'center', color: 'var(--text-muted)' } },
        Names.toPersianDigits(rowIdx + 1)
      ),
      // نام چسبان
      h('td', {
        className: 'body-sm bsh-sticky-right',
        style: {
          background: 'var(--surface-raised)',
          fontWeight: 600,
          borderLeft: '1px solid var(--border-subtle)'
        }
      },
        p.name,
        p.status === 'frozen' && h('span', { className: 'caption', style: { color: 'var(--sky-400)', marginRight: 4 } }, '(فریز)'),
        p.status === 'left' && h('span', { className: 'caption', style: { color: 'var(--neutral-400)', marginRight: 4 } }, '(خارج)')
      ),
      // عادت‌های انتخابی
      h('td', { className: 'body-sm is-num', style: { textAlign: 'center' } },
        p.habitCount != null
          ? Names.toPersianDigits(p.habitCount) + ' عادت'
          : h('span', { className: 'caption', style: { color: 'var(--text-muted)' } }, '— (تعیین نشده)')
      ),
      // عادت‌های انجام‌شده
      h('td', { style: { textAlign: 'center' } },
        isHabitLocked ? (
          h('span', { className: 'caption', style: { color: 'var(--text-muted)' } }, '—')
        ) : (
          h('input', {
            ref: function (el) { inputRefs.current[rowIdx + '_done'] = el; },
            type: 'text',
            inputMode: 'numeric',
            className: 'bsh-field__input body-md',
            style: { width: 56, height: 38, textAlign: 'center', margin: '0 auto', padding: '4px' },
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
          h('span', { className: 'caption', style: { color: 'var(--text-muted)' } }, 'ندارد')
        ) : (
          h('input', {
            ref: function (el) { inputRefs.current[rowIdx + '_hard'] = el; },
            type: 'text',
            inputMode: 'numeric',
            className: 'bsh-field__input body-md',
            style: { width: 56, height: 38, textAlign: 'center', margin: '0 auto', padding: '4px' },
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
          h('span', { className: 'caption', style: { color: 'var(--text-muted)' } }, 'ندارد')
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
          color: dayScoreVal === '—' ? 'var(--text-muted)' : 'var(--emerald-400)'
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

    var [includeFrozen, setIncludeFrozen] = root.React.useState(false);
    var [loading, setLoading] = root.React.useState(false);

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

  SupportApp.UIDaily = {
    DailyScoringTab: DailyScoringTab
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupportApp.UIDaily;
  }
})(typeof window !== 'undefined' ? window : globalThis);
