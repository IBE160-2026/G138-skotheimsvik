/**
 * Small DOM helpers.
 *
 * Kept deliberately thin — all the logic worth testing lives in src/core/,
 * which is what NFR-14 requires.
 */

/**
 * Create an element.
 * @param {string} tag
 * @param {object} [attrs]
 * @param {Array|string} [children]
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset') {
      Object.assign(node.dataset, value);
    } else {
      node.setAttribute(key, value === true ? '' : String(value));
    }
  }

  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' || typeof child === 'number' ? String(child) : child);
  }

  return node;
}

/** Replace a container's contents. */
export function render(container, ...nodes) {
  container.replaceChildren(...nodes.filter(Boolean));
}

/** A labelled statistic block. The value may be a string or a node. */
export function stat(label, value, extraClass = '') {
  const valueNode = el('span', { class: `stat-value ${extraClass}`.trim() });
  if (value instanceof Node) valueNode.append(value);
  else valueNode.textContent = String(value);

  return el('div', { class: 'stat' }, [
    el('span', { class: 'stat-label', text: label }),
    valueNode,
  ]);
}

/** A difficulty badge, carrying the band name as text, not only colour. */
export function bandBadge(band, label) {
  return el('span', {
    class: `badge badge-band band-${band}`,
    text: label,
  });
}

/** Format milliseconds as a human duration. */
export function formatDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** Format a seconds countdown as m:ss. */
export function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Readable date, e.g. "Mon 12 Oct 2026". */
export function formatDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}
