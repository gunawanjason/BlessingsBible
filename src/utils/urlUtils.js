// Utility functions for URL handling and verse serialization

export const MAX_VERSE_NUMBER = 200;
export const MAX_SELECTED_VERSES = 200;

const toValidVerseNumber = (value, maxVerse = MAX_VERSE_NUMBER) => {
  const verse = Number(value);
  return Number.isInteger(verse) && verse >= 1 && verse <= maxVerse
    ? verse
    : null;
};

/**
 * Serialize verse selections into URL-friendly format
 * @param {Set} selectedVerses - Set of verse numbers
 * @returns {string} - Serialized verse string (e.g., "1,3,5-7")
 */
export const serializeVerses = (selectedVerses) => {
  if (!selectedVerses || selectedVerses.size === 0) return "";

  const sortedVerses = Array.from(selectedVerses)
    .map((verse) => toValidVerseNumber(verse))
    .filter((verse) => verse !== null)
    .slice(0, MAX_SELECTED_VERSES)
    .sort((a, b) => a - b);
  if (sortedVerses.length === 0) return "";
  const ranges = [];
  let start = sortedVerses[0];
  let end = sortedVerses[0];

  for (let i = 1; i < sortedVerses.length; i++) {
    if (sortedVerses[i] === end + 1) {
      end = sortedVerses[i];
    } else {
      ranges.push(start === end ? start.toString() : `${start}-${end}`);
      start = sortedVerses[i];
      end = sortedVerses[i];
    }
  }

  ranges.push(start === end ? start.toString() : `${start}-${end}`);
  return ranges.join(",");
};

/**
 * Parse verse string into Set of verse numbers
 * @param {string} verseString - Serialized verse string (e.g., "1,3,5-7")
 * @returns {Set} - Set of verse numbers
 */
export const parseVerses = (
  verseString,
  maxVerse = MAX_VERSE_NUMBER,
  maxSelections = MAX_SELECTED_VERSES,
) => {
  if (!verseString) return new Set();

  const verses = new Set();
  const parts = verseString.split(",").slice(0, maxSelections);

  for (const part of parts) {
    if (part.includes("-")) {
      const rangeParts = part.split("-");
      if (rangeParts.length !== 2) continue;

      const start = toValidVerseNumber(rangeParts[0].trim(), maxVerse);
      const end = toValidVerseNumber(rangeParts[1].trim(), maxVerse);
      if (start !== null && end !== null && start <= end) {
        for (let i = start; i <= end && verses.size < maxSelections; i++) {
          verses.add(i);
        }
      }
    } else {
      const verse = toValidVerseNumber(part.trim(), maxVerse);
      if (verse !== null && verses.size < maxSelections) {
        verses.add(verse);
      }
    }

    if (verses.size >= maxSelections) break;
  }

  return verses;
};

/**
 * Generate shareable URL for selected verses
 * @param {string} book - Book name
 * @param {number} chapter - Chapter number
 * @param {string} translation - Translation code
 * @param {Set} selectedVerses - Selected verse numbers
 * @returns {string} - Complete shareable URL
 */
export const generateShareUrl = (
  book,
  chapter,
  translation,
  selectedVerses,
) => {
  const baseUrl = window.location.origin + window.location.pathname;
  const verses = serializeVerses(selectedVerses);

  const params = new URLSearchParams();
  params.set("book", book);
  params.set("chapter", chapter.toString());
  params.set("translation", translation);
  if (verses) params.set("verses", verses);

  return `${baseUrl}?${params.toString()}`;
};

/**
 * Parse URL parameters for shared verses
 * @returns {Object} - Parsed parameters {book, chapter, translation, verses}
 */
export const parseUrlParams = (search = window.location.search) => {
  const params = new URLSearchParams(search);

  return {
    book: params.get("book"),
    chapter: params.get("chapter") ? Number(params.get("chapter")) : null,
    translation: params.get("translation"),
    verses: parseVerses(params.get("verses")),
  };
};

/**
 * Validate URL reading state against the loaded Bible metadata.
 * Invalid links return null so callers can safely fall back to a known chapter.
 */
export const validateUrlParams = (
  urlParams,
  bibleStructure,
  allowedTranslations = [],
) => {
  if (!urlParams || !bibleStructure?.books) return null;

  const book = bibleStructure.books.find(
    (candidate) => candidate.name === urlParams.book,
  );
  const chapter = Number(urlParams.chapter);
  const translation = urlParams.translation?.toUpperCase();

  if (
    !book ||
    !Number.isInteger(chapter) ||
    chapter < 1 ||
    chapter > book.chapters ||
    !allowedTranslations.includes(translation)
  ) {
    return null;
  }

  const maxVerse = book.verses?.[chapter - 1] || MAX_VERSE_NUMBER;
  return {
    book: book.name,
    chapter,
    translation,
    verses: new Set(
      Array.from(urlParams.verses || [])
        .filter((verse) => toValidVerseNumber(verse, maxVerse) !== null)
        .slice(0, MAX_SELECTED_VERSES),
    ),
  };
};

/**
 * Update URL without page reload
 * @param {string} book - Book name
 * @param {number} chapter - Chapter number
 * @param {string} translation - Translation code
 * @param {Set} selectedVerses - Selected verse numbers
 */
export const updateUrl = (book, chapter, translation, selectedVerses) => {
  const url = generateShareUrl(book, chapter, translation, selectedVerses);
  window.history.replaceState({}, "", url);
};
