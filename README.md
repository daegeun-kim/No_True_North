# Oblique Earth Mapper

An interactive frontend web tool that lets you redefine the Earth's north pole
and generate a custom world map projection in real time.

## What it does

1. Opens with a standard equirectangular world map.
2. Click any location on Earth to set it as the new north pole.
3. The app derives the antipodal south pole automatically.
4. The globe animates — rotating until the selected point reaches the top.
5. The map morphs into the chosen projection (Equirectangular, Mercator, Robinson).
6. The final map is horizontally scrollable, shifting the seam east or west.
7. Reset and try again with any other pole.

## Running

The app is entirely static HTML/CSS/JS — no build step.

Serve it from a local HTTP server (required for ES modules and `fetch`):

```bash
# Python
python -m http.server 8000

# Node
npx serve .
```

Then open `http://localhost:8000` in a modern browser (Chrome 89+, Edge 89+,
Firefox 108+, Safari 16.4+ required for import maps).

> `file://` URLs will not work due to browser ES-module security restrictions.

## Offline data

By default, world data loads from CDN. For offline use, download:

```
https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json
```

and place the file at `data/countries-110m.json`. See `data/README.md`.

## Project structure

```
index.html          Entry point
styles/style.css    Dark-theme stylesheet
src/
  main.js           App state and orchestration
  data.js           Data loading (local → CDN fallback)
  utils.js          Antipodal calculation, coordinate formatting
  projection.js     D3 projection factory and rotation math
  render.js         Canvas rendering (frames + blend transitions)
  animation.js      requestAnimationFrame loop utility
  interaction.js    Click, drag, and scroll event handlers
data/
  README.md         Instructions for local data files
```

## Projection rotation formula

To bring geographic point (λ, φ) to the new north pole:

```js
projection.rotate([ -λ, φ - 90, 0 ])
```

This applies a proper 3D spherical rotation so the selected point appears at
the top of every supported projection. Horizontal scrolling increments
`rotation[0]`, naturally wrapping the map seam without duplicating geometry.
