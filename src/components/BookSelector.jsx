import React, { useState, useEffect, useId, useRef } from "react";
import { getBookName, getTestamentLabel } from "../utils/translationMappings";
import "./BookSelector.css";

const BookSelector = ({
  bibleStructure,
  selectedBook,
  selectedChapter,
  onBookChange,
  onChapterChange,
  selectedTranslation,
  integrated = false,
  onPreviousChapter,
  onNextChapter,
  isPrevDisabled,
  isNextDisabled,
}) => {
  const [showBooks, setShowBooks] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOldTestament, setShowOldTestament] = useState(true);
  const [showNewTestament, setShowNewTestament] = useState(true);
  const [isMobileBookSheet, setIsMobileBookSheet] = useState(false);
  const bookDropdownRef = useRef(null);
  const chapterDropdownRef = useRef(null);
  const bookTriggerRef = useRef(null);
  const bookMenuRef = useRef(null);
  const chapterTriggerRef = useRef(null);
  const chapterMenuRef = useRef(null);
  const bookMenuHeadingRef = useRef(null);
  const searchInputRef = useRef(null);
  const selectedBookRef = useRef(null);
  const idPrefix = useId();
  const bookMenuId = `${idPrefix}-book-menu`;
  const chapterMenuId = `${idPrefix}-chapter-menu`;
  const bookSearchId = `${idPrefix}-book-search`;

  // Keep modal semantics and scroll locking aligned with the mobile sheet CSS.
  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(max-width: 768px)");
    if (!mediaQuery) return undefined;

    const updateViewport = () => setIsMobileBookSheet(mediaQuery.matches);
    updateViewport();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", updateViewport);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(updateViewport);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", updateViewport);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(updateViewport);
      }
    };
  }, []);

  useEffect(() => {
    if ((!showBooks && !showChapters) || !isMobileBookSheet) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showBooks, showChapters, isMobileBookSheet]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        bookDropdownRef.current &&
        !bookDropdownRef.current.contains(event.target)
      ) {
        const focusWasInMenu = bookMenuRef.current?.contains(
          document.activeElement,
        );
        setShowBooks(false);
        setSearchQuery("");
        if (focusWasInMenu) {
          window.requestAnimationFrame(() => {
            const activeElement = document.activeElement;
            if (
              activeElement === document.body ||
              bookMenuRef.current?.contains(activeElement)
            ) {
              bookTriggerRef.current?.focus();
            }
          });
        }
      }
      if (
        chapterDropdownRef.current &&
        !chapterDropdownRef.current.contains(event.target)
      ) {
        const focusWasInMenu = chapterMenuRef.current?.contains(
          document.activeElement,
        );
        setShowChapters(false);
        if (focusWasInMenu) {
          window.requestAnimationFrame(() => {
            if (document.activeElement === document.body) {
              chapterTriggerRef.current?.focus();
            }
          });
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Avoid opening the virtual keyboard until mobile users choose to search.
  useEffect(() => {
    if (!showBooks) return undefined;

    const focusTimer = window.setTimeout(() => {
      const shouldAutoFocusSearch = window.matchMedia(
        "(min-width: 769px) and (pointer: fine)",
      ).matches;

      if (shouldAutoFocusSearch) {
        searchInputRef.current?.focus();
      } else {
        bookMenuHeadingRef.current?.focus({ preventScroll: true });
      }

      selectedBookRef.current?.scrollIntoView({
        block: "center",
        behavior: "instant",
      });
    }, 100);

    return () => window.clearTimeout(focusTimer);
  }, [showBooks]);

  useEffect(() => {
    if (!showChapters) return undefined;

    const focusFrame = window.requestAnimationFrame(() => {
      const initialTarget =
        chapterMenuRef.current?.querySelector(".chapter-item.active") ||
        chapterMenuRef.current?.querySelector(".chapter-item") ||
        chapterMenuRef.current?.querySelector("button");
      initialTarget?.focus({ preventScroll: true });
      initialTarget?.scrollIntoView({ block: "nearest", behavior: "instant" });
    });

    return () => window.cancelAnimationFrame(focusFrame);
  }, [showChapters, selectedChapter]);

  if (!bibleStructure) return null;

  const currentBook = bibleStructure.books.find(
    (book) => book.name === selectedBook,
  );
  const totalChapters = currentBook?.chapters || 0;
  const localizedBookName = selectedBook
    ? getBookName(selectedBook, selectedTranslation)
    : "Select Book";

  const closeBookMenu = (restoreFocus = false) => {
    setShowBooks(false);
    setSearchQuery("");
    if (restoreFocus) {
      window.requestAnimationFrame(() => bookTriggerRef.current?.focus());
    }
  };

  const handleBookDialogKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeBookMenu(true);
      return;
    }

    if (event.key !== "Tab" || !isMobileBookSheet || !bookMenuRef.current) {
      return;
    }

    const focusableElements = Array.from(
      bookMenuRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusableElements.length === 0) return;

    const currentIndex = focusableElements.indexOf(document.activeElement);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && currentIndex <= 0) {
      event.preventDefault();
      lastElement.focus();
    } else if (
      !event.shiftKey &&
      (currentIndex === -1 || currentIndex === focusableElements.length - 1)
    ) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  const handleBookSelect = (book) => {
    onBookChange(book.name);
    onChapterChange(1); // Start at chapter 1 when selecting a new book
    closeBookMenu(true);
  };

  const closeChapterMenu = (restoreFocus = false) => {
    setShowChapters(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => chapterTriggerRef.current?.focus());
    }
  };

  const handleChapterSelect = (chapterNumber) => {
    onChapterChange(chapterNumber);
    closeChapterMenu(true);
  };

  const handleChapterDialogKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeChapterMenu(true);
      return;
    }

    if (event.key !== "Tab" || !isMobileBookSheet || !chapterMenuRef.current) {
      return;
    }

    const focusableElements = Array.from(
      chapterMenuRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  const handlePreviousChapter = () => {
    setShowChapters(false);
    if (onPreviousChapter) {
      onPreviousChapter();
    } else if (selectedChapter > 1) {
      onChapterChange(selectedChapter - 1);
    }
  };

  const handleNextChapter = () => {
    setShowChapters(false);
    if (onNextChapter) {
      onNextChapter();
    } else if (selectedChapter < totalChapters) {
      onChapterChange(selectedChapter + 1);
    }
  };

  const previousDisabled = isPrevDisabled ?? selectedChapter === 1;
  const nextDisabled =
    isNextDisabled ??
    (selectedChapter === totalChapters || totalChapters === 0);

  // Group books by testament
  const oldTestament = bibleStructure.books.slice(0, 39);
  const newTestament = bibleStructure.books.slice(39);

  // Filter books based on search query
  const filterBooks = (books) => {
    if (!searchQuery.trim()) return books;
    const query = searchQuery.toLowerCase();
    return books.filter((book) => {
      const localizedName = getBookName(
        book.name,
        selectedTranslation,
      ).toLowerCase();
      const englishName = book.name.toLowerCase();
      return localizedName.includes(query) || englishName.includes(query);
    });
  };

  const filteredOldTestament = filterBooks(oldTestament);
  const filteredNewTestament = filterBooks(newTestament);

  if (integrated) {
    return (
      <div className="book-selector integrated">
        <div className="chapter-display-wrapper">
          <div className="book-dropdown" ref={bookDropdownRef}>
            <button
              ref={bookTriggerRef}
              className={`chapter-display-button book-selector-btn ${
                showBooks ? "active" : ""
              }`}
              onClick={() => setShowBooks(!showBooks)}
              title={`Change book, current book ${localizedBookName}`}
              aria-label={`Choose Bible book, current book ${localizedBookName}`}
              aria-expanded={showBooks}
              aria-haspopup="dialog"
              aria-controls={bookMenuId}
            >
              <div className="book-title-section">
                <div className="book-title">{localizedBookName}</div>
                <div className="clickable-indicator">
                  <svg
                    className="chevron-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6,9 12,15 18,9"></polyline>
                  </svg>
                </div>
              </div>
              <div className="book-subtitle">Tap to browse books</div>
            </button>

            {showBooks && (
              <div
                className="book-menu-backdrop"
                aria-hidden="true"
                onClick={() => closeBookMenu(true)}
              />
            )}

            {showBooks && (
              <div
                ref={bookMenuRef}
                className="dropdown-menu book-menu"
                id={bookMenuId}
                role="dialog"
                aria-modal={isMobileBookSheet ? "true" : undefined}
                aria-label="Choose a Bible book"
                onKeyDown={handleBookDialogKeyDown}
              >
                <div className="menu-header">
                  <h3 ref={bookMenuHeadingRef} tabIndex={-1}>
                    Choose a Book
                  </h3>
                  <button
                    className="close-button"
                    onClick={() => closeBookMenu(true)}
                    aria-label="Close menu"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
                <div className="book-search-container">
                  <label className="visually-hidden" htmlFor={bookSearchId}>
                    Search books
                  </label>
                  <svg
                    className="search-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <input
                    id={bookSearchId}
                    ref={searchInputRef}
                    type="text"
                    className="book-search-input"
                    placeholder="Search books..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="search-clear"
                      onClick={() => {
                        setSearchQuery("");
                        searchInputRef.current?.focus();
                      }}
                      aria-label="Clear search"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  )}
                </div>
                <div className="books-scroll-container">
                  {filteredOldTestament.length > 0 && (
                    <div className="testament-section">
                      <button
                        className="section-header sticky-header collapsible"
                        onClick={() => setShowOldTestament(!showOldTestament)}
                        aria-expanded={showOldTestament}
                      >
                        <div className="section-header-left">
                          <span>
                            {getTestamentLabel(
                              "oldTestament",
                              selectedTranslation,
                            )}
                          </span>
                          <span className="section-count">
                            {filteredOldTestament.length}
                          </span>
                        </div>
                        <svg
                          className={`section-chevron ${showOldTestament ? "expanded" : ""}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="6,9 12,15 18,9"></polyline>
                        </svg>
                      </button>
                      {showOldTestament && (
                        <div className="books-list">
                          {filteredOldTestament.map((book) => (
                            <button
                              key={book.name}
                              ref={
                                selectedBook === book.name
                                  ? selectedBookRef
                                  : null
                              }
                              className={`book-item ${
                                selectedBook === book.name ? "active" : ""
                              }`}
                              onClick={() => handleBookSelect(book)}
                            >
                              <span className="book-name">
                                {getBookName(book.name, selectedTranslation)}
                              </span>
                              {selectedBook === book.name && (
                                <svg
                                  className="check-icon"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <polyline points="20,6 9,17 4,12"></polyline>
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {filteredNewTestament.length > 0 && (
                    <div className="testament-section">
                      <button
                        className="section-header sticky-header collapsible"
                        onClick={() => setShowNewTestament(!showNewTestament)}
                        aria-expanded={showNewTestament}
                      >
                        <div className="section-header-left">
                          <span>
                            {getTestamentLabel(
                              "newTestament",
                              selectedTranslation,
                            )}
                          </span>
                          <span className="section-count">
                            {filteredNewTestament.length}
                          </span>
                        </div>
                        <svg
                          className={`section-chevron ${showNewTestament ? "expanded" : ""}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="6,9 12,15 18,9"></polyline>
                        </svg>
                      </button>
                      {showNewTestament && (
                        <div className="books-list">
                          {filteredNewTestament.map((book) => (
                            <button
                              key={book.name}
                              ref={
                                selectedBook === book.name
                                  ? selectedBookRef
                                  : null
                              }
                              className={`book-item ${
                                selectedBook === book.name ? "active" : ""
                              }`}
                              onClick={() => handleBookSelect(book)}
                            >
                              <span className="book-name">
                                {getBookName(book.name, selectedTranslation)}
                              </span>
                              {selectedBook === book.name && (
                                <svg
                                  className="check-icon"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <polyline points="20,6 9,17 4,12"></polyline>
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {filteredOldTestament.length === 0 &&
                    filteredNewTestament.length === 0 && (
                      <div className="no-results">
                        <p>No books found for "{searchQuery}"</p>
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>

          {selectedBook && (
            <div className="chapter-dropdown" ref={chapterDropdownRef}>
              <div className="chapter-control-group">
                <button
                  type="button"
                  className="chapter-nav-btn"
                  onClick={handlePreviousChapter}
                  disabled={previousDisabled}
                  aria-label="Previous chapter"
                >
                  ‹
                </button>
                <button
                  ref={chapterTriggerRef}
                  type="button"
                  className={`chapter-display-button chapter-selector-btn ${
                    showChapters ? "active" : ""
                  }`}
                  onClick={() => setShowChapters(!showChapters)}
                  title={`Choose chapter, current chapter ${selectedChapter} of ${totalChapters}`}
                  aria-label={`Choose chapter, current chapter ${selectedChapter} of ${totalChapters}`}
                  aria-expanded={showChapters}
                  aria-haspopup="dialog"
                  aria-controls={chapterMenuId}
                >
                  <div className="chapter-info-section">
                    <div className="chapter-info">
                      <span className="chapter-label">Chapter</span>
                      <span className="chapter-number">{selectedChapter}</span>
                      <span className="chapter-total">of {totalChapters}</span>
                      <span className="chapter-compact-display">
                        <span className="chapter-compact-label">Ch</span>
                        <span className="current-chapter">
                          {selectedChapter}
                        </span>
                        <span className="chapter-separator">/</span>
                        <span className="total-chapters">{totalChapters}</span>
                      </span>
                    </div>
                    <div className="clickable-indicator">
                      <svg
                        className="chevron-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <polyline points="6,9 12,15 18,9"></polyline>
                      </svg>
                    </div>
                  </div>
                  <div className="chapter-subtitle">Tap to jump chapters</div>
                </button>
                <button
                  type="button"
                  className="chapter-nav-btn"
                  onClick={handleNextChapter}
                  disabled={nextDisabled}
                  aria-label="Next chapter"
                >
                  ›
                </button>
              </div>

              {showChapters && (
                <div
                  className="book-menu-backdrop"
                  aria-hidden="true"
                  onClick={() => closeChapterMenu(true)}
                />
              )}

              {showChapters && (
                <div
                  ref={chapterMenuRef}
                  className="dropdown-menu chapters-menu"
                  id={chapterMenuId}
                  role="dialog"
                  aria-modal={isMobileBookSheet ? "true" : undefined}
                  aria-label="Choose a chapter"
                  onKeyDown={handleChapterDialogKeyDown}
                >
                  <div className="menu-header">
                    <h3>
                      Chapter {selectedChapter} of {totalChapters}
                    </h3>
                    <button
                      className="close-button"
                      onClick={() => closeChapterMenu(true)}
                      aria-label="Close menu"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                  <div className="chapters-grid">
                    {Array.from({ length: totalChapters }, (_, i) => i + 1).map(
                      (chapterNum) => (
                        <button
                          key={chapterNum}
                          className={`chapter-item ${
                            selectedChapter === chapterNum ? "active" : ""
                          }`}
                          onClick={() => handleChapterSelect(chapterNum)}
                        >
                          <span className="chapter-text">{chapterNum}</span>
                          {selectedChapter === chapterNum && (
                            <svg
                              className="check-icon"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <polyline points="20,6 9,17 4,12"></polyline>
                            </svg>
                          )}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="book-selector">
      <div className="selector-controls">
        <div className="book-dropdown" ref={bookDropdownRef}>
          <button
            ref={bookTriggerRef}
            type="button"
            className="selector-button"
            onClick={() => setShowBooks(!showBooks)}
            aria-expanded={showBooks}
            aria-haspopup="dialog"
            aria-controls={bookMenuId}
          >
            <span className="button-text">
              {selectedBook
                ? getBookName(selectedBook, selectedTranslation)
                : "Select Book"}
            </span>
            <span className="button-icon">›</span>
          </button>

          {showBooks && (
            <div
              className="book-menu-backdrop"
              aria-hidden="true"
              onClick={() => closeBookMenu(true)}
            />
          )}

          {showBooks && (
            <div
              ref={bookMenuRef}
              className="dropdown-menu"
              id={bookMenuId}
              role="dialog"
              aria-modal={isMobileBookSheet ? "true" : undefined}
              aria-label="Choose a Bible book"
              onKeyDown={handleBookDialogKeyDown}
            >
              <div className="testament-section">
                <div className="section-header">
                  {getTestamentLabel("oldTestament", selectedTranslation)}
                </div>
                <div className="books-list">
                  {oldTestament.map((book) => (
                    <button
                      key={book.name}
                      className={`book-item ${
                        selectedBook === book.name ? "active" : ""
                      }`}
                      onClick={() => handleBookSelect(book)}
                    >
                      {getBookName(book.name, selectedTranslation)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="testament-section">
                <div className="section-header">
                  {getTestamentLabel("newTestament", selectedTranslation)}
                </div>
                <div className="books-list">
                  {newTestament.map((book) => (
                    <button
                      key={book.name}
                      className={`book-item ${
                        selectedBook === book.name ? "active" : ""
                      }`}
                      onClick={() => handleBookSelect(book)}
                    >
                      {getBookName(book.name, selectedTranslation)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {selectedBook && (
          <div className="chapter-dropdown" ref={chapterDropdownRef}>
            <div className="chapter-control-group">
              <button
                type="button"
                className="chapter-nav-btn"
                onClick={handlePreviousChapter}
                disabled={previousDisabled}
                aria-label="Previous chapter"
              >
                ‹
              </button>
              <button
                ref={chapterTriggerRef}
                type="button"
                className="selector-button chapter-selector-btn"
                onClick={() => setShowChapters(!showChapters)}
                aria-expanded={showChapters}
                aria-haspopup="dialog"
                aria-controls={chapterMenuId}
              >
                <span className="button-text">Chapter {selectedChapter}</span>
                <span className="button-icon">›</span>
              </button>
              <button
                type="button"
                className="chapter-nav-btn"
                onClick={handleNextChapter}
                disabled={nextDisabled}
                aria-label="Next chapter"
              >
                ›
              </button>
            </div>

            {showChapters && (
              <div
                className="book-menu-backdrop"
                aria-hidden="true"
                onClick={() => closeChapterMenu(true)}
              />
            )}

            {showChapters && (
              <div
                ref={chapterMenuRef}
                className="dropdown-menu chapters-menu"
                id={chapterMenuId}
                role="dialog"
                aria-modal={isMobileBookSheet ? "true" : undefined}
                aria-label="Choose a chapter"
                onKeyDown={handleChapterDialogKeyDown}
              >
                <div className="chapters-grid">
                  {Array.from({ length: totalChapters }, (_, i) => i + 1).map(
                    (chapterNum) => (
                      <button
                        key={chapterNum}
                        className={`chapter-item ${
                          selectedChapter === chapterNum ? "active" : ""
                        }`}
                        onClick={() => handleChapterSelect(chapterNum)}
                      >
                        {chapterNum}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookSelector;
