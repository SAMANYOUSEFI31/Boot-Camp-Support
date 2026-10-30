/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { memo, useRef } from 'react';
import { B } from '../bushido';
import { Names } from '../names';
import { Scoring, standardDay } from '../scoring';
import type { ParticipantCardProps, RowsViewProps } from './types';

/**
 * جدول ورود سریع امتیازها مخصوص دسکتاپ با فوکوس سریع با فلش‌های کیبورد
 */
export function DailyScoringTable(props: RowsViewProps) {
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
              گزارش هدف (۲ امتیاز)
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
        <B.Checkbox
          checked={specialVal === 1}
          onChange={function (e) {
            onCellChange(p.id, 'special', e.target.checked ? 1 : 0);
          }}
        />
      </td>
      <td
        className="body-md is-num"
        style={{
          textAlign: 'center',
          fontWeight: 600,
          color: dayScoreVal === '—' ? 'var(--text-subtle)' : 'var(--text-success)'
        }}
      >
        {standardDay(p, rec, dayCfg) && (
          <B.Badge intent="success" emphasis="subtle">
            روز استاندارد ✓
          </B.Badge>
        )}{' '}
        {dayScoreVal}
      </td>
    </tr>
  );
});
