/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { B } from '../bushido';
import { Names } from '../names';
import { Store } from '../store';
import { Excel } from '../excel';
import { errorMessage } from '../errors';
import { ImageExport, ImagePreviewModal, type ImagesData } from '../image-export';
import type { Cohort, DayConfig, DayRecord, Group, Toast } from '../types';
import type { CellChange } from './types';
import { DailyScoringCardView } from './ParticipantCards';
import { DailyScoringTable } from './ScoringTable';
import { ExcelGroupDayExportModal } from './ExcelExportModal';
import { HelpHint } from '../help-hint';

/**
 * محاسبه روز جاری نسبت به تاریخ شروع دوره (۱ تا ۳۰)
 */
export function calculateCurrentDayNumber(startDateIso: string | null | undefined): number {
  if (!startDateIso) return 8;
  try {
    const start = new Date(startDateIso + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
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
export function DailyScoringTab(props: { cohort: Cohort; toast?: Toast; onGoToGroups?: () => void }) {
  const cohort = props.cohort;
  const toast = props.toast;

  let myGroups: Group[] = (cohort.groups || []).filter(function (g) {
    return g.mine;
  });
  if (!myGroups.length) {
    myGroups = cohort.groups || [];
  }

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(myGroups[0] ? myGroups[0].id : null);
  const [selectedDayN, setSelectedDayN] = useState(calculateCurrentDayNumber(cohort.startDate));
  const [showFrozen, setShowFrozen] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState(false);

  // حالت نمایش: در موبایل پیش‌فرض 'cards' و در دسکتاپ 'table'
  const isSmallScreen = typeof window !== 'undefined' ? window.innerWidth < 680 : false;
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(isSmallScreen ? 'cards' : 'table');

  // دیالوگ بستن روز
  const [closeDayModalOpen, setCloseDayModalOpen] = useState(false);
  const [clearDayConfirmOpen, setClearDayConfirmOpen] = useState(false);

  // دیالوگ‌های خروجی
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imagePreviewData, setImagePreviewData] = useState<ImagesData | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  useEffect(
    function () {
      if (
        myGroups.length &&
        (!selectedGroupId ||
          !myGroups.find(function (g) {
            return g.id === selectedGroupId;
          }))
      ) {
        setSelectedGroupId(myGroups[0].id);
      }
    },
    [myGroups.length, selectedGroupId]
  );

  // پاسخگویی به تغییر اندازه پنجره
  useEffect(
    function () {
      function onResize() {
        if (window.innerWidth < 680 && viewMode === 'table') {
          setViewMode('cards');
        }
      }
      window.addEventListener('resize', onResize);
      return function () {
        window.removeEventListener('resize', onResize);
      };
    },
    [viewMode]
  );

  const activeGroup =
    myGroups.find(function (g) {
      return g.id === selectedGroupId;
    }) ||
    myGroups[0] ||
    null;

  if (!activeGroup) {
    return (
      <B.Card padding="lg">
        <B.EmptyState
          icon="Flame"
          title="هنوز گروهی نیست"
          description="در تب «گروه‌ها و افراد» یک گروه بساز، بعد به اینجا برگرد."
        />
      </B.Card>
    );
  }

  const dayCfg: DayConfig = (cohort.days || []).find(function (d) {
    return d.n === selectedDayN;
  }) || {
    n: selectedDayN,
    type: selectedDayN <= 7 ? 'warmup' : selectedDayN >= 29 ? 'review' : 'main',
    hardLevels: 3,
    specialMission: true
  };

  const closedDays = activeGroup.closedDays || [];
  const isDayClosed = closedDays.indexOf(selectedDayN) !== -1;

  const dayDate = Names.addDaysToIso(cohort.startDate, selectedDayN - 1);
  const dayShamsi = Names.formatShamsiShort(dayDate);

  const todayDayN = calculateCurrentDayNumber(cohort.startDate);
  const dayTypeName = dayCfg.type === 'warmup' ? 'گرم‌کردن' : dayCfg.type === 'review' ? 'مرور' : 'اصلی';

  const members = (cohort.participants || []).filter(function (p) {
    if (p.groupId !== activeGroup.id) return false;
    if (!showFrozen && (p.status === 'frozen' || p.status === 'left')) return false;
    return true;
  });

  // ذخیره کم‌سروصدا
  function triggerSaveIndicator() {
    setSaveIndicator(true);
    setTimeout(function () {
      setSaveIndicator(false);
    }, 1500);
  }

  // ثبت یک فیلد
  const handleCellChange: CellChange = function (pId, field, value) {
    const patch: Partial<DayRecord> = {};
    patch[field] = value;
    Store.recordDaily(cohort.id, pId, selectedDayN, patch);
    triggerSaveIndicator();
  };

  // ابزارهای گروهی
  function handleBatchAction(
    actionName: 'all_habits_done' | 'all_special_done' | 'clear_day',
    message: string
  ) {
    const rollbackFn = Store.batchRecordDay(cohort.id, activeGroup.id, selectedDayN, actionName);
    triggerSaveIndicator();
    if (toast && rollbackFn) {
      toast.show({
        intent: 'success',
        message: message,
        action: {
          label: 'برگردان',
          onClick: rollbackFn
        },
        duration: 10000
      });
    }
  }

  // تولید تصویر با Canvas API
  function handleGenerateImage(includeFrozenOpt?: boolean) {
    setIsGeneratingImage(true);
    ImageExport.generateGroupDayReportImages(cohort, activeGroup, selectedDayN, includeFrozenOpt || false)
      .then(function (result) {
        setIsGeneratingImage(false);
        setImagePreviewData(result);
        setImageModalOpen(true);
      })
      .catch(function (err) {
        setIsGeneratingImage(false);
        if (toast)
          toast.show({
            intent: 'danger',
            message: 'تصویر ساخته نشد (' + errorMessage(err) + '). دوباره امتحان کن.'
          });
      });
  }

  // خروجی ترکیبی اکسل و تصویر
  function handleExportBoth(includeFrozenOpt?: boolean) {
    setIsGeneratingImage(true);
    Excel.exportGroupDayReport(cohort, activeGroup, selectedDayN, includeFrozenOpt || false)
      .then(function () {
        return ImageExport.generateGroupDayReportImages(
          cohort,
          activeGroup,
          selectedDayN,
          includeFrozenOpt || false
        );
      })
      .then(function (result) {
        setIsGeneratingImage(false);
        setImagePreviewData(result);
        setImageModalOpen(true);
        if (toast) toast.show({ intent: 'success', message: 'Excel دانلود شد و تصویر آماده است.' });
      })
      .catch(function (err) {
        setIsGeneratingImage(false);
        if (toast) toast.show({ intent: 'danger', message: errorMessage(err) });
      });
  }

  // محاسبه آمار ثبت‌شده‌ها
  const recordedMembersCount = members.filter(function (p) {
    const rec = cohort.records && cohort.records[p.id] && cohort.records[p.id][selectedDayN];
    return rec && (rec.done != null || rec.hard != null || rec.special != null);
  }).length;

  const totalMembersCount = members.length;
  const unrecordedCount = totalMembersCount - recordedMembersCount;
  const missingHabit = members.filter(function (p) {
    return p.status === 'active' && p.habitCount == null;
  }).length;
  const progressPercent =
    totalMembersCount > 0 ? Math.round((recordedMembersCount / totalMembersCount) * 100) : 0;

  // «بستن روز» تنها دکمهٔ اصلی صفحه است؛ در هر عرض فقط یک نسخهٔ آن دیده می‌شود
  const closeDayButton = isDayClosed ? (
    <B.Button
      variant="ghost"
      size="sm"
      onClick={function () {
        Store.toggleCloseDay(cohort.id, activeGroup.id, selectedDayN, false);
        if (toast) toast.show({ intent: 'info', message: 'روز دوباره باز شد؛ از مجموع کنار رفت.' });
      }}
    >
      باز کردن دوباره روز
    </B.Button>
  ) : (
    <B.Button
      variant="primary"
      size="sm"
      iconStart="CircleCheck"
      onClick={function () {
        setCloseDayModalOpen(true);
      }}
    >
      بستن روز
    </B.Button>
  );

  return (
    <div className="bsh-stack bsh-daily">
      <B.Card padding="md">
        <div className="bsh-row" style={{ justifyContent: 'space-between' }}>
          <div
            style={{
              maxWidth: '100%',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              paddingBlock: 'var(--space-1)'
            }}
          >
            {myGroups.length > 5 ? (
              <B.Select
                label="گروه"
                options={myGroups.map(function (g) {
                  return { value: g.id, label: g.name };
                })}
                value={activeGroup.id}
                onChange={function (e) {
                  setSelectedGroupId(e.target.value);
                }}
              />
            ) : (
              <B.SegmentedControl
                label="انتخاب گروه"
                items={myGroups.map(function (g) {
                  return { id: g.id, label: g.name };
                })}
                value={activeGroup.id}
                onChange={function (id) {
                  setSelectedGroupId(id);
                }}
              />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <B.IconButton
              icon="ChevronRight"
              flip={true}
              style={{ flex: 'none' }}
              label="روز قبل"
              disabled={selectedDayN <= 1}
              onClick={function () {
                setSelectedDayN(function (prev) {
                  return Math.max(1, prev - 1);
                });
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                background: 'var(--surface-overlay)',
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'grid' }}>
                <span className="heading-xs">{'روز ' + Names.toPersianDigits(selectedDayN)}</span>
                <span className="caption" style={{ color: 'var(--text-subtle)' }}>
                  <bdi>{dayShamsi}</bdi>
                  {' — روز ' + dayTypeName}
                </span>
              </div>
              <HelpHint help="dayTypes" />
              {isDayClosed ? (
                <B.Badge intent="success" emphasis="bold" icon="Check">
                  بسته شده
                </B.Badge>
              ) : (
                <B.Badge intent="warning" emphasis="subtle" icon="Info">
                  باز
                </B.Badge>
              )}
              <HelpHint help="closeDay" />
            </div>
            {selectedDayN !== todayDayN && (
              <B.Button
                variant="ghost"
                size="sm"
                onClick={function () {
                  setSelectedDayN(todayDayN);
                }}
              >
                برو به امروز
              </B.Button>
            )}
            <B.IconButton
              icon="ChevronLeft"
              flip={true}
              style={{ flex: 'none' }}
              label="روز بعد"
              disabled={selectedDayN >= 30}
              onClick={function () {
                setSelectedDayN(function (prev) {
                  return Math.min(30, prev + 1);
                });
              }}
            />
          </div>
          {saveIndicator && (
            <span
              className="caption"
              style={{
                color: 'var(--text-success)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)'
              }}
            >
              <B.Icon name="Check" size="xs" />
              ذخیره شد
            </span>
          )}
          <div
            className="bsh-wide-only"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}
          >
            <B.Button
              variant="secondary"
              size="sm"
              loading={isGeneratingImage}
              onClick={function () {
                handleGenerateImage(showFrozen);
              }}
            >
              دانلود تصویر گروه
            </B.Button>
            <B.Button
              variant="secondary"
              size="sm"
              iconStart="Share2"
              onClick={function () {
                setExportModalOpen(true);
              }}
            >
              دانلود Excel گروه
            </B.Button>
            <B.Button
              variant="secondary"
              size="sm"
              loading={isGeneratingImage}
              onClick={function () {
                handleExportBoth(showFrozen);
              }}
            >
              دانلود هر دو
            </B.Button>
            {closeDayButton}
          </div>
        </div>
      </B.Card>
      {dayCfg.type === 'main' && (
        <div className="bsh-progress">
          <div className="bsh-row" style={{ justifyContent: 'space-between' }}>
            <div className="bsh-row" style={{ gap: 'var(--space-2)' }}>
              <span className="label-md">ثبت‌شده در این روز:</span>
              <span
                className="body-md"
                style={{
                  fontWeight: 700,
                  color: progressPercent === 100 ? 'var(--text-success)' : 'var(--text-default)'
                }}
              >
                {Names.toPersianDigits(recordedMembersCount) +
                  ' از ' +
                  Names.toPersianDigits(totalMembersCount) +
                  ' نفر (' +
                  Names.toPersianDigits(progressPercent) +
                  '٪)'}
              </span>
              <HelpHint help="scoring" visibleLabel />
            </div>
            <div className="bsh-row">
              <div
                className="bsh-wide-only"
                style={{
                  display: 'flex',
                  background: 'var(--surface-overlay)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 'var(--space-0\\.5)'
                }}
              >
                <B.Button
                  variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={function () {
                    setViewMode('cards');
                  }}
                >
                  نمای کارتی
                </B.Button>
                <B.Button
                  variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={function () {
                    setViewMode('table');
                  }}
                >
                  نمای جدولی
                </B.Button>
                <HelpHint help="viewMode" />
              </div>
              <B.Switch
                label="نمایش فریز و خارج‌شده‌ها"
                checked={showFrozen}
                onChange={function (e) {
                  setShowFrozen(e.target.checked);
                }}
              />
              <HelpHint help="frozen" />
            </div>
          </div>
          <div
            className="bsh-progress__track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            aria-label="درصد افراد ثبت‌شده در این روز"
          >
            <div
              className={'bsh-progress__fill' + (progressPercent === 100 ? ' is-complete' : '')}
              style={{ inlineSize: progressPercent + '%' }}
            />
          </div>
        </div>
      )}
      {dayCfg.type === 'main' && missingHabit > 0 && (
        <B.Alert
          intent="warning"
          title={Names.toPersianDigits(missingHabit) + ' نفر تعداد عادت ندارند'}
          action={
            props.onGoToGroups ? (
              <B.Button size="sm" variant="secondary" onClick={props.onGoToGroups}>
                تعیین تعداد عادت
              </B.Button>
            ) : undefined
          }
        >
          تا تعداد عادتشان تعیین نشود، عادت‌هایشان ثبت نمی‌شود.
        </B.Alert>
      )}
      {dayCfg.type === 'main' && (
        <div className="bsh-batch-bar">
          <B.Button
            variant="ghost"
            size="sm"
            onClick={function () {
              handleBatchAction('all_habits_done', 'عادت‌های همهٔ افراد فعال ثبت شد.');
            }}
          >
            همهٔ عادت‌ها انجام شد
          </B.Button>
          <B.Button
            variant="ghost"
            size="sm"
            onClick={function () {
              handleBatchAction('all_special_done', 'گزارش هدف همهٔ افراد فعال ثبت شد.');
            }}
          >
            گزارش هدف همه انجام شد
          </B.Button>
          <B.Button
            variant="ghost"
            size="sm"
            onClick={function () {
              setClearDayConfirmOpen(true);
            }}
          >
            پاک کردن ثبت‌های این روز
          </B.Button>
        </div>
      )}
      {dayCfg.type !== 'main' ? (
        <B.Card padding="lg">
          <B.EmptyState
            icon="Info"
            title="این روز امتیاز ندارد"
            description={
              dayCfg.type === 'warmup'
                ? 'این روز «گرم‌کردن» است و امتیاز ندارد. فقط روزهای اصلی ثبت می‌شوند.'
                : 'این روز «مرور» است و امتیاز ندارد. فقط روزهای اصلی ثبت می‌شوند.'
            }
          />
        </B.Card>
      ) : viewMode === 'cards' ? (
        <DailyScoringCardView
          cohort={cohort}
          group={activeGroup}
          dayCfg={dayCfg}
          members={members}
          onCellChange={handleCellChange}
          toast={toast}
        />
      ) : (
        <DailyScoringTable
          cohort={cohort}
          group={activeGroup}
          dayCfg={dayCfg}
          members={members}
          onCellChange={handleCellChange}
          toast={toast}
        />
      )}
      <div className="bsh-daily-bar">
        <B.Menu
          label="دانلود گزارش گروه"
          side="top"
          trigger={
            <B.Button variant="secondary" size="sm" iconStart="Share2">
              دانلود گزارش
            </B.Button>
          }
          items={[
            {
              label: 'دانلود تصویر گروه',
              onSelect: function () {
                handleGenerateImage(showFrozen);
              }
            },
            {
              label: 'دانلود Excel گروه',
              onSelect: function () {
                setExportModalOpen(true);
              }
            },
            {
              label: 'دانلود هر دو',
              onSelect: function () {
                handleExportBoth(showFrozen);
              }
            }
          ]}
        />
        {closeDayButton}
      </div>
      {closeDayModalOpen && (
        <B.Dialog
          open={closeDayModalOpen}
          onClose={function () {
            setCloseDayModalOpen(false);
          }}
          title={'بستن روز ' + Names.toPersianDigits(selectedDayN)}
          description="امتیاز این روز در مجموع و درصد افراد گروه حساب می‌شود. هر وقت خواستی می‌شود روز را دوباره باز کرد."
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <B.Button
                variant="ghost"
                onClick={function () {
                  setCloseDayModalOpen(false);
                }}
              >
                انصراف
              </B.Button>
              <B.Button
                variant="primary"
                onClick={function () {
                  Store.toggleCloseDay(cohort.id, activeGroup.id, selectedDayN, true);
                  setCloseDayModalOpen(false);
                  if (toast)
                    toast.show({
                      intent: 'success',
                      message: 'روز ' + Names.toPersianDigits(selectedDayN) + ' بسته شد.',
                      action:
                        selectedDayN < 30
                          ? {
                              label: 'روز بعد',
                              onClick: function () {
                                setSelectedDayN(selectedDayN + 1);
                              }
                            }
                          : undefined
                    });
                }}
              >
                روز را ببند
              </B.Button>
            </div>
          }
          size="sm"
        >
          <div style={{ padding: 'var(--space-2) 0' }}>
            {unrecordedCount > 0 ? (
              <B.Alert intent="warning" title="ثبت‌نشده داریم">
                {Names.toPersianDigits(unrecordedCount) +
                  ' نفر در این روز چیزی ثبت نکرده‌اند. امتیازشان صفر حساب می‌شود.'}
              </B.Alert>
            ) : (
              <B.Alert intent="success">برای همهٔ افراد این روز ثبت شده است.</B.Alert>
            )}
          </div>
        </B.Dialog>
      )}
      {clearDayConfirmOpen && (
        <B.Dialog
          open={clearDayConfirmOpen}
          onClose={function () {
            setClearDayConfirmOpen(false);
          }}
          title={'پاک کردن ثبت‌های روز ' + Names.toPersianDigits(selectedDayN)}
          description="ثبت‌های همهٔ افراد فعال این گروه در این روز پاک می‌شود. بلافاصله ۱۰ ثانیه فرصت «برگردان» داری."
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <B.Button
                variant="ghost"
                onClick={function () {
                  setClearDayConfirmOpen(false);
                }}
              >
                انصراف
              </B.Button>
              <B.Button
                variant="danger-bold"
                onClick={function () {
                  setClearDayConfirmOpen(false);
                  handleBatchAction('clear_day', 'ثبت‌های این روز پاک شد.');
                }}
              >
                پاک کن
              </B.Button>
            </div>
          }
          size="sm"
          alert={true}
        />
      )}
      {exportModalOpen && (
        <ExcelGroupDayExportModal
          open={exportModalOpen}
          cohort={cohort}
          group={activeGroup}
          dayN={selectedDayN}
          isDayClosed={isDayClosed}
          onClose={function () {
            setExportModalOpen(false);
          }}
          toast={toast}
        />
      )}
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
