# Task: Standardize Distortion Color Scale Across All Map Projections

## Goal

Update the distortion visualization system so that size distortion and shape distortion are measured and colored using one standardized scale across all map projections.

The current behavior appears to normalize distortion values separately for each projection. This makes every projection use the full color range, even when its absolute distortion is low compared to other projections.

This is not the intended behavior.

The distortion colors should allow users to compare different projections directly.

---

## Problem

The current color normalization likely works like this:

```js
normalizedSize = sizeDistortion / maxSizeDistortionInCurrentProjection;
normalizedShape = shapeDistortion / maxShapeDistortionInCurrentProjection;
```

This means each projection gets its own color scale.

As a result, even a projection with low shape distortion, such as Mercator, can still show strong shape distortion colors because the highest shape distortion within Mercator is normalized to 1.0.

This creates misleading results.

Example problem:

```text
Mercator:
Expected:
- high size distortion near poles
- low shape distortion overall

Current visual result:
- high size distortion
- high shape distortion
```

The likely reason is that shape distortion is normalized only within the current map instead of being compared against a standardized global distortion scale.

---

## Required Change

Distortion values must be normalized using fixed global maximum values.

Do not normalize size and shape distortion separately for each projection.

### Incorrect behavior

```js
normalizedSize = sizeDistortion / maxSizeDistortionInCurrentMap;
normalizedShape = shapeDistortion / maxShapeDistortionInCurrentMap;
```

### Correct behavior

```js
normalizedSize = sizeDistortion / GLOBAL_SIZE_DISTORTION_MAX;
normalizedShape = shapeDistortion / GLOBAL_SHAPE_DISTORTION_MAX;
```

Then clamp values:

```js
normalizedSize = clamp(normalizedSize, 0, 1);
normalizedShape = clamp(normalizedShape, 0, 1);
```

This allows color intensity to mean the same thing across all projections.

---

## Standardized Distortion Scale

Size distortion and shape distortion should both use measurable numeric values.

These values are ratios or ratio-derived values, so they do not have physical units.

### Size distortion value

Size distortion should be calculated as:

```text
sizeRatio = currentProjectedCountryArea / trueOrEqualAreaReferenceCountryArea
sizeDistortion = abs(log(sizeRatio))
```

Interpretation:

```text
sizeRatio = 1.0  -> no size distortion
sizeRatio = 2.0  -> country appears 2x larger than reference
sizeRatio = 0.5  -> country appears 0.5x the reference area
```

Using `abs(log(sizeRatio))` makes enlargement and shrinkage symmetric.

Example:

```text
sizeRatio = 2.0
abs(log(2.0)) ≈ 0.693

sizeRatio = 0.5
abs(log(0.5)) ≈ 0.693
```

### Shape distortion value

Shape distortion should be calculated independently from size distortion.

If using polygon overlap:

```text
1. Project the country in the current map projection.
2. Project the country in a local reference projection.
3. Move both shapes to the same centroid.
4. Scale both shapes to the same area.
5. Optionally rotate or align the shapes to maximize overlap.
6. Calculate maximum IoU.
7. shapeDistortion = 1 - maxIoU
```

Formula:

```text
shapeSimilarity = maxIoU(normalizedCurrentShape, normalizedReferenceShape)
shapeDistortion = 1 - shapeSimilarity
```

Expected range:

```text
0 = no shape distortion
1 = maximum shape distortion
```

If using Tissot-style local differential approximation:

```text
shapeDistortion = abs(log(horizontalScale / verticalScale))
```

In either case, shape distortion must not include size distortion.

---

## Global Maximum Distortion Values

Add explicit maximum values for both size distortion and shape distortion.

These values should be placed at the top of the relevant JavaScript file so they can be adjusted during testing.

### Required configuration

Add a config object similar to:

```js
const DISTORTION_NORMALIZATION_CONFIG = {
  useGlobalNormalization: true,

  sizeDistortionMax: 3.0,
  shapeDistortionMax: 1.0,

  clampNormalizedValues: true
};
```

### Meaning

```text
sizeDistortionMax:
The distortion value that maps to maximum size-distortion color intensity.

shapeDistortionMax:
The distortion value that maps to maximum shape-distortion color intensity.
```

Values greater than the max should be clamped to 1.0.

Example:

```js
normalizedSize = Math.min(sizeDistortion / DISTORTION_NORMALIZATION_CONFIG.sizeDistortionMax, 1);
normalizedShape = Math.min(shapeDistortion / DISTORTION_NORMALIZATION_CONFIG.shapeDistortionMax, 1);
```

---

## Choosing Initial Max Values

Use adjustable initial values.

Recommended starting point:

```js
sizeDistortionMax: 3.0,
shapeDistortionMax: 1.0
```

These are not final scientific constants. They are visualization thresholds and should be easy to tune.

### Size distortion reference

Because:

```text
sizeDistortion = abs(log(sizeRatio))
```

Example values:

```text
sizeDistortion = 0.0 -> 1.0x area
sizeDistortion = 0.69 -> 2.0x or 0.5x area
sizeDistortion = 1.10 -> 3.0x or 0.33x area
sizeDistortion = 1.61 -> 5.0x or 0.20x area
sizeDistortion = 2.30 -> 10.0x or 0.10x area
sizeDistortion = 3.00 -> about 20.1x or 0.05x area
```

So:

```text
sizeDistortionMax = 3.0
```

means countries that appear about 20x too large or about 20x too small reach maximum size color.

### Shape distortion reference

If using IoU-based shape distortion:

```text
shapeDistortion = 1 - maxIoU
```

Example values:

```text
shapeDistortion = 0.0 -> identical shape
shapeDistortion = 0.2 -> 80% best overlap
shapeDistortion = 0.5 -> 50% best overlap
shapeDistortion = 1.0 -> no overlap similarity
```

So:

```text
shapeDistortionMax = 1.0
```

means the full possible IoU-based shape distortion range is used.

If using Tissot-style anisotropy instead, the max value may need tuning.

---

## Legend Must Use the Same Standardized Scale

The bivariate legend in the left panel must show the standardized distortion scale.

The legend should not change when switching projections.

### Required behavior

- The legend appears when Distortion Compare Mode is active.
- The legend uses the same size and shape distortion maximum values for every projection.
- The legend does not rescale based on the current projection.
- The numeric labels remain stable across projection changes.
- The same color always means the same distortion amount.

---

## Legend Numeric Labels

The legend should show numeric values for both axes.

### Horizontal axis

The horizontal axis represents size distortion.

Example labels:

```text
Size Distortion
0
1.5
3.0 max
```

or, if showing area ratio equivalents:

```text
1x
~4.5x
~20x
```

### Vertical axis

The vertical axis represents shape distortion.

Example labels for IoU-based method:

```text
Shape Distortion
0
0.5
1.0 max
```

or:

```text
100% overlap
50% overlap
0% overlap
```

### Required legend content

The legend should include:

```text
Size distortion axis label
Shape distortion axis label
Minimum value
Mid value
Maximum value
Numeric max value for size distortion
Numeric max value for shape distortion
```

---

## Recommended Legend Format

The bivariate legend should continue to show the combined color system:

```text
Horizontal axis = size distortion
Vertical axis = shape distortion
```

Example layout:

```text
                 Shape Distortion
                 1.0 max
                    ↑
                    |
                    |
                    |
0 ------------------+------------------ 3.0 max
          Size Distortion
```

The exact layout can vary, but the numeric values must be visible.

---

## Important Requirement: Legend Does Not Change Across Projections

The legend must remain visually and numerically fixed across:

- Mercator
- Gall-Peters
- Equirectangular
- Pseudocylindrical projections
- Conic projections
- Azimuthal projections

Projection switching should not change:

- color scale
- axis max values
- numeric labels
- legend gradient

Only the country colors should change based on the projection's actual distortion values.

---

## Expected Visual Behavior

After this change, projections should be visually comparable.

### Mercator

Expected:

```text
High-latitude countries:
- high size distortion
- relatively low shape distortion

Equatorial countries:
- lower size distortion
- low shape distortion
```

Mercator should not show strong shape distortion just because it is the current map's highest shape distortion.

### Gall-Peters

Expected:

```text
Countries:
- relatively low size distortion
- higher shape distortion
```

Gall-Peters should show stronger shape distortion than Mercator when using the same global scale.

### Equal-area projections

Expected:

```text
- lower size distortion
- shape distortion depends on projection and location
```

### Conformal projections

Expected:

```text
- lower shape distortion
- size distortion may be high
```

---

## Color Calculation Pipeline

For each country:

1. Calculate raw size distortion.
2. Calculate raw shape distortion.
3. Normalize both values using global max constants.
4. Clamp normalized values to `[0, 1]`.
5. Generate bivariate color from normalized size and normalized shape.
6. Render country with the resulting color.

### Pseudocode

```js
function normalizeDistortion(sizeDistortion, shapeDistortion) {
  const sizeMax = DISTORTION_NORMALIZATION_CONFIG.sizeDistortionMax;
  const shapeMax = DISTORTION_NORMALIZATION_CONFIG.shapeDistortionMax;

  const normalizedSize = clamp(sizeDistortion / sizeMax, 0, 1);
  const normalizedShape = clamp(shapeDistortion / shapeMax, 0, 1);

  return {
    normalizedSize,
    normalizedShape
  };
}
```

Do not use current-map min/max values for color normalization.

---

## Configuration Placement Requirement

All distortion normalization constants must be placed at the top of the relevant JavaScript file.

This includes:

```js
const DISTORTION_NORMALIZATION_CONFIG = {
  useGlobalNormalization: true,
  sizeDistortionMax: 3.0,
  shapeDistortionMax: 1.0,
  clampNormalizedValues: true
};
```

This should be near the existing map style and color config.

Do not hard-code these values inside rendering or calculation functions.

---

## Optional Debug Display

Add optional debug text or console output for checking distortion values.

Useful values:

```text
country name
raw sizeDistortion
raw shapeDistortion
normalizedSize
normalizedShape
sizeRatio
shape IoU if available
```

Optional hover tooltip:

```text
Country: Greenland
Size ratio: 14.2x
Size distortion: 2.65 / 3.0
Shape distortion: 0.12 / 1.0
```

This is optional but useful for debugging suspicious colors.

---

## Updated Success Criteria

The update is successful if:

- Distortion colors are comparable across map projections.
- Size distortion is not normalized separately per projection.
- Shape distortion is not normalized separately per projection.
- Global max values exist for size and shape distortion.
- Global max values are defined at the top of the JavaScript file.
- The bivariate legend shows numeric values.
- The bivariate legend does not change across projections.
- The same color means the same distortion amount in every projection.
- Mercator generally shows high size distortion but relatively low shape distortion.
- Gall-Peters generally shows low size distortion but higher shape distortion.
- Projection switching changes country colors but does not change the legend scale.

---

## Final Concept Summary

This update changes distortion normalization from per-map relative scaling to one standardized global distortion scale.

Size and shape distortion values should be measured as raw numeric values, then normalized using fixed maximum thresholds. These thresholds are shown in the bivariate legend and remain unchanged across projections. This makes the visualization useful for comparing projections directly, rather than only showing which countries are most distorted within the current map.
