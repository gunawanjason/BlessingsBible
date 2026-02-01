import React, { useState, useEffect, useRef, useCallback } from "react";
import "./ComparisonView.css";
import { fetchMultipleVerses, fetchHeadings } from "../services/bibleApi";

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
  bibleStructure,
  highlightedVerse,
  onScroll,
  onVersePositionUpdate,
  alignedVerses,
  useAlignedData = false,
  selectedVerses = new Set(),
  onVerseSelect,
  syncEnabled = false,
  headings: externalHeadings,
}) => {
  const [verses, setVerses] = useState([]);
  const [headings, setHeadings] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
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

  // Scroll handling removed since individual containers don't scroll anymore

  // Handle verse click for selection
  const handleVerseClick = useCallback(
    (verseNumber) => {
      if (onVerseSelect) {
        onVerseSelect(verseNumber);
      }
    },
    [onVerseSelect],
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
    <div className="comparison-view-container" ref={containerRef} id={id}>
      <div className="view-header">
        <h4>{translation}</h4>
      </div>

      {loading && (
        <div className="loading-container">
          <div className="loading-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" />
            </svg>
          </div>
          <div className="loading-text">Loading {translation}...</div>
          <div className="loading-dots">
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          Error loading {translation}: {error}
        </div>
      )}

      {verses.length > 0 && (
        <div className="verses-list">
          {verses.map((verse) => (
            <React.Fragment key={`${id}-${verse.verse}-wrapper`}>
              {(headings || [])
                .filter((h) => parseInt(h.start) === parseInt(verse.verse))
                .map((h, i) => (
                  <div
                    key={`heading-${verse.verse}-${i}`}
                    className="pericope-heading"
                  >
                    {h.heading}
                  </div>
                ))}
              <div
                key={`${id}-${verse.verse}`}
                id={`${id}-verse-${verse.verse}`}
                ref={(el) => (verseRefs.current[verse.verse] = el)}
                className={`verse-item ${
                  highlightedVerse?.verse === verse.verse ? "highlighted" : ""
                } ${verse.isEmpty ? "empty-verse" : ""} ${
                  selectedVerses.has(verse.verse) ? "selected" : ""
                } selectable`}
                onClick={() => handleVerseClick(verse.verse)}
              >
                <span className="verse-number">{verse.verse}</span>
                <span className="verse-text">
                  {verse.isEmpty ? (
                    <span className="missing-verse">—</span>
                  ) : (
                    (() => {
                      const verseSegments = splitVerseContent(verse.text);
                      if (verseSegments.length <= 1) {
                        // Single verse or no segments, display normally
                        return verse.text;
                      } else {
                        // Multiple verse segments, render each on its own line
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
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

export default React.memo(ComparisonView);
