import React, { useState, useEffect, useRef } from "react";
import SearchBar from "./components/SearchBar";
import TranslationSwitcher from "./components/TranslationSwitcher";
import BookSelector from "./components/BookSelector";
import ChapterReader from "./components/ChapterReader";
import { fetchVerses } from "./services/bibleApi";
import "./App.css";

function App() {
  const [selectedTranslation, setSelectedTranslation] = useState("TB");
  const [verses, setVerses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bibleStructure, setBibleStructure] = useState(null);
  const [selectedBook, setSelectedBook] = useState("John");
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [highlightedVerse, setHighlightedVerse] = useState(null);
  const [selectedVerses, setSelectedVerses] = useState(new Set());
  const [copyState, setCopyState] = useState("idle");
  const [showMobileMenu, setShowMobileMenu] = useState(true);
  const mobileMenuRef = useRef(null);

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

  // Load Bible structure data and random verse on every reload
  useEffect(() => {
    const loadBibleStructure = async () => {
      try {
        const response = await fetch("/bible-structure.json");
        const data = await response.json();
        setBibleStructure(data);

        // Load random verse on every page load
        await loadRandomVerse(data);
      } catch (error) {
        console.error("Failed to load Bible structure:", error);
      }
    };
    loadBibleStructure();
  }, [selectedTranslation]);

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
  };

  const handleChapterChange = (chapterNumber, bookName = null) => {
    setSelectedChapter(chapterNumber);
    if (bookName) {
      setSelectedBook(bookName);
    }
    // Clear highlighting when manually changing chapters
    setHighlightedVerse(null);
    setVerses([]);
    setError(null);
  };

  // Navigation handlers for the navbar
  const handlePreviousChapter = () => {
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

    // Get verse content from global reference (set by ChapterReader)
    let content = "";
    if (window.currentChapterVerses && window.currentChapterVerses.length > 0) {
      const verseTexts = sortedVerseNumbers.map((verseNumber) => {
        const verse = window.currentChapterVerses.find(
          (v) =>
            (v.verse || window.currentChapterVerses.indexOf(v) + 1) ===
            verseNumber
        );
        return verse?.text || "";
      });
      content = verseTexts.join(" ");
    }

    const textToCopy = content ? `${header}\n${content}` : header;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
      setCopyState("idle");
    }
  };

  return (
    <div className="app">
      <nav className="app-nav">
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

              {/* Mobile menu toggle */}
              <button
                className="mobile-menu-toggle"
                onClick={() => {
                  setShowMobileMenu(!showMobileMenu);
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

            <div className="nav-actions">
              {/* Copy Button */}
              {selectedVerses.size > 0 && (
                <div className="copy-section">
                  <button
                    onClick={copySelectedVerses}
                    className={`copy-button ${copyState}`}
                    disabled={copyState === "copying"}
                    title={`Copy ${selectedVerses.size} selected verse${
                      selectedVerses.size > 1 ? "s" : ""
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
                          {selectedVerses.size}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
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
      </main>
    </div>
  );
}

export default App;
