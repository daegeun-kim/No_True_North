# Task: Add Land Distortion Comparison Mode to Redefined World Map Tool

## Goal

Add a distortion comparison feature to the redefined world map tool.

The tool should measure and visualize two types of map projection distortion:

1. **Size distortion**
   - How much land area is enlarged or reduced compared to the globe.
   - Example: Mercator has high size distortion near polar regions.

2. **Shape distortion**
   - How much local land geometry is stretched, compressed, or deformed.
   - Example: Gall-Peters has low size distortion but high shape distortion.

The distortion visualization should help users understand how different map projections deform land depending on projection type, projection center, and redefined north/south pole settings.

---

## Core Feature: Distortion Compare Mode

Add a new **Distortion Compare Mode**.

This mode should only be activated when the user clicks a dedicated button.

By default, the map should behave the same as the current version.

### Default Mode

In default mode:

- Show the normal reprojected world map.
- Do not show distortion coloring.
- Keep the current map appearance and projection controls.
- Ocean and land should display as they currently do.

### Distortion Compare Mode

When the user activates Distortion Compare Mode:

- Apply distortion coloring only to land.
- Ocean should remain neutral and should not receive distortion colors.
- Land should be colored using a multivariate / bivariate color system.
- One color channel represents size distortion.
- One color channel represents shape distortion.
- Areas with low distortion should appear visually lighter or more neutral.
- Areas with high size distortion should lean toward the size-distortion color.
- Areas with high shape distortion should lean toward the shape-distortion color.
- Areas with both high size and high shape distortion should visually combine both colors.

---

## Distortion Metrics

Only calculate and visualize these two distortion types:

### 1. Size Distortion

Measure how much local area changes under the selected projection.

Expected behavior:

- Equal-area projections should show low size distortion.
- Mercator-like projections should show high size distortion near polar regions.
- The value should increase when projected land area is significantly larger or smaller than its original spherical area.

Suggested normalized output:

```text
0 = no or very low size distortion
1 = maximum size distortion in current view
```

### 2. Shape Distortion

Measure how much local shape is deformed.

Expected behavior:

- Conformal projections should show low local shape distortion.
- Equal-area projections may show higher shape distortion.
- The value should increase when local geometry is stretched unevenly.

Suggested normalized output:

```text
0 = no or very low shape distortion
1 = maximum shape distortion in current view
```

---

## Do Not Include These Metrics

Do not implement the following distortion types in this version:

- Scale distortion
- Direction distortion
- Distance distortion
- Bearing distortion

These are intentionally excluded because they overlap too much with the main purpose of the project and may make the interface unnecessarily complex.

---

## Land-Only Distortion Visualization

Distortion colors must only be applied to land.

### Required behavior

- Ocean should not be colored by distortion values.
- Distortion sampling should be clipped to land areas.
- Country borders or land outlines should remain visible above the distortion layer.
- Distortion colors should not cover the ocean.
- Pole markers and projection guides should remain visible above the distortion layer.

### Recommended implementation

Use a land-based sample grid.

Possible approaches:

1. Generate sample points across the map.
2. Check whether each point falls on land.
3. Calculate size and shape distortion at each valid land point.
4. Render the result as a land-only distortion heatmap.

Preferred rendering method:

```text
Canvas for distortion heatmap
SVG for land outlines, borders, labels, pole markers, and UI overlays
```

---

## Multivariate Color System

Use two user-visible colors:

```text
Size distortion color
Shape distortion color
```

The distortion map should combine these two color channels.

Example behavior:

```text
Low size + low shape distortion = light / neutral
High size + low shape distortion = size color
Low size + high shape distortion = shape color
High size + high shape distortion = mixed color
```

### Color Controls

Add two color settings:

1. **Size Distortion Color**
2. **Shape Distortion Color**

The user should be able to distinguish the two distortion types clearly.

Default colors may be:

```text
Size distortion = blue
Shape distortion = red
Combined high distortion = purple
```

The exact colors can be adjusted, but the visual difference between the two channels must be clear.

---

## Multivariate Legend

Add a multivariate / bivariate map legend at the bottom of the left panel.

### Legend location

```text
Left panel → bottom area
```

### Legend requirements

The legend should show:

- Horizontal axis: size distortion
- Vertical axis: shape distortion
- Low-to-high gradient for each axis
- Combined color result where both distortions are high
- Labels for:
  - Low size distortion
  - High size distortion
  - Low shape distortion
  - High shape distortion

Suggested legend layout:

```text
            High Shape Distortion
                    ↑
                    |
       mixed high   |   high shape
                    |
Low Size -----------+---------- High Size
                    |
       low both     |   high size
                    |
                    ↓
            Low Shape Distortion
```

The legend should only be visible when Distortion Compare Mode is active.

---

## Distortion Compare Mode Button

Add a dedicated button to activate or deactivate distortion comparison.

### Button behavior

Button label when inactive:

```text
Show Distortion Compare
```

Button label when active:

```text
Hide Distortion Compare
```

### Required behavior

When inactive:

- Map appears in normal projection mode.
- No distortion heatmap is shown.
- Legend is hidden.

When active:

- Land distortion heatmap is shown.
- Multivariate legend is shown at the bottom of the left panel.
- Projection and pole controls remain available.
- North/south pole markers remain visible.

---

## Projection-Specific Distortion Preset Buttons

For each projection, add buttons that automatically set north/south pole or projection settings based on distortion behavior.

Each projection should have buttons for:

1. **Minimum Size Distortion Setting**
2. **Maximum Size Distortion Setting**
3. **Minimum Shape Distortion Setting**
4. **Maximum Shape Distortion Setting**

These buttons should adjust the map orientation / pole settings to demonstrate how distortion changes under that projection.

### Required buttons per projection

For every projection in the projection selector, provide:

```text
Min Size Distortion
Max Size Distortion
Min Shape Distortion
Max Shape Distortion
```

### Button behavior

When clicked:

- Update the new north pole and new south pole settings.
- Recalculate the map projection.
- Recalculate distortion values if Distortion Compare Mode is active.
- Move pole markers to the updated locations.
- Update the distortion heatmap if active.

### Important note

The new north/south pole should not automatically be treated as the minimum distortion point.

The UI should distinguish between:

```text
New North Pole / New South Pole
Projection center
Minimum distortion area
Maximum distortion area
```

---

## Pole Markers

Show the redefined north and south poles on each map.

### Required markers

- New North Pole
- New South Pole

### Marker behavior

- Always visible in normal mode.
- Always visible in Distortion Compare Mode.
- Should appear above land, ocean, and distortion layers.
- Should be labeled clearly.

Suggested labels:

```text
New North Pole
New South Pole
```

---

## Minimum / Maximum Distortion Indicators

When Distortion Compare Mode is active, optionally show markers or outlines for areas with highest and lowest distortion.

### Required indicators

At minimum, the tool should be able to identify:

```text
Lowest size distortion area
Highest size distortion area
Lowest shape distortion area
Highest shape distortion area
```

### Optional visual markers

Use small labeled points or subtle outlines:

```text
Min Size
Max Size
Min Shape
Max Shape
```

These should not visually overpower the main bivariate heatmap.

---

## UI Requirements

### General UI

- Keep the current bright-mode interface.
- Keep the current layout with:
  - left explanatory panel
  - center map
  - right control panel
- Keep the larger text and control sizing from the current version.

### Left Panel

The left panel should include:

1. Projection explanation graphic / globe diagram
2. New north pole and new south pole information
3. Multivariate distortion legend at the bottom

The legend should only appear when Distortion Compare Mode is active.

### Center Map

The center map should include:

1. Reprojected world map
2. Land-only distortion heatmap when active
3. Land outlines / country borders
4. New north pole marker
5. New south pole marker
6. Optional min/max distortion markers

### Right Control Panel

The right control panel should include:

1. Projection selector
2. Pole / orientation controls
3. Distortion Compare Mode button
4. Projection-specific distortion preset buttons
5. Size distortion color selector
6. Shape distortion color selector

---

## Performance Requirements

The distortion mode should remain usable in a static website.

### Recommended performance strategy

Use a sampled land grid instead of calculating exact distortion for every polygon vertex.

Recommended approach:

```text
Normal interaction / dragging:
- Use low-resolution distortion sampling

After user stops interaction:
- Recalculate with higher-resolution sampling
```

Suggested sample levels:

```text
Preview mode: 500–1,000 land sample points
Final mode: 3,000–5,000 land sample points
```

### Rendering recommendation

Use:

```text
Canvas for distortion heatmap
SVG for map outlines, borders, labels, and UI markers
```

### Optional optimization

If distortion calculation becomes slow:

```text
Move distortion calculation to a Web Worker
```

---

## Implementation Notes

### Distortion calculation basis

Use a local differential / Tissot-indicatrix-style approximation.

At each sampled land point:

1. Project the point.
2. Project nearby points slightly north/south and east/west.
3. Estimate local stretching.
4. Derive:
   - size distortion
   - shape distortion
5. Normalize values for visualization.

### Suggested calculation logic

For each sampled geographic point:

```text
Input:
- longitude
- latitude
- selected projection
- current rotation / new pole setting

Calculate:
- projected center point
- projected nearby longitude offset
- projected nearby latitude offset

Estimate:
- local horizontal projected scale
- local vertical projected scale
- area distortion
- shape distortion from difference between directional scale factors
```

Suggested outputs:

```text
sizeDistortion = normalized area scale error
shapeDistortion = normalized anisotropy / uneven stretching
```

Do not expose scale distortion as a separate user-facing metric.

---

## Data Requirements

Use land geometry only.

Recommended source:

```text
World land TopoJSON / GeoJSON
```

The distortion heatmap should be clipped or filtered to land.

Possible land detection methods:

1. Use GeoJSON polygon containment checks.
2. Pre-generate land sample points.
3. Use a simplified land mask for performance.

---

## Expected User Experience

The user should be able to:

1. View the normal redefined world map.
2. Select a projection.
3. Change the new north/south pole setting.
4. Click **Show Distortion Compare**.
5. See land-only distortion coloring.
6. Understand which areas have:
   - high size distortion
   - high shape distortion
   - both high distortions
   - low distortions
7. Use projection-specific buttons to jump to distortion-minimizing or distortion-maximizing pole settings.
8. Compare how different projections handle size and shape deformation.

---

## Success Criteria

The feature is successful if:

- Distortion compare mode is off by default.
- Distortion mode can be toggled with a button.
- Distortion colors are applied only to land.
- Ocean remains neutral.
- Size distortion and shape distortion are visually distinguishable.
- A bivariate legend appears at the bottom of the left panel.
- New north and south poles are shown clearly.
- Each projection has min/max distortion preset buttons.
- The map remains usable in a static website environment.
- The interface does not become too slow during interaction.
- The feature helps users compare projections without overwhelming the main map concept.

---

## Final Concept Summary

This update adds a land-only bivariate distortion analysis mode to the redefined world map tool.

The default experience remains a clean interactive reprojected world map. When the user activates Distortion Compare Mode, the land areas are colored by two distortion metrics: size distortion and shape distortion. The two metrics are combined into a multivariate color map with a legend in the left panel. Projection-specific buttons allow users to explore pole settings that produce minimum or maximum size and shape distortion for each projection.
