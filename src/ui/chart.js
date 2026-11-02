/**
 * A hand-rolled SVG line chart.
 *
 * FR-75 forbids a third-party charting library, and NFR-9 forbids runtime
 * dependencies generally, so this draws the axes and polyline directly.
 * Difficulty is encoded in the point colour *and* exposed in each point's
 * accessible title, so it is not conveyed by colour alone (FR-72, FR-123).
 */

import { el, formatDate } from './dom.js';
import { bandLabel } from '../core/difficulty.js';

const WIDTH = 720;
const HEIGHT = 260;
const PADDING = { top: 20, right: 20, bottom: 42, left: 44 };

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value));
  }
  return node;
}

/**
 * @param {object} options
 * @param {Array<{puzzleDate: string, value: number, difficulty: string}>} options.points
 * @param {string} options.label
 * @param {string} [options.suffix]
 */
export function lineChart({ points, label, suffix = '' }) {
  if (points.length === 0) {
    return el('p', { class: 'empty-state', text: 'No data yet.' });
  }

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const values = points.map((p) => p.value);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const span = maxValue - minValue || 1;

  const xFor = (index) =>
    PADDING.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const yFor = (value) => PADDING.top + plotHeight - ((value - minValue) / span) * plotHeight;

  const svg = svgEl('svg', {
    class: 'chart',
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    role: 'img',
    'aria-label': `${label} over time, ${points.length} puzzles, best ${maxValue}${suffix}`,
  });

  // Horizontal gridlines with value labels.
  for (let i = 0; i <= 4; i += 1) {
    const value = minValue + (span * i) / 4;
    const y = yFor(value);
    svg.append(
      svgEl('line', {
        x1: PADDING.left, x2: WIDTH - PADDING.right, y1: y, y2: y,
        stroke: 'currentColor', 'stroke-opacity': 0.12,
      }),
      svgEl('text', {
        x: PADDING.left - 8, y: y + 4, 'text-anchor': 'end',
        fill: 'currentColor', 'fill-opacity': 0.55, 'font-size': 11,
      }),
    );
    svg.lastChild.textContent = Math.round(value * 10) / 10;
  }

  // The series itself.
  const path = points.map((point, index) => `${xFor(index)},${yFor(point.value)}`).join(' ');
  svg.append(
    svgEl('polyline', {
      points: path, fill: 'none',
      stroke: 'var(--accent)', 'stroke-width': 2,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round',
    }),
  );

  // One marker per puzzle, coloured by that day's band.
  points.forEach((point, index) => {
    const circle = svgEl('circle', {
      cx: xFor(index), cy: yFor(point.value), r: 5,
      fill: `var(--band-${point.difficulty})`,
      stroke: 'var(--surface)', 'stroke-width': 2,
    });
    const title = svgEl('title');
    title.textContent =
      `${formatDate(point.puzzleDate)} — ${point.value}${suffix}, ${bandLabel(point.difficulty)} day`;
    circle.append(title);
    svg.append(circle);
  });

  // First and last date labels only, to avoid a crowded axis.
  const edges = points.length === 1 ? [0] : [0, points.length - 1];
  for (const index of edges) {
    const text = svgEl('text', {
      x: xFor(index), y: HEIGHT - 14,
      'text-anchor': index === 0 ? 'start' : 'end',
      fill: 'currentColor', 'fill-opacity': 0.55, 'font-size': 11,
    });
    text.textContent = points[index].puzzleDate;
    svg.append(text);
  }

  return svg;
}

/** A legend explaining the point colours. */
export function chartLegend() {
  return el('div', { class: 'badge-row' },
    ['beginner', 'intermediate', 'advanced', 'expert'].map((band) =>
      el('span', { class: `badge badge-band band-${band}`, text: bandLabel(band) }),
    ),
  );
}
