// Two-tier cache (in-memory + localStorage) for Bible chapter data.
// Keeps chapters and pericope headings so navigation to an already-visited
// chapter doesn't re-hit the network. Survives reloads via localStorage.

const STORAGE_PREFIX = "bbcache:v1:";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_ENTRIES = 150; // Cap on bbcache:* keys before eviction kicks in

const memCache = new Map();

const makeKey = (kind, translation, book, chapter) =>
  `${STORAGE_PREFIX}${kind}:${String(translation).toUpperCase()}:${book}:${chapter}`;

const isExpired = (entry) =>
  !Number.isFinite(entry?.timestamp) || Date.now() - entry.timestamp > TTL_MS;

const removeEntry = (key) => {
  memCache.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

const readEntry = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (
      !entry ||
      typeof entry !== "object" ||
      !("data" in entry) ||
      isExpired(entry)
    ) {
      removeEntry(key);
      return null;
    }
    return entry;
  } catch {
    removeEntry(key);
    return null;
  }
};

const listCacheKeys = () => {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
  } catch {
    /* ignore */
  }
  return keys;
};

const evictOldest = (fraction = 0.25, protectedKey = null) => {
  const keys = new Set([...listCacheKeys(), ...memCache.keys()]);
  const entries = Array.from(keys)
    .filter((key) => key !== protectedKey)
    .map((key) => {
      const memoryEntry = memCache.get(key);
      if (memoryEntry) return { key, timestamp: memoryEntry.timestamp };

      try {
        const parsed = JSON.parse(localStorage.getItem(key));
        return { key, timestamp: parsed?.timestamp || 0 };
      } catch {
        return { key, timestamp: 0 };
      }
    });
  entries.sort((a, b) => a.timestamp - b.timestamp);
  const toRemove = Math.max(1, Math.floor(entries.length * fraction));
  for (let i = 0; i < toRemove && i < entries.length; i++) {
    removeEntry(entries[i].key);
  }
};

const knownCacheKeys = () => new Set([...listCacheKeys(), ...memCache.keys()]);

const ensureCapacityFor = (key) => {
  const keys = knownCacheKeys();
  const keyExists = keys.has(key);
  const excess = keys.size + (keyExists ? 0 : 1) - MAX_ENTRIES;
  if (excess <= 0) return;

  const evictableEntries = keys.size - (keyExists ? 1 : 0);
  evictOldest(Math.max(0.2, excess / evictableEntries), keyExists ? key : null);
};

const writeEntry = (key, entry) => {
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Most likely QuotaExceededError — evict and retry once
    try {
      evictOldest(0.5, key);
      localStorage.setItem(key, JSON.stringify(entry));
    } catch {
      /* give up silently */
    }
  }
};

const get = (key) => {
  const memoryEntry = memCache.get(key);
  if (memoryEntry) {
    if (isExpired(memoryEntry)) {
      removeEntry(key);
      return null;
    }
    return memoryEntry.data;
  }

  const entry = readEntry(key);
  if (entry) {
    ensureCapacityFor(key);
    memCache.set(key, entry);
    return entry.data;
  }
  return null;
};

const set = (key, data) => {
  ensureCapacityFor(key);
  const entry = { timestamp: Date.now(), data };
  memCache.set(key, entry);
  writeEntry(key, entry);
};

export const getCachedChapter = (translation, book, chapter) =>
  get(makeKey("verses", translation, book, chapter));

export const setCachedChapter = (translation, book, chapter, verses) =>
  set(makeKey("verses", translation, book, chapter), verses);

export const getCachedHeadings = (translation, book, chapter) =>
  get(makeKey("headings", translation, book, chapter));

export const setCachedHeadings = (translation, book, chapter, headings) =>
  set(makeKey("headings", translation, book, chapter), headings);

export const hasCachedChapter = (translation, book, chapter) =>
  getCachedChapter(translation, book, chapter) !== null;

export const clearBibleCache = () => {
  memCache.clear();
  listCacheKeys().forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  });
};
