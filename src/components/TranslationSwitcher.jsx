import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import "./TranslationSwitcher.css";

const TranslationSwitcher = ({ selectedTranslation, onTranslationChange }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({
    Indonesian: true,
    English: true,
    Chinese: true,
  });
  const [dropdownPosition, setDropdownPosition] = useState("down");
  const [triggerRect, setTriggerRect] = useState(null);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);

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
      {
        id: "CUV",
        name: "CUV",
        fullName: "Chinese Union Version (Traditional)",
        available: true,
        category: "Chinese",
      },
    ],
    [],
  );

  // Optimized click outside handler with useCallback
  const handleClickOutside = useCallback((event) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target) &&
      menuRef.current &&
      !menuRef.current.contains(event.target)
    ) {
      setShowDropdown(false);
      // Clean up CSS custom property
      if (window.innerWidth <= 480) {
        document.documentElement.style.removeProperty("--dropdown-top");
      }
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
    [translations, selectedTranslation],
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
    [translations, onTranslationChange],
  );

  // Calculate position when dropdown opens
  useLayoutEffect(() => {
    if (showDropdown && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      setTriggerRect(rect);
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Estimate dropdown height (considering mobile constraints)
      const isMobile = window.innerWidth <= 768;
      const isVerySmall = window.innerWidth <= 480;
      const estimatedDropdownHeight = isVerySmall
        ? Math.min(viewportHeight * 0.35, 250)
        : isMobile
          ? Math.min(viewportHeight * 0.4, 300)
          : Math.min(viewportHeight * 0.5, 400);

      // For very small screens, calculate position accounting for scroll
      if (isVerySmall) {
        const scrollY = window.scrollY || window.pageYOffset;
        const absoluteTop = rect.top + scrollY;

        // Check if dropdown should open upward
        if (
          spaceBelow < estimatedDropdownHeight &&
          spaceAbove > estimatedDropdownHeight
        ) {
          document.documentElement.style.setProperty(
            "--dropdown-top",
            `${absoluteTop - 8}px`,
          );
          setDropdownPosition("up");
        } else {
          document.documentElement.style.setProperty(
            "--dropdown-top",
            `${absoluteTop + rect.height + 8}px`,
          );
          setDropdownPosition("down");
        }
      } else {
        // Position dropdown up if not enough space below and more space above
        if (
          spaceBelow < estimatedDropdownHeight &&
          spaceAbove > estimatedDropdownHeight
        ) {
          setDropdownPosition("up");
        } else {
          setDropdownPosition("down");
        }
      }
    }
  }, [showDropdown]);

  // Optimized dropdown toggle handler
  const toggleDropdown = useCallback(() => {
    setShowDropdown((prev) => !prev);
  }, []);

  // Optimized close dropdown handler
  const closeDropdown = useCallback(() => {
    setShowDropdown(false);
    // Clean up CSS custom property
    if (window.innerWidth <= 480) {
      document.documentElement.style.removeProperty("--dropdown-top");
    }
  }, []);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      setShowDropdown(false);
      // Clean up CSS custom property
      if (window.innerWidth <= 480) {
        document.documentElement.style.removeProperty("--dropdown-top");
      }
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
      ),
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

      {showDropdown &&
        createPortal(
          <div
            className={`translation-dropdown ${
              dropdownPosition === "up" ? "position-up" : ""
            }`}
            style={{
              "--trigger-top": `${triggerRect?.top}px`,
              "--trigger-bottom": `${triggerRect?.bottom}px`,
              "--trigger-left": `${triggerRect?.left}px`,
              "--trigger-right": `${
                window.innerWidth - (triggerRect?.right || 0)
              }px`,
              "--trigger-width": `${triggerRect?.width}px`,
              "--trigger-height": `${triggerRect?.height}px`,
            }}
            role="menu"
            ref={menuRef}
          >
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
          </div>,
          document.body,
        )}
    </div>
  );
};

export default React.memo(TranslationSwitcher);
