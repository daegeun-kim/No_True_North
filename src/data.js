import * as topojson from 'topojson-client';

const LOCAL_URL = './data/countries-110m.json';
const CDN_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

let cache = null;

export async function loadData() {
  if (cache) return cache;

  let topology;

  try {
    const res = await fetch(LOCAL_URL);
    if (!res.ok) throw new Error('local not found');
    topology = await res.json();
  } catch {
    const res = await fetch(CDN_URL);
    if (!res.ok) throw new Error('Map data could not be loaded.');
    topology = await res.json();
  }

  cache = {
    countries: topojson.feature(topology, topology.objects.countries),
    land:      topojson.feature(topology, topology.objects.land),
  };

  return cache;
}
