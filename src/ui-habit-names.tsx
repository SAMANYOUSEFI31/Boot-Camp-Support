/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { B } from './bushido';
import { Names } from './names';
import { MAX_HABIT_NAME } from './habits';

/**
 * فیلدهای نام عادت‌ها (به تعداد عادت فرد). اختیاری است؛ بدون نام، «عادت ۱ …» نشان داده می‌شود.
 */
export function HabitNameFields(props: {
  count: number;
  names: string[];
  onChange: (names: string[]) => void;
}) {
  const { count, names, onChange } = props;
  if (!count || count < 1) return null;
  return (
    <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
      {Array.from({ length: Math.min(4, count) }, (_v, i) => (
        <B.TextField
          key={i}
          label={'نام عادت ' + Names.toPersianDigits(i + 1) + ' (اختیاری)'}
          placeholder="مثلاً: مطالعه"
          maxLength={MAX_HABIT_NAME}
          value={names[i] || ''}
          onChange={(e) => {
            const next = names.slice();
            while (next.length < 4) next.push('');
            next[i] = e.target.value;
            onChange(next);
          }}
        />
      ))}
    </div>
  );
}
