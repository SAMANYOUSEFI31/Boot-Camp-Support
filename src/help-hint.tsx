/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
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
  const [align, setAlign] = useState<'start' | 'end'>('start');
  const [side, setSide] = useState<'bottom' | 'top'>('bottom');

  // پیش از باز شدن، جهت پنل را طوری انتخاب کن که از لبهٔ صفحه بیرون نزند
  const measure = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const panelW = 400;
    setAlign(r.right - panelW < 8 ? 'end' : 'start');
    setSide(r.bottom + 220 > window.innerHeight && r.top > 220 ? 'top' : 'bottom');
  };

  // Esc باید فقط راهنما را ببندد؛ اگر راهنما داخل دیالوگ باشد، دیالوگ هم با همین Esc بسته می‌شد
  const wrapRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const wrap = wrapRef.current;
      const btn = wrap && wrap.querySelector<HTMLButtonElement>('button[aria-expanded="true"]');
      if (e.key !== 'Escape' || !btn) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      // بستن با همان سازوکار بیرون‌کلیک دیزاین سیستم، سپس برگرداندن فوکوس
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      btn.focus();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const trigger = (
    <button
      type="button"
      className={'bsh-help__btn' + (props.visibleLabel ? ' has-label' : '')}
      aria-label={'توضیح دربارهٔ ' + item.label}
      onPointerDown={(e) => measure(e.currentTarget)}
      onFocus={(e) => measure(e.currentTarget)}
    >
      {props.visibleLabel && <span className="body-sm">{item.label}</span>}
      <B.Icon name="Info" size="sm" />
    </button>
  );

  return (
    <span ref={wrapRef} className={'bsh-help' + (props.corner ? ' is-corner' : '')}>
      <B.Popover trigger={trigger} label={item.label} align={align} side={side}>
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
