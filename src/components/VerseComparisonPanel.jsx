import React, { useState, useEffect, useRef, useCallback } from "react";
import "./VerseComparisonPanel.css";
import ComparisonView from "./ComparisonView";
import SyncControls from "./SyncControls";
import ScrollToTop from "./ScrollToTop";
import { fetchMultipleVerses } from "../services/bibleApi";
import { BOOK_TRANSLATIONS, BOOK_NAMES } from "../utils/translationMappings";

const VerseComparisonPanel = ({
  selectedBook,
  selectedChapter,
  bibleStructure,
  highlightedVerse,
  selectedTranslation,
  selectedVerses,
  setSelectedVerses,
  independentSelections,
  setIndependentSelections,
  syncEnabled,
  setSyncEnabled,
  showCopyInNav = false,
}) => {
  const [translations, setTranslations] = useState([
    selectedTranslation || "KJV",
    "NIV",
  ]);
  const [loadingStates, setLoadingStates] = useState({});
  const [alignedVerses, setAlignedVerses] = useState([]);
  const [versesData, setVersesData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const panelRef = useRef(null);
  const scrollSyncTimeout = useRef(null);
  const heightSyncTimeout = useRef(null);

  // Get localized book name based on translation language
  const getLocalizedBookName = useCallback((bookName, translation) => {
    const language = BOOK_TRANSLATIONS[translation] || "en";
    const localizedNames = BOOK_NAMES[language];
    return localizedNames?.[bookName] || bookName; // Fallback to original if not found
  }, []);

  // Fetch and align verses for all translations
  const fetchAllTranslationVerses = useCallback(async () => {
    if (!selectedBook || !selectedChapter || translations.length === 0) return;

    setError(null);
    setIsLoading(true);

    // Set loading state for each translation being fetched
    setLoadingStates((prev) => {
      const newStates = { ...prev };
      translations.forEach((t) => (newStates[t] = "loading"));
      return newStates;
    });

    try {
      const chapterReference = `${selectedBook} ${selectedChapter}`;
      const allVersesData = {};

      // Fetch verses for each translation
      await Promise.all(
        translations.map(async (translation) => {
          try {
            const versesData = await fetchMultipleVerses(
              translation,
              chapterReference
            );
            allVersesData[translation] = versesData.reduce((acc, verse) => {
              acc[verse.verse] = verse.text;
              return acc;
            }, {});
            // Clear loading state for successful fetch
            setLoadingStates((prev) => ({ ...prev, [translation]: null }));
          } catch (err) {
            console.error(
              `Error fetching ${translation} for ${chapterReference}:`,
              err
            );
            allVersesData[translation] = {};
            setLoadingStates((prev) => ({
              ...prev,
              [translation]: {
                status: "error",
                message: err.message || "Failed to fetch verses",
              },
            }));
          }
        })
      );

      // Get all unique verse numbers across all translations
      const allVerseNumbers = new Set();
      Object.values(allVersesData).forEach((translationVerses) => {
        Object.keys(translationVerses).forEach((verseNum) => {
          allVerseNumbers.add(parseInt(verseNum));
        });
      });

      // Sort verse numbers
      const sortedVerseNumbers = Array.from(allVerseNumbers).sort(
        (a, b) => a - b
      );

      // Create aligned verses data
      const aligned = sortedVerseNumbers.map((verseNumber) => {
        const verseData = { verse: verseNumber };
        translations.forEach((translation) => {
          verseData[translation] =
            allVersesData[translation][verseNumber] || null;
        });
        return verseData;
      });

      setVersesData(allVersesData);
      setAlignedVerses(aligned);
    } catch (err) {
      setError(err.message);
      setVersesData({});
      setAlignedVerses([]);
      // Clear all loading states on error
      setLoadingStates({});
    } finally {
      setIsLoading(false);
    }
  }, [selectedBook, selectedChapter, translations]);

  // Align verse heights across all panels (optimized for single-pass update)
  const alignVerseHeights = useCallback(() => {
    if (!panelRef.current || alignedVerses.length === 0) return;

    // Use requestAnimationFrame for smooth UI updates
    requestAnimationFrame(() => {
      const verseHeights = new Map();

      // First pass: Measure all verse heights without modifying DOM
      alignedVerses.forEach((verseData) => {
        let maxHeight = 0;
        translations.forEach((translation) => {
          const verseElement = panelRef.current.querySelector(
            `#view-${translation}-verse-${verseData.verse}`
          );
          if (verseElement) {
            // Force layout calculation by reading height
            const height = verseElement.getBoundingClientRect().height;
            maxHeight = Math.max(maxHeight, height);
          }
        });
        verseHeights.set(verseData.verse, maxHeight);
      });

      // Second pass: Apply all height changes in one batch
      alignedVerses.forEach((verseData) => {
        const targetHeight = verseHeights.get(verseData.verse);
        if (targetHeight) {
          translations.forEach((translation) => {
            const verseElement = panelRef.current.querySelector(
              `#view-${translation}-verse-${verseData.verse}`
            );
            if (verseElement) {
              verseElement.style.minHeight = `${targetHeight}px`;
            }
          });
        }
      });
    });
  }, [alignedVerses, translations]);

  // Debounced height sync for multiple verse operations
  const debouncedHeightSync = useCallback(() => {
    // Clear any pending height sync
    if (heightSyncTimeout.current) {
      clearTimeout(heightSyncTimeout.current);
    }

    // Debounce height sync to calculate once for multiple operations
    heightSyncTimeout.current = setTimeout(() => {
      if (panelRef.current && alignedVerses.length > 0) {
        // First reset all heights to auto to get natural heights
        alignedVerses.forEach((verseData) => {
          translations.forEach((translation) => {
            const verseElement = panelRef.current.querySelector(
              `#view-${translation}-verse-${verseData.verse}`
            );
            if (verseElement) {
              verseElement.style.minHeight = "auto";
              verseElement.style.height = "auto";
            }
          });
        });

        // Then recalculate alignment after heights have reset
        requestAnimationFrame(() => {
          alignVerseHeights();
        });
      }
    }, 100);
  }, [alignedVerses, translations, alignVerseHeights]);

  // Sync height for a specific verse row only (optimized for single verse operations)
  const syncSingleVerseHeight = useCallback(
    (verseNumber) => {
      if (!panelRef.current) return;

      requestAnimationFrame(() => {
        const verseElements = [];
        let maxHeight = 0;

        // Step 1: Collect all verse elements for this specific verse
        translations.forEach((translation) => {
          const verseElement = panelRef.current.querySelector(
            `#view-${translation}-verse-${verseNumber}`
          );
          if (verseElement) {
            verseElement.classList.add("height-syncing");
            verseElements.push(verseElement);
          }
        });

        // Step 2: Reset all heights to auto to get natural heights (important for shrinking on unselect)
        verseElements.forEach((element) => {
          element.style.minHeight = "auto";
          element.style.height = "auto";
        });

        // Step 3: Force reflow to ensure heights are calculated with current content state
        verseElements.forEach((element) => {
          element.offsetHeight; // Force reflow
        });

        // Step 4: Find the maximum natural height after reset
        verseElements.forEach((element) => {
          const height = element.getBoundingClientRect().height;
          maxHeight = Math.max(maxHeight, height);
        });

        // Step 5: Apply the new max height to all verse elements in this row
        if (maxHeight > 0) {
          verseElements.forEach((element) => {
            element.style.minHeight = `${maxHeight}px`;
          });
        }

        // Step 6: Clean up animation class after transition
        setTimeout(() => {
          verseElements.forEach((element) => {
            element.classList.remove("height-syncing");
          });
        }, 450);
      });
    },
    [translations]
  );

  // Handle adding/removing translations
  const handleAddTranslation = useCallback((translationId) => {
    setTranslations((prev) => [...prev, translationId]);
  }, []);

  const handleRemoveTranslation = useCallback(
    (translationId) => {
      setTranslations((prev) => {
        // Don't allow removing the first translation (synced with main dropdown)
        if (prev.length <= 1 || prev[0] === translationId) {
          return prev;
        }
        return prev.filter((t) => t !== translationId);
      });
      // Clear loading state for removed translation
      setLoadingStates((prev) => {
        const newStates = { ...prev };
        delete newStates[translationId];
        return newStates;
      });
      // Trigger debounced height sync since there's more horizontal space now
      debouncedHeightSync();
    },
    [debouncedHeightSync]
  );

  // Toggle sync between panels
  const toggleSync = useCallback(() => {
    setSyncEnabled((prev) => !prev);
  }, [setSyncEnabled]);

  // Handle verse selection (synced mode)
  const handleVerseSelect = useCallback(
    (verseNumber) => {
      if (syncEnabled) {
        setSelectedVerses((prev) => {
          const newSelected = new Set(prev);
          if (newSelected.has(verseNumber)) {
            newSelected.delete(verseNumber);
          } else {
            newSelected.add(verseNumber);
          }
          return newSelected;
        });

        // Sync height for just this specific verse row
        syncSingleVerseHeight(verseNumber);
      }
    },
    [syncEnabled, syncSingleVerseHeight]
  );

  // Handle verse selection (independent mode per translation)
  const handleIndependentVerseSelect = useCallback(
    (translationId, verseNumber) => {
      if (!syncEnabled) {
        setIndependentSelections((prev) => {
          const newSelections = { ...prev };
          if (!newSelections[translationId]) {
            newSelections[translationId] = new Set();
          } else {
            newSelections[translationId] = new Set(
              newSelections[translationId]
            );
          }

          if (newSelections[translationId].has(verseNumber)) {
            newSelections[translationId].delete(verseNumber);
          } else {
            newSelections[translationId].add(verseNumber);
          }

          return newSelections;
        });

        // Sync height for just this specific verse row
        syncSingleVerseHeight(verseNumber);
      }
    },
    [syncEnabled, syncSingleVerseHeight]
  );

  // Clear selections when chapter changes
  useEffect(() => {
    setSelectedVerses(new Set());
    setIndependentSelections({});
  }, [
    selectedBook,
    selectedChapter,
    setSelectedVerses,
    setIndependentSelections,
  ]);

  // Helper function to format verse ranges (groups consecutive verses)
  const formatVerseRange = useCallback((sortedVerseNumbers) => {
    if (sortedVerseNumbers.length === 1) {
      return sortedVerseNumbers[0].toString();
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

      return ranges.join(", ");
    }
  }, []);

  // Copy selected verses from comparison view
  const copySelectedVerses = useCallback(async () => {
    const hasSelections = syncEnabled
      ? selectedVerses.size > 0
      : Object.values(independentSelections).some((set) => set && set.size > 0);

    if (!hasSelections) return;

    try {
      if (syncEnabled) {
        // Synced mode: copy all selected verses from all translations
        const sortedVerseNumbers = Array.from(selectedVerses).sort(
          (a, b) => a - b
        );

        const verseRange = formatVerseRange(sortedVerseNumbers);

        const translationContents = translations.map((translation) => {
          const verseTexts = sortedVerseNumbers.map((verseNumber) => {
            const verseData = alignedVerses.find(
              (v) => v.verse === verseNumber
            );
            const verseText = verseData?.[translation] || "";
            return verseText ? `${verseNumber} ${verseText}` : "";
          });

          const content = verseTexts.filter((text) => text).join("\n");
          const localizedBook = getLocalizedBookName(selectedBook, translation);
          const header = `${localizedBook} ${selectedChapter}:${verseRange} ${translation.toUpperCase()}`;
          return content ? `${header}\n${content}` : header;
        });

        const textToCopy = translationContents.join("\n\n");
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // Independent mode: copy selected verses from each translation separately
        const translationContents = translations
          .map((translation) => {
            const translationSelections = independentSelections[translation];
            if (!translationSelections || translationSelections.size === 0)
              return null;

            const sortedVerseNumbers = Array.from(translationSelections).sort(
              (a, b) => a - b
            );

            const verseRange = formatVerseRange(sortedVerseNumbers);

            const verseTexts = sortedVerseNumbers.map((verseNumber) => {
              const verseData = alignedVerses.find(
                (v) => v.verse === verseNumber
              );
              const verseText = verseData?.[translation] || "";
              return verseText ? `${verseNumber} ${verseText}` : "";
            });

            const content = verseTexts.filter((text) => text).join("\n");
            const localizedBook = getLocalizedBookName(
              selectedBook,
              translation
            );
            const header = `${localizedBook} ${selectedChapter}:${verseRange} ${translation.toUpperCase()}`;
            return content ? `${header}\n${content}` : header;
          })
          .filter((content) => content !== null);

        const textToCopy = translationContents.join("\n\n");
        await navigator.clipboard.writeText(textToCopy);
      }
    } catch (err) {
      console.error("Failed to copy text:", err);
      throw err; // Re-throw so the parent can handle the error state
    }
  }, [
    syncEnabled,
    selectedVerses,
    independentSelections,
    selectedBook,
    selectedChapter,
    translations,
    alignedVerses,
    getLocalizedBookName,
    formatVerseRange,
  ]);

  // Expose copy function globally for the main nav button to use
  useEffect(() => {
    if (showCopyInNav) {
      window.copyComparisonVerses = copySelectedVerses;
      return () => {
        delete window.copyComparisonVerses;
      };
    }
  }, [copySelectedVerses, showCopyInNav]);

  // Scroll sync is now handled by the parent container, no per-panel sync needed
  const handleScrollSync = useCallback(() => {
    // No-op since individual containers don't scroll
  }, []);

  // Fetch verses when book, chapter, or translations change
  useEffect(() => {
    fetchAllTranslationVerses();
  }, [fetchAllTranslationVerses]);

  // Align verse heights after verses are loaded
  useEffect(() => {
    if (!isLoading && alignedVerses.length > 0) {
      debouncedHeightSync();
    }
  }, [
    isLoading,
    alignedVerses,
    debouncedHeightSync,
    selectedBook,
    selectedChapter,
  ]);

  // Update heights for all relevant changes:
  // - Verse selections (selecting/unselecting, both sync and independent modes)
  // - Translation changes (adding/removing translations)
  // - Initial load and data changes
  useEffect(() => {
    if (alignedVerses.length > 0) {
      // Use delay to allow DOM to update first
      const timer = setTimeout(() => {
        // console.log("Triggering height sync for:", {
        //   selectedVerses: Array.from(selectedVerses),
        //   translations,
        //   alignedVerses: alignedVerses.length,
        // });
        alignVerseHeights();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [
    selectedVerses, // Sync selections
    independentSelections, // Independent selections
    translations, // Translation list changes
    alignVerseHeights,
    alignedVerses.length,
  ]);

  // Recalculate verse heights when book or chapter changes
  useEffect(() => {
    debouncedHeightSync();
  }, [selectedBook, selectedChapter, debouncedHeightSync]);

  // Re-align on window resize with proper height reset
  useEffect(() => {
    const handleResize = () => {
      if (alignedVerses.length > 0 && panelRef.current) {
        // First reset all heights to auto to get natural heights
        alignedVerses.forEach((verseData) => {
          translations.forEach((translation) => {
            const verseElement = panelRef.current.querySelector(
              `#view-${translation}-verse-${verseData.verse}`
            );
            if (verseElement) {
              verseElement.style.minHeight = "auto";
              verseElement.style.height = "auto";
            }
          });
        });

        // Then recalculate alignment after heights have reset
        requestAnimationFrame(() => {
          alignVerseHeights();
        });
      }
    };

    // Debounce resize events for better performance
    let resizeTimeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 100);
    };

    window.addEventListener("resize", debouncedResize);
    return () => {
      window.removeEventListener("resize", debouncedResize);
      clearTimeout(resizeTimeout);
    };
  }, [alignedVerses, alignVerseHeights, translations]);

  // Update first translation when selectedTranslation changes
  useEffect(() => {
    if (
      selectedTranslation &&
      translations.length > 0 &&
      translations[0] !== selectedTranslation
    ) {
      setTranslations((prev) => [selectedTranslation, ...prev.slice(1)]);
    }
  }, [selectedTranslation, translations]);

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (scrollSyncTimeout.current) {
        clearTimeout(scrollSyncTimeout.current);
      }
      if (heightSyncTimeout.current) {
        clearTimeout(heightSyncTimeout.current);
      }
    };
  }, []);

  // Mobile horizontal scroll snapping: center panels after scroll ends
  // Mobile scroll behavior is now handled by CSS scroll-snap
  return (
    <div className="verse-comparison-panel" ref={panelRef}>
      <div className="panel-header">
        <h3>Verse Comparison</h3>
        <div className="header-controls">
          <SyncControls
            translations={translations}
            onAddTranslation={handleAddTranslation}
            onRemoveTranslation={handleRemoveTranslation}
            syncEnabled={syncEnabled}
            onToggleSync={toggleSync}
          />
        </div>
      </div>

      {error && <div className="error-message">Error: {error}</div>}

      {isLoading && alignedVerses.length === 0 && (
        <div className="loading-container">
          <div className="loading-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" />
            </svg>
          </div>
          <div className="loading-text">Setting up verse comparison...</div>
          <div className="loading-dots">
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
          </div>
        </div>
      )}

      {!isLoading && (
        <div className="comparison-views-container comparison-scroll-container">
          {translations.map((translation) => (
            <ComparisonView
              key={translation}
              id={`view-${translation}`}
              translation={translation}
              book={selectedBook}
              chapter={selectedChapter}
              bibleStructure={bibleStructure}
              highlightedVerse={highlightedVerse}
              onScroll={handleScrollSync}
              loading={isLoading}
              alignedVerses={alignedVerses}
              useAlignedData={true}
              selectedVerses={
                syncEnabled
                  ? selectedVerses
                  : independentSelections[translation] || new Set()
              }
              onVerseSelect={
                syncEnabled
                  ? handleVerseSelect
                  : (verseNumber) =>
                      handleIndependentVerseSelect(translation, verseNumber)
              }
              syncEnabled={syncEnabled}
            />
          ))}
        </div>
      )}
      <ScrollToTop />
    </div>
    // Mobile snapping scroll: ensure active panel is centered after scroll ends
  );
};

export default React.memo(VerseComparisonPanel);
