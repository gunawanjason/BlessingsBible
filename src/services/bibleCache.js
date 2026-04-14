// Two-tier cache (in-memory + localStorage) for Bible chapter data.
// Keeps chapters and pericope headings so navigation to an already-visited
// chapter doesn't re-hit the network. Survives reloads via localStorage.

const STORAGE_PREFIX = "bbcache:v1:";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_ENTRIES = 150; // Cap on bbcache:* keys before eviction kicks in

const memCache = new Map();

const makeKey = (kind, translation, book, chapter) =>
  `${STORAGE_PREFIX}${kind}:${String(translation).toUpperCase()}:${book}:${chapter}`;

const readEntry = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry !== "object") return null;
    if (!entry.timestamp || Date.now() - entry.timestamp > TTL_MS) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      return null;
    }
    return entry;
  } catch {
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

const evictOldest = (fraction = 0.25) => {
  const keys = listCacheKeys();
  const entries = keys.map((k) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(k));
      return { key: k, timestamp: parsed?.timestamp || 0 };
    } catch {
      return { key: k, timestamp: 0 };
    }
  });
  entries.sort((a, b) => a.timestamp - b.timestamp);
  const toRemove = Math.max(1, Math.floor(entries.length * fraction));
  for (let i = 0; i < toRemove && i < entries.length; i++) {
    try {
      localStorage.removeItem(entries[i].key);
    } catch {
      /* ignore */
    }
  }
};

const writeEntry = (key, data) => {
  const payload = JSON.stringify({ timestamp: Date.now(), data });
  try {
    if (listCacheKeys().length >= MAX_ENTRIES) {
      evictOldest(0.2);
    }
    localStorage.setItem(key, payload);
  } catch {
    // Most likely QuotaExceededError — evict and retry once
    try {
      evictOldest(0.5);
      localStorage.setItem(key, payload);
    } catch {
      /* give up silently */
    }
  }
};

const get = (key) => {
  if (memCache.has(key)) return memCache.get(key);
  const entry = readEntry(key);
  if (entry) {
    memCache.set(key, entry.data);
    return entry.data;
  }
  return null;
};

const set = (key, data) => {
  memCache.set(key, data);
  writeEntry(key, data);
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
