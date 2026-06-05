# Task: Ignore Seam in Country Distortion Measurement and Use Four-Corner Bivariate Colors

## Goal

Update the country-level distortion choropleth in two ways:

1. The selected seam location must not affect the distortion measurement of a country.
2. The bivariate color system must use four explicitly defined corner colors instead of only blending red and blue.

---

## 1. Ignore Seam in Country Distortion Measurement

## Problem

Currently, when the seam cuts through a country, that country receives a different distortion color than when the seam does not cut through it.

This is incorrect.

The seam is a visual map-cutting location. It should affect how the world map is displayed, but it should not change the measured size or shape distortion of a country.

Example problem:

```text
Same projection
Same country
Same pole/orientation
Different seam location
→ country distortion color changes
```

This should not happen.

---

## Required Behavior

Country distortion values must be independent from seam cutting.

For a given:

```text
projection type
north/south pole setting
country geometry
```

the country’s size and shape distortion should remain the same regardless of where the seam is placed.

The seam should only affect:

```text
visual map cut location
country rendering split
map boundary
```

The seam should not affect:

```text
size distortion value
shape distortion value
bivariate color assigned to the country
```

---

## Implementation Requirement

Do not calculate country distortion from seam-clipped or screen-rendered geometry.

### Incorrect method

```text
1. Render country on the map.
2. Country is clipped/split by seam.
3. Measure projected area or shape from the clipped visible geometry.
4. Assign distortion color based on the clipped geometry.
```

This causes the seam to change the distortion value.

### Correct method

Calculate distortion from the full original country geometry before seam clipping.

```text
1. Use original unsplit country geometry.
2. Apply the current projection mathematically.
3. Calculate size and shape distortion from the full country geometry.
4. Assign one distortion value and one color to the whole country.
5. Render the country, allowing the seam to visually split it if necessary.
6. Apply the same country color to all rendered pieces of that country.
```

---

## Country Color Consistency Across Seam

If a country is visually split by the seam:

```text
All split pieces of the same country must use the same distortion color.
```

Example:

```text
Russia split by seam
→ western piece and eastern piece must have identical fill color
```

The country color should be calculated once per country ID, not once per rendered polygon fragment.

---

## Distortion Calculation Rule

Use a seam-independent distortion projection or internal calculation path.

The visible projection may use the selected seam, but the distortion calculation should ignore seam clipping.

Recommended approach:

```text
distortionProjection = same projection type and pole/orientation, but without seam clipping artifacts
renderProjection = same projection type and pole/orientation, with selected seam for display
```

Then:

```text
distortion values = calculated with distortionProjection and full country geometry
rendering = drawn with renderProjection and seam cut
```

---

## Success Criteria for Seam Independence

The update is successful if:

- Changing the seam does not change a country’s distortion color.
- Countries split by the seam keep the same color on both sides.
- Distortion is calculated once per country, not per clipped polygon fragment.
- Seam location affects only visual cutting/rendering, not distortion measurement.
- Distortion Compare Mode remains stable when the seam is changed.

---

# 2. Four-Corner Bivariate Color System

## Problem

The current bivariate choropleth uses only two colors:

```text
red = high size distortion
blue = high shape distortion
```

When both size and shape distortion are high, the colors blend naturally into purple.

This is not the intended visual result.

The desired color for high size distortion and high shape distortion is:

```text
black
```

---

## Required Color System

Define four explicit corner colors for the bivariate legend rectangle.

### Required corner colors

```text
Low size distortion + low shape distortion = white
High size distortion + low shape distortion = red
Low size distortion + high shape distortion = blue
High size distortion + high shape distortion = black
```

### Required configuration

Place the four colors at the top of the relevant JavaScript file.

Example:

```js
const BIVARIATE_COLOR_CONFIG = {
  lowSizeLowShape: "#ffffff",
  highSizeLowShape: "#dc2626",
  lowSizeHighShape: "#2563eb",
  highSizeHighShape: "#000000"
};
```

Do not hard-code these colors inside rendering functions.

---

## Bivariate Color Interpolation

The country color should be generated from four-corner interpolation, not simple red-blue blending.

Input values:

```text
normalizedSize: 0 to 1
normalizedShape: 0 to 1
```

Corner meaning:

```text
normalizedSize = 0, normalizedShape = 0 → white
normalizedSize = 1, normalizedShape = 0 → red
normalizedSize = 0, normalizedShape = 1 → blue
normalizedSize = 1, normalizedShape = 1 → black
```

Use bilinear interpolation between the four corner colors.

---

## Required Legend Behavior

The bivariate legend must use the same four-corner color system.

Legend corners:

```text
bottom-left  = white  = low size, low shape
bottom-right = red    = high size, low shape
top-left     = blue   = low size, high shape
top-right    = black  = high size, high shape
```

The legend should make it clear that:

```text
red   = high size distortion only
blue  = high shape distortion only
black = both size and shape distortion are high
white = both distortions are low
```

---

## Color and Transparency Configuration Requirement

All color and transparency settings must remain at the top of the JavaScript file.

Include:

```js
const BIVARIATE_COLOR_CONFIG = {
  lowSizeLowShape: "#ffffff",
  highSizeLowShape: "#dc2626",
  lowSizeHighShape: "#2563eb",
  highSizeHighShape: "#000000",
  countryOpacity: 0.72,
  borderColor: "#111827",
  borderOpacity: 0.75
};
```

This is required so the visual system can be adjusted easily during debugging.

---

## Updated Success Criteria

This task is successful if:

- Seam changes do not change distortion values.
- Seam changes do not change country colors.
- Countries split by the seam use one consistent color.
- Distortion is calculated from full country geometry, not seam-clipped geometry.
- The bivariate map uses four explicit corner colors.
- High size + high shape distortion appears black, not purple.
- The legend uses the same four-corner color system.
- All color and opacity values are defined at the top of the JavaScript file.

---

## Final Concept Summary

The seam should be treated as a visual display cut, not as part of the distortion measurement. Country distortion must be calculated from full country geometry and assigned once per country, so changing the seam does not change the distortion color.

The bivariate distortion color system should also be changed from two-color blending to a four-corner color rectangle: white for low distortion, red for high size distortion, blue for high shape distortion, and black for high distortion in both metrics.
