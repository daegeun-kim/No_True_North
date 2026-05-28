// diagram.js — dynamic pole-aligned projection surface diagram

const CX  = 120;   // sphere centre x in viewBox
const CY  = 148;   // sphere centre y in viewBox
const R   = 62;    // sphere radius
const D2R = Math.PI / 180;

// Project the 3D pole vector onto the diagram's 2D side-view plane.
// Viewer is at positive-X; diagram horizontal = Y axis; diagram vertical = -Z axis.
//   dx = cos(lat)*sin(lon)   (east–west in the diagram)
//   dy = -sin(lat)           (up–down; negated so north is up)
// Returns a normalised direction [adx, ady].
function computeAxisDir(lon, lat) {
  const φ = lat * D2R;
  const λ = lon * D2R;
  const dx = Math.cos(φ) * Math.sin(λ);
  const dy = -Math.sin(φ);
  const len = Math.sqrt(dx * dx + dy * dy);
  // Near-degenerate (axis points at viewer): fall back to upright
  if (len < 0.05) return [0, -1];
  return [dx / len, dy / len];
}

// SVG rotate transform string around the sphere centre
function rot(θ) {
  return `rotate(${θ.toFixed(1)},${CX},${CY})`;
}

// Cone geometry constants (upright frame).
// Apex is d=128 units above sphere centre → tangent half-width bHW = (h+d)·R/√(d²−R²).
// With h=70 (base 70 below centre): bHW ≈ 110. Sides land at x=10 and x=230 — within viewBox.
const CONE_D     = 128;
const CONE_H     = 70;
const CONE_APEX  = CY - CONE_D;                                                   // y = 20
const CONE_BASE  = CY + CONE_H;                                                   // y = 218
const CONE_HW    = Math.round((CONE_H + CONE_D) * R / Math.sqrt(CONE_D * CONE_D - R * R)); // ≈ 110

// Elements drawn BEHIND the globe (before the sphere circle in SVG order)
function backSurface(family, θ) {
  const r   = rot(θ);
  const ext = 22;          // how far the surface extends beyond the sphere

  if (family === 'cylindrical') {
    return `
      <ellipse cx="${CX}" cy="${CY + R + ext}" rx="${R}" ry="16"
               fill="#f0f0f0" stroke="#aaa" stroke-width="1.2" transform="${r}"/>
      <rect x="${CX - R}" y="${CY - R - ext}" width="${R * 2}" height="${(R + ext) * 2}" rx="3"
            fill="rgba(200,220,250,0.12)" stroke="#aaa" stroke-width="1.2" transform="${r}"/>`;
  }

  if (family === 'conic') {
    // Base ellipse behind the sphere — like the cylinder's bottom cap
    return `
      <ellipse cx="${CX}" cy="${CONE_BASE}" rx="${CONE_HW}" ry="16"
               fill="#f0f0f0" stroke="#aaa" stroke-width="1.2" transform="${r}"/>`;
  }

  return '';
}

// Elements drawn IN FRONT of the globe (after the sphere circle in SVG order)
function frontSurface(family, θ) {
  const r   = rot(θ);
  const ext = 22;

  if (family === 'cylindrical') {
    return `
      <ellipse cx="${CX}" cy="${CY - R - ext}" rx="${R}" ry="16"
               fill="#f0f0f0" stroke="#aaa" stroke-width="1.2" transform="${r}"/>`;
  }

  if (family === 'conic') {
    // Transparent cone body covering the sphere (sides are tangent to sphere circle).
    // Then the base ellipse again on top, so the bottom opening is clearly visible
    // through the transparent surface — matching the cylinder's two-cap style.
    const lx = CX - CONE_HW;
    const rx2 = CX + CONE_HW;
    return `
      <path d="M ${CX},${CONE_APEX} L ${lx},${CONE_BASE} Q ${CX},${CONE_BASE + 20} ${rx2},${CONE_BASE} Z"
            fill="rgba(200,220,250,0.15)" stroke="#aaa" stroke-width="1.2"
            transform="${r}"/>
      <ellipse cx="${CX}" cy="${CONE_BASE}" rx="${CONE_HW}" ry="16"
               fill="#f0f0f0" stroke="#aaa" stroke-width="1.2" transform="${r}"/>`;
  }

  if (family === 'azimuthal') {
    return `
      <ellipse cx="${CX}" cy="${CY - R}" rx="${R + 20}" ry="18"
               fill="rgba(200,220,250,0.30)" stroke="#4a90d9" stroke-width="1.4"
               transform="${r}"/>`;
  }

  return '';
}

// Render a dynamic pole-aligned diagram into `container` (sets innerHTML).
// poleLon / poleLat are the *original* sphere coordinates of the custom north pole,
// or null/undefined for the default state (pole at geographic north).
export function renderDiagram(container, family, poleLon, poleLat) {
  const lon = (poleLon == null) ? 0  : poleLon;
  const lat = (poleLat == null) ? 90 : poleLat;

  const [adx, ady] = computeAxisDir(lon, lat);

  // Rotation angle (degrees) from the upright position [0, -1]
  const θ = Math.atan2(adx, -ady) * 180 / Math.PI;

  // Pole marker positions: on the sphere surface, pushed outward by MRKR - R extra
  const MRKR = R + 13;
  const NX = (CX + adx * MRKR).toFixed(1);
  const NY = (CY + ady * MRKR).toFixed(1);
  const SX = (CX - adx * MRKR).toFixed(1);
  const SY = (CY - ady * MRKR).toFixed(1);

  // Place each label on the side away from the sphere centre
  const nRight  = parseFloat(NX) >= CX;
  const nTextX  = (nRight ? +NX + 9 : +NX - 9).toFixed(1);
  const nAnchor = nRight ? 'start' : 'end';
  const sRight  = parseFloat(SX) >= CX;
  const sTextX  = (sRight ? +SX + 9 : +SX - 9).toFixed(1);
  const sAnchor = sRight ? 'start' : 'end';

  const caption = {
    cylindrical: 'Cylinder unwraps to flat rectangle',
    conic:       'Cone unwraps to fan shape',
    azimuthal:   'Projected onto flat plane',
  }[family] ?? '';

  container.innerHTML = `<svg viewBox="0 0 240 295" fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style="width:100%;max-width:260px;display:block">
    ${backSurface(family, θ)}
    <!-- Globe -->
    <circle cx="${CX}" cy="${CY}" r="${R}"
            fill="#e8ede8" stroke="#666" stroke-width="1.2"/>
    <ellipse cx="${CX}" cy="${CY}" rx="${R}" ry="17"
             stroke="#c0c0c0" stroke-width="0.9" stroke-dasharray="5,3"/>
    <ellipse cx="${CX}" cy="${CY}" rx="27" ry="${R}"
             stroke="#c0c0c0" stroke-width="0.9" stroke-dasharray="5,3"/>
    ${frontSurface(family, θ)}
    <!-- Pole axis -->
    <line x1="${NX}" y1="${NY}" x2="${SX}" y2="${SY}"
          stroke="#999" stroke-width="0.9" stroke-dasharray="5,4"/>
    <!-- N′ marker -->
    <circle cx="${NX}" cy="${NY}" r="6" fill="#ea4646"/>
    <text x="${nTextX}" y="${(+NY + 4.5).toFixed(1)}" font-size="13" fill="#ea4646"
          text-anchor="${nAnchor}"
          font-family="system-ui,sans-serif" font-weight="600">N′</text>
    <!-- S′ marker -->
    <circle cx="${SX}" cy="${SY}" r="6" fill="#539eef"/>
    <text x="${sTextX}" y="${(+SY + 4.5).toFixed(1)}" font-size="13" fill="#539eef"
          text-anchor="${sAnchor}"
          font-family="system-ui,sans-serif" font-weight="600">S′</text>
    <!-- Caption -->
    <text x="120" y="288" text-anchor="middle" font-size="11" fill="#888"
          font-family="system-ui,sans-serif">${caption}</text>
  </svg>`;
}
