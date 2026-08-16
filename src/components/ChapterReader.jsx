import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  fetchChapterCached,
  fetchHeadingsCached,
  hasCachedChapter,
} from "../services/bibleApi";
import { getTranslationLanguage } from "../utils/translationMappings";
import ScrollToTop from "./ScrollToTop";
import "./ChapterReader.css";

const ChapterReader = ({
  selectedBook,
  selectedChapter,
  bibleStructure,
  highlightedVerse,
  selectedTranslation,
  selectedVerses,
  setSelectedVerses,
  chapterVersesRef,
}) => {
  const [chapterVerses, setChapterVerses] = useState([]);
  const [headings, setHeadings] = useState([]);
  // Initialize loading=true so the "No verses found" fallback never flashes
  // during the 150ms before the skeleton-show timer fires on initial mount.
  const [loading, setLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [error, setError] = useState(null);
  const [activeVerseNumber, setActiveVerseNumber] = useState(null);
  const versesContainerRef = useRef(null);
  const verseRefs = useRef({});
  const abortControllerRef = useRef(null);
  const fetchIdRef = useRef(0);
  const skeletonDelayRef = useRef(null);

  // Memoize current book calculation
  const currentBook = useMemo(
    () => bibleStructure?.books.find((book) => book.name === selectedBook),
    [bibleStructure, selectedBook],
  );

  const hasValidSelection =
    currentBook &&
    Number.isInteger(Number(selectedChapter)) &&
    Number(selectedChapter) >= 1 &&
    Number(selectedChapter) <= currentBook.chapters;

  // Delay the skeleton to avoid flashing it for cache hits and fast requests.
  const SKELETON_SHOW_DELAY = 150;

  // Optimized fetch function with abort controller
  const fetchChapterVerses = useCallback(async () => {
    if (!bibleStructure) return;
    if (!selectedBook || !selectedChapter || !hasValidSelection) {
      setChapterVerses([]);
      setHeadings([]);
      setShowSkeleton(false);
      setLoading(false);
      setError("The selected book or chapter is not available.");
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (skeletonDelayRef.current) {
      clearTimeout(skeletonDelayRef.current);
      skeletonDelayRef.current = null;
    }

    // Create new abort controller and fetch id
    abortControllerRef.current = new AbortController();
    const fetchId = ++fetchIdRef.current;

    setLoading(true);
    setError(null);

    const cacheHit = hasCachedChapter(
      selectedTranslation,
      selectedBook,
      selectedChapter,
    );

    if (cacheHit) {
      setShowSkeleton(false);
    } else {
      setChapterVerses([]);
      setHeadings([]);
      skeletonDelayRef.current = setTimeout(() => {
        if (fetchIdRef.current === fetchId) {
          setShowSkeleton(true);
        }
      }, SKELETON_SHOW_DELAY);
    }

    try {
      const requestOptions = {
        signal: abortControllerRef.current.signal,
      };
      const headingsPromise = fetchHeadingsCached(
        selectedTranslation,
        selectedBook,
        selectedChapter,
        requestOptions,
      ).catch(() => ({ data: [], fromCache: false }));
      const versesRes = await fetchChapterCached(
        selectedTranslation,
        selectedBook,
        selectedChapter,
        requestOptions,
      );
      const verses = versesRes.data;

      if (
        abortControllerRef.current?.signal.aborted ||
        fetchIdRef.current !== fetchId
      ) {
        return;
      }

      const transformedVerses = verses.map((verse) => ({
        verse: verse.verse,
        text: verse.text,
      }));

      if (skeletonDelayRef.current) {
        clearTimeout(skeletonDelayRef.current);
        skeletonDelayRef.current = null;
      }
      setChapterVerses(transformedVerses);
      setShowSkeleton(false);

      // Headings are optional metadata and should not delay cached verse text.
      const headingsRes = await headingsPromise;
      if (
        !abortControllerRef.current?.signal.aborted &&
        fetchIdRef.current === fetchId
      ) {
        setHeadings(headingsRes.data);
      }
    } catch (err) {
      if (
        err.name !== "AbortError" &&
        !abortControllerRef.current?.signal.aborted &&
        fetchIdRef.current === fetchId
      ) {
        setError(err.message);
        setChapterVerses([]);
        if (skeletonDelayRef.current) {
          clearTimeout(skeletonDelayRef.current);
          skeletonDelayRef.current = null;
        }
        setShowSkeleton(false);
      }
    } finally {
      if (
        !abortControllerRef.current?.signal.aborted &&
        fetchIdRef.current === fetchId
      ) {
        setLoading(false);
      }
    }
  }, [
    bibleStructure,
    selectedBook,
    selectedChapter,
    hasValidSelection,
    selectedTranslation,
  ]);

  // Fetch chapter verses with cleanup
  useEffect(() => {
    fetchChapterVerses();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (skeletonDelayRef.current) {
        clearTimeout(skeletonDelayRef.current);
        skeletonDelayRef.current = null;
      }
    };
  }, [fetchChapterVerses]);

  // Expose chapter verses via ref for App.jsx copy function
  useEffect(() => {
    if (chapterVersesRef) {
      chapterVersesRef.current = chapterVerses;
    }
  }, [chapterVerses, chapterVersesRef]);

  useEffect(() => {
    setActiveVerseNumber(null);
  }, [selectedBook, selectedChapter]);

  useEffect(() => {
    const verseNumbers = chapterVerses.map(
      (verse, index) => verse.verse || index + 1,
    );
    if (verseNumbers.length === 0) {
      setActiveVerseNumber(null);
      return;
    }

    const highlightedNumber = Number(highlightedVerse?.verse);
    setActiveVerseNumber((current) => {
      if (
        Number.isInteger(highlightedNumber) &&
        verseNumbers.includes(highlightedNumber)
      ) {
        return highlightedNumber;
      }
      return verseNumbers.includes(current) ? current : verseNumbers[0];
    });
  }, [chapterVerses, highlightedVerse]);

  // Optimized auto-scroll with intersection observer
  useEffect(() => {
    if (!highlightedVerse || chapterVerses.length === 0) return;

    // Use requestAnimationFrame for smooth scrolling
    const scrollToVerse = () => {
      const verseElement = document.getElementById(
        `verse-${highlightedVerse.verse}`,
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
  const handleVerseClick = useCallback(
    (verseNumber) => {
      setActiveVerseNumber(verseNumber);
      setSelectedVerses((prev) => {
        const newSelected = new Set(prev);
        if (newSelected.has(verseNumber)) {
          newSelected.delete(verseNumber);
        } else {
          newSelected.add(verseNumber);
        }
        return newSelected;
      });
    },
    [setSelectedVerses],
  );

  const focusVerseAtIndex = useCallback(
    (index) => {
      const targetVerse = chapterVerses[index];
      if (!targetVerse) return;

      const verseNumber = targetVerse.verse || index + 1;
      setActiveVerseNumber(verseNumber);
      requestAnimationFrame(() => verseRefs.current[verseNumber]?.focus());
    },
    [chapterVerses],
  );

  const handleVerseKeyDown = useCallback(
    (event, verseNumber, index) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleVerseClick(verseNumber);
        return;
      }

      let nextIndex;
      if (event.key === "ArrowDown") {
        nextIndex = Math.min(index + 1, chapterVerses.length - 1);
      } else if (event.key === "ArrowUp") {
        nextIndex = Math.max(index - 1, 0);
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = chapterVerses.length - 1;
      } else {
        return;
      }

      event.preventDefault();
      focusVerseAtIndex(nextIndex);
    },
    [chapterVerses.length, focusVerseAtIndex, handleVerseClick],
  );

  // Memoized verse components for better performance
  const verseComponents = useMemo(() => {
    return chapterVerses.map((verse, index) => {
      const verseNumber = verse.verse || index + 1;
      const isHighlighted =
        highlightedVerse &&
        verseNumber >= highlightedVerse.verse &&
        verseNumber < highlightedVerse.verse + (highlightedVerse.count || 1);
      const isSelected = selectedVerses.has(verseNumber);

      const currentHeadings = headings.filter(
        (h) => parseInt(h.start) === parseInt(verseNumber),
      );

      return (
        <React.Fragment
          key={`${selectedBook}-${selectedChapter}-${verseNumber}-wrapper`}
        >
          {currentHeadings.map((h, i) => (
            <h2
              key={`heading-${verseNumber}-${i}`}
              className="pericope-heading"
            >
              {h.heading}
            </h2>
          ))}
          <div
            ref={(element) => {
              if (element) {
                verseRefs.current[verseNumber] = element;
              } else {
                delete verseRefs.current[verseNumber];
              }
            }}
            className={`verse-item ${isHighlighted ? "highlighted" : ""} ${
              isSelected ? "selected" : ""
            }`}
            id={`verse-${verseNumber}`}
            onClick={() => handleVerseClick(verseNumber)}
            onKeyDown={(event) => handleVerseKeyDown(event, verseNumber, index)}
            onFocus={() => setActiveVerseNumber(verseNumber)}
            role="button"
            tabIndex={activeVerseNumber === verseNumber ? 0 : -1}
            aria-pressed={isSelected}
          >
            <span className="verse-number">{verseNumber}</span>
            <span className="verse-text">{verse.text}</span>
          </div>
        </React.Fragment>
      );
    });
  }, [
    chapterVerses,
    highlightedVerse,
    selectedVerses,
    selectedBook,
    selectedChapter,
    handleVerseClick,
    handleVerseKeyDown,
    headings,
    activeVerseNumber,
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
      <section className="chapter-content" aria-label="Bible chapter">
        {showSkeleton && !error && (
          <div
            className="verses-container"
            aria-busy="true"
            aria-label="Loading verses"
          >
            {[
              { heading: true },
              { width: 95 },
              { width: 88 },
              { width: 100 },
              { width: 92 },
              { width: 78 },
              { width: 100 },
              { width: 85 },
              { heading: true },
              { width: 100 },
              { width: 90 },
              { width: 95 },
              { width: 82 },
              { width: 100 },
              { width: 88 },
              { width: 76 },
              { width: 100 },
              { width: 93 },
            ].map((item, index) => {
              if (item.heading) {
                return (
                  <div
                    key={`skeleton-heading-${index}`}
                    className="skeleton-heading"
                  />
                );
              }
              return (
                <div key={`skeleton-${index}`} className="skeleton-verse">
                  <div className="skeleton-number"></div>
                  <div
                    className="skeleton-text"
                    style={{ width: `${item.width}%` }}
                  ></div>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div className="status-message error" role="alert">
            {error === "The selected book or chapter is not available."
              ? error
              : "Unable to load this chapter. Please check your connection and try again."}
          </div>
        )}

        {!showSkeleton && !error && chapterVerses.length > 0 && (
          <div
            className="verses-container"
            ref={versesContainerRef}
            lang={getTranslationLanguage(selectedTranslation)}
          >
            {verseComponents}
          </div>
        )}

        {!showSkeleton && !loading && !error && chapterVerses.length === 0 && (
          <div className="status-message">
            No verses found for this chapter. Try selecting a different chapter.
          </div>
        )}
      </section>
      <ScrollToTop />
    </div>
  );
};

export default React.memo(ChapterReader);
