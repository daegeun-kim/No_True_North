import * as d3 from 'd3';

export const ROTATION_DURATION    = 1200;
export const MORPH_DURATION       = 800;

export function runAnim(duration, easing, onFrame, onDone) {
  let rafId = null;
  let startTime = null;
  let cancelled = false;

  function tick(now) {
    if (cancelled) return;
    if (!startTime) startTime = now;

    const elapsed = now - startTime;
    const raw = Math.min(elapsed / duration, 1);
    const t = easing ? easing(raw) : raw;

    onFrame(t, raw);

    if (raw < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      if (onDone) onDone();
    }
  }

  rafId = requestAnimationFrame(tick);

  return function cancel() {
    cancelled = true;
    if (rafId != null) cancelAnimationFrame(rafId);
  };
}

export function interpolateRotation(from, to) {
  return d3.interpolate(from, to);
}
