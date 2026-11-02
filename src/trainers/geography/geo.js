/**
 * Geographic helpers for the Outline Guesser's hints.
 *
 * Pure maths, no DOM and no content (NFR-15), so the hint behaviour in FR-148
 * to FR-152 can be asserted against hand-checked reference values.
 *
 * Coordinates are [latitude, longitude] in degrees throughout, matching the
 * centroids produced by tools/build-outlines.js.
 */

const EARTH_RADIUS_KM = 6371;

/** The furthest two points on Earth can be — half the circumference. */
export const MAX_DISTANCE_KM = Math.PI * EARTH_RADIUS_KM;

const toRadians = (degrees) => (degrees * Math.PI) / 180;
const toDegrees = (radians) => (radians * 180) / Math.PI;

/**
 * Great-circle distance in kilometres (FR-151).
 * @param {[number, number]} from [lat, lon]
 * @param {[number, number]} to [lat, lon]
 */
export function haversineKm(from, to) {
  const [lat1, lon1] = from;
  const [lat2, lon2] = to;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial bearing from one point to another, 0–360° clockwise from north. */
export function bearingDegrees(from, to) {
  const [lat1, lon1] = from;
  const [lat2, lon2] = to;
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const dLon = toRadians(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

const COMPASS = Object.freeze([
  { name: 'north', arrow: '↑' },
  { name: 'north-east', arrow: '↗' },
  { name: 'east', arrow: '→' },
  { name: 'south-east', arrow: '↘' },
  { name: 'south', arrow: '↓' },
  { name: 'south-west', arrow: '↙' },
  { name: 'west', arrow: '←' },
  { name: 'north-west', arrow: '↖' },
]);

/** Bearing rounded to one of eight compass points (FR-149). */
export function compassPoint(degrees) {
  const index = Math.round(((degrees % 360) + 360) % 360 / 45) % 8;
  return COMPASS[index];
}

/**
 * Closeness as a percentage: 100 % only when the guess is exact, falling
 * linearly with distance (FR-150).
 */
export function proximityPercent(distanceKm) {
  const ratio = 1 - Math.min(distanceKm, MAX_DISTANCE_KM) / MAX_DISTANCE_KM;
  return Math.round(ratio * 100);
}

/**
 * The full hint for one wrong guess.
 * @param {[number, number]} guess centroid of the guessed country
 * @param {[number, number]} target centroid of the answer
 */
export function describeGuess(guess, target) {
  const distanceKm = haversineKm(guess, target);
  const bearing = bearingDegrees(guess, target);
  const point = compassPoint(bearing);
  return {
    distanceKm: Math.round(distanceKm),
    direction: point.name,
    arrow: point.arrow,
    proximity: proximityPercent(distanceKm),
  };
}
