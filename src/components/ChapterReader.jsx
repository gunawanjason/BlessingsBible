import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { fetchMultipleVerses } from "../services/bibleApi";
import "./ChapterReader.css";

const ChapterReader = ({
  selectedBook,
  selectedChapter,
  bibleStructure,
  highlightedVerse,
  selectedTranslation,
  selectedVerses,
  setSelectedVerses,
}) => {
  const [chapterVerses, setChapterVerses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copyState, setCopyState] = useState("idle"); // 'idle', 'copying', 'copied'
  const versesContainerRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Memoize current book calculation
  const currentBook = useMemo(
    () => bibleStructure?.books.find((book) => book.name === selectedBook),
    [bibleStructure, selectedBook]
  );

  const totalChapters = currentBook?.chapters || 0;

  // Optimized fetch function with abort controller
  const fetchChapterVerses = useCallback(async () => {
    if (!selectedBook || !selectedChapter || !currentBook) return;

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      // Use our new API service to fetch the entire chapter
      const chapterReference = `${selectedBook} ${selectedChapter}`;

      const verses = await fetchMultipleVerses(
        selectedTranslation,
        chapterReference
      );

      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      // Transform the verses to match the expected format
      const transformedVerses = verses.map((verse) => ({
        verse: verse.verse,
        text: verse.text,
      }));

      setChapterVerses(transformedVerses);
    } catch (err) {
      if (
        err.name !== "AbortError" &&
        !abortControllerRef.current?.signal.aborted
      ) {
        setError(err.message);
        setChapterVerses([]);
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, [selectedBook, selectedChapter, currentBook, selectedTranslation]);

  // Fetch chapter verses with cleanup
  useEffect(() => {
    fetchChapterVerses();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchChapterVerses]);

  // Optimized auto-scroll with intersection observer
  useEffect(() => {
    if (!highlightedVerse || chapterVerses.length === 0) return;

    // Use requestAnimationFrame for smooth scrolling
    const scrollToVerse = () => {
      const verseElement = document.getElementById(
        `verse-${highlightedVerse.verse}`
      );
      if (verseElement) {
        verseElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
      }
    };

    // Delay slightly to ensure DOM is ready
    const timer = setTimeout(() => {
      requestAnimationFrame(scrollToVerse);
    }, 100);

    return () => clearTimeout(timer);
  }, [highlightedVerse, chapterVerses]);

  // Handle verse selection
  const handleVerseClick = useCallback((verseNumber) => {
    setSelectedVerses((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(verseNumber)) {
        newSelected.delete(verseNumber);
      } else {
        newSelected.add(verseNumber);
      }
      return newSelected;
    });
  }, []);

  // Clear selections when chapter changes
  useEffect(() => {
    setSelectedVerses(new Set());
  }, [selectedBook, selectedChapter, setSelectedVerses]);

  // Copy selected verses with new format
  const copySelectedVerses = useCallback(async () => {
    if (selectedVerses.size === 0) return;

    setCopyState("copying");

    const sortedVerseNumbers = Array.from(selectedVerses).sort((a, b) => a - b);

    // Determine verse range
    let verseRange;
    if (sortedVerseNumbers.length === 1) {
      verseRange = sortedVerseNumbers[0].toString();
    } else {
      const start = sortedVerseNumbers[0];
      const end = sortedVerseNumbers[sortedVerseNumbers.length - 1];
      verseRange = `${start}-${end}`;
    }

    // Get translation name
    const translationName = selectedTranslation?.toUpperCase() || "KJV";

    // Create header: [Book] [Chapter] [Verse Range] [Translation]
    const header = `${selectedBook} ${selectedChapter}:${verseRange} ${translationName}`;

    // Get verse content
    const verseTexts = sortedVerseNumbers.map((verseNumber) => {
      const verse = chapterVerses.find(
        (v) => (v.verse || chapterVerses.indexOf(v) + 1) === verseNumber
      );
      return verse?.text || "";
    });

    const content = verseTexts.join(" ");
    const textToCopy = `${header}\n${content}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
      setCopyState("idle");
    }
  }, [
    selectedVerses,
    chapterVerses,
    selectedBook,
    selectedChapter,
    selectedTranslation,
  ]);

  // Memoized verse components for better performance
  const verseComponents = useMemo(() => {
    return chapterVerses.map((verse, index) => {
      const verseNumber = verse.verse || index + 1;
      const isHighlighted =
        highlightedVerse &&
        verseNumber >= highlightedVerse.verse &&
        verseNumber < highlightedVerse.verse + (highlightedVerse.count || 1);
      const isSelected = selectedVerses.has(verseNumber);

      return (
        <div
          key={`${selectedBook}-${selectedChapter}-${verseNumber}`}
          className={`verse-item ${isHighlighted ? "highlighted" : ""} ${
            isSelected ? "selected" : ""
          }`}
          id={`verse-${verseNumber}`}
          onClick={() => handleVerseClick(verseNumber)}
        >
          <span className="verse-number">{verseNumber}</span>
          <span className="verse-text">{verse.text}</span>
        </div>
      );
    });
  }, [
    chapterVerses,
    highlightedVerse,
    selectedVerses,
    selectedBook,
    selectedChapter,
    handleVerseClick,
  ]);

  if (!selectedBook || !selectedChapter) {
    return (
      <div className="chapter-reader">
        <div className="chapter-placeholder">
          <p>Select a book and chapter to start reading</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chapter-reader">
      {/* Copy button moved to nav bar */}

      <main className="chapter-content">
        {loading && <div className="status-message">Loading chapter...</div>}

        {error && (
          <div className="status-message error">
            Error loading chapter: {error}
          </div>
        )}

        {!loading && !error && chapterVerses.length > 0 && (
          <div className="verses-container" ref={versesContainerRef}>
            {verseComponents}
          </div>
        )}

        {!loading && !error && chapterVerses.length === 0 && (
          <div className="status-message">
            No verses found for this chapter.
          </div>
        )}
      </main>
    </div>
  );
};

export default React.memo(ChapterReader);
