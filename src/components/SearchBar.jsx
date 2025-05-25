import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { getBookName, getEnglishBookName } from "../utils/translationMappings";
import "./SearchBar.css";

const SearchBar = ({ onSearch, selectedTranslation }) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [bibleStructure, setBibleStructure] = useState(null);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Load Bible structure data on component mount
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

  // Memoized helper function to find book (supports translated names)
  const findBook = useCallback(
    (searchTerm) => {
      if (!bibleStructure) return null;

      // First try to find by English name or abbreviation
      let book = bibleStructure.books.find((book) => {
        if (book.name.toLowerCase() === searchTerm.toLowerCase()) return true;
        return book.abbreviations.some(
          (abbr) => abbr.toLowerCase() === searchTerm.toLowerCase()
        );
      });

      if (book) return book;

      // If not found, try to find by translated name
      const englishName = getEnglishBookName(searchTerm, selectedTranslation);
      return bibleStructure.books.find((book) => book.name === englishName);
    },
    [bibleStructure, selectedTranslation]
  );

  // Optimized suggestions generator with memoization (supports translated names)
  const generateSuggestions = useCallback(
    (input) => {
      if (!input.trim() || !bibleStructure) return [];

      const trimmedInput = input.trim();
      const suggestions = [];

      // Parse the current input to determine what stage we're at
      const spaceMatch = trimmedInput.match(
        /^([a-zA-Z0-9\s\u4e00-\u9fff]+?)(\s+(\d+))?(\s*:(\d+)?)?$/
      );

      if (!spaceMatch) return [];

      const [, bookPart, , chapterPart, , versePart] = spaceMatch;
      const bookName = bookPart.trim();

      // Stage 1: Book suggestions only
      if (!chapterPart && !versePart) {
        const lowerInput = bookName.toLowerCase();

        // Search through books using both English and translated names
        for (const book of bibleStructure.books) {
          const translatedName = getBookName(book.name, selectedTranslation);
          let shouldAdd = false;

          // Check English name
          if (book.name.toLowerCase().includes(lowerInput)) {
            shouldAdd = true;
          }

          // Check translated name
          if (translatedName.toLowerCase().includes(lowerInput)) {
            shouldAdd = true;
          }

          // Check abbreviations if not already added
          if (!shouldAdd) {
            for (const abbr of book.abbreviations) {
              if (abbr.toLowerCase().includes(lowerInput)) {
                shouldAdd = true;
                break;
              }
            }
          }

          if (shouldAdd) {
            suggestions.push(translatedName);
            if (suggestions.length >= 8) break;
          }
        }

        return suggestions;
      }

      // Stage 2: Chapter suggestions (after book is complete)
      const book = findBook(bookName);
      if (!book) return [];

      const translatedBookName = getBookName(book.name, selectedTranslation);

      if (chapterPart && !versePart) {
        const chapterNum = parseInt(chapterPart);

        // If chapter number is partial or incomplete, suggest chapters
        if (isNaN(chapterNum) || chapterNum <= 0) {
          const maxChapters = Math.min(book.chapters, 10);
          for (let i = 1; i <= maxChapters; i++) {
            suggestions.push(`${translatedBookName} ${i}`);
          }
        } else if (chapterNum <= book.chapters) {
          // Valid chapter, suggest this chapter
          suggestions.push(`${translatedBookName} ${chapterNum}`);
        }

        return suggestions;
      }

      // Stage 3: Verse suggestions (after book and chapter are complete)
      if (versePart !== undefined) {
        const chapterNum = parseInt(chapterPart);

        if (chapterNum > 0 && chapterNum <= book.chapters) {
          const maxVerses = book.verses[chapterNum - 1];
          const verseNum = parseInt(versePart || "0");

          if (!versePart || versePart === "") {
            // Show first few verses when : is typed
            const limit = Math.min(maxVerses, 10);
            for (let i = 1; i <= limit; i++) {
              suggestions.push(`${translatedBookName} ${chapterNum}:${i}`);
            }
          } else if (verseNum > 0 && verseNum <= maxVerses) {
            // Valid verse number
            suggestions.push(`${translatedBookName} ${chapterNum}:${verseNum}`);
          }
        }

        return suggestions;
      }

      return suggestions;
    },
    [bibleStructure, findBook, selectedTranslation]
  );

  // Debounced input change handler
  const handleInputChange = useCallback(
    (e) => {
      const value = e.target.value;
      setQuery(value);
      setSelectedSuggestionIndex(-1);

      // Clear previous debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Debounce suggestions generation
      debounceTimerRef.current = setTimeout(() => {
        const newSuggestions = generateSuggestions(value);
        setSuggestions(newSuggestions);
        setShowSuggestions(newSuggestions.length > 0);
      }, 150); // 150ms debounce
    },
    [generateSuggestions]
  );

  // Helper function to determine autocomplete stage
  const determineAutoCompleteStage = useCallback(
    (input) => {
      if (!input.trim() || !bibleStructure) return "book";

      // Parse the input to determine the actual stage
      const spaceMatch = input
        .trim()
        .match(/^([a-zA-Z0-9\s\u4e00-\u9fff]+?)(\s+(\d+))?(\s*:(\d+)?)?$/);

      if (!spaceMatch) return "book";

      const [, bookPart, , chapterPart, , versePart] = spaceMatch;

      // Check if the book part matches a known book
      const book = findBook(bookPart.trim());

      if (!book) return "book";

      // If we have a valid book and no chapter number, we're still at book stage
      if (!chapterPart) return "book";

      // If we have chapter but no verse separator, we're at chapter stage
      if (!input.includes(":")) return "chapter";

      // If we have verse separator, we're at verse stage
      return "verse";
    },
    [bibleStructure, findBook]
  );

  // Optimized suggestion selection
  const selectSuggestion = useCallback(
    (suggestion) => {
      setQuery(suggestion);

      // Determine what stage we're at and whether to continue autocomplete
      const currentStage = determineAutoCompleteStage(suggestion);

      if (currentStage === "book") {
        // After selecting book, add space and show chapter suggestions
        const bookWithSpace = suggestion + " ";
        setQuery(bookWithSpace);
        const newSuggestions = generateSuggestions(bookWithSpace);
        setSuggestions(newSuggestions);
        setShowSuggestions(newSuggestions.length > 0);
      } else if (currentStage === "chapter") {
        // After selecting chapter, add colon and show verse suggestions
        const chapterWithColon = suggestion + ":";
        setQuery(chapterWithColon);
        const newSuggestions = generateSuggestions(chapterWithColon);
        setSuggestions(newSuggestions);
        setShowSuggestions(newSuggestions.length > 0);
      } else {
        // Complete verse reference, close suggestions
        setShowSuggestions(false);
      }

      setSelectedSuggestionIndex(-1);
      inputRef.current?.focus();
    },
    [determineAutoCompleteStage, generateSuggestions]
  );

  // Optimized keyboard navigation
  const handleKeyDown = useCallback(
    (e) => {
      if (!showSuggestions) {
        if (e.key === "Enter") {
          handleSearch();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedSuggestionIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case "Tab":
          e.preventDefault();
          if (selectedSuggestionIndex >= 0) {
            selectSuggestion(suggestions[selectedSuggestionIndex]);
          } else if (suggestions.length > 0) {
            selectSuggestion(suggestions[0]);
          }
          break;
        case "Enter":
          e.preventDefault();
          if (selectedSuggestionIndex >= 0) {
            selectSuggestion(suggestions[selectedSuggestionIndex]);
          } else {
            handleSearch();
          }
          break;
        case "Escape":
          setShowSuggestions(false);
          setSelectedSuggestionIndex(-1);
          break;
      }
    },
    [showSuggestions, selectedSuggestionIndex, suggestions, selectSuggestion]
  );

  const handleSearch = useCallback(() => {
    if (query.trim()) {
      // Convert translated book names back to English for the search
      let searchQuery = query.trim();

      // Parse the query to extract book name
      const spaceMatch = searchQuery.match(
        /^([a-zA-Z0-9\s\u4e00-\u9fff]+?)(\s+\d+.*)?$/
      );
      if (spaceMatch) {
        const [, bookPart, remainder] = spaceMatch;
        const englishBookName = getEnglishBookName(
          bookPart.trim(),
          selectedTranslation
        );
        searchQuery = englishBookName + (remainder || "");
      }

      onSearch(searchQuery);
      setShowSuggestions(false);
    }
  }, [query, onSearch, selectedTranslation]);

  const handleBlur = useCallback((e) => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(document.activeElement)) {
        setShowSuggestions(false);
      }
    }, 150);
  }, []);

  const handleFocus = useCallback(() => {
    if (query && bibleStructure) {
      const newSuggestions = generateSuggestions(query);
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
    }
  }, [query, bibleStructure, generateSuggestions]);

  // Memoized suggestion items for better performance
  const suggestionItems = useMemo(() => {
    return suggestions.map((suggestion, index) => (
      <li
        key={`${suggestion}-${index}`}
        className={`suggestion ${
          index === selectedSuggestionIndex ? "selected" : ""
        }`}
        onClick={() => selectSuggestion(suggestion)}
        onMouseEnter={() => setSelectedSuggestionIndex(index)}
      >
        {suggestion}
      </li>
    ));
  }, [suggestions, selectedSuggestionIndex, selectSuggestion]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="search-bar">
      <div className={`search-container ${showSuggestions ? "active" : ""}`}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder="Search verses"
          className="search-input"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
        />
        {query.trim() && (
          <button
            onClick={() => {
              setQuery("");
              setSuggestions([]);
              setShowSuggestions(false);
              inputRef.current?.focus();
            }}
            className="clear-button"
            type="button"
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
        <button
          onClick={handleSearch}
          className={`search-button ${!query.trim() ? "disabled" : ""}`}
          type="button"
          disabled={!query.trim()}
          title="Search verses"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
        </button>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div ref={suggestionsRef} className="suggestions">
          <ul className="suggestions-list">{suggestionItems}</ul>
        </div>
      )}
    </div>
  );
};

export default React.memo(SearchBar);
