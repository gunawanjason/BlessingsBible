import React, { useState, useEffect, useRef, useCallback } from "react";
import "./VerseComparisonPanel.css";
import ComparisonView from "./ComparisonView";
import ScrollToTop from "./ScrollToTop";
import {
  fetchChapterCached,
  fetchHeadingsCached,
  hasCachedChapter,
} from "../services/bibleApi";
import { BOOK_TRANSLATIONS, BOOK_NAMES } from "../utils/translationMappings";
import { writeTextToClipboard } from "../utils/clipboard";

const VerseComparisonPanel = ({
  selectedBook,
  selectedChapter,
  bibleStructure,
  highlightedVerse,
  selectedVerses,
  setSelectedVerses,
  independentSelections,
  setIndependentSelections,
  syncEnabled,
  showCopyInNav = false,
  translations,
  removingTranslations,
}) => {
  const [alignedVerses, setAlignedVerses] = useState([]);
  const [headingsData, setHeadingsData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [translationErrors, setTranslationErrors] = useState({});
  const [showSyncHint, setShowSyncHint] = useState(() => {
    try {
      return !localStorage.getItem("syncHintDismissed");
    } catch {
      return true;
    }
  });
  const panelRef = useRef(null);
  const heightSyncTimeout = useRef(null);
  const headersRef = useRef(null);
  const viewsRef = useRef(null);
  const abortControllerRef = useRef(null);
  const fetchIdRef = useRef(0);
  const retryFocusTranslationRef = useRef(null);
  // Stores the last known verse count so the skeleton can match the column height
  // even after alignedVerses has been cleared for a new chapter load. Default of 30
  // roughly covers most chapters and fills the viewport on first load.
  const prevVerseCountRef = useRef(30);

  const dismissSyncHint = useCallback(() => {
    setShowSyncHint(false);
    try {
      localStorage.setItem("syncHintDismissed", "true");
    } catch {
      // The hint can still be dismissed for this session when storage is blocked.
    }
  }, []);

  // Sync horizontal scrolling between views container and sticky headers
  const handleHorizontalScroll = useCallback((e) => {
    if (headersRef.current) {
      headersRef.current.scrollLeft = e.target.scrollLeft;
    }
  }, []);

  // Get localized book name based on translation language
  const getLocalizedBookName = useCallback((bookName, translation) => {
    const language = BOOK_TRANSLATIONS[translation] || "en";
    const localizedNames = BOOK_NAMES[language];
    return localizedNames?.[bookName] || bookName; // Fallback to original if not found
  }, []);

  // Fetch and align verses for all translations
  const fetchAllTranslationVerses = useCallback(async () => {
    if (!selectedBook || !selectedChapter || translations.length === 0) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const fetchId = ++fetchIdRef.current;

    setError(null);
    setTranslationErrors({});
    setIsLoading(
      !translations.every((translation) =>
        hasCachedChapter(translation, selectedBook, selectedChapter),
      ),
    );

    try {
      const allVersesData = {};
      const allHeadingsData = {};
      const headingsPromises = {};

      // Preserve successful columns even when one translation is unavailable.
      const results = await Promise.allSettled(
        translations.map(async (translation) => {
          const headingsPromise = fetchHeadingsCached(
            translation,
            selectedBook,
            selectedChapter,
            { signal: controller.signal },
          ).catch(() => ({ data: [], fromCache: false }));
          const versesResponse = await fetchChapterCached(
            translation,
            selectedBook,
            selectedChapter,
            { signal: controller.signal },
          );

          return {
            translation,
            verses: versesResponse.data,
            headingsPromise,
          };
        }),
      );

      if (controller.signal.aborted || fetchIdRef.current !== fetchId) return;

      const failures = {};
      results.forEach((result, index) => {
        const translation = translations[index];
        if (result.status === "rejected") {
          if (result.reason?.name === "AbortError") throw result.reason;
          failures[translation] =
            result.reason?.message || "The translation could not be loaded.";
          return;
        }

        allVersesData[translation] = result.value.verses.reduce(
          (acc, verse) => {
            acc[verse.verse] = verse.text;
            return acc;
          },
          {},
        );
        headingsPromises[translation] = result.value.headingsPromise;
      });

      const successfulTranslations = Object.keys(allVersesData);
      setTranslationErrors(failures);
      if (successfulTranslations.length === 0) {
        setAlignedVerses([]);
        setHeadingsData({});
        setIsLoading(false);
        return;
      }

      // Get all unique verse numbers across all translations
      const allVerseNumbers = new Set();
      Object.values(allVersesData).forEach((translationVerses) => {
        Object.keys(translationVerses).forEach((verseNum) => {
          allVerseNumbers.add(parseInt(verseNum));
        });
      });

      // Sort verse numbers
      const sortedVerseNumbers = Array.from(allVerseNumbers).sort(
        (a, b) => a - b,
      );

      // Create aligned verses data
      const aligned = sortedVerseNumbers.map((verseNumber) => {
        const verseData = { verse: verseNumber };
        translations.forEach((translation) => {
          verseData[translation] = allVersesData[translation]
            ? allVersesData[translation][verseNumber] || null
            : null;
        });
        return verseData;
      });

      setAlignedVerses(aligned);
      setIsLoading(false);

      await Promise.all(
        successfulTranslations.map(async (translation) => {
          const headingsResponse = await headingsPromises[translation];
          allHeadingsData[translation] = headingsResponse.data;
        }),
      );
      if (!controller.signal.aborted && fetchIdRef.current === fetchId) {
        setHeadingsData({ ...allHeadingsData });
      }
    } catch (err) {
      if (
        err.name !== "AbortError" &&
        !controller.signal.aborted &&
        fetchIdRef.current === fetchId
      ) {
        setError(err.message);
        setHeadingsData({});
        setAlignedVerses([]);
      }
    } finally {
      if (!controller.signal.aborted && fetchIdRef.current === fetchId) {
        setIsLoading(false);
      }
    }
  }, [selectedBook, selectedChapter, translations]);

  // Align verse heights across all panels (optimized for single-pass update)
  const alignVerseHeights = useCallback(() => {
    if (!panelRef.current || alignedVerses.length === 0) return;

    requestAnimationFrame(() => {
      const headingHeights = new Map();
      const verseHeights = new Map();

      // Read pass: measure heading areas and verse items without touching the DOM
      alignedVerses.forEach((verseData) => {
        let maxHeading = 0;
        let maxVerse = 0;
        translations.forEach((translation) => {
          const headingEl = panelRef.current.querySelector(
            `#view-${translation}-heading-${verseData.verse}`,
          );
          const verseEl = panelRef.current.querySelector(
            `#view-${translation}-verse-${verseData.verse}`,
          );
          if (headingEl)
            maxHeading = Math.max(
              maxHeading,
              headingEl.getBoundingClientRect().height,
            );
          if (verseEl)
            maxVerse = Math.max(
              maxVerse,
              verseEl.getBoundingClientRect().height,
            );
        });
        headingHeights.set(verseData.verse, maxHeading);
        verseHeights.set(verseData.verse, maxVerse);
      });

      // Write pass: apply heights in one batch
      alignedVerses.forEach((verseData) => {
        const maxHeading = headingHeights.get(verseData.verse);
        const maxVerse = verseHeights.get(verseData.verse);
        translations.forEach((translation) => {
          const headingEl = panelRef.current.querySelector(
            `#view-${translation}-heading-${verseData.verse}`,
          );
          const verseEl = panelRef.current.querySelector(
            `#view-${translation}-verse-${verseData.verse}`,
          );
          if (headingEl && maxHeading > 0)
            headingEl.style.minHeight = `${maxHeading}px`;
          if (verseEl && maxVerse > 0)
            verseEl.style.minHeight = `${maxVerse}px`;
        });
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
            const headingEl = panelRef.current.querySelector(
              `#view-${translation}-heading-${verseData.verse}`,
            );
            const verseEl = panelRef.current.querySelector(
              `#view-${translation}-verse-${verseData.verse}`,
            );
            if (headingEl) headingEl.style.minHeight = "auto";
            if (verseEl) {
              verseEl.style.minHeight = "auto";
              verseEl.style.height = "auto";
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

        // Collect verse item elements for this verse number
        translations.forEach((translation) => {
          const verseEl = panelRef.current.querySelector(
            `#view-${translation}-verse-${verseNumber}`,
          );
          if (verseEl) {
            verseEl.classList.add("height-syncing");
            verseElements.push(verseEl);
          }
        });

        // Reset verse item heights
        verseElements.forEach((el) => {
          el.style.minHeight = "auto";
          el.style.height = "auto";
        });

        // Find max verse item height and apply
        verseElements.forEach((el) => {
          maxHeight = Math.max(maxHeight, el.getBoundingClientRect().height);
        });
        if (maxHeight > 0) {
          verseElements.forEach((el) => {
            el.style.minHeight = `${maxHeight}px`;
          });
        }

        // Heading areas don't change on selection, no need to recalculate them

        setTimeout(() => {
          verseElements.forEach((el) => {
            el.classList.remove("height-syncing");
          });
        }, 450);
      });
    },
    [translations],
  );

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
    [syncEnabled, syncSingleVerseHeight, setSelectedVerses],
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
              newSelections[translationId],
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
    [syncEnabled, syncSingleVerseHeight, setIndependentSelections],
  );

  // On chapter/book change: clear stale verse data and reset scroll positions.
  // Clearing alignedVerses makes hasData=false so the skeleton renders during loading.
  // (When only translations change, we intentionally keep existing column data so
  //  only the newly-added translation column shows a skeleton.)
  useEffect(() => {
    setAlignedVerses([]);
    setHeadingsData({});

    // Mobile: reset each column's internal scroll
    if (panelRef.current) {
      panelRef.current.querySelectorAll(".verses-list").forEach((el) => {
        el.scrollTop = 0;
      });
    }
    // Mobile views container (horizontal snap + landscape vertical)
    if (viewsRef.current) {
      viewsRef.current.scrollLeft = 0;
      viewsRef.current.scrollTop = 0;
    }
    // Desktop: the window itself scrolls — bring the panel back to the top
    if (panelRef.current) {
      const navHeight =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--nav-height",
          ),
        ) || 80;
      const panelTop =
        panelRef.current.getBoundingClientRect().top +
        window.scrollY -
        navHeight;
      if (window.scrollY > panelTop + 50) {
        // instant: skeleton renders in the same frame the scroll lands,
        // so the user never sees the gap below a short skeleton mid-animation.
        window.scrollTo({ top: panelTop, behavior: "instant" });
      }
    }
  }, [selectedBook, selectedChapter]);

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
    const availableTranslations = translations.filter(
      (translation) =>
        !translationErrors[translation] &&
        alignedVerses.some((verseData) => verseData[translation] != null),
    );
    const hasSelections = syncEnabled
      ? selectedVerses.size > 0
      : Object.values(independentSelections).some((set) => set && set.size > 0);

    if (!hasSelections) return;
    if (availableTranslations.length === 0) {
      throw new Error("No loaded translations are available to copy");
    }
    if (
      !syncEnabled &&
      !availableTranslations.some(
        (translation) => independentSelections[translation]?.size > 0,
      )
    ) {
      throw new Error(
        "No selected verses from loaded translations are available to copy",
      );
    }

    try {
      if (syncEnabled) {
        // Synced mode: copy all selected verses from all translations
        const sortedVerseNumbers = Array.from(selectedVerses).sort(
          (a, b) => a - b,
        );

        const verseRange = formatVerseRange(sortedVerseNumbers);

        const translationContents = availableTranslations
          .map((translation) => {
            const verseTexts = sortedVerseNumbers.map((verseNumber) => {
              const verseData = alignedVerses.find(
                (v) => v.verse === verseNumber,
              );
              const verseText = verseData?.[translation] || "";
              return verseText ? `${verseNumber} ${verseText}` : "";
            });

            const content = verseTexts.filter((text) => text).join("\n");
            if (!content) return null;

            const localizedBook = getLocalizedBookName(
              selectedBook,
              translation,
            );
            const header = `${localizedBook} ${selectedChapter}:${verseRange} ${translation.toUpperCase()}`;
            return `${header}\n${content}`;
          })
          .filter((content) => content !== null);

        if (translationContents.length === 0) {
          throw new Error("No loaded verse text is available to copy");
        }

        const textToCopy = translationContents.join("\n\n");
        await writeTextToClipboard(textToCopy);
      } else {
        // Independent mode: copy selected verses from each translation separately
        const translationContents = availableTranslations
          .map((translation) => {
            const translationSelections = independentSelections[translation];
            if (!translationSelections || translationSelections.size === 0)
              return null;

            const sortedVerseNumbers = Array.from(translationSelections).sort(
              (a, b) => a - b,
            );

            const verseRange = formatVerseRange(sortedVerseNumbers);

            const verseTexts = sortedVerseNumbers.map((verseNumber) => {
              const verseData = alignedVerses.find(
                (v) => v.verse === verseNumber,
              );
              const verseText = verseData?.[translation] || "";
              return verseText ? `${verseNumber} ${verseText}` : "";
            });

            const content = verseTexts.filter((text) => text).join("\n");
            const localizedBook = getLocalizedBookName(
              selectedBook,
              translation,
            );
            const header = `${localizedBook} ${selectedChapter}:${verseRange} ${translation.toUpperCase()}`;
            return content ? `${header}\n${content}` : null;
          })
          .filter((content) => content !== null);

        if (translationContents.length === 0) {
          throw new Error("No loaded verse text is available to copy");
        }

        const textToCopy = translationContents.join("\n\n");
        await writeTextToClipboard(textToCopy);
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
    translationErrors,
    alignedVerses,
    getLocalizedBookName,
    formatVerseRange,
  ]);

  const handleRetryTranslation = useCallback(
    (translation) => {
      retryFocusTranslationRef.current = translation;
      fetchAllTranslationVerses();
    },
    [fetchAllTranslationVerses],
  );

  useEffect(() => {
    const translation = retryFocusTranslationRef.current;
    if (!translation || isLoading) return undefined;

    const focusFrame = requestAnimationFrame(() => {
      if (document.activeElement !== document.body) {
        retryFocusTranslationRef.current = null;
        return;
      }

      const retryButton = panelRef.current?.querySelector(
        `[data-retry-translation="${translation}"]`,
      );
      const translationView = document.getElementById(`view-${translation}`);
      const nextFocusTarget =
        retryButton ||
        translationView?.querySelector('.verse-item[tabindex="0"]');

      nextFocusTarget?.focus({ preventScroll: true });
      retryFocusTranslationRef.current = null;
    });

    return () => cancelAnimationFrame(focusFrame);
  }, [alignedVerses, isLoading, translationErrors]);

  useEffect(() => {
    retryFocusTranslationRef.current = null;
  }, [selectedBook, selectedChapter, translations]);

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

  // Keep prevVerseCountRef current so skeleton height matches the last loaded chapter
  // even after alignedVerses is cleared for the next load.
  useEffect(() => {
    if (alignedVerses.length > 0) {
      prevVerseCountRef.current = alignedVerses.length;
    }
  }, [alignedVerses]);

  // Fetch verses when book, chapter, or translations change
  useEffect(() => {
    fetchAllTranslationVerses();
    return () => abortControllerRef.current?.abort();
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

  // Full alignment is only needed when the columns or their data change.
  // Selection changes already update the affected row in syncSingleVerseHeight.
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
  }, [translations, alignVerseHeights, alignedVerses.length]);

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
            const headingEl = panelRef.current.querySelector(
              `#view-${translation}-heading-${verseData.verse}`,
            );
            const verseEl = panelRef.current.querySelector(
              `#view-${translation}-verse-${verseData.verse}`,
            );
            if (headingEl) headingEl.style.minHeight = "auto";
            if (verseEl) {
              verseEl.style.minHeight = "auto";
              verseEl.style.height = "auto";
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

  // Clear timeouts on unmount
  useEffect(() => {
    const timeoutRef = heightSyncTimeout;
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Mobile horizontal scroll snapping: center panels after scroll ends
  // Mobile scroll behavior is now handled by CSS scroll-snap
  return (
    <div className="verse-comparison-panel" ref={panelRef}>
      {error && (
        <div className="error-message" role="alert">
          {error}. Please try again.
        </div>
      )}

      {Object.keys(translationErrors).length > 0 && (
        <div className="comparison-errors-announcement" role="alert">
          {Object.entries(translationErrors)
            .map(([translation, message]) => `${translation}: ${message}`)
            .join(" ")}
        </div>
      )}

      {showSyncHint && (
        <div className="sync-hint">
          <span className="sync-hint-text sync-hint-text-full">
            <strong>Sync on:</strong> Clicking a verse in any translation
            selects the same verse in all translations. Toggle sync off to
            select independently.
          </span>
          <span className="sync-hint-text sync-hint-text-compact">
            <strong>Sync on.</strong> Tap a verse to select it everywhere.
          </span>
          <button
            className="sync-hint-dismiss"
            onClick={dismissSyncHint}
            aria-label="Dismiss hint"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Desktop Sticky Headers (Separated to avoid overflow-x trapping) */}
      <div className="comparison-sticky-headers" ref={headersRef}>
        <div className="comparison-sticky-headers-inner">
          {translations.map((translation) => {
            const isRemoving = removingTranslations.has(translation);
            return (
              <div
                key={`sticky-header-${translation}`}
                className={`comparison-header-item ${isRemoving ? "column-removing" : "column-entering"}`}
              >
                <h2>{translation}</h2>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="comparison-views-container comparison-scroll-container"
        aria-busy={isLoading}
        ref={viewsRef}
        onScroll={handleHorizontalScroll}
      >
        {translations.map((translation) => {
          const hasData = alignedVerses.some(
            (verseData) => verseData[translation] != null,
          );
          const isRemoving = removingTranslations.has(translation);
          const translationError = translationErrors[translation];

          if (!hasData && isLoading) {
            // Show skeleton for this column (initial load or newly added translation)
            return (
              <div
                key={`skeleton-${translation}`}
                className="skeleton-column comparison-view-container skeleton-entering"
              >
                <div className="skeleton-column-header">
                  <div className="skeleton-header-label" />
                </div>
                <div className="skeleton-verses">
                  {(() => {
                    // Match the height of existing columns.
                    // When alignedVerses is cleared for a new chapter load, fall back to the
                    // previous chapter's count (stored in prevVerseCountRef) so skeleton rows
                    // extend to wherever the user was scrolled.
                    const rowCount =
                      alignedVerses.length > 0
                        ? alignedVerses.length
                        : prevVerseCountRef.current;
                    return Array.from({ length: rowCount }, (_, i) => {
                      // Sprinkle heading placeholders at roughly realistic positions
                      if (
                        i === 0 ||
                        i === Math.floor(rowCount * 0.35) ||
                        i === Math.floor(rowCount * 0.7)
                      ) {
                        return { heading: true };
                      }
                      // Deterministic varying widths so rows look natural
                      return { width: 65 + ((i * 7 + 13) % 35) };
                    });
                  })().map((item, i) => {
                    if (item.heading) {
                      return (
                        <div
                          key={`skeleton-heading-${i}`}
                          className="skeleton-heading"
                        />
                      );
                    }
                    return (
                      <div key={i} className="skeleton-verse">
                        <div className="skeleton-number" />
                        <div
                          className="skeleton-text"
                          style={{ width: `${item.width}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          if (translationError) {
            return (
              <div
                key={`error-${translation}`}
                className="comparison-view-container comparison-column-error"
              >
                <div className="view-header">
                  <h2>{translation}</h2>
                </div>
                <div className="comparison-column-error-content">
                  <p>
                    <strong>{translation}:</strong> {translationError}
                  </p>
                  <button
                    type="button"
                    data-retry-translation={translation}
                    onClick={() => handleRetryTranslation(translation)}
                    aria-label={`Retry loading ${translation}`}
                  >
                    Retry
                  </button>
                </div>
              </div>
            );
          }

          return (
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
              headings={headingsData[translation]}
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
              className={isRemoving ? "column-removing" : "column-entering"}
            />
          );
        })}
      </div>
      <ScrollToTop />
    </div>
    // Mobile snapping scroll: ensure active panel is centered after scroll ends
  );
};

export default React.memo(VerseComparisonPanel);
