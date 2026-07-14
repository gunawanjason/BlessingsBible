import { getBookName, getEnglishBookName } from "./translationMappings.js";

const MAX_SUGGESTIONS = 10;

export const normalizeSearchCharacters = (input) =>
  String(input ?? "").normalize("NFKC");

const normalizeForComparison = (value) =>
  normalizeSearchCharacters(value).trim().toLocaleLowerCase();

const getBookMatchRank = (book, translatedName, normalizedTerm) => {
  const englishName = normalizeForComparison(book.name);
  const localizedName = normalizeForComparison(translatedName);
  const abbreviations = book.abbreviations.map(normalizeForComparison);

  if (englishName === normalizedTerm || localizedName === normalizedTerm) {
    return 0;
  }
  if (abbreviations.includes(normalizedTerm)) return 1;
  if (
    englishName.startsWith(normalizedTerm) ||
    localizedName.startsWith(normalizedTerm)
  ) {
    return 2;
  }
  if (
    abbreviations.some((abbreviation) =>
      abbreviation.startsWith(normalizedTerm),
    )
  ) {
    return 3;
  }
  if (
    englishName.includes(normalizedTerm) ||
    localizedName.includes(normalizedTerm)
  ) {
    return 4;
  }
  if (
    abbreviations.some((abbreviation) => abbreviation.includes(normalizedTerm))
  ) {
    return 5;
  }

  return null;
};

export const parseSearchInput = (input) => {
  const value = normalizeSearchCharacters(input).trimStart();
  const trimmedValue = value.trimEnd();

  if (!trimmedValue) return null;

  const hasTrailingSpace = /\s$/.test(value);
  const colonIndex = trimmedValue.lastIndexOf(":");
  const referenceBase =
    colonIndex >= 0
      ? trimmedValue.slice(0, colonIndex).trimEnd()
      : trimmedValue;
  const versePart =
    colonIndex >= 0 ? trimmedValue.slice(colonIndex + 1).trim() : null;
  const chapterMatch = referenceBase.match(/^(.+\S)\s+(\d+)$/u);

  return {
    bookPart: chapterMatch ? chapterMatch[1].trim() : referenceBase,
    chapterPart: chapterMatch ? chapterMatch[2] : null,
    versePart,
    hasChapter: Boolean(chapterMatch),
    hasVerseSeparator: colonIndex >= 0,
    hasTrailingSpace,
  };
};

export const findBibleBook = (
  searchTerm,
  bibleStructure,
  selectedTranslation,
) => {
  if (!searchTerm || !bibleStructure) return null;

  const normalizedTerm = normalizeForComparison(searchTerm);
  return (
    bibleStructure.books.find((book) => {
      const searchableNames = [
        book.name,
        getBookName(book.name, selectedTranslation),
        ...book.abbreviations,
      ];
      return searchableNames.some(
        (name) => normalizeForComparison(name) === normalizedTerm,
      );
    }) || null
  );
};

const getNumericSuggestions = (maximum, prefix, formatSuggestion) => {
  const suggestions = [];

  for (let number = 1; number <= maximum; number += 1) {
    if (prefix && !String(number).startsWith(prefix)) continue;

    suggestions.push(formatSuggestion(number));
    if (suggestions.length >= MAX_SUGGESTIONS) break;
  }

  return suggestions;
};

const getChapterSuggestions = (book, translatedBookName, prefix = "") =>
  getNumericSuggestions(
    book.chapters,
    prefix,
    (chapter) => `${translatedBookName} ${chapter}`,
  );

export const generateSearchSuggestions = (
  input,
  bibleStructure,
  selectedTranslation,
) => {
  const parsedInput = parseSearchInput(input);
  if (!parsedInput || !bibleStructure) return [];

  const {
    bookPart,
    chapterPart,
    versePart,
    hasChapter,
    hasVerseSeparator,
    hasTrailingSpace,
  } = parsedInput;
  const book = findBibleBook(bookPart, bibleStructure, selectedTranslation);

  if (hasVerseSeparator) {
    if (!book || !hasChapter || !/^\d*$/u.test(versePart)) return [];

    const chapterNumber = Number(chapterPart);
    if (chapterNumber < 1 || chapterNumber > book.chapters) return [];

    const translatedBookName = getBookName(book.name, selectedTranslation);
    const maxVerses = book.verses[chapterNumber - 1];

    return getNumericSuggestions(
      maxVerses,
      versePart,
      (verse) => `${translatedBookName} ${chapterNumber}:${verse}`,
    );
  }

  if (hasChapter) {
    if (!book) return [];

    const translatedBookName = getBookName(book.name, selectedTranslation);
    return getChapterSuggestions(book, translatedBookName, chapterPart);
  }

  if (hasTrailingSpace && book) {
    return getChapterSuggestions(
      book,
      getBookName(book.name, selectedTranslation),
    );
  }

  const normalizedBookPart = normalizeForComparison(bookPart);
  return bibleStructure.books
    .map((candidate, index) => {
      const translatedName = getBookName(candidate.name, selectedTranslation);
      return {
        index,
        rank: getBookMatchRank(candidate, translatedName, normalizedBookPart),
        translatedName,
      };
    })
    .filter(({ rank }) => rank !== null)
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ translatedName }) => translatedName);
};

export const determineSearchStage = (
  input,
  bibleStructure,
  selectedTranslation,
) => {
  const parsedInput = parseSearchInput(input);
  if (!parsedInput) return "book";

  const book = findBibleBook(
    parsedInput.bookPart,
    bibleStructure,
    selectedTranslation,
  );
  if (!book) return "book";
  if (parsedInput.hasVerseSeparator) return "verse";
  if (parsedInput.hasChapter) return "chapter";
  return "book";
};

export const completeSearchSuggestion = (
  suggestion,
  bibleStructure,
  selectedTranslation,
) => {
  const stage = determineSearchStage(
    suggestion,
    bibleStructure,
    selectedTranslation,
  );

  if (stage === "book") return `${suggestion} `;
  if (stage === "chapter") return `${suggestion}:`;
  return suggestion;
};

export const isCompleteSearchReference = (
  input,
  bibleStructure,
  selectedTranslation,
) => {
  const parsedInput = parseSearchInput(input);
  if (!parsedInput?.hasChapter) return false;

  const book = findBibleBook(
    parsedInput.bookPart,
    bibleStructure,
    selectedTranslation,
  );
  if (!book) return false;

  const chapterNumber = Number(parsedInput.chapterPart);
  if (chapterNumber < 1 || chapterNumber > book.chapters) return false;
  if (!parsedInput.hasVerseSeparator) return true;

  const verseMatch = parsedInput.versePart.match(/^(\d+)(?:-(\d+))?$/u);
  if (!verseMatch) return false;

  const startVerse = Number(verseMatch[1]);
  const endVerse = Number(verseMatch[2] ?? verseMatch[1]);
  const maximumVerse = book.verses[chapterNumber - 1];

  return startVerse >= 1 && endVerse >= startVerse && endVerse <= maximumVerse;
};

export const normalizeSearchQuery = (
  query,
  selectedTranslation,
  bibleStructure,
) => {
  const trimmedQuery = normalizeSearchCharacters(query)
    .trim()
    .replace(/\s*:\s*/gu, ":")
    .replace(/\s*-\s*/gu, "-")
    .replace(/\s+/gu, " ");
  const referenceMatch = trimmedQuery.match(
    /^(.+?)(\s+\d+(?::\d+(?:-\d+)?)?)$/u,
  );

  if (!referenceMatch) {
    return (
      findBibleBook(trimmedQuery, bibleStructure, selectedTranslation)?.name ||
      getEnglishBookName(trimmedQuery, selectedTranslation)
    );
  }

  const [, bookPart, referencePart] = referenceMatch;
  const canonicalBookName =
    findBibleBook(bookPart, bibleStructure, selectedTranslation)?.name ||
    getEnglishBookName(bookPart.trim(), selectedTranslation);

  return canonicalBookName + referencePart;
};

export const localizeSearchQuery = (
  query,
  bibleStructure,
  fromTranslation,
  toTranslation,
) => {
  const normalizedQuery = normalizeSearchCharacters(query);
  const parsedInput = parseSearchInput(normalizedQuery);
  if (!parsedInput) return normalizedQuery;

  const book = findBibleBook(
    parsedInput.bookPart,
    bibleStructure,
    fromTranslation,
  );
  if (!book) return normalizedQuery;

  let localizedQuery = getBookName(book.name, toTranslation);
  if (parsedInput.hasChapter) {
    localizedQuery += ` ${parsedInput.chapterPart}`;
  }
  if (parsedInput.hasVerseSeparator) {
    localizedQuery += `:${parsedInput.versePart}`;
  }
  if (parsedInput.hasTrailingSpace) {
    localizedQuery += " ";
  }

  return localizedQuery;
};
