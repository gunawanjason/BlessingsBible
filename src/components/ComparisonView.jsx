import React, { useState, useEffect, useRef, useCallback } from "react";
import "./ComparisonView.css";
import { fetchMultipleVerses, fetchHeadings } from "../services/bibleApi";
import { getTranslationLanguage } from "../utils/translationMappings";

// Helper function to split verse content by verse numbers and render individual verses
const splitVerseContent = (verseText) => {
  if (!verseText || typeof verseText !== "string") {
    return [];
  }

  // Split by verse numbers in brackets like [1], [2], etc.
  const segments = verseText.split(/(\[\d+\])/g);

  // Filter out empty segments and process them
  const verseSegments = [];
  let currentVerseNumber = null;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i].trim();

    if (!segment) continue;

    // Check if this segment is a verse number
    const verseNumberMatch = segment.match(/^\[(\d+)\]$/);
    if (verseNumberMatch) {
      currentVerseNumber = verseNumberMatch[1];
    } else if (currentVerseNumber) {
      // This is verse content following a verse number
      verseSegments.push({
        verseNumber: currentVerseNumber,
        content: segment.trim(),
      });
      currentVerseNumber = null;
    } else {
      // Content without a preceding verse number - treat as verse 1 if it's the first content
      verseSegments.push({
        verseNumber: verseSegments.length === 0 ? "1" : null,
        content: segment.trim(),
      });
    }
  }

  // If no verse numbers were found, treat the entire text as a single verse
  if (verseSegments.length === 0 && verseText.trim()) {
    verseSegments.push({
      verseNumber: "1",
      content: verseText.trim(),
    });
  }

  return verseSegments;
};

const ComparisonView = ({
  id,
  translation,
  book,
  chapter,
  highlightedVerse,
  onVersePositionUpdate,
  alignedVerses,
  useAlignedData = false,
  selectedVerses = new Set(),
  onVerseSelect,
  headings: externalHeadings,
  className = "",
}) => {
  const [verses, setVerses] = useState([]);
  const [headings, setHeadings] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeVerseNumber, setActiveVerseNumber] = useState(null);
  const containerRef = useRef(null);
  const verseRefs = useRef({});

  // Process verses based on aligned data or fetch independently
  useEffect(() => {
    if (useAlignedData && alignedVerses) {
      // Use aligned verses data (no loading needed)
      const processedVerses = alignedVerses.map((verseData) => ({
        verse: verseData.verse,
        text: verseData[translation] || "", // Empty string for missing verses
        isEmpty: !verseData[translation], // Flag to indicate missing verse
      }));
      setVerses(processedVerses);
      setHeadings(externalHeadings || []);
      setError(null);
      setLoading(false); // Clear any existing loading state
    } else if (!useAlignedData && book && chapter) {
      // Fetch verses independently (show loading for this translation only)
      const fetchVersesAndHeadings = async () => {
        setLoading(true);
        try {
          const chapterReference = `${book} ${chapter}`;
          const [versesData, headingsData] = await Promise.all([
            fetchMultipleVerses(translation, chapterReference),
            fetchHeadings(translation, book, chapter),
          ]);

          setVerses(
            versesData.map((verse) => ({
              verse: verse.verse,
              text: verse.text,
              isEmpty: false,
            })),
          );
          setHeadings(headingsData);
          setError(null);
        } catch (err) {
          setError(err.message);
          setVerses([]);
        } finally {
          setLoading(false);
        }
      };

      fetchVersesAndHeadings();
    }
  }, [
    book,
    chapter,
    translation,
    useAlignedData,
    alignedVerses,
    externalHeadings,
  ]);

  // Update verse positions (simplified)
  useEffect(() => {
    // Basic position tracking for compatibility
    if (verses.length > 0 && onVersePositionUpdate) {
      verses.forEach((verse) => {
        onVersePositionUpdate(id, verse.verse, { top: 0, height: 0 });
      });
    }
  }, [verses, id, onVersePositionUpdate]);

  useEffect(() => {
    setActiveVerseNumber(null);
  }, [book, chapter]);

  useEffect(() => {
    const verseNumbers = verses.map((verse) => verse.verse);
    if (verseNumbers.length === 0) {
      setActiveVerseNumber(null);
      return;
    }

    const highlightedNumber = Number(highlightedVerse?.verse);
    setActiveVerseNumber((current) => {
      if (
        Number.isInteger(highlightedNumber) &&
        verseNumbers.includes(highlightedNumber)
      ) {
        return highlightedNumber;
      }
      return verseNumbers.includes(current) ? current : verseNumbers[0];
    });
  }, [highlightedVerse, verses]);

  // Scroll handling removed since individual containers don't scroll anymore

  // Handle verse click for selection
  const handleVerseClick = useCallback(
    (verseNumber) => {
      setActiveVerseNumber(verseNumber);
      if (onVerseSelect) {
        onVerseSelect(verseNumber);
      }
    },
    [onVerseSelect],
  );

  const focusVerseAtIndex = useCallback(
    (index) => {
      const targetVerse = verses[index];
      if (!targetVerse) return;

      setActiveVerseNumber(targetVerse.verse);
      requestAnimationFrame(() =>
        verseRefs.current[targetVerse.verse]?.focus(),
      );
    },
    [verses],
  );

  const handleVerseKeyDown = useCallback(
    (event, verseNumber, index) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleVerseClick(verseNumber);
        return;
      }

      let nextIndex;
      if (event.key === "ArrowDown") {
        nextIndex = Math.min(index + 1, verses.length - 1);
      } else if (event.key === "ArrowUp") {
        nextIndex = Math.max(index - 1, 0);
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = verses.length - 1;
      } else {
        return;
      }

      event.preventDefault();
      focusVerseAtIndex(nextIndex);
    },
    [focusVerseAtIndex, handleVerseClick, verses.length],
  );

  // Auto-scroll to highlighted verse
  useEffect(() => {
    if (!highlightedVerse || verses.length === 0) return;

    const verseElement = verseRefs.current[highlightedVerse.verse];
    if (verseElement) {
      verseElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [highlightedVerse, verses]);

  return (
    <div
      className={`comparison-view-container${className ? ` ${className}` : ""}`}
      ref={containerRef}
      id={id}
    >
      <div className="view-header">
        <h2>{translation}</h2>
      </div>

      {loading && (
        <div className="loading-container">
          <div className="loading-spinner" />
          <div className="loading-text">Loading {translation}...</div>
        </div>
      )}

      {error && (
        <div className="error-message">
          Unable to load {translation}. Please try again.
        </div>
      )}

      {verses.length > 0 && (
        <div className="verses-list" lang={getTranslationLanguage(translation)}>
          {verses.map((verse, index) => (
            <div
              key={`${id}-${verse.verse}-row`}
              id={`${id}-row-${verse.verse}`}
              className="verse-row"
            >
              {/* Heading area always rendered so heights can be equalized across columns */}
              <div
                id={`${id}-heading-${verse.verse}`}
                className="verse-heading-area"
              >
                {(headings || [])
                  .filter((h) => parseInt(h.start) === parseInt(verse.verse))
                  .map((h, i) => (
                    <h3
                      key={`heading-${verse.verse}-${i}`}
                      className="pericope-heading"
                    >
                      {h.heading}
                    </h3>
                  ))}
              </div>
              <div
                id={`${id}-verse-${verse.verse}`}
                ref={(element) => {
                  if (element) {
                    verseRefs.current[verse.verse] = element;
                  } else {
                    delete verseRefs.current[verse.verse];
                  }
                }}
                className={`verse-item ${
                  highlightedVerse?.verse === verse.verse ? "highlighted" : ""
                } ${verse.isEmpty ? "empty-verse" : ""} ${
                  selectedVerses.has(verse.verse) ? "selected" : ""
                } selectable`}
                onClick={() => handleVerseClick(verse.verse)}
                onKeyDown={(event) =>
                  handleVerseKeyDown(event, verse.verse, index)
                }
                onFocus={() => setActiveVerseNumber(verse.verse)}
                role="button"
                tabIndex={activeVerseNumber === verse.verse ? 0 : -1}
                aria-pressed={selectedVerses.has(verse.verse)}
              >
                <span className="verse-number">{verse.verse}</span>
                <div className="verse-text">
                  {verse.isEmpty ? (
                    <span className="missing-verse">—</span>
                  ) : (
                    (() => {
                      const verseSegments = splitVerseContent(verse.text);
                      if (verseSegments.length <= 1) {
                        return verse.text;
                      } else {
                        return verseSegments.map((segment, index) => (
                          <div key={index} className="verse-segment">
                            {segment.verseNumber && (
                              <span className="inline-verse-number">
                                {segment.verseNumber}
                              </span>
                            )}
                            <span className="verse-segment-text">
                              {segment.content}
                            </span>
                          </div>
                        ));
                      }
                    })()
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default React.memo(ComparisonView);
