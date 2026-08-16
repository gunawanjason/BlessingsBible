import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  completeSearchSuggestion,
  determineSearchStage,
  generateSearchSuggestions,
  isCompleteSearchReference,
  localizeSearchQuery,
  normalizeSearchQuery,
} from "../utils/searchAutocomplete";
import "./SearchBar.css";

const SearchBar = ({ onSearch, selectedTranslation, bibleStructure }) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const blurTimerRef = useRef(null);
  const isComposingRef = useRef(false);
  const previousTranslationRef = useRef(selectedTranslation);
  const skipNextFocusSuggestionsRef = useRef(false);

  const generateSuggestions = useCallback(
    (input) =>
      generateSearchSuggestions(input, bibleStructure, selectedTranslation),
    [bibleStructure, selectedTranslation],
  );

  const updateSuggestions = useCallback(
    (value, reveal = true) => {
      const newSuggestions = generateSuggestions(value);
      setSuggestions(newSuggestions);
      setShowSuggestions(reveal && newSuggestions.length > 0);
      setSelectedSuggestionIndex(-1);
    },
    [generateSuggestions],
  );

  const handleInputChange = useCallback(
    (e) => {
      const value = e.target.value;
      setQuery(value);
      setSelectedSuggestionIndex(-1);

      if (isComposingRef.current || e.nativeEvent.isComposing) {
        setShowSuggestions(false);
        return;
      }

      updateSuggestions(value);
    },
    [updateSuggestions],
  );

  const selectSuggestion = useCallback(
    (suggestion) => {
      setQuery(suggestion);

      const currentStage = determineSearchStage(
        suggestion,
        bibleStructure,
        selectedTranslation,
      );
      const completedValue = completeSearchSuggestion(
        suggestion,
        bibleStructure,
        selectedTranslation,
      );

      if (currentStage === "book") {
        setQuery(completedValue);
        updateSuggestions(completedValue);
      } else if (currentStage === "chapter") {
        setQuery(completedValue);
        updateSuggestions(completedValue);
      } else {
        setQuery(completedValue);
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
      }

      inputRef.current?.focus();
    },
    [bibleStructure, selectedTranslation, updateSuggestions],
  );

  const handleSearch = useCallback(() => {
    const currentQuery = inputRef.current?.value ?? query;
    if (!currentQuery.trim()) return;

    onSearch(
      normalizeSearchQuery(currentQuery, selectedTranslation, bibleStructure),
    );
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  }, [bibleStructure, onSearch, query, selectedTranslation]);

  const handleKeyDown = useCallback(
    (e) => {
      if (
        isComposingRef.current ||
        e.nativeEvent.isComposing ||
        e.keyCode === 229
      ) {
        return;
      }

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
            prev < suggestions.length - 1 ? prev + 1 : prev,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case "Tab":
          if (e.shiftKey) {
            setShowSuggestions(false);
            setSelectedSuggestionIndex(-1);
            break;
          }

          if (suggestions.length > 0) {
            e.preventDefault();
            selectSuggestion(
              suggestions[selectedSuggestionIndex] ?? suggestions[0],
            );
          }
          break;
        case "Enter":
          e.preventDefault();
          if (selectedSuggestionIndex >= 0) {
            selectSuggestion(suggestions[selectedSuggestionIndex]);
          } else if (
            isCompleteSearchReference(
              e.currentTarget.value,
              bibleStructure,
              selectedTranslation,
            )
          ) {
            handleSearch();
          } else {
            selectSuggestion(suggestions[0]);
          }
          break;
        case "Escape":
          setShowSuggestions(false);
          setSelectedSuggestionIndex(-1);
          break;
      }
    },
    [
      handleSearch,
      bibleStructure,
      selectSuggestion,
      selectedSuggestionIndex,
      selectedTranslation,
      showSuggestions,
      suggestions,
    ],
  );

  const handleBlur = useCallback(() => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
    }
    blurTimerRef.current = setTimeout(() => {
      blurTimerRef.current = null;
      if (!suggestionsRef.current?.contains(document.activeElement)) {
        setShowSuggestions(false);
      }
    }, 150);
  }, []);

  const handleFocus = useCallback(() => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    if (skipNextFocusSuggestionsRef.current) {
      skipNextFocusSuggestionsRef.current = false;
      return;
    }
    if (query && bibleStructure) {
      updateSuggestions(query);
    }
  }, [query, bibleStructure, updateSuggestions]);

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(
    (event) => {
      isComposingRef.current = false;
      const value = event.currentTarget.value;
      setQuery(value);
      updateSuggestions(value);
    },
    [updateSuggestions],
  );

  useEffect(() => {
    const previousTranslation = previousTranslationRef.current;
    if (previousTranslation === selectedTranslation) return;

    if (!query.trim()) {
      previousTranslationRef.current = selectedTranslation;
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (!bibleStructure) return;

    const localizedQuery = localizeSearchQuery(
      query,
      bibleStructure,
      previousTranslation,
      selectedTranslation,
    );
    previousTranslationRef.current = selectedTranslation;
    setQuery(localizedQuery);
    updateSuggestions(
      localizedQuery,
      document.activeElement === inputRef.current,
    );
  }, [bibleStructure, query, selectedTranslation, updateSuggestions]);

  useEffect(() => {
    const highlightedIndex =
      selectedSuggestionIndex >= 0 ? selectedSuggestionIndex : 0;
    if (!showSuggestions || suggestions.length === 0) return;

    const activeOption = suggestionsRef.current?.querySelector(
      `[data-suggestion-index="${highlightedIndex}"]`,
    );
    activeOption?.scrollIntoView({ block: "nearest" });
  }, [selectedSuggestionIndex, showSuggestions, suggestions.length]);

  const highlightedSuggestionIndex =
    showSuggestions && suggestions.length > 0
      ? selectedSuggestionIndex >= 0
        ? selectedSuggestionIndex
        : 0
      : -1;

  // Memoized suggestion items for better performance
  const suggestionItems = useMemo(() => {
    return suggestions.map((suggestion, index) => (
      <li
        id={`search-suggestion-${index}`}
        key={`${suggestion}-${index}`}
        role="option"
        aria-selected={index === highlightedSuggestionIndex}
        className={`suggestion ${
          index === highlightedSuggestionIndex ? "selected" : ""
        }`}
        data-suggestion-index={index}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => selectSuggestion(suggestion)}
        onMouseEnter={() => setSelectedSuggestionIndex(index)}
      >
        <span className="suggestion-text">{suggestion}</span>
        {index === highlightedSuggestionIndex && (
          <span className="suggestion-tab-hint" aria-hidden="true">
            <kbd>Tab</kbd>
            <span>to fill</span>
          </span>
        )}
      </li>
    ));
  }, [suggestions, highlightedSuggestionIndex, selectSuggestion]);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) {
        clearTimeout(blurTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="search-bar">
      <div className={`search-container ${showSuggestions ? "active" : ""}`}>
        <button
          onClick={handleSearch}
          className="search-icon"
          type="button"
          aria-label="Search verses"
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
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder="John 3:16"
          className="search-input"
          role="combobox"
          aria-label="Search Bible reference"
          aria-autocomplete="list"
          aria-controls="search-suggestions"
          aria-expanded={showSuggestions}
          aria-describedby="search-autocomplete-help"
          aria-activedescendant={
            highlightedSuggestionIndex >= 0
              ? `search-suggestion-${highlightedSuggestionIndex}`
              : undefined
          }
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
        />
        <span
          id="search-autocomplete-help"
          className="search-autocomplete-help"
        >
          When suggestions are open, press Tab to fill the highlighted option.
          Use Shift+Tab to leave the search field.
        </span>
        {query.trim() && (
          <button
            onClick={() => {
              setQuery("");
              setSuggestions([]);
              setShowSuggestions(false);
              setSelectedSuggestionIndex(-1);
              skipNextFocusSuggestionsRef.current = true;
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
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div ref={suggestionsRef} className="suggestions">
          <ul
            id="search-suggestions"
            className="suggestions-list"
            role="listbox"
            aria-label="Bible reference suggestions"
          >
            {suggestionItems}
          </ul>
        </div>
      )}
    </div>
  );
};

export default React.memo(SearchBar);
