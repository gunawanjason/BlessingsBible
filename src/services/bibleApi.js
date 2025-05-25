const API_BASE_URL = "https://api.blessings365.top";

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
export const fetchSingleVerse = async (translation, book, chapter, verse) => {
  try {
    const url = `${API_BASE_URL}/${translation.toUpperCase()}/single?book=${encodeURIComponent(
      book
    )}&chapter=${chapter}&verse=${verse}`;

    console.log("Fetching single verse from:", url);

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Verse not found: ${book} ${chapter}:${verse}`);
      }
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    // Return normalized format
    return {
      book: book,
      chapter: chapter,
      verse: verse,
      text: data.content || data.text || data.verse_text || "",
      translation: translation.toUpperCase(),
      reference: `${book} ${chapter}:${verse}`,
    };
  } catch (error) {
    console.error("Error in fetchSingleVerse:", error);
    throw error;
  }
};

// Fetch multiple verses from api.blessings365.top
export const fetchMultipleVerses = async (translation, versesQuery) => {
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
      formattedRefs
    )}`;

    console.log("Fetching multiple verses from:", url);

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Verses not found: ${versesQuery}`);
      }
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    // Normalize the response format
    if (Array.isArray(data)) {
      return data.map((verse) => ({
        book: verse.book || verse.book_name || "",
        chapter: verse.chapter || "",
        verse: verse.verse || verse.verse_number || "",
        text: verse.content || verse.text || verse.verse_text || "",
        translation: translation.toUpperCase(),
        reference:
          verse.reference ||
          `${verse.book || ""} ${verse.chapter || ""}:${verse.verse || ""}`,
      }));
    } else if (data.verses && Array.isArray(data.verses)) {
      return data.verses.map((verse) => ({
        book: verse.book || verse.book_name || "",
        chapter: verse.chapter || "",
        verse: verse.verse || verse.verse_number || "",
        text: verse.content || verse.text || verse.verse_text || "",
        translation: translation.toUpperCase(),
        reference:
          verse.reference ||
          `${verse.book || ""} ${verse.chapter || ""}:${verse.verse || ""}`,
      }));
    } else {
      // Single verse response
      return [
        {
          book: data.book || data.book_name || "",
          chapter: data.chapter || "",
          verse: data.verse || data.verse_number || "",
          text: data.content || data.text || data.verse_text || "",
          translation: translation.toUpperCase(),
          reference:
            data.reference ||
            `${data.book || ""} ${data.chapter || ""}:${data.verse || ""}`,
        },
      ];
    }
  } catch (error) {
    console.error("Error in fetchMultipleVerses:", error);
    throw error;
  }
};

// Main fetch function that determines whether to use single or multiple endpoint
export const fetchVerses = async (translation, reference) => {
  try {
    // Check if it's multiple references (contains comma)
    if (reference.includes(",")) {
      return await fetchMultipleVerses(translation, reference);
    }

    const parsed = parseVerseReference(reference);

    if (parsed.isChapter) {
      // For chapter requests, fetch the whole chapter using multiple verses endpoint
      const chapterRef = `${parsed.book} ${parsed.chapter}`;
      return await fetchMultipleVerses(translation, chapterRef);
    } else if (parsed.isRange) {
      // For ranges, use multiple verses endpoint
      const rangeRef = `${parsed.book} ${parsed.chapter}:${parsed.startVerse}-${parsed.endVerse}`;
      return await fetchMultipleVerses(translation, rangeRef);
    } else {
      // Single verse
      const verse = await fetchSingleVerse(
        translation,
        parsed.book,
        parsed.chapter,
        parsed.verse
      );
      return [verse]; // Return as array for consistency
    }
  } catch (error) {
    console.error("Error in fetchVerses:", error);
    throw error;
  }
};

export default {
  fetchSingleVerse,
  fetchMultipleVerses,
  fetchVerses,
};
