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
  const versesContainerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const fetchIdRef = useRef(0);
  const skeletonDelayRef = useRef(null);
  const skeletonShownAtRef = useRef(null);

  // Memoize current book calculation
  const currentBook = useMemo(
    () => bibleStructure?.books.find((book) => book.name === selectedBook),
    [bibleStructure, selectedBook],
  );

  // Skeleton timing: delay showing to avoid flash on fast loads,
  // and enforce a minimum visible duration once it does appear.
  const SKELETON_SHOW_DELAY = 150;
  const SKELETON_MIN_VISIBLE = 300;

  // Optimized fetch function with abort controller
  const fetchChapterVerses = useCallback(async () => {
    if (!selectedBook || !selectedChapter || !currentBook) return;

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

    // When the chapter is already cached, skip the flash-avoidance delay and
    // show the skeleton right away so users see the same loading affordance
    // on every navigation — then let the min-visible timer gate the render.
    const cacheHit = hasCachedChapter(
      selectedTranslation,
      selectedBook,
      selectedChapter,
    );

    skeletonShownAtRef.current = null;
    if (cacheHit) {
      skeletonShownAtRef.current = Date.now();
      setShowSkeleton(true);
    } else {
      skeletonDelayRef.current = setTimeout(() => {
        if (fetchIdRef.current === fetchId) {
          skeletonShownAtRef.current = Date.now();
          setShowSkeleton(true);
        }
      }, SKELETON_SHOW_DELAY);
    }

    try {
      const [versesRes, headingsRes] = await Promise.all([
        fetchChapterCached(selectedTranslation, selectedBook, selectedChapter),
        fetchHeadingsCached(selectedTranslation, selectedBook, selectedChapter),
      ]);
      const verses = versesRes.data;
      const headingsData = headingsRes.data;

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

      const applyData = () => {
        if (fetchIdRef.current !== fetchId) return;
        setChapterVerses(transformedVerses);
        setHeadings(headingsData);
        setShowSkeleton(false);
        skeletonShownAtRef.current = null;
      };

      // If skeleton never showed (fast load), cancel the pending show
      // and render immediately. If it did show, keep it up long enough
      // to avoid flicker.
      if (skeletonShownAtRef.current === null) {
        if (skeletonDelayRef.current) {
          clearTimeout(skeletonDelayRef.current);
          skeletonDelayRef.current = null;
        }
        applyData();
      } else {
        const elapsed = Date.now() - skeletonShownAtRef.current;
        const remaining = Math.max(0, SKELETON_MIN_VISIBLE - elapsed);
        if (remaining === 0) {
          applyData();
        } else {
          setTimeout(applyData, remaining);
        }
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
  }, [selectedBook, selectedChapter, currentBook, selectedTranslation]);

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
            <div
              key={`heading-${verseNumber}-${i}`}
              className="pericope-heading"
            >
              {h.heading}
            </div>
          ))}
          <div
            className={`verse-item ${isHighlighted ? "highlighted" : ""} ${
              isSelected ? "selected" : ""
            }`}
            id={`verse-${verseNumber}`}
            onClick={() => handleVerseClick(verseNumber)}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={`Verse ${verseNumber}${isSelected ? ", selected" : ""}. Click to ${isSelected ? "deselect" : "select"}.`}
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
    headings,
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
      <main className="chapter-content">
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
          <div className="status-message error">
            Unable to load this chapter. Please check your connection and try
            again.
          </div>
        )}

        {!showSkeleton && !error && chapterVerses.length > 0 && (
          <div className="verses-container" ref={versesContainerRef}>
            {verseComponents}
          </div>
        )}

        {!showSkeleton && !loading && !error && chapterVerses.length === 0 && (
          <div className="status-message">
            No verses found for this chapter. Try selecting a different chapter.
          </div>
        )}
      </main>
      <ScrollToTop />
    </div>
  );
};

export default React.memo(ChapterReader);
