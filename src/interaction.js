const GLOBE_SENSITIVITY = 0.3;   // degrees per CSS pixel for globe drag
const DRAG_MOVED_THRESHOLD = 4;   // px — below this, mouseup counts as a click

export function setupInteraction(canvas, getProjection, appState, callbacks) {
  const { onPoleClick, onGlobeDrag, onMapScrollDelta } = callbacks;

  let mouseDownX = 0;
  let mouseDownY = 0;
  let dragLastX  = 0;
  let dragLastY  = 0;
  let dragging   = false;
  let movedEnough = false;

  // ── Coordinate helpers ───────────────────────────────────────

  function canvasXY(event) {
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    return [
      (event.clientX - rect.left) * scaleX,
      (event.clientY - rect.top)  * scaleY,
    ];
  }

  function geoCoords(x, y) {
    const proj = getProjection();
    if (!proj?.invert) return null;
    const c = proj.invert([x, y]);
    if (!c) return null;
    const [lon, lat] = c;
    if (isNaN(lon) || isNaN(lat)) return null;
    if (lat < -90.5 || lat > 90.5) return null;
    if (lon < -181  || lon > 181)  return null;
    return { lon, lat };
  }

  // ── Mouse ────────────────────────────────────────────────────

  function onMouseDown(e) {
    if (appState.phase === 'animating') return;
    dragging    = true;
    movedEnough = false;
    mouseDownX  = e.clientX;
    mouseDownY  = e.clientY;
    dragLastX   = e.clientX;
    dragLastY   = e.clientY;
    e.preventDefault();
  }

  function onMouseMove(e) {
    if (!dragging) return;

    const dx = e.clientX - dragLastX;
    const dy = e.clientY - dragLastY;
    dragLastX = e.clientX;
    dragLastY = e.clientY;

    const totalDx = e.clientX - mouseDownX;
    const totalDy = e.clientY - mouseDownY;
    if (Math.abs(totalDx) > DRAG_MOVED_THRESHOLD ||
        Math.abs(totalDy) > DRAG_MOVED_THRESHOLD) {
      movedEnough = true;
    }

    if (!movedEnough) return;

    if (appState.phase === 'globe') {
      onGlobeDrag(dx * GLOBE_SENSITIVITY, dy * GLOBE_SENSITIVITY);
    } else if (appState.phase === 'projected') {
      onMapScrollDelta(dx);
    }

    e.preventDefault();
  }

  function onMouseUp(e) {
    if (!dragging) return;
    dragging = false;

    if (!movedEnough) {
      // Treat as a click — allow pole selection from 2D map or globe
      if (appState.phase === 'projected' || appState.phase === 'globe') {
        const [cx, cy] = canvasXY(e);
        const geo = geoCoords(cx, cy);
        if (geo) onPoleClick(geo.lon, geo.lat);
      }
    }
  }

  // ── Wheel ────────────────────────────────────────────────────

  function onWheel(e) {
    if (appState.phase !== 'projected') return;
    e.preventDefault();
    const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY;
    onMapScrollDelta(dx);
  }

  // ── Touch ────────────────────────────────────────────────────

  let touchLastX = 0;
  let touchLastY = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchMoved  = false;

  function onTouchStart(e) {
    if (appState.phase === 'animating') return;
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchLastX  = t.clientX;
    touchLastY  = t.clientY;
    touchMoved  = false;
  }

  function onTouchMove(e) {
    const t = e.touches[0];
    const dx = t.clientX - touchLastX;
    const dy = t.clientY - touchLastY;
    touchLastX = t.clientX;
    touchLastY = t.clientY;

    const tx = t.clientX - touchStartX;
    const ty = t.clientY - touchStartY;
    if (Math.abs(tx) > DRAG_MOVED_THRESHOLD || Math.abs(ty) > DRAG_MOVED_THRESHOLD) {
      touchMoved = true;
    }

    if (!touchMoved) return;

    if (appState.phase === 'globe') {
      onGlobeDrag(dx * GLOBE_SENSITIVITY, dy * GLOBE_SENSITIVITY);
    } else if (appState.phase === 'projected') {
      onMapScrollDelta(dx);
    }
    e.preventDefault();
  }

  function onTouchEnd(e) {
    if (!touchMoved && (appState.phase === 'projected' || appState.phase === 'globe')) {
      const rect   = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      const touch  = e.changedTouches[0];
      const cx = (touch.clientX - rect.left) * scaleX;
      const cy = (touch.clientY - rect.top)  * scaleY;
      const geo = geoCoords(cx, cy);
      if (geo) onPoleClick(geo.lon, geo.lat);
    }
    touchMoved = false;
  }

  // ── Register ─────────────────────────────────────────────────

  canvas.addEventListener('mousedown',  onMouseDown);
  canvas.addEventListener('mousemove',  onMouseMove);
  window.addEventListener('mouseup',    onMouseUp);
  canvas.addEventListener('wheel',      onWheel,      { passive: false });
  canvas.addEventListener('touchstart', onTouchStart, { passive: true  });
  canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
  canvas.addEventListener('touchend',   onTouchEnd,   { passive: true  });

  return function teardown() {
    canvas.removeEventListener('mousedown',  onMouseDown);
    canvas.removeEventListener('mousemove',  onMouseMove);
    window.removeEventListener('mouseup',    onMouseUp);
    canvas.removeEventListener('wheel',      onWheel);
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove',  onTouchMove);
    canvas.removeEventListener('touchend',   onTouchEnd);
  };
}
