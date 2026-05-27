# Unfixed Earth — Sphere-First Projection Reconstruction Specification

## 1. Project Summary

**Unfixed Earth** is an interactive frontend web map visualization project that lets users redefine the Earth's poles and regenerate world maps from that new spherical coordinate system.

The project assumes the Earth is a perfect sphere.

The project does **not** rotate, pan, or visually re-center an existing projected map. Instead, it rebuilds the longitude-latitude coordinate system on the sphere first. Only after the new coordinate system is created does the app apply the selected projection to create a 2D map.

The core concept:

```text
Earth as perfect sphere
→ user selects a new north pole
→ opposite point becomes new south pole
→ new latitude circles are generated from the new pole axis
→ new longitude meridians are generated between the two new poles
→ every Earth geometry point is converted into this new coordinate system
→ selected projection is applied to the new coordinates
→ new 2D world map is rendered
```

## 2. Conceptual Goal

The Earth itself is natural.

A map is artificial because it depends on human-defined choices:

- North pole
- South pole
- Longitude system
- Latitude system
- Projection surface
- Projection formula
- Map seam
- Map orientation

This project reveals that the conventional world map is only one possible mapping of the same Earth.

When the user selects a new north pole, the app should create a new map that is equally valid under its own artificial coordinate system.

## 3. Most Important Technical Requirement

The selected point must become the actual north pole of the generated map.

It must not become:

- A visual center point
- A map pan target
- A projection center only
- A decorative marker
- A point around which the old coordinate system rotates visually

The app must create a new coordinate system where:

```text
selected point = new latitude +90°
antipodal point = new latitude -90°
```

For cylindrical and pseudo-cylindrical maps, the selected point must move to the top edge of the map because the top edge represents the stretched north pole of the new coordinate system.

For azimuthal maps, the selected point must move to the center because the azimuthal projection is centered on the new pole.

## 4. Wrong Implementation to Avoid

The following pipeline is incorrect:

```text
Natural Earth original lon-lat
→ D3 projection using original coordinate system
→ projection.rotate / projection.center / screen pan / CSS transform
→ draw horizontal and vertical grid lines
→ call those lines the new coordinate system
```

This is wrong because the original north and south poles remain the hidden anchors of the map.

If the map still revolves around the original north and south pole when panning, the coordinate system has not been rebuilt.

If the land geometry does not follow the new graticule, the graticule is fake.

If the original pole remains the top of the cylindrical map after a custom pole is selected, the implementation is wrong.

## 5. Correct Implementation Pipeline

The correct pipeline is:

```text
Natural Earth original lon-lat
→ place each coordinate onto a perfect sphere
→ build a new spherical axis from the user-selected north pole
→ calculate new latitude from angular distance to the selected pole
→ calculate new longitude from angular position around the new pole axis
→ generate new lon-lat coordinates
→ pass only the new lon-lat coordinates into the selected projection
→ render the 2D map
```

D3 may still be used for projection rendering, path drawing, animation, and UI. However, D3 should receive already transformed coordinates. The core coordinate reconstruction must happen before projection.

## 6. Starting Interface

The app should start in a **2D map view**, not a globe view.

Default start state:

```text
Projection: Equirectangular
Coordinate system: conventional Earth coordinate system
Graticule mode: Redefined / Current coordinate system
Map view: 2D world map
```

At startup, the current coordinate system and original coordinate system are identical.

The user can change the projection type before selecting a new pole.

The user selects the new north pole by clicking on the 2D map.

A globe view may be added later, but the first version should start from the 2D projected world map.

## 7. Required Projection Options

The UI must include the following projection options:

```text
Equirectangular
Mercator
Robinson
Lambert conformal conic
Azimuthal
```

Recommended internal type:

```ts
type ProjectionType =
  | "equirectangular"
  | "mercator"
  | "robinson"
  | "lambertConformalConic"
  | "azimuthal";
```

The selected projection type should remain active when the pole changes.

Example:

```text
User selects Mercator
→ user clicks a new north pole
→ the map transforms into a new Mercator map based on the new poles
```

The app should not switch projection type automatically after pole selection.

## 8. Required UI Controls

The first version should include:

- Projection dropdown
- Graticule toggle
- Reset button
- Optional replay animation button
- Optional markers toggle
- Horizontally scrollable map area for cylindrical and pseudo-cylindrical maps

Required projection dropdown options:

```text
Equirectangular
Mercator
Robinson
Lambert conformal conic
Azimuthal
```

Required graticule toggle options:

```text
Original lon-lat
Redefined lon-lat
```

## 9. Step-by-Step Coordinate Reconstruction

This section is the core specification.

### Step 1 — Treat the Earth as a Perfect Sphere

Natural Earth data arrives as longitude-latitude coordinates.

These coordinates are only used to place points on the sphere.

For every coordinate:

```text
original coordinate = [λ, φ]
```

Convert it into a 3D unit sphere point.

Use radians for calculation:

```text
x = cos(φ) * cos(λ)
y = cos(φ) * sin(λ)
z = sin(φ)
```

The result is:

```text
v = [x, y, z]
```

At this stage, the point is no longer treated as a flat map coordinate. It is treated as a point on a sphere.

### Step 2 — User Selects a New North Pole

The user clicks a point on the current 2D map.

The app must convert that clicked screen position back to the corresponding original point on the sphere.

The selected point becomes:

```text
newNorthPoleOriginalLonLat = [λp, φp]
```

Convert it into a 3D unit vector:

```text
P = [xp, yp, zp]
```

This vector `P` defines the new north pole direction.

### Step 3 — Calculate the New South Pole

The new south pole is the exact opposite side of the sphere.

In 3D vector form:

```text
S = -P
```

In original lon-lat form:

```text
newSouthPole = [λp + 180°, -φp]
```

Longitude should be normalized to:

```text
[-180°, 180°]
```

### Step 4 — Define the New Pole Axis

The new pole axis is the line passing through:

```text
newNorthPole P
sphere center O
newSouthPole S
```

This axis replaces the conventional Earth north-south axis.

After this point, the original north and south poles have no special projection role.

They are only ordinary points on the sphere.

### Step 5 — Generate New Latitude

New latitude is based on angular distance from the selected north pole.

For any point `v` on the sphere, calculate the angular distance from the new north pole:

```text
angularDistance = arccos(dot(P, v))
```

Then the new latitude is:

```text
newLatitude = 90° - angularDistance
```

In radians:

```text
φ' = π/2 - arccos(dot(P, v))
```

Interpretation:

```text
angularDistance = 0°   → new latitude +90°  → new north pole
angularDistance = 10°  → new latitude +80°
angularDistance = 20°  → new latitude +70°
angularDistance = 90°  → new latitude 0°    → new equator
angularDistance = 170° → new latitude -80°
angularDistance = 180° → new latitude -90°  → new south pole
```

This creates latitude circles by expanding outward from the new north pole every 10 degrees until the circles shrink again toward the new south pole.

### Step 6 — Generate New Latitude Circles

The redefined latitude grid should be understood as circles on the sphere centered around the new pole axis.

Suggested interval:

```text
every 10 degrees
```

Latitude circles:

```text
+90°  = selected north pole
+80°  = small circle around selected pole
+70°  = larger circle
+60°  = larger circle
+50°
+40°
+30°
+20°
+10°
0°    = new equator, largest circle
-10°
-20°
-30°
-40°
-50°
-60°
-70°
-80°  = small circle around new south pole
-90°  = antipodal south pole
```

These circles are not based on original latitude.

They are based only on angular distance from the selected pole.

### Step 7 — Generate New Longitude

New longitude is generated by great-circle meridians connecting the new north pole and the new south pole.

Each new longitude line must:

- Start at the new north pole
- Follow a great circle
- Cross the new equator
- End at the new south pole

Longitude is the angular direction around the new pole axis.

To compute it robustly, define a new local coordinate frame on the sphere.

### Step 8 — Build a Local Basis Around the New Pole

Let:

```text
P = new north pole unit vector
```

Choose a reference vector that is not parallel to `P`.

Default reference:

```text
A = [0, 0, 1]
```

If `P` is too close to `[0, 0, 1]` or `[0, 0, -1]`, use:

```text
A = [1, 0, 0]
```

Create two perpendicular unit vectors on the new equator plane:

```text
E1 = normalize(cross(A, P))
E2 = cross(P, E1)
```

Now:

```text
P  = new north direction
E1 = new zero-longitude reference direction
E2 = new ninety-degree longitude reference direction
```

### Step 9 — Compute New Longitude for Each Point

For each sphere point `v`, project it onto the new equatorial plane:

```text
q = v - dot(v, P) * P
```

Then compute new longitude:

```text
newLongitude = atan2(dot(q, E2), dot(q, E1))
```

In radians:

```text
λ' = atan2(dot(q, E2), dot(q, E1))
```

At the exact new north or south pole, longitude is mathematically undefined. This is normal. Any longitude value at the pole represents the same physical point.

### Step 10 — Produce Redefined Coordinates

For every source point:

```text
original lon-lat [λ, φ]
→ sphere vector v
→ new longitude λ'
→ new latitude φ'
→ redefined coordinate [λ', φ']
```

Only this redefined coordinate should be passed to the selected map projection.

The original coordinate should not be passed directly into the projection after a custom pole is selected.

## 10. Projection After Coordinate Reconstruction

After every geometry point has been converted to redefined coordinates, the selected projection is applied.

The projection does not know or care about the original pole.

It only receives:

```text
[new longitude, new latitude]
```

This makes the new coordinate system the actual basis of the map.

## 11. Cylindrical Projection Logic

This applies to:

- Equirectangular
- Mercator

Robinson is pseudo-cylindrical but should follow the same conceptual rule for pole placement.

For cylindrical maps:

1. The new coordinate system defines the new sphere orientation.
2. A cylinder is fitted around the sphere using the new pole axis.
3. The new equator becomes the horizontal middle of the map.
4. The new north pole is stretched into the top edge.
5. The new south pole is stretched into the bottom edge.
6. The cylinder is cut along a seam based on redefined longitude.
7. The cylinder is unwrapped into a rectangular 2D map.

Expected output:

- Selected new north pole appears on the top edge.
- Antipodal new south pole appears on the bottom edge.
- New latitude lines are horizontal.
- New longitude lines are vertical.
- Original north and south poles appear wherever the new coordinate system places them.

## 12. Projection-Specific Behavior

### 12.1 Equirectangular

Input:

```text
[λ', φ']
```

Mapping:

```text
x = λ'
y = φ'
```

Expected behavior:

- New north pole appears at the top edge.
- New south pole appears at the bottom edge.
- New equator appears at the vertical center.
- Redefined graticule appears as straight perpendicular lines.
- Original poles are ordinary points.

### 12.2 Mercator

Input:

```text
[λ', φ']
```

Mapping:

```text
x = λ'
y = ln(tan(π/4 + φ'/2))
```

Expected behavior:

- New north pole approaches the top clipped edge.
- New south pole approaches the bottom clipped edge.
- Exact ±90° cannot be shown because Mercator goes to infinity at the poles.
- Use clipping around ±85°.
- Redefined graticule appears as normal Mercator graticule.
- Original poles are ordinary points.

### 12.3 Robinson

Input:

```text
[λ', φ']
```

Expected behavior:

- Robinson projection is applied to the redefined coordinate system.
- New north pole corresponds to the top boundary.
- New south pole corresponds to the bottom boundary.
- Redefined graticule follows normal Robinson structure.
- Original poles are ordinary points.

### 12.4 Lambert Conformal Conic

Input:

```text
[λ', φ']
```

Expected behavior:

- Conic projection is applied relative to the new coordinate system.
- New pole axis controls the conic projection.
- Redefined meridians and parallels follow conic behavior.
- Original poles are ordinary points.

Default standard parallels may be fixed for the first version.

Optional future control:

```text
standard parallel 1
standard parallel 2
central meridian
```

### 12.5 Azimuthal

Input:

```text
[λ', φ']
```

Recommended default:

```text
Azimuthal equidistant
```

Expected behavior:

- New north pole appears at the center.
- Redefined latitude lines become concentric circles.
- Redefined longitude lines radiate outward.
- New south pole appears at the outer opposite limit depending on clipping.
- Original poles are ordinary points.

## 13. Graticule System

The app must include a graticule toggle:

```text
Original lon-lat
Redefined lon-lat
```

### 13.1 Redefined Lon-Lat Graticule

This is the default graticule after pole selection.

It must be generated from the new coordinate system.

For cylindrical maps:

- New latitude lines appear horizontal.
- New longitude lines appear vertical.
- New north pole is represented by the top edge.
- New south pole is represented by the bottom edge.

For azimuthal maps:

- New latitude lines appear as circles.
- New longitude lines radiate from the center.

For conic maps:

- New latitude and longitude lines follow conic projection behavior.

Important:

The redefined graticule is not decorative. It must correspond to the same `[λ', φ']` coordinate system used to transform the land geometry.

### 13.2 Original Lon-Lat Graticule

Original lon-lat graticule shows the conventional Earth coordinate system as geometry placed on the sphere.

After a custom pole is selected:

1. Generate original longitude and latitude lines in original coordinates.
2. Convert their points to 3D sphere positions.
3. Convert those positions into the redefined coordinate system.
4. Project them using the selected projection.

Expected behavior:

- Original graticule should appear curved, tilted, warped, or interrupted.
- Original graticule should not remain horizontal/vertical unless the selected pole is the original north pole.
- Original graticule is a reference layer only.

### 13.3 Graticule Toggle UI

Use a button or segmented control:

```text
Graticule: Original | Redefined
```

Optional future mode:

```text
Both
```

First version only requires one visible mode at a time.

## 14. Map Interaction

### 14.1 Pole Selection

The user selects a new north pole by clicking the 2D map.

Click handling:

1. Capture screen coordinate.
2. Invert the active projection to get current displayed redefined coordinate.
3. Convert displayed redefined coordinate back to the original sphere coordinate.
4. Set that original sphere point as the new north pole.
5. Rebuild the coordinate system.
6. Reproject all geometry.

Important:

If the user clicks after a previous pole redefinition, the clicked point must still refer to the real Earth point under the cursor, not just the current redefined coordinate.

The app must be able to convert between:

```text
screen coordinate
current redefined coordinate
original sphere coordinate
```

### 14.2 Projection Change

When the projection type changes:

- Keep the current custom pole.
- Keep the current coordinate system.
- Reproject the same redefined coordinates using the new projection.
- Do not reset the pole unless the user presses reset.

### 14.3 Reset

The reset button should return to:

```text
Projection: current or default, depending on UI decision
Coordinate system: original Earth poles
New north pole: original north pole
New south pole: original south pole
Graticule: redefined/current
Scroll offset: 0
```

Recommended reset behavior:

- Reset coordinate system only.
- Keep selected projection type.

This lets the user compare the same projection before and after pole redefinition.

## 15. Horizontal Scrolling and Seam Control

For cylindrical and pseudo-cylindrical maps:

- Equirectangular
- Mercator
- Robinson

The map should be horizontally scrollable east and west.

This scrolling controls the seam of the **redefined longitude system**, not the original longitude system.

Expected behavior:

- Map wraps around using `λ'`.
- Panning should revolve around the new pole axis.
- New north and south poles remain tied to top/bottom behavior.
- Original north and south poles should move as ordinary geometry.

If horizontal panning still revolves around the original north and south poles, the implementation is wrong.

For azimuthal projection:

- Horizontal infinite scrolling is not required.
- The map remains circular.

For Lambert conformal conic:

- Horizontal scrolling may be limited or disabled in the first version.

## 16. Animation Requirement

The map should animate from the previous 2D projected state to the new 2D projected state.

The animation should show transformation between two map states, not a visual pan.

Suggested animation sequence:

1. User clicks a new pole.
2. Marker appears on selected point.
3. Current graticule fades.
4. Land geometry morphs from old projected coordinates to new projected coordinates.
5. Redefined graticule fades in.
6. New map settles.

For cylindrical projections:

- The selected point should visibly move toward the top edge.
- The antipodal point should move toward the bottom edge.

For azimuthal projection:

- The selected point should visibly move toward the center.

The first version can use simple interpolation, but the final result must be mathematically correct.

## 17. Data Source

Use Natural Earth data first.

Recommended first datasets:

```text
Natural Earth 110m land
Natural Earth 110m countries
```

Recommended format:

```text
TopoJSON
```

Acceptable prototype format:

```text
GeoJSON
```

Do not add unrelated thematic data until the projection system works correctly.

## 18. Rendering Architecture

Recommended modules:

```text
App
MapView2D
ProjectionControls
PoleSelector
CoordinateSystemBuilder
CoordinateTransformer
ProjectionEngine
GraticuleRenderer
AnimationController
DataLoader
```

### 18.1 CoordinateSystemBuilder

Responsibilities:

- Store selected new north pole
- Calculate new south pole
- Build new pole axis
- Build local basis vectors `P`, `E1`, `E2`
- Define the new latitude system
- Define the new longitude system

### 18.2 CoordinateTransformer

Responsibilities:

- Convert original lon-lat to 3D sphere vector
- Compute new latitude from angular distance to `P`
- Compute new longitude from angular position around `P`
- Convert every geometry coordinate into `[λ', φ']`
- Transform land geometry
- Transform country geometry
- Transform original graticule geometry
- Preserve mapping from screen location to original sphere point

### 18.3 ProjectionEngine

Responsibilities:

- Select projection type
- Project redefined coordinates
- Clip projection where necessary
- Handle horizontal wrapping for cylindrical maps
- Render final geometry

### 18.4 GraticuleRenderer

Responsibilities:

- Render redefined graticule from `[λ', φ']`
- Render original graticule after transformation into `[λ', φ']`
- Ensure the graticule corresponds to the same coordinate system as land geometry

### 18.5 AnimationController

Responsibilities:

- Store previous projected coordinates
- Store new projected coordinates
- Interpolate between visual states
- Animate graticule transition
- Animate pole marker transition

## 19. Recommended State Model

```ts
type ProjectionType =
  | "equirectangular"
  | "mercator"
  | "robinson"
  | "lambertConformalConic"
  | "azimuthal";

type GraticuleMode = "original" | "redefined";

type CoordinateSystemState = {
  newNorthPoleOriginalLonLat: [number, number];
  newSouthPoleOriginalLonLat: [number, number];
  poleVector: [number, number, number];
  southPoleVector: [number, number, number];
  basisE1: [number, number, number];
  basisE2: [number, number, number];
  isDefaultCoordinateSystem: boolean;
};

type AppState = {
  projectionType: ProjectionType;
  graticuleMode: GraticuleMode;
  coordinateSystem: CoordinateSystemState;
  animationState: "idle" | "transforming";
  scrollOffset: number;
  showPoleMarkers: boolean;
};
```

## 20. Validation Tests

These tests must be used before considering the projection system correct.

### 20.1 Default Pole Test

Input:

```text
new north pole = original north pole
```

Expected:

- Map looks like the normal selected projection.
- Redefined graticule matches original graticule.
- Original north pole appears at the normal north position.
- Original south pole appears at the normal south position.

### 20.2 Equator Pole Test

Input:

```text
new north pole = [0°, 0°]
```

Expected for equirectangular:

- `[0°, 0°]` becomes top edge.
- `[180°, 0°]` becomes bottom edge.
- Original north pole moves to the new equator area.
- Redefined graticule appears horizontal/vertical.

### 20.3 Mid-Latitude Pole Test

Input:

```text
new north pole = [30°, 45°]
```

Expected:

- `[30°, 45°]` becomes new latitude `+90°`.
- `[-150°, -45°]` becomes new latitude `-90°`.
- In equirectangular, `[30°, 45°]` appears on the top edge.
- In equirectangular, `[-150°, -45°]` appears on the bottom edge.
- Original north pole is no longer the top anchor.
- Redefined graticule appears normal.
- Original graticule appears distorted.

This is the most important test.

### 20.4 Mercator Pole Test

Input:

```text
new north pole = [30°, 45°]
```

Expected:

- Selected pole approaches top clipped edge.
- Antipode approaches bottom clipped edge.
- Exact poles are clipped because Mercator cannot display ±90°.
- Original poles are ordinary points.

### 20.5 Azimuthal Pole Test

Input:

```text
new north pole = [30°, 45°]
```

Expected:

- `[30°, 45°]` appears at the center.
- Redefined latitude lines appear as concentric circles.
- Redefined longitude lines radiate outward.
- Original poles are ordinary points.

### 20.6 Graticule Consistency Test

After any custom pole selection:

- Land geometry and redefined graticule must share the same coordinate transformation.
- If graticule is horizontal/vertical but land does not align with the new coordinate system, the implementation is wrong.
- Original graticule must not remain horizontal/vertical unless the selected pole is the original north pole.

### 20.7 Pan / Seam Test

For cylindrical projections after custom pole selection:

- Horizontal panning should wrap around redefined longitude `λ'`.
- The map should not revolve around the original north/south pole axis.
- New pole axis should remain the basis of the wrapping behavior.

## 21. First Version Scope

The first version must include:

- 2D map starting view
- Natural Earth land/country geometry
- Projection dropdown
- Required five projection types
- Click-to-select new north pole
- Antipodal south pole calculation
- Perfect-sphere coordinate reconstruction
- Redefined longitude-latitude system
- Coordinate transformation for all map geometry
- Original/redefined graticule toggle
- Horizontal scrolling for cylindrical/pseudo-cylindrical projections
- 2D map transformation animation
- Reset button

## 22. Out of Scope for First Version

Do not implement in the first version:

- Required globe starting view
- Population layers
- Climate layers
- City layers
- Search
- Labels
- Export
- Backend
- Database
- User accounts
- WebGL globe
- Distortion analysis
- Tissot indicatrix
- Mobile optimization
- Advanced styling
- Additional projections beyond the required five

These may be added after the coordinate reconstruction is correct.

## 23. Implementation Priority

Recommended order:

1. Load Natural Earth geometry.
2. Render normal 2D equirectangular map.
3. Implement lon-lat to 3D sphere conversion.
4. Implement new pole selection.
5. Implement antipodal south pole calculation.
6. Implement local basis generation around the selected pole.
7. Implement new latitude calculation using angular distance.
8. Implement new longitude calculation using angular position around the new pole axis.
9. Transform every geometry coordinate into `[λ', φ']`.
10. Render transformed geometry with equirectangular projection.
11. Validate mid-latitude pole test.
12. Implement redefined graticule.
13. Implement original graticule transformed into new coordinate system.
14. Add Mercator.
15. Add Robinson.
16. Add Azimuthal.
17. Add Lambert conformal conic.
18. Add horizontal scroll/wrap behavior.
19. Add animation.
20. Add UI polish.

Do not move to animation or styling until the mid-latitude pole test passes.

## 24. Direct Instruction for Claude

Claude must implement a sphere-first coordinate reconstruction system.

Claude must not rely on D3 projection rotation, projection center, screen-space pan, or CSS transforms to simulate the new pole.

D3 may be used after coordinate reconstruction.

Required core functions:

```ts
lonLatToVector(lon: number, lat: number): Vec3
vectorToLonLat(v: Vec3): [number, number]
buildCoordinateSystem(poleLon: number, poleLat: number): CoordinateSystemState
transformOriginalToRedefined(lon: number, lat: number, system: CoordinateSystemState): [number, number]
transformGeometryToRedefined(geojson: GeoJSON, system: CoordinateSystemState): GeoJSON
```

Required validation:

```text
transformOriginalToRedefined(30, 45, systemForPole(30, 45))
→ latitude should be approximately +90°

transformOriginalToRedefined(-150, -45, systemForPole(30, 45))
→ latitude should be approximately -90°
```

If these tests fail, the project is not correctly implemented.

## 25. Final Concept Statement

```text
The Earth does not come with a default map.

A map appears only after a coordinate system and projection are imposed on the sphere.

Unfixed Earth lets users remove the default pole assumption, rebuild the world coordinate system from any selected point, and generate a new map that is artificial but still true to the same Earth.
```
