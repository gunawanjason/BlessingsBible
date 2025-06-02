import React, { useState, useEffect, useRef } from "react";
import SearchBar from "./components/SearchBar";
import TranslationSwitcher from "./components/TranslationSwitcher";
import BookSelector from "./components/BookSelector";
import ChapterReader from "./components/ChapterReader";
import VerseComparisonPanel from "./components/VerseComparisonPanel";
import ShareButton from "./components/ShareButton";
import { fetchVerses } from "./services/bibleApi";
import { getBookName } from "./utils/translationMappings";
import { parseUrlParams, generateShareUrl } from "./utils/urlUtils";
import "./App.css";
import { sendPageView, sendEvent } from "./utils/ga";

function App() {
  const [selectedBook, setSelectedBook] = useState("John");
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [viewMode, setViewMode] = useState("reader"); // 'reader' or 'comparison'
  const [selectedTranslation, setSelectedTranslation] = useState("TB");
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check for saved preference or default to light mode
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : false;
  });

  // Apply dark mode class to document
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDarkMode ? "dark" : "light"
    );
    localStorage.setItem("darkMode", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // Track view changes for analytics
  useEffect(() => {
    sendPageView(
      `/${selectedTranslation}/${selectedBook}/${selectedChapter}/${viewMode}`
    );
    sendEvent({
      action: "view_switch",
      category: "navigation",
      label: viewMode,
    });
  }, [viewMode, selectedTranslation, selectedBook, selectedChapter]);
  const [verses, setVerses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bibleStructure, setBibleStructure] = useState(null);
  const [highlightedVerse, setHighlightedVerse] = useState(null);
  const [selectedVerses, setSelectedVerses] = useState(new Set());
  const [comparisonSelectedVerses, setComparisonSelectedVerses] = useState(
    new Set()
  );
  const [comparisonIndependentSelections, setComparisonIndependentSelections] =
    useState({});
  const [comparisonSyncEnabled, setComparisonSyncEnabled] = useState(true);
  const [copyState, setCopyState] = useState("idle");
  const [showMobileMenu, setShowMobileMenu] = useState(true);
  const mobileMenuRef = useRef(null);

  // Heartbeat for engagement rate
  useEffect(() => {
    const heartbeat = setInterval(() => {
      sendEvent({
        action: "heartbeat",
        category: "engagement",
        label: `${selectedTranslation}/${selectedBook}/${selectedChapter}/${viewMode}`,
      });
    }, 15000); // 15 seconds
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

  // Function to generate a random verse reference
  const generateRandomVerse = (bibleData) => {
    if (!bibleData || !bibleData.books || bibleData.books.length === 0) {
      return null;
    }

    // Get a random book
    const randomBookIndex = Math.floor(Math.random() * bibleData.books.length);
    const randomBook = bibleData.books[randomBookIndex];

    // Get a random chapter
    const randomChapter = Math.floor(Math.random() * randomBook.chapters) + 1;

    // Get a random verse from that chapter
    const versesInChapter = randomBook.verses[randomChapter - 1];
    const randomVerse = Math.floor(Math.random() * versesInChapter) + 1;

    return {
      book: randomBook.name,
      chapter: randomChapter,
      verse: randomVerse,
      reference: `${randomBook.name} ${randomChapter}:${randomVerse}`,
    };
  };

  // Load a random verse on first visit
  const loadRandomVerse = async (bibleData) => {
    const randomVerse = generateRandomVerse(bibleData);
    if (!randomVerse) return;

    try {
      setLoading(true);
      setError(null);

      const fetchedVerses = await fetchVerses(
        selectedTranslation,
        randomVerse.reference
      );

      if (fetchedVerses.length > 0) {
        const firstVerse = fetchedVerses[0];
        setSelectedBook(firstVerse.book);
        setSelectedChapter(firstVerse.chapter);
        setHighlightedVerse({
          verse: firstVerse.verse,
          count: 1,
        });
        setVerses(fetchedVerses);
      }
    } catch (err) {
      console.error("Error loading random verse:", err);
      setError(err.message || "Failed to load random verse");
    } finally {
      setLoading(false);
    }
  };

  // Load Bible structure data
  useEffect(() => {
    const loadBibleStructure = async () => {
      try {
        const response = await fetch("/bible-structure.json");
        const data = await response.json();
        setBibleStructure(data);
      } catch (error) {
        console.error("Failed to load Bible structure:", error);
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
      // Check if click is outside both the menu and the toggle button
      // const isOutsideMenu = mobileMenuRef.current && !mobileMenuRef.current.contains(event.target);
      // const isToggleButton = event.target.closest('.mobile-menu-toggle');
      // if (isOutsideMenu && !isToggleButton) {
      //   setShowMobileMenu(false);
      // }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleVerseSearch = async (verseReference) => {
    setLoading(true);
    setError(null);
    try {
      const fetchedVerses = await fetchVerses(
        selectedTranslation,
        verseReference
      );

      if (fetchedVerses.length > 0) {
        const firstVerse = fetchedVerses[0];
        // Navigate to the book and chapter of the found verse
        setSelectedBook(firstVerse.book);
        setSelectedChapter(firstVerse.chapter);

        // Only highlight if the search includes specific verse numbers
        const hasVerseNumber = verseReference.includes(":");
        if (hasVerseNumber) {
          setHighlightedVerse({
            verse: firstVerse.verse,
            count: fetchedVerses.length,
          });
        } else {
          setHighlightedVerse(null);
        }
        // Send GA event for verse search
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
    // Send GA event for translation change
    sendEvent({
      action: "translation_change",
      category: "engagement",
      label: translation,
    });
    // Re-fetch current verses in new translation if any are displayed
    if (verses.length > 0 && verses[0].book) {
      setLoading(true);
      try {
        // Reconstruct the reference from the first verse
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
    // Clear highlighting when manually changing chapters
    setHighlightedVerse(null);
    setVerses([]);
    setError(null);
  };

  // Navigation handlers for the navbar
  const handlePreviousChapter = () => {
    sendEvent({
      action: "prev_chapter_click",
      category: "navigation",
      label: `${selectedBook} ${selectedChapter}`,
    });
    if (selectedChapter > 1) {
      handleChapterChange(selectedChapter - 1);
    } else if (bibleStructure) {
      const currentBookIndex = bibleStructure.books.findIndex(
        (book) => book.name === selectedBook
      );
      if (currentBookIndex > 0) {
        const previousBook = bibleStructure.books[currentBookIndex - 1];
        handleChapterChange(previousBook.chapters, previousBook.name);
      }
    }
  };

  const handleNextChapter = () => {
    sendEvent({
      action: "next_chapter_click",
      category: "navigation",
      label: `${selectedBook} ${selectedChapter}`,
    });
    const currentBook = bibleStructure?.books.find(
      (book) => book.name === selectedBook
    );
    const totalChapters = currentBook?.chapters || 0;

    if (selectedChapter < totalChapters) {
      handleChapterChange(selectedChapter + 1);
    } else if (bibleStructure) {
      const currentBookIndex = bibleStructure.books.findIndex(
        (book) => book.name === selectedBook
      );
      if (currentBookIndex < bibleStructure.books.length - 1) {
        const nextBook = bibleStructure.books[currentBookIndex + 1];
        handleChapterChange(1, nextBook.name);
      }
    }
  };

  // Check if navigation buttons should be disabled
  const isPrevDisabled =
    selectedChapter === 1 && bibleStructure?.books[0]?.name === selectedBook;
  const isNextDisabled = (() => {
    const currentBook = bibleStructure?.books.find(
      (book) => book.name === selectedBook
    );
    const totalChapters = currentBook?.chapters || 0;
    return (
      selectedChapter === totalChapters &&
      bibleStructure?.books[bibleStructure.books.length - 1]?.name ===
        selectedBook
    );
  })();

  // Copy selected verses function
  const copySelectedVerses = async () => {
    if (viewMode === "reader") {
      // Reader mode copy logic
      if (selectedVerses.size === 0) return;

      setCopyState("copying");

      const sortedVerseNumbers = Array.from(selectedVerses).sort(
        (a, b) => a - b
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
            // Consecutive verse, extend the current range
            rangeEnd = currentVerse;
          } else {
            // Non-consecutive verse, finish current range and start new one
            if (rangeStart === rangeEnd) {
              ranges.push(rangeStart.toString());
            } else {
              ranges.push(`${rangeStart}-${rangeEnd}`);
            }
            rangeStart = currentVerse;
            rangeEnd = currentVerse;
          }
        }

        // Add the final range
        if (rangeStart === rangeEnd) {
          ranges.push(rangeStart.toString());
        } else {
          ranges.push(`${rangeStart}-${rangeEnd}`);
        }

        verseRange = ranges.join(", ");
      }

      // Get book name in translation language
      const localizedBookName = getBookName(selectedBook, selectedTranslation);

      // Get translation name
      const translationName = selectedTranslation?.toUpperCase() || "KJV";

      // Create header: [Book in translation language] [Chapter] [Verse Range] [Translation]
      const header = `${localizedBookName} ${selectedChapter}:${verseRange} ${translationName}`;

      // Get verse content from global reference (set by ChapterReader)
      let content = "";
      if (
        window.currentChapterVerses &&
        window.currentChapterVerses.length > 0
      ) {
        const verseLines = sortedVerseNumbers.map((verseNumber) => {
          const verse = window.currentChapterVerses.find(
            (v) =>
              (v.verse || window.currentChapterVerses.indexOf(v) + 1) ===
              verseNumber
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
        // Send GA event for verse copy
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
      // Comparison mode copy logic - will be handled by the callback from VerseComparisonPanel
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

  return (
    <div className="app">
      <nav className="app-nav">
        <div className="nav-content">
          {/* Top row - Always visible */}
          <div className="nav-top">
            <div className="nav-brand">
              {/* Copy Button positioned on the left */}
              {(() => {
                const hasReaderSelections =
                  viewMode === "reader" && selectedVerses.size > 0;
                const hasComparisonSelections =
                  viewMode === "comparison" &&
                  (comparisonSyncEnabled
                    ? comparisonSelectedVerses.size > 0
                    : Object.values(comparisonIndependentSelections).some(
                        (set) => set && set.size > 0
                      ));

                const totalSelections =
                  viewMode === "reader"
                    ? selectedVerses.size
                    : comparisonSyncEnabled
                    ? comparisonSelectedVerses.size
                    : Object.values(comparisonIndependentSelections).reduce(
                        (total, set) => total + (set?.size || 0),
                        0
                      );

                // Generate share URL for current selections
                const shareUrl = (() => {
                  const currentSelections =
                    viewMode === "reader"
                      ? selectedVerses
                      : comparisonSyncEnabled
                      ? comparisonSelectedVerses
                      : new Set(
                          Object.values(
                            comparisonIndependentSelections
                          ).flatMap((set) => Array.from(set || []))
                        );

                  return generateShareUrl(
                    selectedBook,
                    selectedChapter,
                    selectedTranslation,
                    currentSelections
                  );
                })();

                return (
                  (hasReaderSelections || hasComparisonSelections) && (
                    <div className="copy-section copy-left">
                      <button
                        onClick={copySelectedVerses}
                        className={`copy-button ${copyState}`}
                        disabled={copyState === "copying"}
                        title={`Copy ${totalSelections} selected verse${
                          totalSelections > 1 ? "s" : ""
                        }`}
                      >
                        {copyState === "copying" && (
                          <>
                            ⏳ <span className="copy-text">Copying...</span>
                          </>
                        )}
                        {copyState === "copied" && (
                          <>
                            ✅ <span className="copy-text">Copied</span>
                          </>
                        )}
                        {copyState === "idle" && (
                          <>
                            📋 <span className="copy-text">Copy</span>
                            <span className="copy-count">
                              {totalSelections}
                            </span>
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
                  )
                );
              })()}

              <img
                src="/bcc_logo.png"
                alt="BlessingsBible Logo"
                className="app-logo"
              />
              <h1 className="app-title">BlessingsBible</h1>
            </div>

            <div className="nav-actions">
              {/* Mobile controls - dark mode toggle + menu toggle */}
              <div className="nav-mobile-controls">
                {/* Dark mode toggle - shown on mobile next to menu toggle */}
                <button
                  className="dark-mode-toggle"
                  onClick={toggleDarkMode}
                  aria-label={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
                  title={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
                >
                  {isDarkMode ? (
                    // Sun icon for light mode
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
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
                  ) : (
                    // Moon icon for dark mode
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  )}
                </button>

                {/* Mobile menu toggle */}
                <button
                  className="mobile-menu-toggle"
                  onClick={() => {
                    setShowMobileMenu((prev) => {
                      sendEvent({
                        action: "mobile_menu_toggle",
                        category: "ui",
                        label: !prev ? "open" : "close",
                      });
                      return !prev;
                    });
                  }}
                  aria-label="Toggle mobile menu"
                  aria-expanded={showMobileMenu}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    {showMobileMenu ? (
                      // Up arrow (^)
                      <polyline points="18,15 12,9 6,15"></polyline>
                    ) : (
                      // Down arrow (V)
                      <polyline points="6,9 12,15 18,9"></polyline>
                    )}
                  </svg>
                </button>
              </div>

              {/* Dark mode toggle for desktop - hidden on mobile */}
              <button
                className="dark-mode-toggle desktop-only"
                onClick={toggleDarkMode}
                aria-label={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
                title={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
              >
                {isDarkMode ? (
                  // Sun icon for light mode
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
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
                ) : (
                  // Moon icon for dark mode
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
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
      </nav>

      {loading && <div className="status-bar loading">Searching...</div>}
      {error && <div className="status-bar error">{error}</div>}

      <main className="app-main">
        <div className="view-switcher">
          <button
            className={`view-tab ${viewMode === "reader" ? "active" : ""}`}
            onClick={() => setViewMode("reader")}
          >
            Reader
          </button>
          <button
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
          />
        )}
      </main>
    </div>
  );
}

export default App;
