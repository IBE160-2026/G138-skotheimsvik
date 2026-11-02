/**
 * A hand-rolled SVG line chart.
 *
 * FR-91 forbids a third-party charting library and NFR-9 forbids runtime
 * dependencies generally, so this draws the axes and polyline directly.
 *
 * Each chart now shows one trainer at one variant (FR-88), so there is no
 * difficulty to encode — every point on a chart is directly comparable, which
 * is the whole reason the variant picker exists.
 */

import { el, formatDate } from './dom.js';

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
 * @param {Array<{x: string, y: number}>} options.points x is an ISO date
 * @param {string} options.label
 * @param {string} [options.suffix]
 */
export function lineChart({ points, label, suffix = '' }) {
  if (points.length === 0) {
    return el('p', { class: 'empty-state', text: 'No data yet.' });
  }

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const values = points.map((point) => point.y);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const span = maxValue - minValue || 1;

  const xFor = (index) =>
    PADDING.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const yFor = (value) => PADDING.top + plotHeight - ((value - minValue) / span) * plotHeight;

  const svg = svgEl('svg', {
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    class: 'chart',
    role: 'img',
    'aria-label': `${label} over time, ${points.length} rounds`,
  });

  // Horizontal gridlines with value labels.
  for (let step = 0; step <= 4; step += 1) {
    const value = minValue + (span * step) / 4;
    const y = yFor(value);
    svg.append(
      svgEl('line', { x1: PADDING.left, x2: WIDTH - PADDING.right, y1: y, y2: y, class: 'chart-grid' }),
    );
    const text = svgEl('text', { x: PADDING.left - 8, y: y + 4, class: 'chart-axis', 'text-anchor': 'end' });
    text.textContent = `${Math.round(value)}${suffix}`;
    svg.append(text);
  }

  svg.append(
    svgEl('polyline', {
      class: 'chart-line',
      points: points.map((point, index) => `${xFor(index)},${yFor(point.y)}`).join(' '),
    }),
  );

  points.forEach((point, index) => {
    const circle = svgEl('circle', { cx: xFor(index), cy: yFor(point.y), r: 4, class: 'chart-point' });
    const title = svgEl('title');
    title.textContent = `${formatDate(point.x)}: ${point.y}${suffix}`;
    circle.append(title);
    svg.append(circle);
  });

  // Only the ends are labelled; more than that is unreadable at this width.
  const first = svgEl('text', { x: PADDING.left, y: HEIGHT - 12, class: 'chart-axis' });
  first.textContent = formatDate(points[0].x);
  svg.append(first);

  if (points.length > 1) {
    const last = svgEl('text', {
      x: WIDTH - PADDING.right,
      y: HEIGHT - 12,
      class: 'chart-axis',
      'text-anchor': 'end',
    });
    last.textContent = formatDate(points[points.length - 1].x);
    svg.append(last);
  }

  return el('div', { class: 'chart-wrap' }, [svg]);
}

/** Kept so the progress view can explain the chart without a colour key. */
export function chartLegend() {
  return el('p', { class: 'muted small' }, [
    'Each point is one round at this level, in puzzle-date order. Hover a point for the exact value.',
  ]);
}
