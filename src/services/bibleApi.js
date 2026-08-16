import {
  getCachedChapter,
  setCachedChapter,
  getCachedHeadings,
  setCachedHeadings,
  hasCachedChapter,
} from "./bibleCache.js";

const API_BASE_URL = "https://api.blessings365.top";
const REQUEST_TIMEOUT_MS = 12000;

const createAbortError = () => {
  const error = new Error("The request was cancelled");
  error.name = "AbortError";
  return error;
};

const createTimeoutError = () => {
  const error = new Error("The Bible service took too long to respond");
  error.name = "TimeoutError";
  return error;
};

const fetchJsonWithTimeout = async (
  url,
  { signal, timeout = REQUEST_TIMEOUT_MS } = {},
) => {
  if (signal?.aborted) throw createAbortError();

  const controller = new AbortController();
  let timedOut = false;
  let rejectCancellation;
  const cancellation = new Promise((_, reject) => {
    rejectCancellation = reject;
  });
  const cancel = (error) => {
    controller.abort();
    rejectCancellation(error);
  };
  const handleAbort = () => cancel(createAbortError());
  signal?.addEventListener("abort", handleAbort, { once: true });

  const timeoutId = setTimeout(() => {
    timedOut = true;
    cancel(createTimeoutError());
  }, timeout);

  try {
    const response = await Promise.race([
      fetch(url, { signal: controller.signal }),
      cancellation,
    ]);
    const data = response.ok
      ? await Promise.race([response.json(), cancellation])
      : null;
    return { response, data };
  } catch (error) {
    if (timedOut && error.name !== "TimeoutError") throw createTimeoutError();
    if (signal?.aborted) throw createAbortError();
    throw error;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleAbort);
  }
};

const invalidPayloadError = (kind) =>
  new Error(`Bible service returned invalid ${kind} data`);

const toPositiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

const getNonBlankText = (...values) =>
  values.find((value) => typeof value === "string" && value.trim().length > 0);

const normalizeVersePayload = (payload, translation, fallback = {}) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw invalidPayloadError("verse");
  }

  const book = getNonBlankText(payload.book, payload.book_name, fallback.book);
  const chapter = toPositiveInteger(payload.chapter ?? fallback.chapter);
  const verse = toPositiveInteger(
    payload.verse ?? payload.verse_number ?? fallback.verse,
  );
  const text = getNonBlankText(
    payload.content,
    payload.text,
    payload.verse_text,
  );

  if (!book || chapter === null || verse === null || !text) {
    throw invalidPayloadError("verse");
  }

  return {
    book,
    chapter,
    verse,
    text,
    translation: translation.toUpperCase(),
    reference:
      getNonBlankText(payload.reference) || `${book} ${chapter}:${verse}`,
  };
};

const normalizeVerseCollection = (data, translation) => {
  const payloads = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray(data.verses)
      ? data.verses
      : data && typeof data === "object"
        ? [data]
        : null;

  if (!payloads || payloads.length === 0) {
    throw invalidPayloadError("verse");
  }

  return payloads.map((payload) => normalizeVersePayload(payload, translation));
};

const validateHeadingsPayload = (data) => {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !Array.isArray(data.headings)
  ) {
    throw invalidPayloadError("headings");
  }

  data.headings.forEach((heading) => {
    if (
      !heading ||
      typeof heading !== "object" ||
      Array.isArray(heading) ||
      toPositiveInteger(heading.start) === null ||
      !getNonBlankText(heading.heading)
    ) {
      throw invalidPayloadError("headings");
    }
  });

  return data.headings;
};

// Helper function to parse verse references
const parseVerseReference = (reference) => {
  // Handle various formats like "John 3:16", "Genesis 1:1-3", "Psalms 23"
  const patterns = [
    // Book Chapter:Verse-Verse (e.g., "John 3:16-18")
    /^(.+?)\s+(\d+):(\d+)-(\d+)$/,
    // Book Chapter:Verse (e.g., "John 3:16")
    /^(.+?)\s+(\d+):(\d+)$/,
    // Book Chapter (e.g., "John 3")
    /^(.+?)\s+(\d+)$/,
  ];

  for (const pattern of patterns) {
    const match = reference.trim().match(pattern);
    if (match) {
      if (pattern.source.includes("-(\\d+)")) {
        // Range format
        return {
          book: match[1].trim(),
          chapter: parseInt(match[2]),
          startVerse: parseInt(match[3]),
          endVerse: parseInt(match[4]),
          isRange: true,
        };
      } else if (pattern.source.includes(":(\\d+)")) {
        // Single verse format
        return {
          book: match[1].trim(),
          chapter: parseInt(match[2]),
          verse: parseInt(match[3]),
          isRange: false,
        };
      } else {
        // Chapter only format
        return {
          book: match[1].trim(),
          chapter: parseInt(match[2]),
          isChapter: true,
        };
      }
    }
  }

  throw new Error(`Invalid verse reference format: ${reference}`);
};

// Format multiple verse references for API URL
const formatMultipleVersesForAPI = (references) => {
  // Convert references to the format expected by the API
  // Example: "Genesis 1:1-3:7,Matthew 1:1-25,Psalms 1:1-6,Proverbs 1:1-6"
  return references
    .map((ref) => {
      const parsed = parseVerseReference(ref);
      if (parsed.isChapter) {
        return `${parsed.book} ${parsed.chapter}`;
      } else if (parsed.isRange) {
        return `${parsed.book} ${parsed.chapter}:${parsed.startVerse}-${parsed.endVerse}`;
      } else {
        return `${parsed.book} ${parsed.chapter}:${parsed.verse}`;
      }
    })
    .join(",");
};

// Fetch single verse from api.blessings365.top
export const fetchSingleVerse = async (
  translation,
  book,
  chapter,
  verse,
  options = {},
) => {
  try {
    const url = `${API_BASE_URL}/${translation.toUpperCase()}/single?book=${encodeURIComponent(
      book,
    )}&chapter=${chapter}&verse=${verse}`;

    const { response, data } = await fetchJsonWithTimeout(url, options);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Verse not found: ${book} ${chapter}:${verse}`);
      }
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`,
      );
    }

    return normalizeVersePayload(data, translation, { book, chapter, verse });
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Error in fetchSingleVerse:", error);
    }
    throw error;
  }
};

// Fetch multiple verses from api.blessings365.top
export const fetchMultipleVerses = async (
  translation,
  versesQuery,
  options = {},
) => {
  try {
    // Parse the verses query into individual references
    let references;
    if (Array.isArray(versesQuery)) {
      references = versesQuery;
    } else if (typeof versesQuery === "string") {
      // Split by comma if it's a string with multiple references
      references = versesQuery.split(",").map((ref) => ref.trim());
    } else {
      references = [versesQuery];
    }

    const formattedRefs = formatMultipleVersesForAPI(references);
    const url = `${API_BASE_URL}/${translation.toUpperCase()}/multiple?verses=${encodeURIComponent(
      formattedRefs,
    )}`;

    const { response, data } = await fetchJsonWithTimeout(url, options);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Verses not found: ${versesQuery}`);
      }
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`,
      );
    }

    return normalizeVerseCollection(data, translation);
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Error in fetchMultipleVerses:", error);
    }
    throw error;
  }
};

// Fetch pericope headings from api.blessings365.top
export const fetchHeadings = async (
  translation,
  book,
  chapter,
  options = {},
) => {
  try {
    const url = `${API_BASE_URL}/${translation.toUpperCase()}/headings?book=${encodeURIComponent(
      book,
    )}&chapter=${chapter}`;

    const { response, data } = await fetchJsonWithTimeout(url, options);

    if (!response.ok) {
      if (response.status === 404) {
        return []; // Return empty array if no headings found
      }
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`,
      );
    }

    return validateHeadingsPayload(data);
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Error in fetchHeadings:", error);
    }
    throw error;
  }
};

// Main fetch function that determines whether to use single or multiple endpoint
export const fetchVerses = async (translation, reference, options = {}) => {
  try {
    // Check if it's multiple references (contains comma)
    if (reference.includes(",")) {
      return await fetchMultipleVerses(translation, reference, options);
    }

    const parsed = parseVerseReference(reference);

    if (parsed.isChapter) {
      // For chapter requests, fetch the whole chapter using multiple verses endpoint
      const chapterRef = `${parsed.book} ${parsed.chapter}`;
      return await fetchMultipleVerses(translation, chapterRef, options);
    } else if (parsed.isRange) {
      // For ranges, use multiple verses endpoint
      const rangeRef = `${parsed.book} ${parsed.chapter}:${parsed.startVerse}-${parsed.endVerse}`;
      return await fetchMultipleVerses(translation, rangeRef, options);
    } else {
      // Single verse
      const verse = await fetchSingleVerse(
        translation,
        parsed.book,
        parsed.chapter,
        parsed.verse,
        options,
      );
      return [verse]; // Return as array for consistency
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Error in fetchVerses:", error);
    }
    throw error;
  }
};

// Cached chapter fetch — returns previously-fetched verses instantly on hit,
// otherwise falls back to the network and populates the cache.
export const fetchChapterCached = async (
  translation,
  book,
  chapter,
  options = {},
) => {
  if (options.signal?.aborted) throw createAbortError();
  const cached = getCachedChapter(translation, book, chapter);
  if (cached !== null) return { data: cached, fromCache: true };

  const data = await fetchMultipleVerses(
    translation,
    `${book} ${chapter}`,
    options,
  );
  if (options.signal?.aborted) throw createAbortError();
  setCachedChapter(translation, book, chapter, data);
  return { data, fromCache: false };
};

// Cached pericope headings fetch.
export const fetchHeadingsCached = async (
  translation,
  book,
  chapter,
  options = {},
) => {
  if (options.signal?.aborted) throw createAbortError();
  const cached = getCachedHeadings(translation, book, chapter);
  if (cached !== null) return { data: cached, fromCache: true };

  const data = await fetchHeadings(translation, book, chapter, options);
  if (options.signal?.aborted) throw createAbortError();
  setCachedHeadings(translation, book, chapter, data);
  return { data, fromCache: false };
};

export { hasCachedChapter };

export default {
  fetchSingleVerse,
  fetchMultipleVerses,
  fetchHeadings,
  fetchVerses,
  fetchChapterCached,
  fetchHeadingsCached,
  hasCachedChapter,
};
