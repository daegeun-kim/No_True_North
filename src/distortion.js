import * as d3 from 'd3';
import { transformPoint, buildCoordinateSystem } from './transform.js';

// ── Distortion normalization config ───────────────────────────
// Fixed global thresholds — same across all projections so colors are comparable.
// sizeDistortionMax: raw value that maps to full size-distortion color
//   (|log(h·k / medianHK)| scale; ≈3.0 ≈ 20× area enlargement or shrinkage)
// shapeDistortionMax: raw value that maps to full shape-distortion color
//   (|log(max(h,k) / min(h,k))| scale; 1.0 ≈ e≈2.7× axis ratio)
export const DISTORTION_NORMALIZATION_CONFIG = {
  sizeDistortionMax:  3.0,
  shapeDistortionMax: 1.0,
};

// ── Color / transparency config ────────────────────────────────
// Edit these values to adjust the visual appearance of distortion mode.
export const DISTORTION_COLOR_CONFIG = {
  sizeColor:      '#1692fe',
  shapeColor:     '#dc2626',
  lowColor:       '#ffffff',
  borderColor:    '#111827',
  countryOpacity: 0.9,
  noDataColor:    '#d4d4d4',
};

const EPS = 0.35; // degrees for finite-difference Jacobian

// ── Hex ↔ RGB ──────────────────────────────────────────────────
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// Bivariate 2×2 corner interpolation:
//   (s=0, q=0) → neutral light
//   (s=1, q=0) → sizeColor
//   (s=0, q=1) → shapeColor
//   (s=1, q=1) → mixed
export function bivariateColor(s, q, sizeHex, shapeHex) {
  const [sr, sg, sb] = hexToRgb(sizeHex);
  const [qr, qg, qb] = hexToRgb(shapeHex);
  const wr = 228, wg = 228, wb = 228;
  const mr = (sr + qr) >> 1, mg = (sg + qg) >> 1, mb = (sb + qb) >> 1;

  const r = (1 - s) * (1 - q) * wr + s * (1 - q) * sr + (1 - s) * q * qr + s * q * mr;
  const g = (1 - s) * (1 - q) * wg + s * (1 - q) * sg + (1 - s) * q * qg + s * q * mg;
  const b = (1 - s) * (1 - q) * wb + s * (1 - q) * sb + (1 - s) * q * qb + s * q * mb;

  return [
    Math.max(0, Math.min(255, Math.round(r))),
    Math.max(0, Math.min(255, Math.round(g))),
    Math.max(0, Math.min(255, Math.round(b))),
  ];
}

// ── Tissot h/k scale factors at a projected point ─────────────
// lp, fp are coordinates in the redefined system (what d3 projection receives).
function computeHK(projection, lp, fp) {
  const D2R  = Math.PI / 180;
  const fpN  = Math.min(89.5, fp + EPS);
  const fpS  = Math.max(-89.5, fp - EPS);
  const lpE  = lp + EPS;
  const lpW  = lp - EPS;

  const pN = projection([lp, fpN]);
  const pS = projection([lp, fpS]);
  const pE = projection([lpE, fp]);
  const pW = projection([lpW, fp]);

  if (!pN || !pS || !pE || !pW) return null;
  if ([pN, pS, pE, pW].some(p => isNaN(p[0]) || isNaN(p[1]))) return null;

  const cosF = Math.max(0.02, Math.cos(fp * D2R));
  const h = Math.sqrt((pN[0] - pS[0]) ** 2 + (pN[1] - pS[1]) ** 2) / (fpN - fpS);
  const k = Math.sqrt((pE[0] - pW[0]) ** 2 + (pE[1] - pW[1]) ** 2) / ((lpE - lpW) * cosF);

  if (h < 1e-4 || k < 1e-4 || !isFinite(h) || !isFinite(k)) return null;
  return { h, k };
}

// ── Country sample point precomputation ───────────────────────
// Call once after data load on the original (untransformed) countries GeoJSON.
// Returns Map<countryId, [[lon, lat], ...]> in original geographic coordinates.
export function precomputeCountrySamples(countriesGeoJSON) {
  const samples = new Map();

  for (const feature of countriesGeoJSON.features) {
    const area = d3.geoArea(feature);
    const N    = area > 0.01 ? 20 : area > 0.001 ? 8 : 2;
    const pts  = samplePointsInFeature(feature, N);
    samples.set(feature.id, pts.length > 0 ? pts : [d3.geoCentroid(feature)]);
  }

  return samples;
}

function samplePointsInFeature(feature, targetN) {
  const [[lon0, lat0], [lon1, lat1]] = d3.geoBounds(feature);

  // Countries spanning the antimeridian get a wide bbox — fall back to centroid.
  if (lon1 - lon0 > 170) {
    return [d3.geoCentroid(feature)];
  }

  const pts   = [];
  const steps = Math.ceil(Math.sqrt(targetN * 4));
  const dLon  = (lon1 - lon0) / Math.max(1, steps);
  const dLat  = (lat1 - lat0) / Math.max(1, steps);

  outer:
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const lon = lon0 + i * dLon;
      const lat = lat0 + j * dLat;
      if (d3.geoContains(feature, [lon, lat])) {
        pts.push([lon, lat]);
        if (pts.length >= targetN * 3) break outer;
      }
    }
  }

  if (pts.length === 0) return [d3.geoCentroid(feature)];

  if (pts.length > targetN) {
    const step = Math.floor(pts.length / targetN);
    return pts.filter((_, i) => i % step === 0).slice(0, targetN);
  }
  return pts;
}

// ── Country-level distortion computation ──────────────────────
// Returns Map<countryId, { sizeNorm, shapeNorm }> with values in [0, 1].
// Distortion is measured relative to the projection's own scale distribution,
// not against the default north-pole orientation — so the default map also shows distortion.
export function computeCountryDistortions(originalCountries, countrySamples, projection, coordinateSystem) {
  const perCountry = [];
  const allHK      = [];

  // First pass: collect h,k at each sample point for every country
  for (const feature of originalCountries.features) {
    const id  = feature.id;
    const pts = countrySamples.get(id) ?? [d3.geoCentroid(feature)];
    const hks = [];

    for (const [lon, lat] of pts) {
      const [lp, fp] = transformPoint(lon, lat, coordinateSystem);
      const pc = projection([lp, fp]);
      if (!pc || isNaN(pc[0]) || isNaN(pc[1])) continue;
      const hk = computeHK(projection, lp, fp);
      if (hk) {
        hks.push(hk);
        allHK.push(hk.h * hk.k);
      }
    }

    perCountry.push({ id, hks });
  }

  if (allHK.length === 0) return new Map();

  // Global median area scale used as size-distortion reference
  const sorted   = allHK.slice().sort((a, b) => a - b);
  const medianHK = sorted[Math.floor(sorted.length / 2)];

  // Second pass: normalize directly against global fixed thresholds.
  // Using fixed constants (not per-map percentiles) keeps color comparable across projections.
  const { sizeDistortionMax, shapeDistortionMax } = DISTORTION_NORMALIZATION_CONFIG;

  const result = new Map();
  for (const { id, hks } of perCountry) {
    if (hks.length === 0) {
      result.set(id, { sizeNorm: 0, shapeNorm: 0 });
      continue;
    }

    const avgHK    = hks.reduce((s, r) => s + r.h * r.k, 0) / hks.length;
    const sizeRaw  = Math.abs(Math.log(avgHK / medianHK));
    const shapeRaw = hks.reduce((s, r) => {
      return s + Math.abs(Math.log(Math.max(r.h, r.k) / Math.min(r.h, r.k)));
    }, 0) / hks.length;

    result.set(id, {
      sizeNorm:  Math.min(1, sizeRaw  / sizeDistortionMax),
      shapeNorm: Math.min(1, shapeRaw / shapeDistortionMax),
    });
  }

  return result;
}

// ── Min/max distortion preset search ─────────────────────────
// key: 'minSize' | 'maxSize' | 'minShape' | 'maxShape'
// makeProjectionFn: (width, height) => d3 projection (for the current projection type)
// Returns [lon, lat] of the pole that produces the best distortion score.
export function searchDistortionPreset(key, originalCountries, makeProjectionFn, width, height) {
  const maximize = key.startsWith('max');
  const metric   = key.includes('Size') ? 'size' : 'shape';

  // Use country centroids for fast scoring during search
  const centroids = originalCountries.features
    .map(f => ({ area: d3.geoArea(f), centroid: d3.geoCentroid(f) }))
    .filter(c => c.area > 0 && c.centroid && !c.centroid.some(isNaN));

  // Coarse grid search (30° lon × 30° lat)
  let bestPole  = [0, 90];
  let bestScore = maximize ? -Infinity : Infinity;

  for (let lat = -75; lat <= 90; lat += 30) {
    for (let lon = -150; lon <= 180; lon += 30) {
      const score = scoreCandidate(lon, lat, centroids, makeProjectionFn, width, height, metric);
      if (maximize ? score > bestScore : score < bestScore) {
        bestScore = score;
        bestPole  = [lon, lat];
      }
    }
  }

  // Fine search ±20° around best candidate (5° step)
  const [bLon, bLat] = bestPole;
  for (let dlat = -20; dlat <= 20; dlat += 5) {
    for (let dlon = -20; dlon <= 20; dlon += 5) {
      const lon2 = ((bLon + dlon + 360 + 180) % 360) - 180;
      const lat2 = Math.max(-89, Math.min(89, bLat + dlat));
      const score = scoreCandidate(lon2, lat2, centroids, makeProjectionFn, width, height, metric);
      if (maximize ? score > bestScore : score < bestScore) {
        bestScore = score;
        bestPole  = [lon2, lat2];
      }
    }
  }

  return bestPole;
}

// Area-weighted mean distortion score for a candidate pole — used only in search.
function scoreCandidate(poleLon, poleLat, centroids, makeProjectionFn, width, height, metric) {
  const system = buildCoordinateSystem(poleLon, poleLat);
  const proj   = makeProjectionFn(width, height);
  proj.rotate([0, 0, 0]);

  // Collect all hk values for global median
  const allHK = [];
  for (const { centroid } of centroids) {
    const [lp, fp] = transformPoint(centroid[0], centroid[1], system);
    const pc = proj([lp, fp]);
    if (!pc || isNaN(pc[0]) || isNaN(pc[1])) continue;
    const hk = computeHK(proj, lp, fp);
    if (hk) allHK.push(hk.h * hk.k);
  }

  if (allHK.length === 0) return 0;
  const sorted   = allHK.slice().sort((a, b) => a - b);
  const medianHK = sorted[Math.floor(sorted.length / 2)];

  let totalScore  = 0;
  let totalWeight = 0;

  for (const { area, centroid } of centroids) {
    const [lp, fp] = transformPoint(centroid[0], centroid[1], system);
    const pc = proj([lp, fp]);
    if (!pc || isNaN(pc[0]) || isNaN(pc[1])) continue;
    const hk = computeHK(proj, lp, fp);
    if (!hk) continue;

    const score = metric === 'size'
      ? Math.abs(Math.log(hk.h * hk.k / medianHK))
      : Math.abs(Math.log(Math.max(hk.h, hk.k) / Math.min(hk.h, hk.k)));

    totalScore  += score * area;
    totalWeight += area;
  }

  return totalWeight > 0 ? totalScore / totalWeight : 0;
}
