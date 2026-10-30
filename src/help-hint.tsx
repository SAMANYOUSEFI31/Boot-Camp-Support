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
// بیشینهٔ عرض پنل (--overlay-width-sm) و ارتفاع معمول آن، برای تصمیم جهت باز شدن
const PANEL_W = 400;
const PANEL_H = 220;

export function HelpHint(props: {
  help: HelpKey;
  visibleLabel?: boolean;
  corner?: boolean;
  body?: ReactNode;
}) {
  const item = HELP[props.help];
  const [align, setAlign] = useState<'start' | 'end'>('start');
  const [side, setSide] = useState<'bottom' | 'top'>('bottom');

  // پیش از باز شدن، جهت پنل را از روی فضای واقعیِ دو سوی آیکون انتخاب کن:
  // پنل به سمتی باز می‌شود که جا بیشتری دارد (افقی: چپ/راست، عمودی: بالا/پایین)
  // و هیچ‌وقت روی خودِ آیکون یا از لبهٔ صفحه بیرون نمی‌افتد
  const measure = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const panelW = Math.min(PANEL_W, window.innerWidth - 16);
    // در راست‌به‌چپ، «start» یعنی لبهٔ راست پنل با لبهٔ راست آیکون هم‌تراز و پنل به چپ باز می‌شود
    const roomLeft = r.right - 8;
    const roomRight = window.innerWidth - r.left - 8;
    setAlign(roomLeft >= panelW || roomLeft >= roomRight ? 'start' : 'end');
    const roomBelow = window.innerHeight - r.bottom - 8;
    const roomAbove = r.top - 8;
    setSide(roomBelow >= PANEL_H || roomBelow >= roomAbove ? 'bottom' : 'top');
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
