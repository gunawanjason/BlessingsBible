import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import "./TranslationSwitcher.css";

const TranslationSwitcher = ({ selectedTranslation, onTranslationChange }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({
    Indonesian: true,
    English: true,
    Chinese: true,
  });
  const dropdownRef = useRef(null);

  // Memoized translations array to prevent unnecessary re-renders
  const translations = useMemo(
    () => [
      // Indonesian Translations (prioritized first)
      {
        id: "TB",
        name: "TB",
        fullName: "Terjemahan Baru",
        available: true,
        category: "Indonesian",
      },

      // English Translations
      {
        id: "KJV",
        name: "KJV",
        fullName: "King James Version",
        available: true,
        category: "English",
      },
      {
        id: "NIV",
        name: "NIV",
        fullName: "New International Version",
        available: true,
        category: "English",
      },
      {
        id: "ESV",
        name: "ESV",
        fullName: "English Standard Version",
        available: true,
        category: "English",
      },
      {
        id: "NLT",
        name: "NLT",
        fullName: "New Living Translation",
        available: true,
        category: "English",
      },
      {
        id: "NASB",
        name: "NASB",
        fullName: "New American Standard Bible",
        available: true,
        category: "English",
      },
      {
        id: "TLB",
        name: "TLB",
        fullName: "The Living Bible",
        available: true,
        category: "English",
      },

      // Chinese Translations
      {
        id: "CNVS",
        name: "CNVS",
        fullName: "Chinese New Version Simplified",
        available: true,
        category: "Chinese",
      },
      {
        id: "CUNPSS-上帝",
        name: "CUNPSS (上帝)",
        fullName: "Chinese Union Version Simplified (上帝)",
        available: true,
        category: "Chinese",
      },
      {
        id: "CUNPSS-神",
        name: "CUNPSS (神)",
        fullName: "Chinese Union Version Simplified (神)",
        available: true,
        category: "Chinese",
      },
    ],
    []
  );

  // Optimized click outside handler with useCallback
  const handleClickOutside = useCallback((event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setShowDropdown(false);
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [handleClickOutside]);

  // Memoized current translation to prevent unnecessary calculations
  const currentTranslation = useMemo(
    () =>
      translations.find((t) => t.id === selectedTranslation) || translations[0],
    [translations, selectedTranslation]
  );

  // Optimized translation selection handler
  const handleTranslationSelect = useCallback(
    (translationId) => {
      const translation = translations.find((t) => t.id === translationId);
      if (translation) {
        onTranslationChange(translationId);
        setShowDropdown(false);
      }
    },
    [translations, onTranslationChange]
  );

  // Optimized dropdown toggle handler
  const toggleDropdown = useCallback(() => {
    setShowDropdown((prev) => !prev);
  }, []);

  // Optimized close dropdown handler
  const closeDropdown = useCallback(() => {
    setShowDropdown(false);
  }, []);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      setShowDropdown(false);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setShowDropdown((prev) => !prev);
    }
  }, []);

  // Toggle category expansion/collapse
  const toggleCategory = useCallback((category) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  }, []);

  // Group translations by category with specific order
  const groupedTranslations = useMemo(() => {
    const groups = {};
    translations.forEach((translation) => {
      const category = translation.category || "Other";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(translation);
    });

    // Return in specific order: Indonesian, English, Chinese
    const orderedCategories = ["Indonesian", "English", "Chinese"];
    const orderedGroups = {};
    orderedCategories.forEach((category) => {
      if (groups[category]) {
        orderedGroups[category] = groups[category];
      }
    });

    return orderedGroups;
  }, [translations]);

  // Memoized translation items organized by category for better performance
  const translationItems = useMemo(() => {
    return Object.entries(groupedTranslations).map(
      ([category, categoryTranslations]) => (
        <div key={category} className="translation-category">
          <button
            className="category-header"
            onClick={() => toggleCategory(category)}
            aria-expanded={expandedCategories[category]}
          >
            <div className="category-info">
              <span className="category-name">{category}</span>
              <span className="category-count">
                ({categoryTranslations.length})
              </span>
            </div>
            <svg
              className={`category-chevron ${
                expandedCategories[category] ? "expanded" : ""
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
          </button>
          {expandedCategories[category] && (
            <div className="category-translations">
              {categoryTranslations.map((translation) => (
                <button
                  key={translation.id}
                  className={`translation-item ${
                    selectedTranslation === translation.id ? "active" : ""
                  }`}
                  onClick={() => handleTranslationSelect(translation.id)}
                  aria-pressed={selectedTranslation === translation.id}
                >
                  <div className="translation-content">
                    <div className="translation-names">
                      <span className="short-name">{translation.name}</span>
                      <span className="full-name">{translation.fullName}</span>
                    </div>
                    <div className="translation-status">
                      {selectedTranslation === translation.id && (
                        <svg
                          className="check-icon"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden="true"
                        >
                          <polyline points="20,6 9,17 4,12"></polyline>
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )
    );
  }, [
    groupedTranslations,
    selectedTranslation,
    handleTranslationSelect,
    expandedCategories,
    toggleCategory,
  ]);

  return (
    <div className="translation-switcher" ref={dropdownRef}>
      <button
        className={`translation-button ${showDropdown ? "active" : ""}`}
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        aria-expanded={showDropdown}
        aria-haspopup="true"
        title="Choose Bible translation"
      >
        <div className="translation-info">
          <span className="translation-name">{currentTranslation.name}</span>
          <span className="translation-label">Translation</span>
        </div>
        <div className="translation-indicator">
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
      </button>

      {showDropdown && (
        <div className="translation-dropdown" role="menu">
          <div className="dropdown-header">
            <h3>Bible Translations</h3>
            <button
              className="close-button"
              onClick={closeDropdown}
              aria-label="Close translation menu"
              type="button"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div className="translations-list" role="menubar">
            {translationItems}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(TranslationSwitcher);
