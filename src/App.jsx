import React, { useState, useEffect, useRef, useCallback } from "react";
import SearchBar from "./components/SearchBar";
import TranslationSwitcher from "./components/TranslationSwitcher";
import BookSelector from "./components/BookSelector";
import ChapterReader from "./components/ChapterReader";
import VerseComparisonPanel from "./components/VerseComparisonPanel";
import SyncControls from "./components/SyncControls";
import ShareButton from "./components/ShareButton";
import { fetchVerses } from "./services/bibleApi";
import { getBookName } from "./utils/translationMappings";
import { parseUrlParams, generateShareUrl } from "./utils/urlUtils";
import { VerseProvider } from "./useVerseData";
import "./styles/index.css";
import { sendPageView, sendEvent } from "./utils/ga";

// Shared SVG icons to avoid duplication
const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const CopyIdleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CopySuccessIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20,6 9,17 4,12" />
  </svg>
);

const CopyProgressIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12,6 12,12 16,14" />
  </svg>
);

function App() {
  const [selectedBook, setSelectedBook] = useState("John");
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [viewMode, setViewMode] = useState("reader");
  const [selectedTranslation, setSelectedTranslation] = useState("TB");
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : false;
  });

  // Apply dark mode class to document
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDarkMode ? "dark" : "light",
    );
    localStorage.setItem("darkMode", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const [verses, setVerses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bibleStructure, setBibleStructure] = useState(null);
  const [highlightedVerse, setHighlightedVerse] = useState(null);
  const [selectedVerses, setSelectedVerses] = useState(new Set());
  const [comparisonSelectedVerses, setComparisonSelectedVerses] = useState(
    new Set(),
  );
  const [comparisonIndependentSelections, setComparisonIndependentSelections] =
    useState({});
  const [comparisonSyncEnabled, setComparisonSyncEnabled] = useState(true);
  const [comparisonTranslations, setComparisonTranslations] = useState(() => {
    const first = "TB";
    return [first, "NIV"];
  });
  const [comparisonRemovingTranslations, setComparisonRemovingTranslations] =
    useState(new Set());
  const [copyState, setCopyState] = useState("idle");
  const [showMobileMenu, setShowMobileMenu] = useState(true);
  const [showWelcome, setShowWelcome] = useState(() => {
    return !localStorage.getItem("welcomeDismissed");
  });
  const mobileMenuRef = useRef(null);
  const chapterVersesRef = useRef([]);
  const navRef = useRef(null);

  // Dynamically update --nav-height based on actual nav element height
  useEffect(() => {
    if (!navRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const height = entry.target.getBoundingClientRect().height;
        document.documentElement.style.setProperty(
          "--nav-height",
          `${height}px`,
        );
      }
    });

    resizeObserver.observe(navRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Heartbeat for engagement rate — every 60 seconds
  useEffect(() => {
    const heartbeat = setInterval(() => {
      sendEvent({
        action: "heartbeat",
        category: "engagement",
        label: `${selectedTranslation}/${selectedBook}/${selectedChapter}/${viewMode}`,
      });
    }, 60000);
    return () => clearInterval(heartbeat);
  }, [selectedTranslation, selectedBook, selectedChapter, viewMode]);

  // Track pageview on book/chapter/translation change
  useEffect(() => {
    sendPageView(`/${selectedTranslation}/${selectedBook}/${selectedChapter}`);
  }, [selectedTranslation, selectedBook, selectedChapter]);

  // Clear selections when switching between views
  useEffect(() => {
    setSelectedVerses(new Set());
    setComparisonSelectedVerses(new Set());
    setComparisonIndependentSelections({});
    setCopyState("idle");
  }, [viewMode]);

  // Load Bible structure data
  useEffect(() => {
    const loadBibleStructure = async () => {
      try {
        const response = await fetch("/bible-structure.json");
        const data = await response.json();
        setBibleStructure(data);
      } catch (err) {
        console.error("Failed to load Bible structure:", err);
      }
    };
    loadBibleStructure();
  }, []);

  // Parse URL parameters on initial load
  useEffect(() => {
    const urlParams = parseUrlParams();
    if (urlParams.book && urlParams.chapter && urlParams.translation) {
      setSelectedBook(urlParams.book);
      setSelectedChapter(urlParams.chapter);
      setSelectedTranslation(urlParams.translation);

      if (urlParams.verses.size > 0) {
        setSelectedVerses(urlParams.verses);
      }
    }
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!showMobileMenu) return;
      const isOutsideMenu =
        mobileMenuRef.current && !mobileMenuRef.current.contains(event.target);
      const isToggleButton = event.target.closest(".mobile-menu-toggle");
      if (isOutsideMenu && !isToggleButton) {
        setShowMobileMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMobileMenu]);

  // Navigation handlers
  const handlePreviousChapter = useCallback(() => {
    sendEvent({
      action: "prev_chapter_click",
      category: "navigation",
      label: `${selectedBook} ${selectedChapter}`,
    });
    if (selectedChapter > 1) {
      handleChapterChange(selectedChapter - 1);
    } else if (bibleStructure) {
      const currentBookIndex = bibleStructure.books.findIndex(
        (book) => book.name === selectedBook,
      );
      if (currentBookIndex > 0) {
        const previousBook = bibleStructure.books[currentBookIndex - 1];
        handleChapterChange(previousBook.chapters, previousBook.name);
      }
    }
  }, [selectedChapter, selectedBook, bibleStructure]);

  const handleNextChapter = useCallback(() => {
    sendEvent({
      action: "next_chapter_click",
      category: "navigation",
      label: `${selectedBook} ${selectedChapter}`,
    });
    const currentBook = bibleStructure?.books.find(
      (book) => book.name === selectedBook,
    );
    const totalChapters = currentBook?.chapters || 0;

    if (selectedChapter < totalChapters) {
      handleChapterChange(selectedChapter + 1);
    } else if (bibleStructure) {
      const currentBookIndex = bibleStructure.books.findIndex(
        (book) => book.name === selectedBook,
      );
      if (currentBookIndex < bibleStructure.books.length - 1) {
        const nextBook = bibleStructure.books[currentBookIndex + 1];
        handleChapterChange(1, nextBook.name);
      }
    }
  }, [selectedChapter, selectedBook, bibleStructure]);

  const handleVerseSearch = async (verseReference) => {
    setLoading(true);
    setError(null);
    try {
      const fetchedVerses = await fetchVerses(
        selectedTranslation,
        verseReference,
      );

      if (fetchedVerses.length > 0) {
        const firstVerse = fetchedVerses[0];
        setSelectedBook(firstVerse.book);
        setSelectedChapter(firstVerse.chapter);

        const hasVerseNumber = verseReference.includes(":");
        if (hasVerseNumber) {
          setHighlightedVerse({
            verse: firstVerse.verse,
            count: fetchedVerses.length,
          });
        } else {
          setHighlightedVerse(null);
        }
        sendEvent({
          action: "verse_search",
          category: "engagement",
          label: verseReference,
          value: fetchedVerses.length,
        });
      }

      setVerses(fetchedVerses);
    } catch (err) {
      setError(err.message || "Failed to fetch verses");
      setVerses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTranslationChange = async (translation) => {
    setSelectedTranslation(translation);
    sendEvent({
      action: "translation_change",
      category: "engagement",
      label: translation,
    });
    if (verses.length > 0 && verses[0].book) {
      setLoading(true);
      try {
        const firstVerse = verses[0];
        const reference =
          verses.length === 1
            ? `${firstVerse.book} ${firstVerse.chapter}:${firstVerse.verse}`
            : `${firstVerse.book} ${firstVerse.chapter}:${firstVerse.verse}-${
                verses[verses.length - 1].verse
              }`;

        const fetchedVerses = await fetchVerses(translation, reference);
        setVerses(fetchedVerses);
      } catch (err) {
        setError(err.message || "Failed to fetch verses in new translation");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBookChange = (bookName) => {
    setSelectedBook(bookName);
    sendEvent({
      action: "book_change",
      category: "navigation",
      label: bookName,
    });
  };

  const handleChapterChange = (chapterNumber, bookName = null) => {
    setSelectedChapter(chapterNumber);
    if (bookName) {
      setSelectedBook(bookName);
      sendEvent({
        action: "book_change",
        category: "navigation",
        label: bookName,
      });
    }
    sendEvent({
      action: "chapter_change",
      category: "navigation",
      label: `${bookName || selectedBook} ${chapterNumber}`,
    });
    setHighlightedVerse(null);
    setVerses([]);
    setError(null);
  };

  // Sync first comparison translation with selectedTranslation
  useEffect(() => {
    if (
      selectedTranslation &&
      comparisonTranslations[0] !== selectedTranslation
    ) {
      setComparisonTranslations((prev) => {
        const next = [...prev];
        const existingIndex = next.indexOf(selectedTranslation);
        if (existingIndex > 0) {
          next[existingIndex] = next[0];
          next[0] = selectedTranslation;
        } else {
          next[0] = selectedTranslation;
        }
        return next;
      });
    }
  }, [selectedTranslation]); // eslint-disable-line react-hooks/exhaustive-deps

  const MAX_COMPARISON_TRANSLATIONS = 5;

  const handleAddComparisonTranslation = useCallback((translationId) => {
    setComparisonTranslations((prev) => {
      if (prev.includes(translationId)) return prev;
      if (prev.length >= MAX_COMPARISON_TRANSLATIONS) return prev;
      return [...prev, translationId];
    });
  }, []);

  const handleRemoveComparisonTranslation = useCallback((translationId) => {
    setComparisonTranslations((current) => {
      if (current.length <= 1 || current[0] === translationId) return current;
      setComparisonRemovingTranslations((r) => new Set([...r, translationId]));
      setTimeout(() => {
        setComparisonTranslations((c) => c.filter((t) => t !== translationId));
        setComparisonRemovingTranslations((r) => {
          const next = new Set(r);
          next.delete(translationId);
          return next;
        });
      }, 250);
      return current;
    });
  }, []);

  // Check if navigation buttons should be disabled
  const isPrevDisabled =
    selectedChapter === 1 && bibleStructure?.books[0]?.name === selectedBook;
  const isNextDisabled = (() => {
    const currentBook = bibleStructure?.books.find(
      (book) => book.name === selectedBook,
    );
    const totalChapters = currentBook?.chapters || 0;
    return (
      selectedChapter === totalChapters &&
      bibleStructure?.books[bibleStructure.books.length - 1]?.name ===
        selectedBook
    );
  })();

  // Compute copy/share state at component level (no IIFE)
  const hasReaderSelections = viewMode === "reader" && selectedVerses.size > 0;
  const hasComparisonSelections =
    viewMode === "comparison" &&
    (comparisonSyncEnabled
      ? comparisonSelectedVerses.size > 0
      : Object.values(comparisonIndependentSelections).some(
          (set) => set && set.size > 0,
        ));

  const totalSelections =
    viewMode === "reader"
      ? selectedVerses.size
      : comparisonSyncEnabled
        ? comparisonSelectedVerses.size
        : Object.values(comparisonIndependentSelections).reduce(
            (total, set) => total + (set?.size || 0),
            0,
          );

  const shareUrl = (() => {
    const currentSelections =
      viewMode === "reader"
        ? selectedVerses
        : comparisonSyncEnabled
          ? comparisonSelectedVerses
          : new Set(
              Object.values(comparisonIndependentSelections).flatMap((set) =>
                Array.from(set || []),
              ),
            );

    return generateShareUrl(
      selectedBook,
      selectedChapter,
      selectedTranslation,
      currentSelections,
    );
  })();

  const showCopyActions = hasReaderSelections || hasComparisonSelections;

  // Copy selected verses function
  const copySelectedVerses = async () => {
    if (viewMode === "reader") {
      if (selectedVerses.size === 0) return;

      setCopyState("copying");

      const sortedVerseNumbers = Array.from(selectedVerses).sort(
        (a, b) => a - b,
      );

      // Group consecutive verses into ranges
      let verseRange;
      if (sortedVerseNumbers.length === 1) {
        verseRange = sortedVerseNumbers[0].toString();
      } else {
        const ranges = [];
        let rangeStart = sortedVerseNumbers[0];
        let rangeEnd = sortedVerseNumbers[0];

        for (let i = 1; i < sortedVerseNumbers.length; i++) {
          const currentVerse = sortedVerseNumbers[i];
          const previousVerse = sortedVerseNumbers[i - 1];

          if (currentVerse === previousVerse + 1) {
            rangeEnd = currentVerse;
          } else {
            if (rangeStart === rangeEnd) {
              ranges.push(rangeStart.toString());
            } else {
              ranges.push(`${rangeStart}-${rangeEnd}`);
            }
            rangeStart = currentVerse;
            rangeEnd = currentVerse;
          }
        }

        if (rangeStart === rangeEnd) {
          ranges.push(rangeStart.toString());
        } else {
          ranges.push(`${rangeStart}-${rangeEnd}`);
        }

        verseRange = ranges.join(", ");
      }

      const localizedBookName = getBookName(selectedBook, selectedTranslation);
      const translationName = selectedTranslation?.toUpperCase() || "KJV";
      const header = `${localizedBookName} ${selectedChapter}:${verseRange} ${translationName}`;

      // Get verse content from ref
      let content = "";
      const currentChapterVerses = chapterVersesRef.current;
      if (currentChapterVerses && currentChapterVerses.length > 0) {
        const verseLines = sortedVerseNumbers.map((verseNumber) => {
          const verse = currentChapterVerses.find(
            (v) =>
              (v.verse || currentChapterVerses.indexOf(v) + 1) === verseNumber,
          );
          return verse?.text
            ? `${verseNumber} ${verse.text}`
            : `${verseNumber} `;
        });
        content = verseLines.join("\n");
      }

      const textToCopy = content ? `${header}\n${content}` : header;

      try {
        await navigator.clipboard.writeText(textToCopy);
        setCopyState("copied");
        sendEvent({
          action: "copy_verses",
          category: "engagement",
          label: header,
          value: sortedVerseNumbers.length,
        });
        setTimeout(() => setCopyState("idle"), 2000);
      } catch (err) {
        console.error("Failed to copy text: ", err);
        setCopyState("idle");
      }
    } else if (viewMode === "comparison") {
      if (window.copyComparisonVerses) {
        setCopyState("copying");
        try {
          await window.copyComparisonVerses();
          setCopyState("copied");
          setTimeout(() => setCopyState("idle"), 2000);
        } catch (err) {
          console.error("Failed to copy comparison verses: ", err);
          setCopyState("idle");
        }
      }
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
    sendEvent({
      action: "dark_mode_toggle",
      category: "ui",
      label: !isDarkMode ? "enabled" : "disabled",
    });
  };

  const dismissWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem("welcomeDismissed", "true");
  };

  // Context value for verse data
  const verseContextValue = {
    currentChapterVersesRef: chapterVersesRef,
  };

  return (
    <VerseProvider value={verseContextValue}>
      <div className="app">
        <nav className="app-nav" ref={navRef}>
          <div className="nav-content">
            {/* Top row - Always visible */}
            <div className="nav-top">
              <div className="nav-brand">
                <img
                  src="/bcc_logo.png"
                  alt="BlessingsBible Logo"
                  className="app-logo"
                />
                <h1 className="app-title">BlessingsBible</h1>
              </div>

              <div className="nav-actions">
                <button
                  className="dark-mode-toggle"
                  onClick={toggleDarkMode}
                  aria-label={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
                  title={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
                >
                  {isDarkMode ? <SunIcon /> : <MoonIcon />}
                </button>
              </div>
            </div>

            {/* Bottom row - Controls */}
            <div
              className={`nav-controls ${showMobileMenu ? "mobile-open" : ""}`}
              ref={mobileMenuRef}
            >
              <div className="nav-primary-controls">
                <BookSelector
                  bibleStructure={bibleStructure}
                  selectedBook={selectedBook}
                  selectedChapter={selectedChapter}
                  onBookChange={handleBookChange}
                  onChapterChange={handleChapterChange}
                  selectedTranslation={selectedTranslation}
                  integrated={true}
                  onPreviousChapter={handlePreviousChapter}
                  onNextChapter={handleNextChapter}
                  isPrevDisabled={isPrevDisabled}
                  isNextDisabled={isNextDisabled}
                />
              </div>

              <div className="nav-secondary-controls">
                <SearchBar
                  onSearch={handleVerseSearch}
                  selectedTranslation={selectedTranslation}
                />
                <TranslationSwitcher
                  selectedTranslation={selectedTranslation}
                  onTranslationChange={handleTranslationChange}
                />
              </div>
            </div>
          </div>
          <div className="view-tab-bar" role="tablist">
            <div className="view-tab-bar-inner">
              <div className="tab-bar-tabs">
                <button
                  role="tab"
                  aria-selected={viewMode === "reader"}
                  className={`view-tab ${viewMode === "reader" ? "active" : ""}`}
                  onClick={() => setViewMode("reader")}
                >
                  Reader
                </button>
                <button
                  role="tab"
                  aria-selected={viewMode === "comparison"}
                  className={`view-tab ${viewMode === "comparison" ? "active" : ""}`}
                  onClick={() => {
                    setViewMode("comparison");
                    sendEvent({
                      action: "tab_switch",
                      category: "navigation",
                      label: "comparison",
                    });
                  }}
                >
                  Comparison
                </button>
              </div>
              {viewMode === "comparison" && (
                <div className="tab-bar-controls">
                  <SyncControls
                    translations={comparisonTranslations}
                    onAddTranslation={handleAddComparisonTranslation}
                    onRemoveTranslation={handleRemoveComparisonTranslation}
                    syncEnabled={comparisonSyncEnabled}
                    onToggleSync={() =>
                      setComparisonSyncEnabled((prev) => !prev)
                    }
                    maxTranslations={MAX_COMPARISON_TRANSLATIONS}
                  />
                </div>
              )}
              {/* Copy/Share buttons */}
              <div
                className={`tab-bar-actions ${showCopyActions ? "visible" : ""}`}
              >
                <button
                  onClick={copySelectedVerses}
                  className={`copy-button ${copyState}`}
                  disabled={copyState === "copying"}
                  title={`Copy ${totalSelections} selected verse${
                    totalSelections > 1 ? "s" : ""
                  }`}
                >
                  {copyState === "copying" && <CopyProgressIcon />}
                  {copyState === "copied" && <CopySuccessIcon />}
                  {copyState === "idle" && (
                    <>
                      <CopyIdleIcon />
                      <span className="copy-count">{totalSelections}</span>
                    </>
                  )}
                </button>
                {viewMode === "reader" && (
                  <ShareButton
                    url={shareUrl}
                    disabled={totalSelections === 0}
                    verseCount={totalSelections}
                  />
                )}
              </div>
            </div>
          </div>
        </nav>

        {loading && <div className="status-bar loading">Loading verses…</div>}
        {error && (
          <div className="status-bar error">
            {error === "Failed to fetch verses"
              ? "Unable to load verses. Check your connection and try again, or select a different chapter."
              : error}
          </div>
        )}

        {/* Welcome banner for first-time visitors */}
        {showWelcome && (
          <div className="welcome-banner" role="alert">
            <div className="welcome-content">
              <div className="welcome-text">
                <h2>Welcome to BlessingsBible</h2>
                <p>
                  Read scripture in 11 translations, compare side by side, and
                  share your favourite verses.
                </p>
                <p className="welcome-tip">
                  <strong>Tip:</strong> Click any verse to select it, then use
                  the copy button to copy.
                </p>
              </div>
              <button
                className="welcome-close"
                onClick={dismissWelcome}
                aria-label="Dismiss welcome message"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <main className="app-main">
          {viewMode === "reader" ? (
            <ChapterReader
              selectedBook={selectedBook}
              selectedChapter={selectedChapter}
              onBookChange={handleBookChange}
              onChapterChange={handleChapterChange}
              bibleStructure={bibleStructure}
              highlightedVerse={highlightedVerse}
              selectedTranslation={selectedTranslation}
              selectedVerses={selectedVerses}
              setSelectedVerses={setSelectedVerses}
              showCopyInNav={true}
              chapterVersesRef={chapterVersesRef}
            />
          ) : (
            <VerseComparisonPanel
              selectedBook={selectedBook}
              selectedChapter={selectedChapter}
              bibleStructure={bibleStructure}
              highlightedVerse={highlightedVerse}
              selectedTranslation={selectedTranslation}
              selectedVerses={comparisonSelectedVerses}
              setSelectedVerses={setComparisonSelectedVerses}
              independentSelections={comparisonIndependentSelections}
              setIndependentSelections={setComparisonIndependentSelections}
              syncEnabled={comparisonSyncEnabled}
              setSyncEnabled={setComparisonSyncEnabled}
              showCopyInNav={true}
              translations={comparisonTranslations}
              removingTranslations={comparisonRemovingTranslations}
            />
          )}
        </main>
      </div>
    </VerseProvider>
  );
}

export default App;
