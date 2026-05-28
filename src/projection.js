import * as d3 from 'd3';
import {
  geoRobinson,
  geoCylindricalEqualArea,
  geoMollweide,
  geoPeirceQuincuncial,
} from 'd3-geo-projection';

export const CYLINDRICAL_TYPES = new Set([
  'equirectangular',
  'mercator',
  'robinson',
  'gallPeters',
  'cylindricalEqualArea',
  'mollweide',
]);

export function isCylindrical(type) {
  return CYLINDRICAL_TYPES.has(type);
}

// All projections start at rotate([0,0,0]).
// The caller applies rotate([scrollDeg, 0, 0]) for seam shifting only.
// Coordinate transformation into the new system happens before this in transform.js.
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

      case 'gallPeters':
        proj = geoCylindricalEqualArea()
          .parallel(45)
          .fitExtent(pad, { type: 'Sphere' });
        break;

      case 'cylindricalEqualArea':
        proj = geoCylindricalEqualArea()
          .fitExtent(pad, { type: 'Sphere' });
        break;

      case 'mollweide':
        proj = geoMollweide()
          .fitExtent(pad, { type: 'Sphere' });
        break;

      case 'lambertConformalConic':
        proj = d3.geoConicEquidistant()
          .parallels([40, 30])
          .fitExtent(pad, { type: 'Sphere' });
        break;

      case 'albersEqualAreaConic':
        proj = d3.geoConicEqualArea()
          .parallels([20, 50])
          .fitExtent(pad, { type: 'Sphere' });
        break;

      case 'azimuthalEquidistant':
        proj = d3.geoAzimuthalEquidistant()
          .clipAngle(180)
          .fitExtent(pad, { type: 'Sphere' });
        break;

      case 'lambertAzimuthalEqualArea': {
        proj = d3.geoConicEquidistant()  // due to bug in geoAzimuthalEqualArea(), same map is artifically created with geoConicEquidistant()
          .parallels([90, 90])
          .fitExtent(pad, { type: 'Sphere' });
        break;
      }

      case 'orthographic':
        proj = d3.geoOrthographic()
          .clipAngle(90)
          .fitExtent(pad, { type: 'Sphere' });
        break;

      case 'peirceQuincuncial':
        proj = geoPeirceQuincuncial()
          .fitExtent(pad, { type: 'Sphere' });
        break;

      case 'equirectangular':
      default:
        proj = d3.geoEquirectangular()
          .fitExtent(pad, { type: 'Sphere' });
        break;
    }
  } catch (err) {
    console.warn('Projection fallback to equirectangular:', type, err);
    proj = d3.geoEquirectangular()
      .fitExtent(pad, { type: 'Sphere' });
  }

  proj.rotate([0, 0, 0]);
  return proj;
}
