/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from 'react';
import { B } from './bushido';
import { HELP, scoringRulesHelp } from './copy';
import type { HelpKey } from './copy';

/**
 * راهنمای کوتاه کنار یک بخش (آیکون ⓘ).
 * با کلیک یا لمس باز می‌شود؛ با Esc یا کلیک بیرون بسته می‌شود.
 * در موبایل پنل به‌صورت شیت پایین صفحه باز می‌شود (app.css) و از لبه بیرون نمی‌زند.
 *
 * - help: کلید متن در copy.ts ('scoring' فهرست قواعد امتیاز را نشان می‌دهد)
 * - visibleLabel: وقتی true باشد، متن عنوان هم کنار آیکون نوشته می‌شود
 * - corner: آیکون را در گوشهٔ انتهایی یک فیلد (کنار برچسب) می‌گذارد
 */
export function HelpHint(props: {
  help: HelpKey;
  visibleLabel?: boolean;
  corner?: boolean;
  body?: ReactNode;
}) {
  const item = HELP[props.help];
  const trigger = (
    <button
      type="button"
      className={'bsh-help__btn' + (props.visibleLabel ? ' has-label' : '')}
      aria-label={'توضیح دربارهٔ ' + item.label}
    >
      {props.visibleLabel && <span className="body-sm">{item.label}</span>}
      <B.Icon name="Info" size="sm" />
    </button>
  );

  return (
    <span className={'bsh-help' + (props.corner ? ' is-corner' : '')}>
      <B.Popover trigger={trigger} label={item.label}>
        <div className="bsh-help__panel body-sm">
          <strong className="label-md">{item.label}</strong>
          {props.help === 'scoring' ? (
            <ul>
              {scoringRulesHelp().map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            props.body || <p>{item.text}</p>
          )}
        </div>
      </B.Popover>
    </span>
  );
}
