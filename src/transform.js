const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

function dot(a, b) {
  return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}

function cross(a, b) {
  return [
    a[1]*b[2] - a[2]*b[1],
    a[2]*b[0] - a[0]*b[2],
    a[0]*b[1] - a[1]*b[0],
  ];
}

function normalize(v) {
  const m = Math.sqrt(dot(v, v));
  return m > 0 ? [v[0]/m, v[1]/m, v[2]/m] : [1, 0, 0];
}

export function lonLatToVector(lon, lat) {
  const λ = lon * D2R;
  const φ = lat * D2R;
  return [
    Math.cos(φ) * Math.cos(λ),
    Math.cos(φ) * Math.sin(λ),
    Math.sin(φ),
  ];
}

export function vectorToLonLat(v) {
  return [
    Math.atan2(v[1], v[0]) * R2D,
    Math.asin(Math.max(-1, Math.min(1, v[2]))) * R2D,
  ];
}

// Build a new spherical coordinate system around the selected pole.
// Returns P (pole unit vector), E1 and E2 (equatorial basis vectors).
// Convention: E1 is aligned with the original lon=0° direction when possible,
// giving identity transformation when the default north pole is selected.
export function buildCoordinateSystem(poleLon, poleLat) {
  const P = lonLatToVector(poleLon, poleLat);

  // Choose reference vector not parallel to P, preferring [1,0,0] so that
  // the default pole (0°,90°) produces the identity transformation.
  let A;
  if (Math.abs(P[0]) < 0.9) {
    A = [1, 0, 0];
  } else if (Math.abs(P[1]) < 0.9) {
    A = [0, 1, 0];
  } else {
    A = [0, 0, 1];
  }

  // Gram-Schmidt: project A onto the equatorial plane perpendicular to P
  const dotAP = dot(A, P);
  const Aproj = [
    A[0] - dotAP * P[0],
    A[1] - dotAP * P[1],
    A[2] - dotAP * P[2],
  ];
  const E1 = normalize(Aproj);
  const E2 = cross(P, E1); // unit vector, right-hand rule

  let southLon = poleLon + 180;
  if (southLon > 180) southLon -= 360;

  return {
    poleVector: P,
    basisE1: E1,
    basisE2: E2,
    newNorthPoleOriginalLonLat: [poleLon, poleLat],
    newSouthPoleOriginalLonLat: [southLon, -poleLat],
  };
}

// Transform one original [lon, lat] into the new coordinate system [λ', φ'].
export function transformPoint(lon, lat, system) {
  const v = lonLatToVector(lon, lat);
  const { poleVector: P, basisE1: E1, basisE2: E2 } = system;

  // New latitude: arcsin of the dot product with the new pole axis
  const dotPV = Math.max(-1, Math.min(1, dot(P, v)));
  const newLat = Math.asin(dotPV) * R2D;

  // New longitude: project v onto the equatorial plane, then find angle
  const q = [
    v[0] - dotPV * P[0],
    v[1] - dotPV * P[1],
    v[2] - dotPV * P[2],
  ];
  const newLon = Math.atan2(dot(q, E2), dot(q, E1)) * R2D;

  return [newLon, newLat];
}

// Inverse: given [λ', φ'] in the redefined system, return original [lon, lat].
// Used to convert a screen click (inverted via projection) back to original coords.
export function inverseTransformPoint(newLon, newLat, system) {
  const { poleVector: P, basisE1: E1, basisE2: E2 } = system;
  const λ = newLon * D2R;
  const φ = newLat * D2R;
  const sinφ = Math.sin(φ);
  const cosφ = Math.cos(φ);
  const cosλ = Math.cos(λ);
  const sinλ = Math.sin(λ);

  // Reconstruct the 3D vector from the new basis
  const v = [
    sinφ * P[0] + cosφ * (cosλ * E1[0] + sinλ * E2[0]),
    sinφ * P[1] + cosφ * (cosλ * E1[1] + sinλ * E2[1]),
    sinφ * P[2] + cosφ * (cosλ * E1[2] + sinλ * E2[2]),
  ];

  return vectorToLonLat(v);
}

// ── GeoJSON transformation ────────────────────────────────────

function transformCoord(coord, system) {
  return transformPoint(coord[0], coord[1], system);
}

function transformRing(ring, system) {
  return ring.map(c => transformCoord(c, system));
}

function transformGeometry(geom, system) {
  if (!geom) return geom;
  switch (geom.type) {
    case 'Point':
      return { ...geom, coordinates: transformCoord(geom.coordinates, system) };
    case 'MultiPoint':
    case 'LineString':
      return { ...geom, coordinates: geom.coordinates.map(c => transformCoord(c, system)) };
    case 'MultiLineString':
    case 'Polygon':
      return { ...geom, coordinates: geom.coordinates.map(r => transformRing(r, system)) };
    case 'MultiPolygon':
      return { ...geom, coordinates: geom.coordinates.map(p => p.map(r => transformRing(r, system))) };
    case 'GeometryCollection':
      return { ...geom, geometries: geom.geometries.map(g => transformGeometry(g, system)) };
    default:
      return geom;
  }
}

// Transform a GeoJSON Feature, FeatureCollection, or raw geometry object.
export function transformGeoJSON(obj, system) {
  if (!obj) return obj;
  if (obj.type === 'FeatureCollection') {
    return {
      ...obj,
      features: obj.features.map(f => ({
        ...f,
        geometry: transformGeometry(f.geometry, system),
      })),
    };
  }
  if (obj.type === 'Feature') {
    return { ...obj, geometry: transformGeometry(obj.geometry, system) };
  }
  // Raw geometry (e.g. MultiLineString from geoGraticule)
  return transformGeometry(obj, system);
}
