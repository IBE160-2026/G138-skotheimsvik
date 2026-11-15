/**
 * Authoring tool — converts Natural Earth derived TopoJSON into the plain SVG
 * paths the Outline Guesser ships (FR-146, NFR-10, NFR-22).
 *
 * Run with: node tools/build-outlines.js
 *
 * This file is NOT shipped to the browser. It runs once, by hand, and its
 * output is committed. The application itself never parses TopoJSON and never
 * makes a network request.
 *
 * Source: world-atlas@2.0.2 countries-110m, derived from Natural Earth.
 * Natural Earth is public domain: https://www.naturalearthdata.com/about/terms-of-use/
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const TOPO_50M_PATH = join(here, 'data', 'countries-50m.topo.json');
const TOPO_10M_PATH = join(here, 'data', 'countries-10m.topo.json');
const TOPO_110M_PATH = join(here, 'data', 'countries-110m.topo.json');
const COUNTRIES_PATH = join(root, 'src', 'trainers', 'geography', 'countries.json');
const OUT_PATH = join(root, 'src', 'trainers', 'geography', 'outlines.json');

/**
 * Natural Earth abbreviates long names, so ours have to be translated.
 */
const NAME_ALIASES = new Map([
  ['United States', 'United States of America'],
  ['Bosnia and Herzegovina', 'Bosnia and Herz.'],
  ['Central African Republic', 'Central African Rep.'],
  ['Republic of the Congo', 'Congo'],
  ['Democratic Republic of the Congo', 'Dem. Rep. Congo'],
  ['Dominican Republic', 'Dominican Rep.'],
  ['Equatorial Guinea', 'Eq. Guinea'],
  ['Eswatini', 'eSwatini'],
  ['Ivory Coast', "Côte d'Ivoire"],
  ['North Macedonia', 'Macedonia'],
  ['Solomon Islands', 'Solomon Is.'],
  ['South Sudan', 'S. Sudan'],
  ['Antigua and Barbuda', 'Antigua and Barb.'],
  ['Marshall Islands', 'Marshall Is.'],
  ['Saint Kitts and Nevis', 'St. Kitts and Nevis'],
  ['Saint Vincent and the Grenadines', 'St. Vin. and Gren.'],
  ['Sao Tome and Principe', 'São Tomé and Principe'],
  ['Vatican City', 'Vatican'],
]);

/** Every silhouette is normalised into this square (FR-147). */
const VIEWBOX = 100;

/** Padding inside the viewBox so stroke and glow never clip at the edge. */
const PADDING = 4;

/** Douglas-Peucker tolerance, in normalised units — fine enough to preserve authentic coastlines. */
const SIMPLIFY_EPSILON = 0.08;

/** Islands smaller than this share of the biggest ring are dropped as specks. */
const MIN_RING_AREA_RATIO = 0.0012;

/**
 * Rings further apart than this (in degrees) are treated as separate landmasses.
 *
 * Natural Earth files overseas territories under the parent country, so France
 * arrives carrying French Guiana and the United States carrying Hawaii. Drawn
 * literally, France becomes a thumbnail of the Atlantic with two specks in it.
 * Grouping rings and keeping only the largest cluster gives the silhouette a
 * player would actually recognise. Alaska survives, because it genuinely does
 * sit within a few degrees of the lower 48.
 */
const CLUSTER_GAP_DEGREES = 6.5;

// --- TopoJSON decoding -----------------------------------------------------

/** Dequantise one arc into absolute [lon, lat] pairs. */
function decodeArc(arc, transform) {
  const [sx, sy] = transform.scale;
  const [tx, ty] = transform.translate;
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * sx + tx, y * sy + ty];
  });
}

/** Stitch a ring's arc indices into one point list. Negative index means reversed. */
function ringPoints(ringIndices, arcs) {
  const points = [];
  for (const index of ringIndices) {
    const arc = index < 0 ? arcs[~index].slice().reverse() : arcs[index];
    // Consecutive arcs share an endpoint; drop the duplicate.
    points.push(...(points.length ? arc.slice(1) : arc));
  }
  return points;
}

/** Every ring of a geometry, exterior and holes alike, as point lists. */
function geometryRings(geometry, arcs) {
  if (geometry.type === 'Polygon') {
    return geometry.arcs.map((ring) => ringPoints(ring, arcs));
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.arcs.flatMap((polygon) => polygon.map((ring) => ringPoints(ring, arcs)));
  }
  return [];
}

// --- Geometry helpers ------------------------------------------------------

/** Shoelace area; sign indicates winding, so callers take the absolute value. */
function signedArea(points) {
  let total = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    total += points[j][0] * points[i][1] - points[i][0] * points[j][1];
  }
  return total / 2;
}

/**
 * True polygon centroid of one ring, in [lon, lat].
 *
 * Averaging the vertices instead would drag the result towards whichever coast
 * Natural Earth happened to draw in most detail — it put the centre of the
 * United States about eight degrees too far east, out in the Appalachians.
 */
function ringCentroid(ring) {
  const lons = ring.map(([lon]) => lon);
  const wraps = Math.max(...lons) - Math.min(...lons) > 180;
  const points = wraps ? ring.map(([lon, lat]) => [lon < 0 ? lon + 360 : lon, lat]) : ring;

  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const cross = points[j][0] * points[i][1] - points[i][0] * points[j][1];
    twiceArea += cross;
    cx += (points[j][0] + points[i][0]) * cross;
    cy += (points[j][1] + points[i][1]) * cross;
  }
  if (twiceArea === 0) return null;
  return [cx / (3 * twiceArea), cy / (3 * twiceArea)];
}

/**
 * Area-weighted centroid across every ring, combined on the unit sphere.
 *
 * The 3D step matters for countries whose landmasses straddle the antimeridian:
 * averaging longitudes directly would drop Fiji into the wrong hemisphere.
 */
function sphericalCentroid(rings) {
  let x = 0;
  let y = 0;
  let z = 0;
  let weight = 0;

  for (const ring of rings) {
    const area = Math.abs(signedArea(ring));
    const centre = area === 0 ? null : ringCentroid(ring);
    if (!centre) continue;
    const phi = (centre[1] * Math.PI) / 180;
    const lambda = (centre[0] * Math.PI) / 180;
    x += Math.cos(phi) * Math.cos(lambda) * area;
    y += Math.cos(phi) * Math.sin(lambda) * area;
    z += Math.sin(phi) * area;
    weight += area;
  }

  if (weight === 0) return null;
  const hyp = Math.hypot(x / weight, y / weight);
  return [
    Number(((Math.atan2(z / weight, hyp) * 180) / Math.PI).toFixed(4)),
    Number(((Math.atan2(y / weight, x / weight) * 180) / Math.PI).toFixed(4)),
  ];
}

/** Perpendicular distance from p to the segment ab. */
function pointSegmentDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function simplify(points, epsilon) {
  // Preserve closed rings: simplify open chain + re-close so 3-vertex polygons survive.
  const closed =
    points.length > 2 &&
    points[0][0] === points[points.length - 1][0] &&
    points[0][1] === points[points.length - 1][1];
  const work = closed ? points.slice(0, -1) : points;
  if (work.length <= 4) return work;

  function rdp(pts) {
    if (pts.length < 3) return pts;
    let maxDistance = 0;
    let index = 0;
    for (let i = 1; i < pts.length - 1; i += 1) {
      const distance = pointSegmentDistance(pts[i], pts[0], pts[pts.length - 1]);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    if (maxDistance <= epsilon) return [pts[0], pts[pts.length - 1]];
    return [...rdp(pts.slice(0, index + 1)).slice(0, -1), ...rdp(pts.slice(index))];
  }

  // Split closed ring at furthest vertex from start so RDP doesn't collapse start==end
  let farIdx = 1;
  let farDist = 0;
  for (let i = 1; i < work.length; i += 1) {
    const d = Math.hypot(work[i][0] - work[0][0], work[i][1] - work[0][1]);
    if (d > farDist) {
      farDist = d;
      farIdx = i;
    }
  }
  const half1 = rdp(work.slice(0, farIdx + 1));
  const half2 = rdp([...work.slice(farIdx), work[0]]);
  return [...half1.slice(0, -1), ...half2.slice(0, -1)];
}

function ringBbox(ring) {
  const xs = ring.map(([lon]) => lon);
  const ys = ring.map(([, lat]) => lat);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** Shortest gap between two bounding boxes; zero when they overlap. */
function bboxGap(a, b) {
  const dx = Math.max(0, a.minX - b.maxX, b.minX - a.maxX);
  const dy = Math.max(0, a.minY - b.maxY, b.minY - a.maxY);
  return Math.hypot(dx, dy);
}

/** Group rings into landmasses by proximity and return the largest group. */
function mainCluster(rings) {
  if (rings.length < 2) return rings;
  const boxes = rings.map(ringBbox);
  const parent = rings.map((_, index) => index);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));

  for (let i = 0; i < rings.length; i += 1) {
    for (let j = i + 1; j < rings.length; j += 1) {
      if (bboxGap(boxes[i], boxes[j]) < CLUSTER_GAP_DEGREES) {
        const a = find(i);
        const b = find(j);
        if (a !== b) parent[b] = a;
      }
    }
  }

  const groups = new Map();
  rings.forEach((ring, index) => {
    const key = find(index);
    const group = groups.get(key) ?? { rings: [], area: 0 };
    group.rings.push(ring);
    group.area += Math.abs(signedArea(ring));
    groups.set(key, group);
  });

  return [...groups.values()].reduce((best, group) => (group.area > best.area ? group : best)).rings;
}

// --- Conversion ------------------------------------------------------------

/**
 * Turn one country's rings into a normalised SVG path.
 *
 * Longitudes are unwrapped first: a country spanning the antimeridian would
 * otherwise be drawn as two halves pinned to opposite edges of the viewBox.
 */
function toPath(rings, centroidLat) {
  const unwrapped = rings.map((ring) => ring.map(([lon, lat]) => [lon, lat]));
  const allLon = unwrapped.flat().map(([lon]) => lon);
  if (Math.max(...allLon) - Math.min(...allLon) > 180) {
    for (const ring of unwrapped) {
      for (const point of ring) {
        if (point[0] < 0) point[0] += 360;
      }
    }
  }

  // Equirectangular, with longitude squeezed by latitude so shapes stay honest.
  const squeeze = Math.cos((centroidLat * Math.PI) / 180);
  const projected = unwrapped.map((ring) => ring.map(([lon, lat]) => [lon * squeeze, -lat]));

  const xs = projected.flat().map(([x]) => x);
  const ys = projected.flat().map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const usable = VIEWBOX - PADDING * 2;
  const scale = usable / Math.max(maxX - minX, maxY - minY, 1e-9);
  const offsetX = PADDING + (usable - (maxX - minX) * scale) / 2;
  const offsetY = PADDING + (usable - (maxY - minY) * scale) / 2;

  const normalised = projected.map((ring) =>
    ring.map(([x, y]) => [(x - minX) * scale + offsetX, (y - minY) * scale + offsetY]),
  );

  const areas = normalised.map((ring) => Math.abs(signedArea(ring)));
  const biggest = Math.max(...areas);

  const parts = [];
  normalised.forEach((ring, index) => {
    if (areas[index] / biggest < MIN_RING_AREA_RATIO) return;
    const reduced = simplify(ring, SIMPLIFY_EPSILON);
    if (reduced.length < 3) return;
    const coords = reduced.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`);
    parts.push(`M${coords.join('L')}Z`);
  });

  return parts.join('');
}

// --- Main ------------------------------------------------------------------

function loadTopo(path) {
  const topology = JSON.parse(readFileSync(path, 'utf8'));
  const decodedArcs = topology.arcs.map((arc) => decodeArc(arc, topology.transform));
  const byName = new Map(
    topology.objects.countries.geometries.map((geometry) => [geometry.properties.name, geometry]),
  );
  return { decodedArcs, byName };
}

const topo10 = loadTopo(TOPO_10M_PATH);
const topo50 = loadTopo(TOPO_50M_PATH);
const topo110 = loadTopo(TOPO_110M_PATH);

/**
 * Exact municipal border of Vatican City (OSM / official boundary coords [lon, lat]),
 * because 10m quantization collapses a 0.49 km² enclave to a single grid step.
 */
const OVERRIDE_RINGS = new Map([
  [
    'Vatican City',
    [
      [
        [12.4457, 41.9031],
        [12.4465, 41.9019],
        [12.4478, 41.9012],
        [12.4501, 41.9008],
        [12.4525, 41.9004],
        [12.4545, 41.9003],
        [12.4567, 41.9011],
        [12.4576, 41.9019],
        [12.4583, 41.9029],
        [12.4577, 41.9038],
        [12.4565, 41.9045],
        [12.4557, 41.9059],
        [12.4546, 41.9068],
        [12.4531, 41.9065],
        [12.4513, 41.9061],
        [12.4494, 41.9052],
        [12.4475, 41.9043],
        [12.4457, 41.9031],
      ],
    ],
  ],
]);

const { countries } = JSON.parse(readFileSync(COUNTRIES_PATH, 'utf8'));
const outlines = {};
const missing = [];

for (const country of countries) {
  const targetName = NAME_ALIASES.get(country.name) ?? country.name;

  let rawRings = OVERRIDE_RINGS.get(country.name) ?? null;
  if (!rawRings) {
    // Use 50m for large/medium countries, and 10m for smaller countries or when 50m is missing/coarse
    let source = topo50.byName.has(targetName) ? topo50 : topo10;
    let geometry = source.byName.get(targetName);
    if (!geometry) {
      source = topo10.byName.has(targetName) ? topo10 : topo110;
      geometry = source.byName.get(targetName);
    }
    if (!geometry) {
      missing.push(country.name);
      continue;
    }

    rawRings = geometryRings(geometry, source.decodedArcs);
    // If 50m has few vertices, upgrade to 10m for crisp authentic detail
    const totalVerts = rawRings.reduce((sum, r) => sum + r.length, 0);
    if (source === topo50 && totalVerts < 120 && topo10.byName.has(targetName)) {
      source = topo10;
      geometry = topo10.byName.get(targetName);
      rawRings = geometryRings(geometry, source.decodedArcs);
    }
  }

  const rings = mainCluster(rawRings);
  const centroid = sphericalCentroid(rings);
  if (!centroid || rings.length === 0) {
    missing.push(country.name);
    continue;
  }
  const d = toPath(rings, centroid[0]);
  if (!d) {
    missing.push(country.name);
    continue;
  }
  outlines[country.name] = { d, centroid };
}

const output = {
  schemaVersion: 1,
  source: 'world-atlas@2.0.2 countries-50m & countries-10m, derived from Natural Earth',
  licence: 'Public domain — https://www.naturalearthdata.com/about/terms-of-use/',
  note: 'Generated by tools/build-outlines.js. Do not edit by hand. Outlines are normalised into a 0 0 100 100 viewBox so relative area gives nothing away (FR-147). Centroids are [lat, lon] and drive the distance hints (FR-151).',
  viewBox: `0 0 ${VIEWBOX} ${VIEWBOX}`,
  outlines,
};

writeFileSync(OUT_PATH, `${JSON.stringify(output)}\n`, 'utf8');

const bytes = Buffer.byteLength(JSON.stringify(output));
console.log(`Skrev ${Object.keys(outlines).length} omriss til ${OUT_PATH}`);
console.log(`Størrelse: ${(bytes / 1024).toFixed(1)} kB`);
if (missing.length) console.log(`Uten omriss (${missing.length}): ${missing.join(', ')}`);
