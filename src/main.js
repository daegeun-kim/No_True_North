import * as d3 from 'd3';
import { loadData }                                       from './data.js';
import { antipodal, formatCoord }                         from './utils.js';
import { makeProjection, isCylindrical }                  from './projection.js';
import { renderFrame, renderBlend, resizeCanvas }         from './render.js';
import { runAnim, MORPH_DURATION }                        from './animation.js';
import { setupInteraction }                               from './interaction.js';
import {
  buildCoordinateSystem,
  transformPoint,
  inverseTransformPoint,
  transformGeoJSON,
} from './transform.js';
import { renderDiagram } from './diagram.js';
import {
  precomputeCountrySamples,
  computeCountryDistortions,
  searchDistortionPreset,
  bivariateColor,
  DISTORTION_NORMALIZATION_CONFIG,
  BIVARIATE_COLOR_CONFIG,
} from './distortion.js';

// ── Seam preview style ────────────────────────────────────────
const SEAM_PREVIEW_COLOR   = '#111827';
const SEAM_PREVIEW_OPACITY = 0.8;
const SEAM_PREVIEW_WIDTH   = 2;
const SEAM_PREVIEW_DASH    = [6, 4];

// ── Projection family → diagram mapping ───────────────────────

const PROJ_FAMILY = {
  equirectangular:          'cylindrical',
  mercator:                 'cylindrical',
  robinson:                 'cylindrical',
  gallPeters:               'cylindrical',
  cylindricalEqualArea:     'cylindrical',
  mollweide:                'cylindrical',
  lambertConformalConic:    'conic',
  albersEqualAreaConic:     'conic',
  azimuthalEquidistant:     'azimuthal',
  lambertAzimuthalEqualArea:'azimuthal',
  orthographic:             'azimuthal',
  peirceQuincuncial:        'azimuthal',
};

// ── Default coordinate system (original north pole = identity) ─

const DEFAULT_SYSTEM = buildCoordinateSystem(0, 90);

// ── App state ─────────────────────────────────────────────────

const state = {
  phase:                 'projected',   // 'projected' | 'animating'
  projType:              'equirectangular',
  graticuleMode:         'redefined',   // 'redefined' | 'original'
  customPole:            null,          // original { lon, lat }
  derivedPole:           null,          // original { lon, lat }
  coordinateSystem:      DEFAULT_SYSTEM,
  seamLon:               180,           // seam longitude in redefined coords (default antimeridian)
  isSelectingSeam:       false,
  seamPreviewLon:        null,
  data:                  null,
  transformedData:       null,
  transformedPoleCoords: null,
  cancelAnim:            null,
  // Distortion compare mode
  distortionMode:        false,
  countrySamples:        null,
  distortionMap:         null,
};

let canvasW = 0;
let canvasH = 0;
let activeProjection = null;

const projCache = { type: null, w: null, h: null, proj: null };

function getBaseProj(type) {
  if (projCache.type !== type || projCache.w !== canvasW || projCache.h !== canvasH) {
    projCache.type = type;
    projCache.w    = canvasW;
    projCache.h    = canvasH;
    projCache.proj = makeProjection(type, canvasW, canvasH);
  }
  return projCache.proj;
}

// seamLon → D3 rotation angle: seam at 180° ↔ rotate([0,0,0])
function seamRotAngle() {
  return 180 - state.seamLon;
}

// ── DOM refs ──────────────────────────────────────────────────

const canvas               = document.getElementById('map-canvas');
const seamCanvas           = document.getElementById('seam-canvas');
const instruction          = document.getElementById('instruction');
const projSelect           = document.getElementById('projection-select');
const northDisplay         = document.getElementById('north-pole-display');
const southDisplay         = document.getElementById('south-pole-display');
const resetBtn             = document.getElementById('reset-btn');
const replayBtn            = document.getElementById('replay-btn');
const gratOrigBtn          = document.getElementById('grat-original');
const gratRedefBtn         = document.getElementById('grat-redefined');
const statusLine           = document.getElementById('status-line');
const loadingOverlay       = document.getElementById('loading-overlay');
const projDiagramEl        = document.getElementById('projection-diagram');
const distortionToggleBtn  = document.getElementById('distortion-toggle-btn');
const distortionLegendSect = document.getElementById('distortion-legend-section');
const legendCanvas         = document.getElementById('legend-canvas');
const presetBtns           = document.querySelectorAll('.preset-btn');
const seamBtn              = document.getElementById('seam-btn');
const seamDisplay          = document.getElementById('seam-display');
const seamGroup            = document.getElementById('seam-group');

// ── Helpers ───────────────────────────────────────────────────

function setStatus(msg, isError = false) {
  statusLine.textContent = msg;
  statusLine.classList.toggle('error', isError);
}

function setPhase(phase) {
  state.phase = phase;
  canvas.className = '';
  if (phase === 'projected') canvas.classList.add('state-projected');
  if (phase === 'animating') canvas.classList.add('state-animating');
}

function draw() {
  if (!state.data || !state.transformedData || !activeProjection) return;
  const distOpts = state.distortionMode ? {
    active:        true,
    distortionMap: state.distortionMap,
  } : null;
  renderFrame(canvas, activeProjection, state.transformedData, state, distOpts);
}

function redrawProjected() {
  const proj = getBaseProj(state.projType);
  proj.rotate([seamRotAngle(), 0, 0]);
  activeProjection = proj;
  draw();
}

function buildTransformedData(system) {
  if (!state.data) return null;
  const graticule = d3.geoGraticule()();
  return {
    land:      transformGeoJSON(state.data.land,      system),
    countries: transformGeoJSON(state.data.countries, system),
    gratOrig:  transformGeoJSON(graticule,            system),
  };
}

function updatePoleUI() {
  if (state.customPole) {
    northDisplay.textContent = formatCoord(state.customPole.lon, state.customPole.lat);
    northDisplay.classList.add('set');
  } else {
    northDisplay.textContent = '—';
    northDisplay.classList.remove('set');
  }
  if (state.derivedPole) {
    southDisplay.textContent = formatCoord(state.derivedPole.lon, state.derivedPole.lat);
    southDisplay.classList.add('set');
  } else {
    southDisplay.textContent = '—';
    southDisplay.classList.remove('set');
  }
}

function updateGratUI() {
  if (state.graticuleMode === 'original') {
    gratOrigBtn.classList.add('active');
    gratRedefBtn.classList.remove('active');
  } else {
    gratRedefBtn.classList.add('active');
    gratOrigBtn.classList.remove('active');
  }
}

function updateProjDiagram() {
  const family = PROJ_FAMILY[state.projType] || 'cylindrical';
  renderDiagram(
    projDiagramEl,
    family,
    state.customPole?.lon ?? null,
    state.customPole?.lat ?? null,
  );
}

// ── Seam helpers ──────────────────────────────────────────────

function formatSeam(lon) {
  const norm = ((lon % 360) + 360) % 360;
  const c = norm > 180 ? norm - 360 : norm;
  if (Math.abs(c) >= 179.95) return '180°';
  const abs = Math.abs(c).toFixed(1);
  return `${abs}° ${c >= 0 ? 'E' : 'W'}`;
}

function updateSeamUI() {
  const isAzimuthal = PROJ_FAMILY[state.projType] === 'azimuthal';
  seamGroup.style.display = isAzimuthal ? 'none' : '';

  if (state.isSelectingSeam) {
    seamBtn.textContent = 'Selecting Seam…';
    seamBtn.classList.add('active-toggle');
  } else {
    seamBtn.textContent = 'Change Seam';
    seamBtn.classList.remove('active-toggle');
  }

  seamDisplay.textContent = `Seam: ${formatSeam(state.seamLon)}`;
}

function drawSeamPreview(lon) {
  const ctx = seamCanvas.getContext('2d');
  ctx.clearRect(0, 0, seamCanvas.width, seamCanvas.height);
  if (!activeProjection || lon === null) return;

  const pts      = Array.from({ length: 181 }, (_, i) => [lon, -90 + i]);
  const meridian = { type: 'Feature', geometry: { type: 'LineString', coordinates: pts } };
  const path     = d3.geoPath(activeProjection, ctx);

  ctx.save();
  ctx.globalAlpha = SEAM_PREVIEW_OPACITY;
  ctx.beginPath();
  path(meridian);
  ctx.strokeStyle = SEAM_PREVIEW_COLOR;
  ctx.lineWidth   = SEAM_PREVIEW_WIDTH;
  ctx.setLineDash(SEAM_PREVIEW_DASH);
  ctx.stroke();
  ctx.restore();
}

function clearSeamPreview() {
  const ctx = seamCanvas.getContext('2d');
  ctx.clearRect(0, 0, seamCanvas.width, seamCanvas.height);
}

function handleSeamToggle() {
  if (state.phase !== 'projected') return;
  state.isSelectingSeam = !state.isSelectingSeam;
  state.seamPreviewLon  = null;
  if (!state.isSelectingSeam) clearSeamPreview();
  updateSeamUI();
}

function handleSeamClick(lon) {
  state.seamLon         = lon;
  state.isSelectingSeam = false;
  state.seamPreviewLon  = null;
  clearSeamPreview();
  updateSeamUI();
  redrawProjected();
  if (state.distortionMode) {
    state.distortionMap = null;
    computeDistortionMap();
  }
}

// ── Distortion helpers ────────────────────────────────────────

function computeDistortionMap() {
  if (!state.countrySamples || !state.coordinateSystem || !state.data || !canvasW || !canvasH) return;
  const distProj = makeProjection(state.projType, canvasW, canvasH);
  distProj.rotate([0, 0, 0]);
  state.distortionMap = computeCountryDistortions(
    state.data.countries,
    state.countrySamples,
    distProj,
    state.coordinateSystem,
  );
  updateLegend();
  draw();
}

function updateLegend() {
  if (!legendCanvas) return;
  const ctx  = legendCanvas.getContext('2d');
  const W    = legendCanvas.width;
  const H    = legendCanvas.height;
  const CELL = 2;
  for (let yi = 0; yi < H; yi += CELL) {
    for (let xi = 0; xi < W; xi += CELL) {
      const s =  xi / (W - 1);
      const q = 1 - yi / (H - 1);
      const [r, g, b] = bivariateColor(s, q);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(xi, yi, CELL, CELL);
    }
  }
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth   = 1;
  ctx.strokeRect(0, 0, W, H);

  const { sizeDistortionMax, shapeDistortionMax } = DISTORTION_NORMALIZATION_CONFIG;
  const elShapeMax = document.getElementById('legend-label-shape-max');
  const elShapeMin = document.getElementById('legend-label-shape-min');
  const elSizeMin  = document.getElementById('legend-label-size-min');
  const elSizeMax  = document.getElementById('legend-label-size-max');
  if (elShapeMax) elShapeMax.textContent = `${shapeDistortionMax}`;
  if (elShapeMin) elShapeMin.textContent = '0';
  if (elSizeMin)  elSizeMin.textContent  = '0';
  if (elSizeMax)  elSizeMax.textContent  = `${sizeDistortionMax}`;

  const swatchSize  = document.getElementById('legend-swatch-size');
  const swatchShape = document.getElementById('legend-swatch-shape');
  if (swatchSize)  swatchSize.style.background  = BIVARIATE_COLOR_CONFIG.highSizeLowShape;
  if (swatchShape) swatchShape.style.background = BIVARIATE_COLOR_CONFIG.lowSizeHighShape;
}

function updateDistortionUI() {
  const active = state.distortionMode;
  distortionToggleBtn.textContent = active ? 'Hide Distortion Compare' : 'Show Distortion Compare';
  distortionToggleBtn.classList.toggle('active-toggle', active);
  distortionLegendSect.classList.toggle('distortion-hidden', !active);
}

function handleDistortionToggle() {
  state.distortionMode = !state.distortionMode;
  updateDistortionUI();
  if (state.phase !== 'projected') return;
  if (state.distortionMode && !state.distortionMap) {
    requestAnimationFrame(computeDistortionMap);
  } else {
    draw();
  }
}

function handleDistortionPreset(key) {
  if (state.phase !== 'projected' || !state.data) return;

  setStatus('Searching for optimal pole…');
  const [lon, lat] = searchDistortionPreset(
    key,
    state.data.countries,
    (w, h) => makeProjection(state.projType, w, h),
    canvasW,
    canvasH,
  );
  setStatus('');

  state.customPole  = { lon, lat };
  state.derivedPole = antipodal(lon, lat);

  state.transformedPoleCoords = {
    north: transformPoint(lon, lat, state.coordinateSystem),
    south: transformPoint(state.derivedPole.lon, state.derivedPole.lat, state.coordinateSystem),
  };

  updatePoleUI();
  updateProjDiagram();
  if (state.transformedData) draw();
  setPhase('animating');
  setTimeout(runTransitionAnimation, 180);
}

// ── Animation ─────────────────────────────────────────────────

function runTransitionAnimation() {
  if (state.cancelAnim) {
    state.cancelAnim();
    state.cancelAnim = null;
  }

  const oldTransformedData = state.transformedData;
  const oldRotAngle        = seamRotAngle();   // seam persists across pole changes

  const newSystem = buildCoordinateSystem(
    state.customPole.lon,
    state.customPole.lat,
  );
  state.coordinateSystem = newSystem;
  state.transformedData  = buildTransformedData(newSystem);

  state.transformedPoleCoords = {
    north: [0, 90],
    south: [0, -90],
  };

  const oldProj = makeProjection(state.projType, canvasW, canvasH);
  oldProj.rotate([oldRotAngle, 0, 0]);

  const newProj = makeProjection(state.projType, canvasW, canvasH);
  newProj.rotate([seamRotAngle(), 0, 0]);

  projCache.type = null;

  setPhase('animating');
  replayBtn.disabled = true;
  instruction.classList.add('hidden');
  setStatus('Transforming…');

  state.cancelAnim = runAnim(
    MORPH_DURATION,
    d3.easeCubicInOut,
    (t) => {
      renderBlend(
        canvas, oldProj, newProj,
        oldTransformedData, state.transformedData,
        state, t,
      );
    },
    () => {
      activeProjection = newProj;
      finishAnimation();
    },
  );
}

function finishAnimation() {
  state.cancelAnim = null;
  const proj = getBaseProj(state.projType);
  proj.rotate([seamRotAngle(), 0, 0]);
  activeProjection = proj;
  setPhase('projected');
  replayBtn.disabled = false;
  setStatus('');
  if (state.distortionMode) {
    state.distortionMap = null;
    computeDistortionMap();
  } else {
    draw();
  }
}

// ── Event handlers ────────────────────────────────────────────

function handlePoleClick(redefinedLon, redefinedLat) {
  // Intercept click for seam selection
  if (state.isSelectingSeam) {
    handleSeamClick(redefinedLon);
    return;
  }

  const [origLon, origLat] = inverseTransformPoint(
    redefinedLon, redefinedLat, state.coordinateSystem,
  );

  state.customPole  = { lon: origLon, lat: origLat };
  state.derivedPole = antipodal(origLon, origLat);

  state.transformedPoleCoords = {
    north: [redefinedLon, redefinedLat],
    south: transformPoint(
      state.derivedPole.lon, state.derivedPole.lat,
      state.coordinateSystem,
    ),
  };

  updatePoleUI();
  updateProjDiagram();
  if (state.transformedData) draw();
  setPhase('animating');
  setTimeout(runTransitionAnimation, 180);
}

function handleMapScrollDelta(_pxDelta) {
  // Horizontal scrolling removed; use Change Seam button to reposition seam
}

function handleProjectionChange() {
  const newType = projSelect.value;
  if (newType === state.projType) return;
  state.projType = newType;
  projCache.type = null;

  // Exit seam selection when switching to azimuthal
  if (PROJ_FAMILY[newType] === 'azimuthal' && state.isSelectingSeam) {
    state.isSelectingSeam = false;
    state.seamPreviewLon  = null;
    clearSeamPreview();
  }

  updateProjDiagram();
  updateSeamUI();

  if (state.phase === 'projected') {
    redrawProjected();
    setStatus('');
    if (state.distortionMode) {
      state.distortionMap = null;
      computeDistortionMap();
    }
  }
}

function handleGraticuleToggle(mode) {
  state.graticuleMode = mode;
  updateGratUI();
  if (state.phase === 'projected') draw();
}

function handleReset() {
  if (state.cancelAnim) {
    state.cancelAnim();
    state.cancelAnim = null;
  }

  state.customPole            = null;
  state.derivedPole           = null;
  state.coordinateSystem      = DEFAULT_SYSTEM;
  state.seamLon               = 180;
  state.isSelectingSeam       = false;
  state.seamPreviewLon        = null;
  state.graticuleMode         = 'redefined';
  state.transformedPoleCoords = null;
  state.distortionMap         = null;
  projCache.type              = null;

  clearSeamPreview();

  if (state.data) {
    state.transformedData = buildTransformedData(DEFAULT_SYSTEM);
  }

  updatePoleUI();
  updateGratUI();
  updateProjDiagram();
  updateSeamUI();
  replayBtn.disabled = true;
  instruction.classList.remove('hidden');
  setStatus('');

  setPhase('projected');
  redrawProjected();
  if (state.distortionMode) computeDistortionMap();
}

function handleReplay() {
  if (!state.customPole) return;

  state.coordinateSystem      = DEFAULT_SYSTEM;
  state.transformedData       = buildTransformedData(DEFAULT_SYSTEM);
  state.transformedPoleCoords = null;
  projCache.type              = null;

  redrawProjected();
  setPhase('animating');
  setTimeout(runTransitionAnimation, 180);
}

function handleResize() {
  const dims = resizeCanvas(canvas);
  if (dims.width === canvasW && dims.height === canvasH) return;
  canvasW = dims.width;
  canvasH = dims.height;
  seamCanvas.width  = canvasW;
  seamCanvas.height = canvasH;
  projCache.type = null;
  redrawProjected();
}

// ── Bootstrap ─────────────────────────────────────────────────

async function init() {
  const dims = resizeCanvas(canvas);
  canvasW = dims.width;
  canvasH = dims.height;
  seamCanvas.width  = canvasW;
  seamCanvas.height = canvasH;

  setPhase('projected');
  updateGratUI();
  updateProjDiagram();
  updateSeamUI();
  redrawProjected();

  setupInteraction(canvas, () => activeProjection, state, {
    onPoleClick:      handlePoleClick,
    onGlobeDrag:      () => {},
    onMapScrollDelta: handleMapScrollDelta,
  });

  // Seam preview: track cursor longitude while selecting
  canvas.addEventListener('mousemove', (e) => {
    if (!state.isSelectingSeam || !activeProjection?.invert) return;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top)  * scaleY;
    const coords = activeProjection.invert([x, y]);
    if (coords && !isNaN(coords[0])) {
      state.seamPreviewLon = coords[0];
      drawSeamPreview(state.seamPreviewLon);
    }
  });

  canvas.addEventListener('mouseleave', () => {
    if (state.isSelectingSeam) clearSeamPreview();
  });

  projSelect.addEventListener('change', handleProjectionChange);
  resetBtn.addEventListener('click',    handleReset);
  replayBtn.addEventListener('click',   handleReplay);
  gratOrigBtn.addEventListener('click',  () => handleGraticuleToggle('original'));
  gratRedefBtn.addEventListener('click', () => handleGraticuleToggle('redefined'));

  distortionToggleBtn.addEventListener('click', handleDistortionToggle);

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => handleDistortionPreset(btn.dataset.key));
  });

  seamBtn.addEventListener('click', handleSeamToggle);

  const ro = new ResizeObserver(handleResize);
  ro.observe(canvas);

  setStatus('Loading map data…');

  try {
    state.data            = await loadData();
    state.transformedData = buildTransformedData(state.coordinateSystem);
    state.countrySamples  = precomputeCountrySamples(state.data.countries);
    draw();
    loadingOverlay.classList.add('fade-out');
    setTimeout(() => { loadingOverlay.style.display = 'none'; }, 600);
    setStatus('');
  } catch (err) {
    setStatus(err.message || 'Map data could not be loaded.', true);
    loadingOverlay.querySelector('.loading-text').textContent =
      'Map data could not be loaded.';
  }
}

init();
