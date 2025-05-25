import React, { useState, useEffect, useRef } from "react";
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
}) => {
  const [showBooks, setShowBooks] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [showOldTestament, setShowOldTestament] = useState(true);
  const [showNewTestament, setShowNewTestament] = useState(true);
  const bookDropdownRef = useRef(null);
  const chapterDropdownRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        bookDropdownRef.current &&
        !bookDropdownRef.current.contains(event.target)
      ) {
        setShowBooks(false);
      }
      if (
        chapterDropdownRef.current &&
        !chapterDropdownRef.current.contains(event.target)
      ) {
        setShowChapters(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (!bibleStructure) return null;

  const currentBook = bibleStructure.books.find(
    (book) => book.name === selectedBook
  );
  const totalChapters = currentBook?.chapters || 0;

  const handleBookSelect = (book) => {
    onBookChange(book.name);
    onChapterChange(1); // Start at chapter 1 when selecting a new book
    setShowBooks(false);
  };

  const handleChapterSelect = (chapterNumber) => {
    onChapterChange(chapterNumber);
    setShowChapters(false);
  };

  // Group books by testament
  const oldTestament = bibleStructure.books.slice(0, 39);
  const newTestament = bibleStructure.books.slice(39);

  if (integrated) {
    return (
      <div className="book-selector integrated">
        <div className="chapter-display-wrapper">
          <div className="book-dropdown" ref={bookDropdownRef}>
            <button
              className={`chapter-display-button book-selector-btn ${
                showBooks ? "active" : ""
              }`}
              onClick={() => setShowBooks(!showBooks)}
              title="Click to change book"
              aria-expanded={showBooks}
            >
              <div className="book-title-section">
                <div className="book-title">
                  {selectedBook
                    ? getBookName(selectedBook, selectedTranslation)
                    : "Select Book"}
                </div>
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
              <div className="dropdown-menu book-menu">
                <div className="menu-header">
                  <h3>Choose a Book</h3>
                  <button
                    className="close-button"
                    onClick={() => setShowBooks(false)}
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
                <div className="testament-section">
                  <button
                    className="section-header collapsible"
                    onClick={() => setShowOldTestament(!showOldTestament)}
                  >
                    <span>
                      {getTestamentLabel("oldTestament", selectedTranslation)}
                    </span>
                    <svg
                      className={`chevron-icon ${
                        showOldTestament ? "expanded" : ""
                      }`}
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
                      {oldTestament.map((book) => (
                        <button
                          key={book.name}
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

                <div className="testament-section">
                  <button
                    className="section-header collapsible"
                    onClick={() => setShowNewTestament(!showNewTestament)}
                  >
                    <span>
                      {getTestamentLabel("newTestament", selectedTranslation)}
                    </span>
                    <svg
                      className={`chevron-icon ${
                        showNewTestament ? "expanded" : ""
                      }`}
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
                      {newTestament.map((book) => (
                        <button
                          key={book.name}
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
              </div>
            )}
          </div>

          {selectedBook && (
            <div className="chapter-dropdown" ref={chapterDropdownRef}>
              <button
                className={`chapter-display-button chapter-selector-btn ${
                  showChapters ? "active" : ""
                }`}
                onClick={() => setShowChapters(!showChapters)}
                title="Click to jump to chapter"
                aria-expanded={showChapters}
              >
                <div className="chapter-info-section">
                  <div
                    className={`chapter-nav-btn ${
                      selectedChapter === 1 ? "disabled" : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectedChapter > 1)
                        handleChapterSelect(selectedChapter - 1);
                    }}
                    role="button"
                    tabIndex={selectedChapter === 1 ? -1 : 0}
                    aria-label="Previous Chapter"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        if (selectedChapter > 1)
                          handleChapterSelect(selectedChapter - 1);
                      }
                    }}
                  >
                    ‹
                  </div>
                  <div className="chapter-info">
                    <span className="chapter-label">Chapter</span>
                    <span className="chapter-number">{selectedChapter}</span>
                    <span className="chapter-total">of {totalChapters}</span>
                  </div>
                  <div
                    className={`chapter-nav-btn ${
                      selectedChapter === totalChapters ? "disabled" : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectedChapter < totalChapters)
                        handleChapterSelect(selectedChapter + 1);
                    }}
                    role="button"
                    tabIndex={selectedChapter === totalChapters ? -1 : 0}
                    aria-label="Next Chapter"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        if (selectedChapter < totalChapters)
                          handleChapterSelect(selectedChapter + 1);
                      }
                    }}
                  >
                    ›
                  </div>
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
                <div className="chapter-subtitle">Tap to jump chapters</div>
              </button>

              {showChapters && (
                <div className="dropdown-menu chapters-menu">
                  <div className="menu-header">
                    <h3>
                      Chapter {selectedChapter} of {totalChapters}
                    </h3>
                    <button
                      className="close-button"
                      onClick={() => setShowChapters(false)}
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
                      )
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
            className="selector-button"
            onClick={() => setShowBooks(!showBooks)}
          >
            <span className="button-text">
              {selectedBook
                ? getBookName(selectedBook, selectedTranslation)
                : "Select Book"}
            </span>
            <span className="button-icon">›</span>
          </button>

          {showBooks && (
            <div className="dropdown-menu">
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
            <button
              className="selector-button"
              onClick={() => setShowChapters(!showChapters)}
            >
              <button
                className="chapter-nav-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedChapter > 1)
                    handleChapterSelect(selectedChapter - 1);
                }}
                disabled={selectedChapter === 1}
                aria-label="Previous Chapter"
              >
                ‹
              </button>
              <span className="button-text">Chapter {selectedChapter}</span>
              <button
                className="chapter-nav-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedChapter < totalChapters)
                    handleChapterSelect(selectedChapter + 1);
                }}
                disabled={selectedChapter === totalChapters}
                aria-label="Next Chapter"
              >
                ›
              </button>
              <span className="button-icon">›</span>
            </button>

            {showChapters && (
              <div className="dropdown-menu chapters-menu">
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
                    )
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
