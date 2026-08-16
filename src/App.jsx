import React, { useState, useEffect, useRef, useCallback } from "react";
import SearchBar from "./components/SearchBar";
import TranslationSwitcher from "./components/TranslationSwitcher";
import BookSelector from "./components/BookSelector";
import ChapterReader from "./components/ChapterReader";
import VerseComparisonPanel from "./components/VerseComparisonPanel";
import SyncControls from "./components/SyncControls";
import ShareButton from "./components/ShareButton";
import { fetchVerses } from "./services/bibleApi";
import { BOOK_TRANSLATIONS, getBookName } from "./utils/translationMappings";
import {
  parseUrlParams,
  generateShareUrl,
  updateUrl,
  validateUrlParams,
} from "./utils/urlUtils";
import { VerseProvider } from "./useVerseData";
import "./styles/index.css";
import { sendPageView, sendEvent } from "./utils/ga";
import { writeTextToClipboard } from "./utils/clipboard";

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

const CopyErrorIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="8" y1="8" x2="16" y2="16" />
    <line x1="16" y1="8" x2="8" y2="16" />
  </svg>
);

const MobileToolsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="4" y1="6" x2="20" y2="6" />
    <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
    <line x1="4" y1="18" x2="20" y2="18" />
    <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" />
  </svg>
);

const readStoredDarkMode = () => {
  try {
    const saved = localStorage.getItem("darkMode");
    return saved === null ? false : JSON.parse(saved) === true;
  } catch {
    return false;
  }
};

function App() {
  const [selectedBook, setSelectedBook] = useState("John");
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [viewMode, setViewMode] = useState("reader");
  const [selectedTranslation, setSelectedTranslation] = useState("TB");
  const [isDarkMode, setIsDarkMode] = useState(readStoredDarkMode);

  // Apply dark mode class to document
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDarkMode ? "dark" : "light",
    );
    try {
      localStorage.setItem("darkMode", JSON.stringify(isDarkMode));
    } catch {
      // The selected theme still applies when storage is unavailable.
    }
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
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [showComparisonScrollCue, setShowComparisonScrollCue] = useState(false);
  const chapterVersesRef = useRef([]);
  const navRef = useRef(null);
  const navSecondaryControlsRef = useRef(null);
  const comparisonControlsRef = useRef(null);
  const dataRequestControllerRef = useRef(null);
  const dataRequestIdRef = useRef(0);
  const copyResetTimerRef = useRef(null);
  const [urlReady, setUrlReady] = useState(false);

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

  useEffect(() => {
    const controls = comparisonControlsRef.current;
    if (viewMode !== "comparison" || !controls) {
      setShowComparisonScrollCue(false);
      return undefined;
    }

    const updateScrollCue = () => {
      const remainingScroll =
        controls.scrollWidth - controls.clientWidth - controls.scrollLeft;
      setShowComparisonScrollCue(remainingScroll > 2);
    };

    updateScrollCue();
    const resizeObserver = new ResizeObserver(updateScrollCue);
    resizeObserver.observe(controls);
    if (controls.firstElementChild) {
      resizeObserver.observe(controls.firstElementChild);
    }
    controls.addEventListener("scroll", updateScrollCue, { passive: true });

    return () => {
      resizeObserver.disconnect();
      controls.removeEventListener("scroll", updateScrollCue);
    };
  }, [comparisonRemovingTranslations, comparisonTranslations, viewMode]);

  useEffect(() => {
    const compactNavigation = window.matchMedia(
      "(max-width: 480px), (max-width: 768px) and (orientation: landscape)",
    );
    const preserveFocusedTools = () => {
      if (
        compactNavigation.matches &&
        navSecondaryControlsRef.current?.contains(document.activeElement)
      ) {
        setMobileToolsOpen(true);
      }
    };

    preserveFocusedTools();
    compactNavigation.addEventListener?.("change", preserveFocusedTools);
    return () =>
      compactNavigation.removeEventListener?.("change", preserveFocusedTools);
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
    const controller = new AbortController();
    const loadBibleStructure = async () => {
      try {
        const response = await fetch("/bible-structure.json", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Bible metadata request failed (${response.status})`);
        }
        const data = await response.json();
        setBibleStructure(data);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Failed to load Bible structure:", err);
          setError(
            "Unable to load Bible metadata. Please refresh and try again.",
          );
        }
      }
    };
    loadBibleStructure();
    return () => controller.abort();
  }, []);

  const applyUrlState = useCallback(() => {
    if (!bibleStructure) return;

    const rawParams = parseUrlParams();
    const validatedParams = validateUrlParams(
      rawParams,
      bibleStructure,
      Object.keys(BOOK_TRANSLATIONS),
    );

    if (validatedParams) {
      setSelectedBook(validatedParams.book);
      setSelectedChapter(validatedParams.chapter);
      setSelectedTranslation(validatedParams.translation);
      setSelectedVerses(validatedParams.verses);
      setHighlightedVerse(null);
      setError(null);
    } else {
      setSelectedBook("John");
      setSelectedChapter(1);
      setSelectedTranslation("TB");
      setSelectedVerses(new Set());
      setHighlightedVerse(null);
      setError(
        rawParams.book ||
          rawParams.chapter ||
          rawParams.translation ||
          rawParams.verses.size > 0
          ? "This shared passage link is invalid. Showing John chapter 1 instead."
          : null,
      );
    }

    setUrlReady(true);
  }, [bibleStructure]);

  // Hydrate shared reading state after metadata is available and support history navigation.
  useEffect(() => {
    if (!bibleStructure) return;
    applyUrlState();
    window.addEventListener("popstate", applyUrlState);
    return () => window.removeEventListener("popstate", applyUrlState);
  }, [applyUrlState, bibleStructure]);

  // Keep the address bar in sync with the current passage and selected verses.
  useEffect(() => {
    if (!urlReady) return;
    updateUrl(
      selectedBook,
      selectedChapter,
      selectedTranslation,
      selectedVerses,
    );
  }, [
    urlReady,
    selectedBook,
    selectedChapter,
    selectedTranslation,
    selectedVerses,
  ]);

  const beginDataRequest = useCallback(() => {
    dataRequestControllerRef.current?.abort();
    const controller = new AbortController();
    dataRequestControllerRef.current = controller;
    return { controller, requestId: ++dataRequestIdRef.current };
  }, []);

  const handleBookChange = useCallback((bookName) => {
    dataRequestControllerRef.current?.abort();
    setSelectedBook(bookName);
    setHighlightedVerse(null);
    setSelectedVerses(new Set());
    setComparisonSelectedVerses(new Set());
    setComparisonIndependentSelections({});
    setVerses([]);
    setLoading(false);
    setError(null);
    sendEvent({
      action: "book_change",
      category: "navigation",
      label: bookName,
    });
  }, []);

  const handleChapterChange = useCallback(
    (chapterNumber, bookName = null) => {
      dataRequestControllerRef.current?.abort();
      setSelectedChapter(Number(chapterNumber));
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
      setSelectedVerses(new Set());
      setComparisonSelectedVerses(new Set());
      setComparisonIndependentSelections({});
      setVerses([]);
      setLoading(false);
      setError(null);
    },
    [selectedBook],
  );

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
  }, [selectedChapter, selectedBook, bibleStructure, handleChapterChange]);

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
  }, [selectedChapter, selectedBook, bibleStructure, handleChapterChange]);

  const handleVerseSearch = async (verseReference) => {
    const { controller, requestId } = beginDataRequest();
    setLoading(true);
    setError(null);
    try {
      const fetchedVerses = await fetchVerses(
        selectedTranslation,
        verseReference,
        { signal: controller.signal },
      );

      if (controller.signal.aborted || dataRequestIdRef.current !== requestId) {
        return;
      }

      if (fetchedVerses.length > 0) {
        const firstVerse = fetchedVerses[0];
        setSelectedBook(firstVerse.book);
        setSelectedChapter(Number(firstVerse.chapter));
        setSelectedVerses(new Set());

        const hasVerseNumber = verseReference.includes(":");
        if (hasVerseNumber) {
          setHighlightedVerse({
            verse: Number(firstVerse.verse),
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
      if (
        err.name !== "AbortError" &&
        !controller.signal.aborted &&
        dataRequestIdRef.current === requestId
      ) {
        setError(err.message || "Failed to fetch verses");
        setVerses([]);
      }
    } finally {
      if (
        !controller.signal.aborted &&
        dataRequestIdRef.current === requestId
      ) {
        setLoading(false);
      }
    }
  };

  const handleTranslationChange = async (translation) => {
    const { controller, requestId } = beginDataRequest();
    setSelectedTranslation(translation);
    setError(null);
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

        const fetchedVerses = await fetchVerses(translation, reference, {
          signal: controller.signal,
        });
        if (
          controller.signal.aborted ||
          dataRequestIdRef.current !== requestId
        ) {
          return;
        }
        setVerses(fetchedVerses);
      } catch (err) {
        if (
          err.name !== "AbortError" &&
          !controller.signal.aborted &&
          dataRequestIdRef.current === requestId
        ) {
          setError(err.message || "Failed to fetch verses in new translation");
        }
      } finally {
        if (
          !controller.signal.aborted &&
          dataRequestIdRef.current === requestId
        ) {
          setLoading(false);
        }
      }
    } else if (dataRequestIdRef.current === requestId) {
      setLoading(false);
    }
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

  const handleRemoveComparisonTranslation = useCallback(
    (translationId) => {
      if (
        comparisonTranslations.length <= 1 ||
        comparisonTranslations[0] === translationId ||
        comparisonRemovingTranslations.has(translationId)
      ) {
        return;
      }

      setComparisonRemovingTranslations(
        (current) => new Set([...current, translationId]),
      );
      setComparisonIndependentSelections((selections) => {
        if (!selections[translationId]) return selections;
        const next = { ...selections };
        delete next[translationId];
        return next;
      });

      setTimeout(() => {
        setComparisonTranslations((current) =>
          current.filter((translation) => translation !== translationId),
        );
        setComparisonRemovingTranslations((current) => {
          const next = new Set(current);
          next.delete(translationId);
          return next;
        });
      }, 250);
    },
    [comparisonRemovingTranslations, comparisonTranslations],
  );

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

  const showTemporaryCopyState = useCallback((nextState) => {
    if (copyResetTimerRef.current) {
      clearTimeout(copyResetTimerRef.current);
    }
    setCopyState(nextState);
    copyResetTimerRef.current = setTimeout(() => {
      setCopyState("idle");
      copyResetTimerRef.current = null;
    }, 2000);
  }, []);

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
        await writeTextToClipboard(textToCopy);
        showTemporaryCopyState("copied");
        sendEvent({
          action: "copy_verses",
          category: "engagement",
          label: header,
          value: sortedVerseNumbers.length,
        });
      } catch (err) {
        console.error("Failed to copy text: ", err);
        showTemporaryCopyState("error");
      }
    } else if (viewMode === "comparison") {
      if (window.copyComparisonVerses) {
        setCopyState("copying");
        try {
          await window.copyComparisonVerses();
          showTemporaryCopyState("copied");
        } catch (err) {
          console.error("Failed to copy comparison verses: ", err);
          showTemporaryCopyState("error");
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

  const handleViewTabKeyDown = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    let nextMode = viewMode;
    if (event.key === "ArrowLeft" || event.key === "Home") {
      nextMode = "reader";
    } else if (event.key === "ArrowRight" || event.key === "End") {
      nextMode = "comparison";
    }
    setViewMode(nextMode);
    requestAnimationFrame(() => {
      document.getElementById(`${nextMode}-tab`)?.focus();
    });
  };

  useEffect(() => {
    return () => {
      dataRequestControllerRef.current?.abort();
      if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current);
    };
  }, []);

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
            <div className="nav-controls">
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

              <button
                type="button"
                className="mobile-tools-toggle"
                onClick={() => setMobileToolsOpen((open) => !open)}
                aria-expanded={mobileToolsOpen}
                aria-controls="mobile-nav-tools"
                aria-label={
                  mobileToolsOpen
                    ? "Hide search and translation controls"
                    : "Show search and translation controls"
                }
                title={
                  mobileToolsOpen
                    ? "Hide search and translation controls"
                    : "Show search and translation controls"
                }
              >
                <MobileToolsIcon />
              </button>

              <div
                ref={navSecondaryControlsRef}
                id="mobile-nav-tools"
                className={`nav-secondary-controls${
                  mobileToolsOpen ? " mobile-tools-open" : ""
                }`}
              >
                <SearchBar
                  onSearch={handleVerseSearch}
                  selectedTranslation={selectedTranslation}
                  bibleStructure={bibleStructure}
                />
                <TranslationSwitcher
                  selectedTranslation={selectedTranslation}
                  onTranslationChange={handleTranslationChange}
                />
              </div>
            </div>
          </div>
          <div className="view-tab-bar">
            <div className="view-tab-bar-inner">
              <div
                className="tab-bar-tabs"
                role="tablist"
                aria-label="Bible view"
                onKeyDown={handleViewTabKeyDown}
              >
                <button
                  id="reader-tab"
                  role="tab"
                  aria-selected={viewMode === "reader"}
                  aria-controls="reader-panel"
                  tabIndex={viewMode === "reader" ? 0 : -1}
                  className={`view-tab ${viewMode === "reader" ? "active" : ""}`}
                  onClick={() => setViewMode("reader")}
                >
                  Reader
                </button>
                <button
                  id="comparison-tab"
                  role="tab"
                  aria-selected={viewMode === "comparison"}
                  aria-controls="comparison-panel"
                  tabIndex={viewMode === "comparison" ? 0 : -1}
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
                <div
                  ref={comparisonControlsRef}
                  className={`tab-bar-controls${
                    showComparisonScrollCue ? " has-overflow-right" : ""
                  }`}
                >
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
                  aria-live="polite"
                  aria-label={
                    copyState === "copied"
                      ? "Selected verses copied"
                      : copyState === "copying"
                        ? "Copying selected verses"
                        : copyState === "error"
                          ? "Could not copy selected verses"
                          : `Copy ${totalSelections} selected verse${totalSelections === 1 ? "" : "s"}`
                  }
                  title={
                    copyState === "error"
                      ? "Copy failed. Try again."
                      : `Copy ${totalSelections} selected verse${
                          totalSelections > 1 ? "s" : ""
                        }`
                  }
                >
                  {copyState === "copying" && <CopyProgressIcon />}
                  {copyState === "copied" && <CopySuccessIcon />}
                  {copyState === "error" && <CopyErrorIcon />}
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

        {loading && (
          <div className="status-bar loading" role="status" aria-live="polite">
            Loading verses…
          </div>
        )}
        {error && (
          <div className="status-bar error" role="alert">
            {error === "Failed to fetch verses"
              ? "Unable to load verses. Check your connection and try again, or select a different chapter."
              : error}
          </div>
        )}

        <main className="app-main">
          {viewMode === "reader" ? (
            <div id="reader-panel" role="tabpanel" aria-labelledby="reader-tab">
              <ChapterReader
                selectedBook={selectedBook}
                selectedChapter={selectedChapter}
                bibleStructure={bibleStructure}
                highlightedVerse={highlightedVerse}
                selectedTranslation={selectedTranslation}
                selectedVerses={selectedVerses}
                setSelectedVerses={setSelectedVerses}
                chapterVersesRef={chapterVersesRef}
              />
            </div>
          ) : (
            <div
              id="comparison-panel"
              role="tabpanel"
              aria-labelledby="comparison-tab"
            >
              <VerseComparisonPanel
                selectedBook={selectedBook}
                selectedChapter={selectedChapter}
                bibleStructure={bibleStructure}
                highlightedVerse={highlightedVerse}
                selectedVerses={comparisonSelectedVerses}
                setSelectedVerses={setComparisonSelectedVerses}
                independentSelections={comparisonIndependentSelections}
                setIndependentSelections={setComparisonIndependentSelections}
                syncEnabled={comparisonSyncEnabled}
                showCopyInNav={true}
                translations={comparisonTranslations}
                removingTranslations={comparisonRemovingTranslations}
              />
            </div>
          )}
        </main>
      </div>
    </VerseProvider>
  );
}

export default App;
