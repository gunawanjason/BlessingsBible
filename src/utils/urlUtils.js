// Utility functions for URL handling and verse serialization

/**
 * Serialize verse selections into URL-friendly format
 * @param {Set} selectedVerses - Set of verse numbers
 * @returns {string} - Serialized verse string (e.g., "1,3,5-7")
 */
export const serializeVerses = (selectedVerses) => {
  if (!selectedVerses || selectedVerses.size === 0) return "";

  const sortedVerses = Array.from(selectedVerses).sort((a, b) => a - b);
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
export const parseVerses = (verseString) => {
  if (!verseString) return new Set();

  const verses = new Set();
  const parts = verseString.split(",");

  for (const part of parts) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map((num) => parseInt(num.trim()));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          verses.add(i);
        }
      }
    } else {
      const verse = parseInt(part.trim());
      if (!isNaN(verse)) {
        verses.add(verse);
      }
    }
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
  selectedVerses
) => {
  const baseUrl = window.location.origin + window.location.pathname;
  const verses = serializeVerses(selectedVerses);

  if (!verses) return baseUrl;

  const params = new URLSearchParams();
  params.set("book", book);
  params.set("chapter", chapter.toString());
  params.set("translation", translation);
  params.set("verses", verses);

  return `${baseUrl}?${params.toString()}`;
};

/**
 * Parse URL parameters for shared verses
 * @returns {Object} - Parsed parameters {book, chapter, translation, verses}
 */
export const parseUrlParams = () => {
  const params = new URLSearchParams(window.location.search);

  return {
    book: params.get("book"),
    chapter: params.get("chapter") ? parseInt(params.get("chapter")) : null,
    translation: params.get("translation"),
    verses: parseVerses(params.get("verses")),
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
