# TASK.md

## Task: Projection List Cleanup, Projection Bug Fixes, UI Update, Left Panel Diagram, and Smoother Animation

## Context

This project is **Unfixed Earth**, an interactive frontend web map visualization project.

The core technical rule remains:

```text
Natural Earth original lon-lat
→ perfect sphere coordinate reconstruction
→ user-selected pole becomes new latitude +90°
→ antipodal point becomes new latitude -90°
→ generate redefined lon-lat
→ apply selected projection
→ render 2D map
```

Do not use D3 projection rotation, projection center, CSS transform, or screen-space panning to fake pole redefinition.

D3 may be used only after the geometry has been transformed into the redefined coordinate system.

---

## 1. Projection List Cleanup

### Required Projection List

Update the projection dropdown to use the following cleaned projection list:

```text
Equirectangular
Mercator
Robinson
Gall-Peters
Cylindrical Equal Area
Mollweide
Lambert Conformal Conic
Albers Equal-Area Conic
Azimuthal Equidistant
Lambert Azimuthal Equal-Area
Orthographic
Peirce Quincuncial
```

### Remove / Do Not Include

Do not include these duplicate or ambiguous entries:

```text
Lambert conformal conic
Azimuthal equidistant
Azimuthal
Gauss-Kruger
```

### Reason

- `Lambert conformal conic` is a duplicate of `Lambert Conformal Conic`.
- `Azimuthal equidistant` is a duplicate of `Azimuthal Equidistant`.
- `Azimuthal` is a projection family, not a specific projection. Use `Orthographic`, `Azimuthal Equidistant`, and `Lambert Azimuthal Equal-Area` as specific options.
- `Gauss-Kruger` should not be included in this version because it is closer to transverse Mercator / regional grid usage and is not a strong whole-world projection option for the first version.

---

## 2. Projection Mapping Rules

Each dropdown option must map to the correct D3 projection.

Use this mapping:

```text
Equirectangular              -> d3.geoEquirectangular()
Mercator                     -> d3.geoMercator()
Robinson                     -> d3.geoRobinson()
Gall-Peters                  -> d3.geoCylindricalEqualArea().parallel(45)
Cylindrical Equal Area       -> d3.geoCylindricalEqualArea()
Mollweide                    -> d3.geoMollweide()
Lambert Conformal Conic      -> d3.geoConicConformal().parallels([30, 60])
Albers Equal-Area Conic      -> d3.geoConicEqualArea().parallels([20, 50])
Azimuthal Equidistant        -> d3.geoAzimuthalEquidistant()
Lambert Azimuthal Equal-Area -> d3.geoAzimuthalEqualArea()
Orthographic                 -> d3.geoOrthographic()
Peirce Quincuncial           -> d3.geoPeirceQuincuncial()
```

If a projection constructor comes from `d3-geo-projection`, import it correctly.

---

## 3. Bug Fix: Azimuthal Equidistant Is Incorrect

### Current Problem

Current `Azimuthal Equidistant` appears to be implemented as Lambert azimuthal equal-area.

### Required Fix

Make sure:

```text
Azimuthal Equidistant        -> d3.geoAzimuthalEquidistant()
Lambert Azimuthal Equal-Area -> d3.geoAzimuthalEqualArea()
```

These two projections must be separate dropdown options and must produce visibly different results.

### Acceptance Criteria

- Selecting `Azimuthal Equidistant` uses the equidistant azimuthal projection.
- Selecting `Lambert Azimuthal Equal-Area` uses the Lambert azimuthal equal-area projection.
- The two outputs are visually different.
- Both projections use the sphere-first redefined coordinate system before projection.
- The selected custom north pole appears at the center for both azimuthal projections.
- The original north and south poles are ordinary points after custom pole selection.

---

## 4. Bug Fix: Lambert Conformal Conic Not Showing

### Current Problem

`Lambert Conformal Conic` is not rendering or is not visible.

### Required Fix

Make `Lambert Conformal Conic` render correctly.

Use:

```ts
d3.geoConicConformal().parallels([30, 60])
```

Then apply the existing transformed/redefined coordinates to this projection.

### Things to Check

Check for:

- Incorrect projection name mapping
- Missing import
- Incorrect constructor
- Incorrect `fitExtent`, `scale`, or `translate`
- Geometry being clipped out
- Projection receiving original lon-lat instead of redefined lon-lat
- Projection factory returning `null` or falling back incorrectly
- Conic projection not being included in render condition branches

### Acceptance Criteria

- `Lambert Conformal Conic` appears in the dropdown.
- Selecting it renders the world map successfully.
- The map uses transformed/redefined coordinates.
- The selected new pole controls the conic coordinate system.
- Original north/south poles do not anchor the conic map.

---

## 5. UI Update: Bright Mode

### Required Change

Make the entire interface bright mode.

### Visual Requirements

- Main background should be white.
- Panels should use white or very light gray.
- Text should be dark gray or black.
- Map area should remain visually clear against the white interface.
- Avoid dark-mode styling.
- Avoid black full-page backgrounds.

### Acceptance Criteria

- The app visually reads as a bright-mode interface.
- No major container uses a dark background.
- Text remains readable.

---

## 6. UI Update: Larger Control Panel and Text

### Required Change

Make the control panel and text approximately **1.5 times larger** than the current version.

### Apply To

- Projection dropdown
- Graticule toggle
- Reset button
- Any other control button
- Panel headings
- Pole coordinate information
- Status text

### Acceptance Criteria

- Control panel is easier to read.
- Text is visibly larger.
- Buttons and dropdowns have larger clickable areas.
- Layout remains clean and does not feel cramped.

---

## 7. Layout Update: Add Left Panel

### Required Change

The map should be placed at the center of the interface.

Add a left panel that has approximately the same width as the existing right control panel.

Final layout:

```text
Left explanatory panel | Center map view | Right control panel
```

### Layout Requirements

- Center map area should remain the main focus.
- Left panel and right panel should be visually balanced.
- Left panel width should be approximately equal to right control panel width.
- The map should be horizontally and vertically centered in the middle region.
- The interface should not feel left-heavy or right-heavy.

---

## 8. Left Panel: Projection Formation Diagram

### Required Change

Add a visual diagram in the left panel showing how the selected projection surface creates the map.

The diagram should be similar in concept to the attached reference image:

```text
A globe with a cylinder or cone placed around/on top of it,
with the two poles indicated,
showing how the map is created through projection transformation.
```

### Diagram Behavior by Projection Type

The left panel diagram should change depending on the selected projection family.

### Cylindrical / Pseudo-Cylindrical Projections

For:

```text
Equirectangular
Mercator
Robinson
Gall-Peters
Cylindrical Equal Area
Mollweide
```

Show:

- A globe
- A cylinder around the globe
- New north pole indicated
- New south pole indicated
- Visual suggestion that the cylinder unwraps into a rectangular map

The cylinder does not need to be physically perfect. It can be a simplified SVG diagram.

### Conic Projections

For:

```text
Lambert Conformal Conic
Albers Equal-Area Conic
```

Show:

- A globe
- A cone placed over/around the globe, similar to the attached reference image
- New north pole indicated near the cone apex direction
- New south pole indicated on the opposite side
- Visual suggestion that the cone unwraps into a conic map

### Azimuthal Projections

For:

```text
Azimuthal Equidistant
Lambert Azimuthal Equal-Area
Orthographic
Peirce Quincuncial
```

Show:

- A globe
- A flat projection plane touching or facing the globe near the selected new north pole
- New north pole indicated at the projection center
- New south pole indicated opposite the center direction where appropriate

### Diagram Style

- Use simple SVG or HTML/CSS vector drawing.
- Use thin outlines.
- Use white/light background.
- Use clear but minimal labels.
- Do not use image assets unless necessary.
- The diagram can be schematic, not physically exact.
- The diagram should remain visually similar in spirit to the reference image: simple globe + projection surface + pole indicators.

### Acceptance Criteria

- Left panel contains a clear diagram.
- Diagram updates when projection family changes.
- Cylindrical projections show a cylinder.
- Conic projections show a cone.
- Azimuthal projections show a plane.
- New north and south poles are indicated.
- Diagram is readable in bright mode.

---

## 9. Left Panel: Pole Location Information

### Required Change

Below the projection formation diagram, show information about the current new north and south poles.

### Required Information

Show:

```text
New North Pole
Original lon-lat: [lon, lat]
Redefined coordinate: 90° N, 0° E
Location: [country / ocean / region if available]

New South Pole
Original lon-lat: [lon, lat]
Redefined coordinate: 90° S, 0° E
Location: [country / ocean / region if available]
```

### Notes

At the exact pole, longitude is mathematically undefined. For UI clarity, it is acceptable to display:

```text
90° N, 0° E
90° S, 0° E
```

But the implementation should understand that the longitude value at the pole is arbitrary.

### Location / Country

If country detection is already available or easy from the current Natural Earth country geometry, show the country name.

If not available yet, show one of:

```text
Country detection not available
Ocean / land unknown
Location lookup pending
```

Do not add a heavy new geocoder or external API for this version.

### Acceptance Criteria

- North pole original lon-lat is shown.
- South pole original lon-lat is shown.
- Redefined pole coordinates are shown clearly.
- The display does not imply that longitude at the pole is mathematically meaningful.
- No external API is required.

---

## 10. Animation Update: Smooth and Slower Transformation

### Current Problem

The animation from original map to redefined map is too abrupt.

### Required Change

Make the transition from the previous map state to the redefined map state smoother and slower.

### Animation Requirements

- Continents should move smoothly from old projected positions to new projected positions.
- Avoid sudden jumps.
- Avoid instant geometry replacement.
- Animation should be slow enough for the user to understand that the map is being reconstructed.
- Recommended duration:

```text
1200ms to 2000ms
```

- Use easing such as:

```text
easeCubicInOut
```

or equivalent.

### Important Technical Rule

The animation can interpolate visually between old and new projected coordinates, but the final state must be mathematically correct.

Do not fake the final map with CSS transform.

Do not rely on screen-space rotation as the actual projection logic.

### Acceptance Criteria

- Map transformation feels smooth.
- Continents visibly move from old positions to new positions.
- The selected pole moves toward its correct final position.
- Cylindrical projections place the selected pole at the top edge in the final state.
- Azimuthal projections place the selected pole at the center in the final state.
- The final rendered geometry uses the sphere-first coordinate reconstruction pipeline.

---

## 11. Preserve Existing Core Features

Do not remove or break existing required features:

- 2D map starting view
- Projection dropdown
- Graticule toggle
- Reset button
- Custom north pole selection
- Antipodal south pole calculation
- Sphere-first coordinate reconstruction
- Horizontal scrolling for cylindrical / pseudo-cylindrical projections
- Original lon-lat graticule mode
- Redefined lon-lat graticule mode

---

## 12. Required Validation Tests

After this task, verify the following.

### Projection Mapping Tests

- `Azimuthal Equidistant` and `Lambert Azimuthal Equal-Area` produce different maps.
- `Lambert Conformal Conic` renders successfully.
- `Gall-Peters` differs from generic `Cylindrical Equal Area`.
- Duplicate projection names do not appear in the dropdown.
- `Gauss-Kruger` does not appear in the dropdown.

### Coordinate System Tests

Use selected pole:

```text
[30°, 45°]
```

Expected:

- `[30°, 45°]` transforms to new latitude `+90°`.
- `[-150°, -45°]` transforms to new latitude `-90°`.
- In equirectangular, `[30°, 45°]` appears on the top edge.
- In equirectangular, `[-150°, -45°]` appears on the bottom edge.
- Original north pole no longer anchors the map.
- Redefined graticule aligns with the transformed geometry.
- Original graticule appears distorted.

### UI Tests

- Interface is bright mode.
- Text and controls are approximately 1.5 times larger.
- Left panel is present.
- Left panel width roughly matches right control panel width.
- Map is centered.
- Projection formation diagram appears in the left panel.
- Diagram changes according to projection family.
- Pole location information appears below the diagram.

### Animation Tests

- Transition is not abrupt.
- Continents move smoothly.
- Final projected geometry is correct.
- Animation duration is approximately 1200ms to 2000ms.

---

## 13. Files to Inspect First

Start by inspecting files related to:

```text
projection list / projection factory
coordinate transformation
map rendering
animation
layout
control panel
```

Likely file areas:

```text
src/projection/*
src/coordinate/*
src/components/*
src/styles/*
src/App*
```

Do not modify unrelated files.

---

## 14. Implementation Priority

Recommended order:

1. Fix projection list and remove duplicates.
2. Fix projection constructor mapping.
3. Fix `Azimuthal Equidistant` vs `Lambert Azimuthal Equal-Area`.
4. Fix `Lambert Conformal Conic` rendering.
5. Verify all projections still use transformed/redefined coordinates.
6. Add bright-mode styling.
7. Increase control/text scale by approximately 1.5x.
8. Add left panel layout.
9. Add projection formation diagram.
10. Add pole location information.
11. Smooth and slow the map transformation animation.
12. Run validation tests.

---

## 15. Do Not Do

Do not:

- Add backend.
- Add external APIs.
- Add database.
- Add new data layers.
- Add user accounts.
- Add export features.
- Add mobile optimization as a separate task.
- Reintroduce globe-first starting view.
- Use D3 rotation as the main pole-redefinition method.
- Use CSS transform as the actual projection method.
- Change Git state.
- Modify unrelated files.
