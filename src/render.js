import * as d3 from 'd3';

const OCEAN_COLOR     = '#0a1628';
const LAND_COLOR      = '#1e4035';
const BORDER_COLOR    = '#335e46';
const GRATICULE_COLOR = '#1a3858';
const GRATICULE_ORIG  = '#3a5530';
const SPHERE_STROKE   = '#1a3050';
const NORTH_COLOR     = '#e05a5a';
const SOUTH_COLOR     = '#5a9ae0';

// Standard graticule in [λ', φ'] space.
// Because the projection always receives pre-transformed coordinates, this
// draws the redefined coordinate system's grid as regular horizontal/vertical lines.
const graticuleLine = d3.geoGraticule()();
const sphereFeature = { type: 'Sphere' };

function makePath(projection, ctx) {
  return d3.geoPath(projection, ctx);
}

// ── Flat projection view ───────────────────────────────────────
// data must contain: { land, countries, gratOrig }
// state.transformedPoleCoords: { north: [lon,lat], south: [lon,lat] } | null

export function renderFrame(canvas, proj, data, state) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const path = makePath(proj, ctx);

  ctx.beginPath();
  path(sphereFeature);
  ctx.fillStyle = OCEAN_COLOR;
  ctx.fill();

  if (data?.land) {
    ctx.beginPath();
    path(data.land);
    ctx.fillStyle = LAND_COLOR;
    ctx.fill();
  }

  drawGraticule(ctx, proj, state.graticuleMode || 'redefined', data?.gratOrig);

  if (data?.countries) {
    ctx.beginPath();
    path(data.countries);
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 0.4;
    ctx.stroke();
  }

  ctx.beginPath();
  path(sphereFeature);
  ctx.strokeStyle = SPHERE_STROKE;
  ctx.lineWidth = 1;
  ctx.stroke();

  drawMarkers(ctx, proj, state);
}

// ── Blend: crossfade from oldData/projA → newData/projB ───────

export function renderBlend(canvas, projA, projB, oldData, newData, state, t) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const pathB = makePath(projB, ctx);

  ctx.beginPath();
  pathB(sphereFeature);
  ctx.fillStyle = OCEAN_COLOR;
  ctx.fill();

  drawLayer(ctx, projA, oldData, 1 - t);
  drawLayer(ctx, projB, newData, t);

  ctx.globalAlpha = 1;
  ctx.beginPath();
  pathB(sphereFeature);
  ctx.strokeStyle = SPHERE_STROKE;
  ctx.lineWidth = 1;
  ctx.stroke();

  drawMarkers(ctx, projB, state);
}

// ── Helpers ───────────────────────────────────────────────────

// 'redefined': draw standard graticule as [λ', φ'] values — always looks like a normal grid
//              because the projection receives pre-transformed coordinates.
// 'original':  draw original lon/lat lines that were transformed into [λ', φ'] space
//              (they appear curved/warped).
function drawGraticule(ctx, proj, mode, gratOrig) {
  const path = makePath(proj, ctx);
  ctx.beginPath();
  if (mode === 'original' && gratOrig) {
    path(gratOrig);
    ctx.strokeStyle = GRATICULE_ORIG;
  } else {
    path(graticuleLine);
    ctx.strokeStyle = GRATICULE_COLOR;
  }
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

function drawLayer(ctx, projection, data, alpha) {
  if (alpha <= 0) return;
  const path = makePath(projection, ctx);
  ctx.globalAlpha = alpha;

  if (data?.land) {
    ctx.beginPath();
    path(data.land);
    ctx.fillStyle = LAND_COLOR;
    ctx.fill();
  }

  ctx.beginPath();
  path(graticuleLine);
  ctx.strokeStyle = GRATICULE_COLOR;
  ctx.lineWidth = 0.5;
  ctx.stroke();

  if (data?.countries) {
    ctx.beginPath();
    path(data.countries);
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 0.4;
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

// Markers are drawn using pre-transformed [λ', φ'] coordinates stored in
// state.transformedPoleCoords so that render.js has no dependency on transform.js.
function drawMarkers(ctx, projection, state) {
  if (!state?.transformedPoleCoords) return;
  const { north, south } = state.transformedPoleCoords;
  if (north) drawPoleMarker(ctx, projection, north[0], north[1], 'N′', NORTH_COLOR);
  if (south) drawPoleMarker(ctx, projection, south[0], south[1], 'S′', SOUTH_COLOR);
}

function drawPoleMarker(ctx, projection, lon, lat, label, color) {
  const p = projection([lon, lat]);
  if (!p || isNaN(p[0]) || isNaN(p[1])) return;

  const [x, y] = p;
  const { width: cw, height: ch } = ctx.canvas;
  if (x < -50 || x > cw + 50 || y < -50 || y > ch + 50) return;

  ctx.save();
  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.arc(x, y, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#060e16';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 9, y);

  ctx.restore();
}

export function resizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const w = Math.floor(rect.width);
  const h = Math.floor(rect.height);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width  = w;
    canvas.height = h;
  }
  return { width: w, height: h };
}
