/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { memo } from 'react';
import { B } from '../bushido';
import { Names } from '../names';
import { Scoring, standardDay } from '../scoring';
import { HabitChips } from './HabitChips';
import type { CellChange, ParticipantCardProps, RowsViewProps } from './types';

export function DailyScoringCardView(props: RowsViewProps) {
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
          title="فردی در این گروه نیست"
          description="در تب «گروه‌ها و افراد»، افراد این گروه را اضافه کن."
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
            onHabitToggle={props.onHabitToggle}
            toast={toast}
          />
        );
      })}
    </div>
  );
}

const ParticipantCard = memo(function ParticipantCard(props: ParticipantCardProps) {
  const rowIdx = props.rowIdx;
  const p = props.participant;
  const rec = props.record;
  const dayCfg = props.dayCfg;
  const onCellChange = props.onCellChange;
  const onHabitToggle = props.onHabitToggle;

  const habitCount = p.habitCount;
  const hardVal = rec && rec.hard != null ? rec.hard : null;
  const specialVal = rec && rec.special != null ? rec.special : 0;

  const hasRecord = rec && (rec.done != null || rec.hard != null || rec.special != null);
  const isStandard = standardDay(p, rec, dayCfg);
  let dayScoreVal = '—';
  if (hasRecord) {
    const sc = Scoring.dayScore(p, rec, dayCfg);
    const mx = Scoring.dayMax(p, dayCfg, rec);
    dayScoreVal = Names.toPersianDigits(sc) + ' از ' + Names.toPersianDigits(mx);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {isStandard && (
              <B.Badge intent="success" emphasis="subtle">
                روز استاندارد ✓
              </B.Badge>
            )}
            <div className="bsh-score-chip" data-recorded={hasRecord ? 'true' : 'false'}>
              {dayScoreVal}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="caption" style={{ color: 'var(--text-subtle)' }}>
              عادت‌های انجام‌شده:
            </span>
            <span className="caption" style={{ color: 'var(--text-subtle)' }}>
              {habitCount != null ? Names.toPersianDigits(habitCount) + ' عادت دارد' : 'تعیین‌نشده'}
            </span>
          </div>
          {habitCount == null ? (
            <div className="caption" style={{ color: 'var(--text-subtle)', padding: 'var(--space-1) 0' }}>
              تعداد عادت این فرد تعیین نشده. در تب «گروه‌ها و افراد» تعیینش کن.
            </div>
          ) : (
            <HabitChips participant={p} record={rec} onToggle={onHabitToggle} />
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
        <div className="bsh-special-row">
          <span className="body-sm" style={{ fontWeight: 500 }}>
            گزارش هدف (۲ امتیاز)
          </span>
          <B.Switch
            checked={specialVal === 1}
            onChange={function (e) {
              onCellChange(p.id, 'special', e.target.checked ? 1 : 0);
            }}
          />
        </div>
      </div>
    </B.Card>
  );
});
