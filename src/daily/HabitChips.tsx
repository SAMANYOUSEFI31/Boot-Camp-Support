/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Names } from '../names';
import { habitStatuses } from '../habits';
import type { DayRecord, Participant } from '../types';

/**
 * ثبت تک‌تک عادت‌ها: هر عادت (با نام خودش) یک دکمهٔ روشن/خاموش است.
 * رکورد قدیمی فقط تعداد دارد؛ با لمس هر عادت از صفر و تک‌تک ثبت می‌شود.
 */
export function HabitChips(props: {
  participant: Participant;
  record: DayRecord | null;
  onToggle: (participantId: string, index: number) => void;
}) {
  const { participant: p, record: rec, onToggle } = props;
  const items = habitStatuses(p, rec);
  const legacy = items.length > 0 && items.every((h) => h.state === 'unknown');

  return (
    <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
      <div className="bsh-habit-chips">
        {items.map(function (h) {
          const on = h.state === 'done';
          return (
            <button
              key={h.index}
              type="button"
              className="bsh-opt bsh-habit-chip"
              aria-pressed={on}
              aria-label={h.label + (on ? ': انجام شد' : ': انجام نشد')}
              title={h.label}
              onClick={function () {
                onToggle(p.id, h.index);
              }}
            >
              <span className="bsh-habit-chip__text">{(on ? '✓ ' : '') + h.label}</span>
            </button>
          );
        })}
      </div>
      {legacy && rec && (
        <span className="caption" style={{ color: 'var(--text-subtle)' }}>
          {'فقط تعداد ثبت شده بود (' +
            Names.toPersianDigits(rec.done == null ? 0 : rec.done) +
            ' از ' +
            Names.toPersianDigits(items.length) +
            ')، کدام‌ها معلوم نیست. با لمس هر عادت، ثبت از صفر و تک‌تک می‌شود.'}
        </span>
      )}
    </div>
  );
}
