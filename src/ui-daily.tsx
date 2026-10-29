/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { memo, useEffect, useRef, useState } from 'react';
import { B } from './bushido';
import { Names } from './names';
import { errorMessage } from './errors';
import { Scoring } from './scoring';
import { Store } from './store';
import { Excel } from './excel';
import { ImageExport, type ImagesData } from './image-export';
import type { Cohort, DayConfig, DayRecord, Group, Participant, Toast } from './types';

type CellField = 'done' | 'hard' | 'special';
type CellChange = (participantId: string, field: CellField, value: number | null) => void;

/**
 * محاسبه روز جاری نسبت به تاریخ شروع دوره (۱ تا ۳۰)
 */
function calculateCurrentDayNumber(startDateIso: string | null | undefined): number {
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
function DailyScoringTab(props: { cohort: Cohort; toast?: Toast }) {
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
          title="هیچ گروه فعالی یافت نشد"
          description="لطفاً ابتدا در تب «گروه‌ها» حداقل یک گروه بسازید و علامت «مال من است» را بزنید."
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
    label: string
  ) {
    const rollbackFn = Store.batchRecordDay(cohort.id, activeGroup.id, selectedDayN, actionName);
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
        if (toast) toast.show({ intent: 'danger', message: 'خطا در ساخت تصویر: ' + errorMessage(err) });
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
        if (toast) toast.show({ intent: 'success', message: 'فایل اکسل دانلود شد و تصویر گزارش آماده است.' });
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
  const progressPercent =
    totalMembersCount > 0 ? Math.round((recordedMembersCount / totalMembersCount) * 100) : 0;

  // «بستن روز» تنها دکمهٔ اصلی صفحه است؛ در هر عرض فقط یک نسخهٔ آن دیده می‌شود
  const closeDayButton = isDayClosed ? (
    <B.Button
      variant="ghost"
      size="sm"
      onClick={function () {
        Store.toggleCloseDay(cohort.id, activeGroup.id, selectedDayN, false);
        if (toast) toast.show({ intent: 'info', message: 'روز دوباره باز شد.' });
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
              <span className="heading-xs">
                {'روز ' + Names.toPersianDigits(selectedDayN) + ' · ' + dayShamsi + ' · ' + dayTypeName}
              </span>
              {isDayClosed ? (
                <B.Badge intent="success" emphasis="bold" icon="Check">
                  بسته شده
                </B.Badge>
              ) : (
                <B.Badge intent="warning" emphasis="subtle" icon="Info">
                  باز
                </B.Badge>
              )}
            </div>
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
              خروجی تصویر
            </B.Button>
            <B.Button
              variant="secondary"
              size="sm"
              iconStart="Share2"
              onClick={function () {
                setExportModalOpen(true);
              }}
            >
              خروجی Excel
            </B.Button>
            <B.Button
              variant="secondary"
              size="sm"
              loading={isGeneratingImage}
              onClick={function () {
                handleExportBoth(showFrozen);
              }}
            >
              خروجی هر دو
            </B.Button>
            {closeDayButton}
          </div>
        </div>
      </B.Card>
      {dayCfg.type === 'main' && (
        <div className="bsh-progress">
          <div className="bsh-row" style={{ justifyContent: 'space-between' }}>
            <div className="bsh-row" style={{ gap: 'var(--space-2)' }}>
              <span className="label-md">پیشرفت ثبت گروه:</span>
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
                  ' نفر ثبت شد (' +
                  Names.toPersianDigits(progressPercent) +
                  '٪)'}
              </span>
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
              </div>
              <B.Switch
                label="نمایش فریز‌شده‌ها"
                checked={showFrozen}
                onChange={function (e) {
                  setShowFrozen(e.target.checked);
                }}
              />
            </div>
          </div>
          <div
            className="bsh-progress__track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            aria-label="پیشرفت ثبت گروه"
          >
            <div
              className={'bsh-progress__fill' + (progressPercent === 100 ? ' is-complete' : '')}
              style={{ inlineSize: progressPercent + '%' }}
            />
          </div>
        </div>
      )}
      {dayCfg.type === 'main' && (
        <div className="bsh-batch-bar">
          <B.Button
            variant="ghost"
            size="sm"
            onClick={function () {
              handleBatchAction('all_habits_done', 'همه‌ی عادت‌ها انجام شد');
            }}
          >
            همه‌ی عادت‌ها انجام شد
          </B.Button>
          {dayCfg.specialMission && (
            <B.Button
              variant="ghost"
              size="sm"
              onClick={function () {
                handleBatchAction('all_special_done', 'مأموریت همه انجام شد');
              }}
            >
              مأموریت همه انجام شد
            </B.Button>
          )}
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
                ? 'روزهای ۱ تا ۷ دوره، مرحله گرم‌کردن و آشنایی با عادات هستند و امتیازی برای آنها ثبت نمی‌شود.'
                : 'روزهای ۲۹ و ۳۰ دوره، روزهای مرور پایانی هستند و امتیازی برای آنها ثبت نمی‌شود.'
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
          label="خروجی"
          side="top"
          trigger={
            <B.Button variant="secondary" size="sm" iconStart="Share2">
              خروجی
            </B.Button>
          }
          items={[
            {
              label: 'خروجی تصویر',
              onSelect: function () {
                handleGenerateImage(showFrozen);
              }
            },
            {
              label: 'خروجی Excel',
              onSelect: function () {
                setExportModalOpen(true);
              }
            },
            {
              label: 'خروجی هر دو',
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
          description="با بستن روز، امتیازات این روز در مجموع تجمعی اعضا و گروه لحاظ خواهند شد."
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
                      message: 'روز ' + Names.toPersianDigits(selectedDayN) + ' با موفقیت بسته شد.'
                    });
                }}
              >
                تأیید و بستن روز
              </B.Button>
            </div>
          }
          size="sm"
        >
          <div style={{ padding: 'var(--space-2) 0' }}>
            {unrecordedCount > 0 ? (
              <B.Alert intent="warning" title="توجه">
                {Names.toPersianDigits(unrecordedCount) +
                  ' نفر هنوز هیچ رکوردی برای امروز ثبت نکرده‌اند. با بستن روز، امتیاز آنها صفر لحاظ خواهد شد.'}
              </B.Alert>
            ) : (
              <B.Alert intent="success">همه اعضای فعال برای امروز نتیجه ثبت کرده‌اند.</B.Alert>
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
          description="آیا مطمئنید که می‌خواهید تمام رکوردهای ثبت‌شده امروز برای این گروه پاک شوند؟"
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
                  handleBatchAction('clear_day', 'ثبت‌های امروز پاک شدند');
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
        <ImageExport.ImagePreviewModal
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

/**
 * نمای کارتی مخصوص موبایل و تبلت با دکمه‌های بزرگ لمسی (حداقل ۴۴ پیکسل)
 */
interface RowsViewProps {
  cohort: Cohort;
  group: Group;
  dayCfg: DayConfig;
  members: Participant[];
  onCellChange: CellChange;
  toast?: Toast;
}

function DailyScoringCardView(props: RowsViewProps) {
  const cohort = props.cohort;
  const group = props.group;
  const dayCfg = props.dayCfg;
  const members = props.members;
  const onCellChange = props.onCellChange;
  const toast = props.toast;

  if (!members.length) {
    return (
      <B.Card padding="lg">
        <B.EmptyState
          icon="User"
          title="عضوی برای ثبت امتیاز وجود ندارد"
          description="لطفاً ابتدا از تب «گروه‌ها»، اعضای این گروه را اضافه کنید."
        />
      </B.Card>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
      {members.map(function (p, idx) {
        const rec = (cohort.records && cohort.records[p.id] && cohort.records[p.id][dayCfg.n]) || null;
        return (
          <ParticipantCard
            key={p.id}
            rowIdx={idx}
            participant={p}
            record={rec}
            dayCfg={dayCfg}
            onCellChange={onCellChange}
            toast={toast}
          />
        );
      })}
    </div>
  );
}

/**
 * کارت مجزای هر عضو جهت سرعت رندر بالا و عدم افت فریم (Memoized)
 */
interface ParticipantCardProps {
  rowIdx: number;
  participant: Participant;
  record: DayRecord | null;
  dayCfg: DayConfig;
  onCellChange: CellChange;
  toast?: Toast;
}

const ParticipantCard = memo(function ParticipantCard(props: ParticipantCardProps) {
  const rowIdx = props.rowIdx;
  const p = props.participant;
  const rec = props.record;
  const dayCfg = props.dayCfg;
  const onCellChange = props.onCellChange;

  const habitCount = p.habitCount;
  const doneVal = rec && rec.done != null ? rec.done : null;
  const hardVal = rec && rec.hard != null ? rec.hard : null;
  const specialVal = rec && rec.special != null ? rec.special : 0;

  const hasRecord = rec && (rec.done != null || rec.hard != null || rec.special != null);
  let dayScoreVal = '—';
  if (hasRecord) {
    const sc = Scoring.dayScore(p, rec, dayCfg);
    const mx = Scoring.dayMax(p, dayCfg, rec);
    dayScoreVal = Names.toPersianDigits(sc) + ' از ' + Names.toPersianDigits(mx);
  }

  // آرایه گزینه‌های عادت (۰ تا habitCount)
  const habitOptions = [];
  if (habitCount != null) {
    for (let i = 0; i <= habitCount; i++) {
      habitOptions.push(i);
    }
  }

  // آرایه سطوح کار سخت (۰ تا hardLevels)
  const hardOptions = [];
  if (dayCfg.hardLevels > 0) {
    for (let hIdx = 0; hIdx <= dayCfg.hardLevels; hIdx++) {
      hardOptions.push(hIdx);
    }
  }

  return (
    <B.Card
      padding="md"
      style={{
        borderInlineStart:
          'var(--space-1) solid ' + (hasRecord ? 'var(--border-success)' : 'var(--border-default)'),
        background: 'var(--surface-raised)'
      }}
    >
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--space-2)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              minInlineSize: 0,
              flexWrap: 'wrap'
            }}
          >
            <span
              className="caption"
              style={{ color: 'var(--text-subtle)', minInlineSize: 'var(--space-5)' }}
            >
              {Names.toPersianDigits(rowIdx + 1) + '.'}
            </span>
            <span className="body-md" style={{ fontWeight: 700 }}>
              {p.name}
            </span>
            {p.status === 'frozen' && (
              <B.Badge intent="info" emphasis="subtle">
                فریز
              </B.Badge>
            )}
            {p.status === 'left' && (
              <B.Badge intent="neutral" emphasis="subtle">
                خارج
              </B.Badge>
            )}
          </div>
          <div className="bsh-score-chip" data-recorded={hasRecord ? 'true' : 'false'}>
            {dayScoreVal}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="caption" style={{ color: 'var(--text-subtle)' }}>
              عادت‌های انجام‌شده:
            </span>
            <span className="caption" style={{ color: 'var(--text-subtle)' }}>
              {habitCount != null ? 'سقف: ' + Names.toPersianDigits(habitCount) + ' عادت' : 'تعیین‌نشده'}
            </span>
          </div>
          {habitCount == null ? (
            <div className="caption" style={{ color: 'var(--text-subtle)', padding: 'var(--space-1) 0' }}>
              تعداد عادت این فرد تعیین نشده است.
            </div>
          ) : (
            <div className="bsh-opts">
              {habitOptions.map(function (opt) {
                const isSelected = doneVal === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    className="bsh-opt"
                    aria-pressed={isSelected}
                    onClick={function () {
                      onCellChange(p.id, 'done', isSelected ? null : opt);
                    }}
                  >
                    {Names.toPersianDigits(opt)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {dayCfg.hardLevels > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <span className="caption" style={{ color: 'var(--text-subtle)' }}>
              {'سطح کار سخت (سقف ' + Names.toPersianDigits(dayCfg.hardLevels) + '):'}
            </span>
            <div className="bsh-opts">
              {hardOptions.map(function (lvl) {
                const isSelected = hardVal === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    className="bsh-opt bsh-opt--hard"
                    aria-pressed={isSelected}
                    onClick={function () {
                      onCellChange(p.id, 'hard', isSelected ? null : lvl);
                    }}
                  >
                    {lvl === 0 ? '۰ (انجام نداد)' : 'سطح ' + Names.toPersianDigits(lvl)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {dayCfg.specialMission && (
          <div className="bsh-special-row">
            <span className="body-sm" style={{ fontWeight: 500 }}>
              مأموریت ویژه انجام شد
            </span>
            <B.Switch
              checked={specialVal === 1}
              onChange={function (e) {
                onCellChange(p.id, 'special', e.target.checked ? 1 : 0);
              }}
            />
          </div>
        )}
      </div>
    </B.Card>
  );
});

/**
 * جدول ورود سریع امتیازها مخصوص دسکتاپ با فوکوس سریع با فلش‌های کیبورد
 */
function DailyScoringTable(props: RowsViewProps) {
  const cohort = props.cohort;
  const dayCfg = props.dayCfg;
  const members = props.members;
  const onCellChange = props.onCellChange;
  const toast = props.toast;

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function focusNextRow(currentRowIdx: number, colName: string) {
    const nextRowIdx = currentRowIdx + 1;
    const nextRef = inputRefs.current[nextRowIdx + '_' + colName];
    if (nextRef) {
      nextRef.focus();
      if (nextRef.select) nextRef.select();
    }
  }

  function focusPrevRow(currentRowIdx: number, colName: string) {
    const prevRowIdx = currentRowIdx - 1;
    const prevRef = inputRefs.current[prevRowIdx + '_' + colName];
    if (prevRef) {
      prevRef.focus();
      if (prevRef.select) prevRef.select();
    }
  }

  if (!members.length) {
    return (
      <B.Card padding="lg">
        <B.EmptyState
          icon="User"
          title="عضوی برای ثبت امتیاز وجود ندارد"
          description="لطفاً ابتدا از تب «گروه‌ها»، اعضای این گروه را اضافه کنید."
        />
      </B.Card>
    );
  }

  return (
    <div
      className="bsh-scoring-table-wrap bsh-table-scroll-container"
      style={{
        border: 'var(--border-width-thin) solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)'
      }}
    >
      <table
        className="bsh-table"
        style={{ borderCollapse: 'collapse', width: '100%', minWidth: 'var(--container-md)' }}
      >
        <thead>
          <tr>
            <th className="label-sm" style={{ width: 50, textAlign: 'center' }}>
              ردیف
            </th>
            <th
              className="label-sm bsh-sticky-right"
              style={{
                minWidth: 'calc(var(--space-12) * 3.5)'
              }}
            >
              نام و نام خانوادگی
            </th>
            <th className="label-sm is-num" style={{ textAlign: 'center', width: 110 }}>
              عادت‌های انتخابی
            </th>
            <th className="label-sm is-num" style={{ textAlign: 'center', width: 130 }}>
              عادت‌های انجام‌شده
            </th>
            <th className="label-sm is-num" style={{ textAlign: 'center', width: 130 }}>
              {'کار سخت (۰ تا ' + Names.toPersianDigits(dayCfg.hardLevels) + ')'}
            </th>
            <th className="label-sm is-num" style={{ textAlign: 'center', width: 110 }}>
              مأموریت ویژه
            </th>
            <th className="label-sm is-num" style={{ textAlign: 'center', width: 110 }}>
              امتیاز امروز
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map(function (p, rowIdx) {
            const rec = (cohort.records && cohort.records[p.id] && cohort.records[p.id][dayCfg.n]) || null;
            return (
              <TableRowItem
                key={p.id}
                rowIdx={rowIdx}
                participant={p}
                record={rec}
                dayCfg={dayCfg}
                inputRefs={inputRefs}
                onCellChange={onCellChange}
                focusNextRow={focusNextRow}
                focusPrevRow={focusPrevRow}
                toast={toast}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * سطر جدول ثبت روزانه به صورت کامپوننت Memoized جهت جلوگیری از لگ در تایپ
 */
interface TableRowItemProps extends ParticipantCardProps {
  inputRefs: { current: Record<string, HTMLInputElement | null> };
  focusNextRow: (rowIdx: number, colName: string) => void;
  focusPrevRow: (rowIdx: number, colName: string) => void;
}

const TableRowItem = memo(function TableRowItem(props: TableRowItemProps) {
  const rowIdx = props.rowIdx;
  const p = props.participant;
  const rec = props.record;
  const dayCfg = props.dayCfg;
  const inputRefs = props.inputRefs;
  const onCellChange = props.onCellChange;
  const focusNextRow = props.focusNextRow;
  const focusPrevRow = props.focusPrevRow;
  const toast = props.toast;

  const isHabitLocked = p.habitCount == null;
  const doneVal = rec && rec.done != null ? String(rec.done) : '';
  const hardVal = rec && rec.hard != null ? String(rec.hard) : '';
  const specialVal = rec && rec.special != null ? rec.special : 0;

  let dayScoreVal = '—';
  if (rec && (rec.done != null || rec.hard != null || rec.special != null)) {
    const sc = Scoring.dayScore(p, rec, dayCfg);
    const mx = Scoring.dayMax(p, dayCfg, rec);
    dayScoreVal = Names.toPersianDigits(sc) + ' از ' + Names.toPersianDigits(mx);
  }

  return (
    <tr>
      <td className="body-sm is-num" style={{ textAlign: 'center', color: 'var(--text-subtle)' }}>
        {Names.toPersianDigits(rowIdx + 1)}
      </td>
      <td
        className="body-sm bsh-sticky-right"
        style={{
          fontWeight: 600,
          borderInlineEnd: 'var(--border-width-thin) solid var(--border-subtle)'
        }}
      >
        {p.name}
        {p.status === 'frozen' && (
          <span
            className="caption"
            style={{ color: 'var(--text-info)', marginInlineStart: 'var(--space-1)' }}
          >
            (فریز)
          </span>
        )}
        {p.status === 'left' && (
          <span
            className="caption"
            style={{ color: 'var(--text-subtle)', marginInlineStart: 'var(--space-1)' }}
          >
            (خارج)
          </span>
        )}
      </td>
      <td className="body-sm is-num" style={{ textAlign: 'center' }}>
        {p.habitCount != null ? (
          Names.toPersianDigits(p.habitCount) + ' عادت'
        ) : (
          <span className="caption" style={{ color: 'var(--text-subtle)' }}>
            — (تعیین نشده)
          </span>
        )}
      </td>
      <td style={{ textAlign: 'center' }}>
        {isHabitLocked ? (
          <span className="caption" style={{ color: 'var(--text-subtle)' }}>
            —
          </span>
        ) : (
          <input
            ref={function (el) {
              inputRefs.current[rowIdx + '_done'] = el;
            }}
            type="text"
            inputMode="numeric"
            className="bsh-field__input bsh-cell-input body-md"
            value={doneVal !== '' ? Names.toPersianDigits(doneVal) : ''}
            placeholder="—"
            onChange={function (e) {
              const raw = e.target.value;
              if (!raw) {
                onCellChange(p.id, 'done', null);
                return;
              }
              const latin = Names.toLatinDigits(raw);
              const d = parseInt(latin, 10);
              if (isNaN(d)) return;

              if (d > (p.habitCount as number)) {
                if (toast)
                  toast.show({
                    intent: 'danger',
                    message: 'انجام‌شده‌ها نمی‌تواند از انتخابی‌ها بیشتر باشد.'
                  });
                return;
              }
              onCellChange(p.id, 'done', d);
              focusNextRow(rowIdx, 'done');
            }}
            onKeyDown={function (e) {
              if (e.key === 'ArrowDown' || e.key === 'Enter') {
                e.preventDefault();
                focusNextRow(rowIdx, 'done');
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                focusPrevRow(rowIdx, 'done');
              }
            }}
          />
        )}
      </td>
      <td style={{ textAlign: 'center' }}>
        {dayCfg.hardLevels === 0 ? (
          <span className="caption" style={{ color: 'var(--text-subtle)' }}>
            ندارد
          </span>
        ) : (
          <input
            ref={function (el) {
              inputRefs.current[rowIdx + '_hard'] = el;
            }}
            type="text"
            inputMode="numeric"
            className="bsh-field__input bsh-cell-input body-md"
            value={hardVal !== '' ? Names.toPersianDigits(hardVal) : ''}
            placeholder="—"
            onChange={function (e) {
              const raw = e.target.value;
              if (!raw) {
                onCellChange(p.id, 'hard', null);
                return;
              }
              const latin = Names.toLatinDigits(raw);
              const hVal = parseInt(latin, 10);
              if (isNaN(hVal)) return;

              if (hVal > dayCfg.hardLevels) {
                if (toast)
                  toast.show({
                    intent: 'danger',
                    message:
                      'سطح کار سخت نمی‌تواند از سقف روز (' +
                      Names.toPersianDigits(dayCfg.hardLevels) +
                      ') بیشتر باشد.'
                  });
                return;
              }
              onCellChange(p.id, 'hard', hVal);
              focusNextRow(rowIdx, 'hard');
            }}
            onKeyDown={function (e) {
              if (e.key === 'ArrowDown' || e.key === 'Enter') {
                e.preventDefault();
                focusNextRow(rowIdx, 'hard');
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                focusPrevRow(rowIdx, 'hard');
              }
            }}
          />
        )}
      </td>
      <td style={{ textAlign: 'center' }}>
        {!dayCfg.specialMission ? (
          <span className="caption" style={{ color: 'var(--text-subtle)' }}>
            ندارد
          </span>
        ) : (
          <B.Checkbox
            checked={specialVal === 1}
            onChange={function (e) {
              onCellChange(p.id, 'special', e.target.checked ? 1 : 0);
            }}
          />
        )}
      </td>
      <td
        className="body-md is-num"
        style={{
          textAlign: 'center',
          fontWeight: 600,
          color: dayScoreVal === '—' ? 'var(--text-subtle)' : 'var(--text-success)'
        }}
      >
        {dayScoreVal}
      </td>
    </tr>
  );
});

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

function ExcelGroupDayExportModal(props: ExcelExportModalProps) {
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

export const UIDaily = {
  DailyScoringTab: DailyScoringTab
};
