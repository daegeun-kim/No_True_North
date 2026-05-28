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
  scrollDeg:             0,
  data:                  null,          // raw original GeoJSON (never mutated)
  transformedData:       null,          // transformed GeoJSON for current system
  transformedPoleCoords: null,          // { north:[λ',φ'], south:[λ',φ'] } | null
  cancelAnim:            null,
};

let canvasW = 0;
let canvasH = 0;
let activeProjection = null;

// Cache projection object per (type, w, h) — rotation is applied after retrieval
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

// ── DOM refs ──────────────────────────────────────────────────

const canvas         = document.getElementById('map-canvas');
const instruction    = document.getElementById('instruction');
const scrollHint     = document.getElementById('scroll-hint');
const projSelect     = document.getElementById('projection-select');
const northDisplay   = document.getElementById('north-pole-display');
const southDisplay   = document.getElementById('south-pole-display');
const resetBtn       = document.getElementById('reset-btn');
const replayBtn      = document.getElementById('replay-btn');
const gratOrigBtn    = document.getElementById('grat-original');
const gratRedefBtn   = document.getElementById('grat-redefined');
const statusLine     = document.getElementById('status-line');
const loadingOverlay = document.getElementById('loading-overlay');
const projDiagramEl  = document.getElementById('projection-diagram');

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

  if (phase === 'projected' && isCylindrical(state.projType) && state.customPole) {
    scrollHint.classList.add('visible');
  } else {
    scrollHint.classList.remove('visible');
  }
}

function draw() {
  if (!state.data || !state.transformedData || !activeProjection) return;
  renderFrame(canvas, activeProjection, state.transformedData, state);
}

function redrawProjected() {
  const proj = getBaseProj(state.projType);
  // Only scroll shifts the projection; pole alignment is done in pre-transformed data
  proj.rotate([state.scrollDeg, 0, 0]);
  activeProjection = proj;
  draw();
}

// Build the complete transformed dataset from raw data + coordinate system.
// Also pre-transforms the original graticule so 'original' mode shows warped lines.
function buildTransformedData(system) {
  if (!state.data) return null;
  const graticule = d3.geoGraticule()();
  return {
    land:     transformGeoJSON(state.data.land,      system),
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

// ── Animation ─────────────────────────────────────────────────

function runTransitionAnimation() {
  if (state.cancelAnim) {
    state.cancelAnim();
    state.cancelAnim = null;
  }

  // Capture old state for the blend
  const oldTransformedData = state.transformedData;
  const oldScrollDeg       = state.scrollDeg;

  // Build the new coordinate system from the selected original pole
  const newSystem = buildCoordinateSystem(
    state.customPole.lon,
    state.customPole.lat,
  );
  state.coordinateSystem = newSystem;
  state.scrollDeg        = 0;
  state.transformedData  = buildTransformedData(newSystem);

  // In the new system, the new poles are always at ±90° latitude
  state.transformedPoleCoords = {
    north: [0, 90],
    south: [0, -90],
  };

  // Build the two projections for the blend
  const oldProj = makeProjection(state.projType, canvasW, canvasH);
  oldProj.rotate([oldScrollDeg, 0, 0]);

  const newProj = makeProjection(state.projType, canvasW, canvasH);
  newProj.rotate([0, 0, 0]);

  projCache.type = null; // Invalidate cache

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
  proj.rotate([state.scrollDeg, 0, 0]);
  activeProjection = proj;
  setPhase('projected');
  replayBtn.disabled = false;
  setStatus('');
  draw();
}

// ── Event handlers ────────────────────────────────────────────

// proj.invert returns [λ', φ'] (redefined coordinates, scroll-corrected by D3).
// Convert back to original sphere coordinates before setting as new north pole.
function handlePoleClick(redefinedLon, redefinedLat) {
  const [origLon, origLat] = inverseTransformPoint(
    redefinedLon, redefinedLat, state.coordinateSystem,
  );

  state.customPole  = { lon: origLon, lat: origLat };
  state.derivedPole = antipodal(origLon, origLat);

  // Show marker at the clicked screen position in the current frame
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

function handleMapScrollDelta(pxDelta) {
  if (state.phase !== 'projected') return;
  if (!isCylindrical(state.projType)) return;
  const degPerPx = 360 / Math.max(canvasW, 1);
  state.scrollDeg -= pxDelta * degPerPx;
  redrawProjected();
}

function handleProjectionChange() {
  const newType = projSelect.value;
  if (newType === state.projType) return;
  state.projType = newType;
  projCache.type = null;

  updateProjDiagram();

  if (state.phase === 'projected') {
    if (!isCylindrical(newType)) state.scrollDeg = 0;
    redrawProjected();
    if (isCylindrical(newType) && state.customPole) {
      scrollHint.classList.add('visible');
    } else {
      scrollHint.classList.remove('visible');
    }
    setStatus('');
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
  state.scrollDeg             = 0;
  state.graticuleMode         = 'redefined';
  state.transformedPoleCoords = null;
  projCache.type              = null;

  if (state.data) {
    state.transformedData = buildTransformedData(DEFAULT_SYSTEM);
  }

  updatePoleUI();
  updateGratUI();
  updateProjDiagram();
  replayBtn.disabled = true;
  instruction.classList.remove('hidden');
  setStatus('');

  setPhase('projected');
  redrawProjected();
}

function handleReplay() {
  if (!state.customPole) return;

  // Reset to default coordinate system so the animation plays from the start
  state.coordinateSystem      = DEFAULT_SYSTEM;
  state.scrollDeg             = 0;
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
  projCache.type = null;
  redrawProjected();
}

// ── Bootstrap ─────────────────────────────────────────────────

async function init() {
  const dims = resizeCanvas(canvas);
  canvasW = dims.width;
  canvasH = dims.height;

  setPhase('projected');
  updateGratUI();
  updateProjDiagram();
  redrawProjected();

  setupInteraction(canvas, () => activeProjection, state, {
    onPoleClick:      handlePoleClick,
    onGlobeDrag:      () => {},
    onMapScrollDelta: handleMapScrollDelta,
  });

  projSelect.addEventListener('change', handleProjectionChange);
  resetBtn.addEventListener('click',    handleReset);
  replayBtn.addEventListener('click',   handleReplay);
  gratOrigBtn.addEventListener('click',  () => handleGraticuleToggle('original'));
  gratRedefBtn.addEventListener('click', () => handleGraticuleToggle('redefined'));

  const ro = new ResizeObserver(handleResize);
  ro.observe(canvas);

  setStatus('Loading map data…');

  try {
    state.data = await loadData();
    state.transformedData = buildTransformedData(state.coordinateSystem);
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
