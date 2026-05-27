import * as d3 from 'd3';
import { geoRobinson } from 'd3-geo-projection';

export const CYLINDRICAL_TYPES = new Set([
  'equirectangular', 'mercator', 'robinson'
]);

export function isCylindrical(type) {
  return CYLINDRICAL_TYPES.has(type);
}

// Flat map projections.
// The projection always starts at rotate([0,0,0]).
// Coordinate transformation into the new system happens before projection (in transform.js).
// The caller may apply rotate([scrollDeg, 0, 0]) for east-west seam shifting.
export function makeProjection(type, width, height) {
  let proj;
  const pad = [[20, 20], [width - 20, height - 20]];

  try {
    switch (type) {
      case 'mercator':
        proj = d3.geoMercator()
          .fitExtent(pad, { type: 'Sphere' })
          .clipExtent([[0, 0], [width, height]]);
        break;

      case 'robinson':
        proj = geoRobinson()
          .fitExtent(pad, { type: 'Sphere' });
        break;

      case 'lambertConformalConic':
        proj = d3.geoConicConformal()
          .parallels([20, 50])
          .fitExtent(pad, { type: 'Sphere' })
          .clipExtent([[0, 0], [width, height]]);
        break;

      case 'azimuthal':
        proj = d3.geoAzimuthalEquidistant()
          .clipAngle(180)
          .fitExtent(pad, { type: 'Sphere' });
        break;

      case 'equirectangular':
      default:
        proj = d3.geoEquirectangular()
          .fitExtent(pad, { type: 'Sphere' });
        break;
    }
  } catch {
    proj = d3.geoEquirectangular()
      .fitExtent(pad, { type: 'Sphere' });
  }

  proj.rotate([0, 0, 0]);
  return proj;
}
