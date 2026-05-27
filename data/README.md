# Data directory

This directory is the local cache location for Natural Earth TopoJSON data.

## Automatic CDN fallback

`data.js` first tries to load `./data/countries-110m.json`.
If the file is missing, it automatically falls back to the world-atlas CDN:

```
https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json
```

An internet connection is required if the local file is absent.

## Download for offline use

To run the app fully offline, download the file manually and place it here:

```
data/countries-110m.json
```

The file is published by the `world-atlas` npm package and is available at:

- https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json
- https://unpkg.com/world-atlas@2/countries-110m.json

Resolution: 110m Natural Earth (approx. 110 km/feature), suitable for performance.
