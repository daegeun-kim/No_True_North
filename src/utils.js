export function antipodal(lon, lat) {
  let southLon = lon + 180;
  if (southLon > 180) southLon -= 360;
  return { lon: southLon, lat: -lat };
}

export function formatCoord(lon, lat) {
  if (lon == null || lat == null || isNaN(lon) || isNaN(lat)) return '—';
  const latAbs = Math.abs(lat).toFixed(2);
  const lonAbs = Math.abs(lon).toFixed(2);
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${latAbs}° ${latDir}, ${lonAbs}° ${lonDir}`;
}

export function clampLat(lat) {
  return Math.max(-90, Math.min(90, lat));
}

export function normalizeLon(lon) {
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
}
