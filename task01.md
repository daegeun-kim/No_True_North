# Task: Fix Shape Distortion Normalization and Add Seam Selection Mode

## Goal

Update the distortion comparison and map navigation behavior for the redefined world map tool.

This update has two main changes:

1. **Fix shape distortion calculation**
   - Shape distortion must be calculated independently from size distortion.
   - Before comparing country shapes, normalize the current projected country and the reference country to the same size.

2. **Add seam selection**
   - The map seam should be fixed by default at 180° longitude.
   - Add a user-controlled seam selection feature.
   - Remove horizontal scrolling behavior.
   - Seam selection applies to cylindrical, pseudocylindrical, and conic projections.
   - Seam selection does not apply to azimuthal projections.

---

## Part 1: Shape Distortion Must Be Size-Normalized

## Problem

The current distortion system appears to calculate shape distortion by directly comparing:

```text
locally accurate country projection
vs
country shape in current world map projection
```

If this comparison is done without size normalization, then size distortion incorrectly contributes to shape distortion.

This causes incorrect results.

Example:

```text
Mercator projection:
Expected:
- high size distortion
- low shape distortion

Current behavior:
- high size distortion
- high shape distortion
```

This happens because Mercator enlarges countries at high latitudes. If the enlarged country is directly compared against the reference country without scaling them to the same area, the overlap becomes poor even though the local shape is mostly preserved.

---

## Required Fix

Shape distortion must be calculated after removing size difference.

Size distortion and shape distortion must be independent visual channels.

### Correct conceptual separation

```text
Size distortion:
Measures area enlargement or shrinkage.

Shape distortion:
Measures deformation after size difference has been removed.
```

### Required behavior

Before calculating shape distortion:

1. Project the country using the current world map projection.
2. Project the country using the local reference projection.
3. Move both shapes to a common centroid.
4. Scale both shapes to the same area.
5. Then compare the shapes.

Shape distortion should not increase only because one projected shape is larger than the other.

---

## Correct Shape Distortion Pipeline

For each country:

### Step 1: Current projected country

Generate the country polygon in the current world map projection.

```text
currentShape = projectCountry(countryGeometry, currentProjection)
```

### Step 2: Reference country shape

Generate the locally accurate reference projection for the same country.

```text
referenceShape = projectCountry(countryGeometry, localReferenceProjection)
```

### Step 3: Normalize centroid

Move both shapes so their centroids match.

```text
currentShapeCentered = translateToOrigin(currentShape)
referenceShapeCentered = translateToOrigin(referenceShape)
```

### Step 4: Normalize area

Scale both shapes so their areas are equal.

```text
currentArea = polygonArea(currentShapeCentered)
referenceArea = polygonArea(referenceShapeCentered)

scaleFactor = sqrt(referenceArea / currentArea)
currentShapeNormalized = scale(currentShapeCentered, scaleFactor)
```

After this step:

```text
area(currentShapeNormalized) ≈ area(referenceShapeCentered)
```

### Step 5: Compare normalized shapes

Calculate shape similarity after size normalization.

Possible formula:

```text
shapeSimilarity = intersectionArea(currentShapeNormalized, referenceShapeCentered) /
                  unionArea(currentShapeNormalized, referenceShapeCentered)

shapeDistortion = 1 - shapeSimilarity
```

### Important requirement

Do not calculate shape distortion using raw projected polygons with different areas.

---

## Alternative Shape Distortion Method

If polygon overlap is difficult or unstable, use a Tissot-style local differential method.

This is often cleaner because size and shape distortion are naturally separated.

At each sample point inside a country:

```text
horizontalScale = local east-west projected scale
verticalScale = local north-south projected scale

sizeDistortion = abs(log(horizontalScale * verticalScale))
shapeDistortion = abs(log(horizontalScale / verticalScale))
```

Then aggregate per country:

```text
countrySizeDistortion = area-weighted average of local sizeDistortion
countryShapeDistortion = area-weighted average of local shapeDistortion
```

### Expected results

```text
Mercator:
- horizontalScale ≈ verticalScale
- high sizeDistortion near poles
- low shapeDistortion

Gall-Peters:
- horizontalScale and verticalScale differ significantly
- low sizeDistortion
- high shapeDistortion
```

### Recommendation

Use the Tissot-style method if it is easier to implement reliably.

Use the polygon-overlap method only if size normalization is correctly implemented.

---

## Size Distortion Calculation

Size distortion should continue to measure area difference directly.

For each country:

```text
sizeRatio = currentProjectedArea / referenceProjectedArea
sizeDistortion = abs(log(sizeRatio))
```

Size distortion should not be normalized away during the size distortion calculation.

Only shape distortion requires size normalization before comparison.

---

## Required Visual Behavior After Fix

After fixing shape distortion:

### Mercator

Expected visual result:

```text
High-latitude countries:
- high size distortion color
- low shape distortion color
```

### Gall-Peters

Expected visual result:

```text
Most countries:
- low size distortion color
- high shape distortion color
```

### Default map

The default map should still show distortion.

The default map should not be treated as zero distortion.

---

# Part 2: Add Seam Selection Feature

## Goal

Add a controlled seam selection feature for projections where seam location matters.

The map should no longer be horizontally scrollable.

Instead, the user should explicitly choose the seam location using a new **Change Seam** interaction.

---

## Default Seam Behavior

By default, the seam should be fixed at:

```text
180° longitude
```

This means the default seam is the antimeridian.

### Required default behavior

- Map loads with seam at 180° longitude.
- No horizontal scrolling is available.
- The map is stable and does not shift left/right through drag or scroll.
- Distortion calculations use the current seam setting.
- Default seam remains 180° unless the user changes it.

---

## Remove Horizontal Scrolling

Horizontal map scrolling should no longer be available.

### Remove or disable

- Drag-to-scroll world map behavior.
- Infinite horizontal wrap scrolling.
- CSS or SVG translation that visually shifts the world map without updating the projection.
- Any scroll behavior that changes country position without updating seam and distortion values.

### Reason

Free horizontal scrolling makes distortion comparison ambiguous.

If the seam changes visually but the projection object and distortion calculation do not update, the displayed distortion becomes inconsistent with the visible map.

The seam must be a controlled projection parameter, not a visual scroll offset.

---

## Seam Selection Applicability

Seam selection applies to:

```text
Cylindrical projections
Pseudocylindrical projections
Conic projections
```

Seam selection does not apply to:

```text
Azimuthal projections
```

### Required behavior by projection type

#### Cylindrical projections

The seam controls the longitude where the map is cut.

Examples:

```text
Mercator
Gall-Peters
Equirectangular
```

#### Pseudocylindrical projections

The seam controls the longitude where the world shape is cut.

Examples:

```text
Mollweide
Natural Earth
Robinson
Sinusoidal
Eckert-style projections
```

#### Conic projections

The seam controls the central longitude / cut direction of the conic projection.

Examples:

```text
Lambert Conformal Conic
Conic Equal Area
Conic Equidistant
```

#### Azimuthal projections

The seam selection button should be hidden or disabled.

Examples:

```text
Azimuthal Equidistant
Lambert Azimuthal Equal-Area
Orthographic
Stereographic
```

---

## UI: Change Seam Button

Add a button labeled:

```text
Change Seam
```

### Button location

Place the button in the right control panel near projection and pole settings.

### Button states

Default state:

```text
Change Seam
```

Active state:

```text
Click Map to Set Seam
```

or:

```text
Selecting Seam...
```

### Required behavior

When the user clicks **Change Seam**:

1. Enter seam selection mode.
2. Show a vertical seam preview line on the map.
3. The preview line follows the user's cursor horizontally.
4. The line represents the longitude that will become the new seam.
5. User clicks on the map to confirm the seam.
6. Seam longitude is updated.
7. Projection is recalculated.
8. Country distortion is recalculated if Distortion Compare Mode is active.
9. Exit seam selection mode.

---

## Seam Preview Line

When seam selection mode is active, display a vertical line along the projected longitude under the cursor.

### Required behavior

- The line should be visible above the map.
- The line should follow the cursor movement.
- The line should represent a meridian / longitude line.
- The line should update in real time as the cursor moves.
- The line should be visually distinct but not too strong.
- The line should not permanently alter the map until the user clicks.

### Visual recommendation

Use a dashed vertical line or projected meridian line.

Example visual style:

```js
const SEAM_SELECTION_STYLE = {
  lineColor: "#111827",
  lineOpacity: 0.8,
  lineWidth: 2,
  lineDash: "6 4"
};
```

Place this style configuration at the top of the relevant JavaScript file.

---

## How to Interpret Cursor as Seam Longitude

When seam selection mode is active:

1. Read the cursor position on the map.
2. Invert the projection to get geographic coordinates.
3. Extract longitude from the inverted coordinate.
4. Use that longitude as the candidate seam longitude.
5. Draw the seam preview line along that longitude.

Pseudo logic:

```js
const [lon, lat] = projection.invert([mouseX, mouseY]);
candidateSeamLongitude = lon;
drawMeridian(candidateSeamLongitude);
```

If projection inversion fails:

```text
Do not update the seam preview line.
Keep the previous valid candidate seam longitude.
```

---

## Updating the Projection from Seam Longitude

The seam location should be handled as a projection parameter.

### Concept

For cylindrical and pseudocylindrical projections:

```text
seamLongitude = longitude where map is cut
centralMeridian = seamLongitude - 180°
```

Example:

```text
seamLongitude = 180°
centralMeridian = 0°
```

For D3 rotation:

```js
projection.rotate([-centralMeridian, currentPoleLatRotation, currentGamma]);
```

or equivalent based on the current projection architecture.

### Required behavior

Changing the seam should update the actual projection orientation.

Do not implement seam change as a visual SVG or CSS translation only.

The rendered map and the distortion calculation must both use the same seam value.

---

## Seam State

Maintain seam as explicit application state.

Example:

```js
const state = {
  seamLongitude: 180,
  isSelectingSeam: false
};
```

### Required behavior

- `seamLongitude` defaults to `180`.
- Seam value persists when switching between supported projection types.
- Seam value is ignored for azimuthal projections.
- Seam value is used in projection generation for cylindrical, pseudocylindrical, and conic projections.
- Seam value is used in distortion recalculation.

---

## Seam Display

Add a small seam info display in the UI.

Example:

```text
Current seam: 180°
```

When the seam is changed:

```text
Current seam: 120°W
```

or:

```text
Current seam: -120°
```

Use whichever longitude display format is already consistent with the project.

---

## Seam and Distortion Calculation

Distortion calculation must use the current seam setting.

### Required behavior

When seam changes:

1. Rebuild the projection with the new seam.
2. Reproject countries.
3. Recalculate country-level size distortion.
4. Recalculate country-level shape distortion.
5. Recalculate bivariate country colors.
6. Redraw the map.

### Important

Do not calculate distortion based on default seam if the user has selected a different seam.

Do not visually move the map without recalculating distortion.

---

## Seam and Projection Presets

Projection-specific Min/Max distortion buttons should respect seam logic.

### Required behavior

When a Min/Max distortion button is clicked:

- It may update pole/orientation settings.
- It may update seam only if the preset explicitly requires it.
- Otherwise, it should keep the current seam value.
- After applying the preset, recalculate projection and distortion.

### Recommended first implementation

Keep seam unchanged when using Min/Max distortion buttons.

This makes the interaction more predictable.

---

## Seam Selection and Azimuthal Projections

For azimuthal projections:

- Hide the **Change Seam** button, or
- Disable it with a tooltip/message.

Recommended disabled message:

```text
Seam selection is not used for azimuthal projections.
```

### Reason

Azimuthal projections are centered on a point and do not use the same left/right seam logic as cylindrical, pseudocylindrical, or conic projections.

---

## Color and Style Configuration Requirement

All color, transparency, and seam preview style values must be placed at the top of each relevant JavaScript file.

This includes:

- Size distortion color
- Shape distortion color
- Low distortion color
- Country opacity
- Country border color
- Country border opacity
- Ocean color
- No-data country color
- Seam preview line color
- Seam preview line opacity
- Seam preview line width
- Seam preview line dash pattern

Example:

```js
const MAP_STYLE_CONFIG = {
  sizeDistortionColor: "#2563eb",
  shapeDistortionColor: "#dc2626",
  lowDistortionColor: "#f8fafc",
  countryOpacity: 0.72,
  countryBorderColor: "#111827",
  countryBorderOpacity: 0.75,
  oceanColor: "#ffffff",
  noDataColor: "#e5e7eb",
  seamPreviewColor: "#111827",
  seamPreviewOpacity: 0.8,
  seamPreviewWidth: 2,
  seamPreviewDash: "6 4"
};
```

Do not hard-code these values inside rendering functions.

---

## Updated Interaction Flow

### Normal use

1. User opens the map.
2. Projection loads with default seam at 180°.
3. Horizontal scrolling is disabled.
4. User can change projection and pole settings.
5. User can activate Distortion Compare Mode.

### Seam selection use

1. User clicks **Change Seam**.
2. Seam preview line appears.
3. User moves cursor over the map.
4. Preview line follows cursor longitude.
5. User clicks map to confirm seam.
6. Seam value updates.
7. Map redraws using the new seam.
8. Distortion values update if Distortion Compare Mode is active.

---

## Updated Success Criteria

The update is successful if:

- Shape distortion is no longer contaminated by size distortion.
- Shape comparison normalizes country size before overlap comparison.
- Mercator generally shows high size distortion but low shape distortion.
- Gall-Peters generally shows low size distortion but high shape distortion.
- Default map still shows distortion.
- The default seam is fixed at 180°.
- Horizontal scrolling is no longer available.
- The **Change Seam** button exists for cylindrical, pseudocylindrical, and conic projections.
- Seam selection shows a vertical or meridian preview line following the cursor.
- Clicking the map sets the seam.
- Seam change updates the actual projection, not only the visual map position.
- Distortion values are recalculated after seam changes.
- Seam selection is hidden or disabled for azimuthal projections.
- Color, transparency, and seam style settings are placed at the top of relevant JavaScript files.

---

## Final Concept Summary

This update fixes the distortion logic and stabilizes the projection seam behavior.

Shape distortion must be calculated independently from size distortion by normalizing the compared country shapes to the same area before measuring shape difference. This prevents projections like Mercator from incorrectly showing high shape distortion only because countries are enlarged.

The map should also stop using horizontal scrolling. Instead, the seam is fixed at 180° by default and can be changed through an explicit **Change Seam** interaction. The user selects a new seam by moving the cursor over the map and clicking the desired longitude. This seam affects cylindrical, pseudocylindrical, and conic projections, and the projection and distortion calculations must both use the selected seam.
