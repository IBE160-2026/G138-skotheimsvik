/**
 * Persistence.
 *
 * Wraps localStorage so that a missing, unavailable or corrupt store degrades to
 * a usable app rather than a crash (FR-84, FR-86, NFR-7). The backend is
 * injectable so tests can drive it without a browser.
 */

export const SCHEMA_VERSION = 1;

export const STORAGE_KEYS = Object.freeze({
  progress: 'learninghub.v2.progress',
  settings: 'learninghub.v2.settings',
  practice: 'learninghub.v2.practice',
});

/** An in-memory stand-in used by tests and as the fallback when storage is blocked. */
export function createMemoryBackend(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => void map.set(key, String(value)),
    removeItem: (key) => void map.delete(key),
  };
}

/** Probe whether a real localStorage is usable; Safari private mode throws on write. */
export function detectBackend() {
  try {
    const probeKey = '__learninghub_probe__';
    globalThis.localStorage.setItem(probeKey, '1');
    globalThis.localStorage.removeItem(probeKey);
    return { backend: globalThis.localStorage, available: true };
  } catch {
    return { backend: createMemoryBackend(), available: false };
  }
}

/**
 * @param {object} [options]
 * @param {object} [options.backend]
 * @param {boolean} [options.available]
 */
export function createStorage(options = {}) {
  const detected = options.backend
    ? { backend: options.backend, available: options.available ?? true }
    : detectBackend();

  const { backend, available } = detected;
  /** @type {string[]} */
  const warnings = [];

  /**
   * Read and parse a key, falling back when anything is wrong with it.
   * @template T
   * @param {string} key
   * @param {T} fallback
   * @returns {T}
   */
  function read(key, fallback) {
    let raw;
    try {
      raw = backend.getItem(key);
    } catch {
      warnings.push(`Could not read ${key}.`);
      return fallback;
    }

    if (raw === null || raw === undefined) return fallback;

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
      if (parsed.schemaVersion !== SCHEMA_VERSION) {
        warnings.push('Saved progress was from an older version and has been reset.');
        return fallback;
      }
      return parsed.data ?? fallback;
    } catch {
      warnings.push('Saved progress could not be read and has been reset.');
      return fallback;
    }
  }

  /**
   * Write a key, wrapped with its schema version.
   * @param {string} key
   * @param {unknown} data
   */
  function write(key, data) {
    try {
      backend.setItem(key, JSON.stringify({ schemaVersion: SCHEMA_VERSION, data }));
      return true;
    } catch {
      warnings.push('Progress could not be saved.');
      return false;
    }
  }

  function remove(key) {
    try {
      backend.removeItem(key);
    } catch {
      /* nothing useful to do */
    }
  }

  return {
    available,
    read,
    write,
    remove,
    /** Warnings accumulated so far, for the non-blocking notice (FR-84). */
    warnings: () => [...warnings],
    clearWarnings: () => void (warnings.length = 0),
    /** Approximate stored size in bytes, for NFR-10. */
    size() {
      return Object.values(STORAGE_KEYS).reduce((total, key) => {
        try {
          return total + (backend.getItem(key)?.length ?? 0);
        } catch {
          return total;
        }
      }, 0);
    },
  };
}
