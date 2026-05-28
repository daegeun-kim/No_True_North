## Debugging:
- maps are not showing for lambert conformal conic and lambert azimuthal equal area.
- lambert conformal conic: The map outline is showing but the map itself is a empty, showing only the land color of ocean color.
- lambert azimuthal equal area: Even the map border is now showing.
Make sure to use d3.geoConicConformal(), and d3.geoAzimuthalEqualArea() correctly to implement the map


## Left Panel Diagram Correction:

The left panel diagram must not be a fixed generic image only.

It should be a lightweight dynamic geometric visualization based on:

- Current selected projection type
- Current selected new north pole
- Current calculated new south pole

The diagram should show:

- A sphere representing Earth
- The selected new north pole
- The calculated new south pole
- The new pole axis connecting them
- A projection surface aligned to that pole axis

Projection surface behavior:

- Cylindrical / pseudo-cylindrical projections: show a cylinder aligned with the new pole axis.
- Conic projections: show a cone aligned with the new pole axis.
- Azimuthal projections: show a plane centered/tangent near the new north pole.

The diagram may be schematic and does not need full 3D geospatial accuracy.

Use SVG or Canvas for a lightweight implementation.

Do not use heavy WebGL or full 3D country geometry in this version unless already available.

Acceptance criteria:

- Diagram changes when projection type changes.
- Diagram updates when the user selects a new north pole.
- New north and south pole markers correspond to the selected custom pole and antipode.
- Projection surface is visually aligned to the custom pole axis.
- Diagram is not just a fixed static image unrelated to the current pole.