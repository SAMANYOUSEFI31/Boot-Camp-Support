interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface PlacementInput {
  anchor: Rect;
  viewport: Rect;
  panel: { width: number; height: number };
  rtl: boolean;
  alignEnd: boolean;
  preferTop: boolean;
  margin: number;
  gap: number;
}

export function placeOverlay(input: PlacementInput) {
  const { anchor, viewport, panel, rtl, alignEnd, preferTop, margin, gap } = input;
  const availableWidth = Math.max(0, viewport.width - 2 * margin);
  const availableHeight = Math.max(0, viewport.height - 2 * margin);
  const compact = viewport.width <= 640 || viewport.height <= 520;
  const width = compact ? availableWidth : Math.min(panel.width, availableWidth);
  const minLeft = viewport.left + margin;
  const maxLeft = minLeft + availableWidth - width;
  const alignRight = rtl !== alignEnd;
  const desiredLeft = alignRight ? anchor.left + anchor.width - width : anchor.left;
  const left = compact ? minLeft : Math.max(minLeft, Math.min(desiredLeft, maxLeft));
  const minTop = viewport.top + margin;
  const maxBottom = minTop + availableHeight;
  const above = Math.max(0, anchor.top - gap - minTop);
  const below = Math.max(0, maxBottom - anchor.top - anchor.height - gap);
  const topSide = preferTop ? above >= panel.height || above >= below :
    below < panel.height && above > below;
  const maxHeight = compact ? availableHeight : Math.min(availableHeight, topSide ? above : below);
  const height = Math.min(panel.height, maxHeight);
  const top = compact ? maxBottom - height : topSide ? anchor.top - gap - height :
    anchor.top + anchor.height + gap;
  return { left, top: Math.max(minTop, Math.min(top, maxBottom - height)), width, maxHeight, compact };
}

export function watchOverlayPositioning() {
  const panels = () => Array.from(document.querySelectorAll<HTMLElement>('.bsh-popover__panel'));
  const triggerFor = (panel: HTMLElement) =>
    panel.parentElement?.querySelector<HTMLButtonElement>('button[aria-expanded="true"][aria-haspopup]');
  let frame = 0;
  const observed = new Set<HTMLElement>();
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => schedule());

  function position() {
    const active = new Set<HTMLElement>();
    const visual = window.visualViewport;
    const viewport = {
      left: visual?.offsetLeft || 0,
      top: visual?.offsetTop || 0,
      width: visual?.width || document.documentElement.clientWidth,
      height: visual?.height || window.innerHeight
    };
    for (const panel of panels()) {
      const trigger = triggerFor(panel);
      if (!trigger) continue;
      active.add(panel);
      active.add(trigger);
      // A transformed dialog would contain fixed panels; restarting its animation on close would jump.
      panel.closest('.bsh-dialog')?.classList.add('bsh-dialog--open-popover');
      const anchor = trigger.getBoundingClientRect();
      const visible = { left: viewport.left, top: viewport.top,
        right: viewport.left + viewport.width, bottom: viewport.top + viewport.height };
      for (let parent = trigger.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        const bounds = parent.getBoundingClientRect();
        if (/auto|scroll|hidden|clip/.test(style.overflowX)) {
          visible.left = Math.max(visible.left, bounds.left);
          visible.right = Math.min(visible.right, bounds.right);
        }
        if (/auto|scroll|hidden|clip/.test(style.overflowY)) {
          visible.top = Math.max(visible.top, bounds.top);
          visible.bottom = Math.min(visible.bottom, bounds.bottom);
        }
      }
      if (anchor.bottom <= visible.top || anchor.top >= visible.bottom ||
          anchor.right <= visible.left || anchor.left >= visible.right) {
        trigger.click();
        continue;
      }
      panel.style.position = 'fixed';
      panel.style.inset = 'auto';
      panel.style.width = '';
      panel.style.minWidth = '';
      panel.style.maxWidth = '';
      panel.style.maxHeight = '';
      const style = getComputedStyle(panel);
      const margin = parseFloat(style.getPropertyValue('--space-4'));
      const gap = parseFloat(style.getPropertyValue('--space-2'));
      const safe = getComputedStyle(document.body);
      const safeMargin = Math.max(margin, parseFloat(safe.paddingLeft), parseFloat(safe.paddingRight),
        parseFloat(safe.paddingTop), parseFloat(safe.paddingBottom));
      const availableWidth = Math.max(0, viewport.width - 2 * safeMargin);
      const maxWidth = style.maxWidth === 'none' ? availableWidth : parseFloat(style.maxWidth);
      panel.style.minWidth = Math.min(parseFloat(style.minWidth), availableWidth) + 'px';
      panel.style.maxWidth = Math.min(maxWidth, availableWidth) + 'px';
      panel.style.maxHeight = Math.max(0, viewport.height - 2 * safeMargin) + 'px';
      panel.style.left = viewport.left + safeMargin + 'px';
      panel.style.top = viewport.top + safeMargin + 'px';
      if (viewport.width <= 640 || viewport.height <= 520) {
        panel.style.width = availableWidth + 'px';
        panel.style.maxWidth = availableWidth + 'px';
      }
      const placement = placeOverlay({
        anchor, viewport, panel: { width: panel.offsetWidth, height: panel.offsetHeight },
        rtl: style.direction === 'rtl', alignEnd: panel.classList.contains('is-end'),
        preferTop: panel.classList.contains('is-top'), margin: safeMargin, gap
      });
      panel.style.left = placement.left + 'px';
      panel.style.top = placement.top + 'px';
      panel.style.width = placement.width + 'px';
      panel.style.maxHeight = placement.maxHeight + 'px';
    }
    for (const element of observed) {
      if (!active.has(element)) { resizeObserver?.unobserve(element); observed.delete(element); }
    }
    for (const element of active) {
      if (!observed.has(element)) { resizeObserver?.observe(element); observed.add(element); }
    }
  }

  function schedule(event?: Event) {
    if (event?.target instanceof Element && event.target.closest('.bsh-popover__panel')) return;
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => { frame = 0; position(); });
  }

  function onEscape(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    const open = panels();
    const panel = open.find((p) => p.contains(document.activeElement)) || open[open.length - 1];
    if (!panel) return;
    const trigger = triggerFor(panel);
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    trigger.click();
    trigger.focus({ preventScroll: true });
  }

  const observer = new MutationObserver(position);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', schedule);
  window.addEventListener('keydown', onEscape, true);
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);
  position();
  return () => {
    observer.disconnect();
    resizeObserver?.disconnect();
    if (frame) cancelAnimationFrame(frame);
    document.removeEventListener('scroll', schedule, true);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('keydown', onEscape, true);
    window.visualViewport?.removeEventListener('resize', schedule);
    window.visualViewport?.removeEventListener('scroll', schedule);
  };
}
