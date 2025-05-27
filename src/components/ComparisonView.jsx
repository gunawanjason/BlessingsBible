import React, { useState, useEffect, useRef, useCallback } from "react";
import "./ComparisonView.css";
import { fetchMultipleVerses } from "../services/bibleApi";

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
}) => {
  const [verses, setVerses] = useState([]);
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
      setError(null);
      setLoading(false); // Clear any existing loading state
    } else if (!useAlignedData && book && chapter) {
      // Fetch verses independently (show loading for this translation only)
      const fetchVerses = async () => {
        setLoading(true);
        try {
          const chapterReference = `${book} ${chapter}`;
          const versesData = await fetchMultipleVerses(
            translation,
            chapterReference
          );

          setVerses(
            versesData.map((verse) => ({
              verse: verse.verse,
              text: verse.text,
              isEmpty: false,
            }))
          );
          setError(null);
        } catch (err) {
          setError(err.message);
          setVerses([]);
        } finally {
          setLoading(false);
        }
      };

      fetchVerses();
    }
  }, [book, chapter, translation, useAlignedData, alignedVerses]);

  // Update verse positions when verses change
  useEffect(() => {
    if (verses.length > 0 && onVersePositionUpdate) {
      const updatePositions = () => {
        verses.forEach((verse) => {
          const verseElement = verseRefs.current[verse.verse];
          if (verseElement) {
            const rect = verseElement.getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();
            onVersePositionUpdate(id, verse.verse, {
              top:
                rect.top - containerRect.top + containerRef.current.scrollTop,
              height: rect.height,
            });
          }
        });
      };

      // Initial position update
      updatePositions();

      // Update positions on resize
      const resizeObserver = new ResizeObserver(updatePositions);
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [verses, id, onVersePositionUpdate]);

  // Handle scroll events and notify parent
  const handleScroll = useCallback(() => {
    if (containerRef.current && onScroll) {
      // Find the verse currently at the center of the view
      const container = containerRef.current;
      const containerHeight = container.clientHeight;
      const scrollCenter = container.scrollTop + containerHeight / 2;

      // Find the verse closest to the center
      let closestVerse = null;
      let minDistance = Infinity;

      verses.forEach((verse) => {
        const verseElement = verseRefs.current[verse.verse];
        if (verseElement) {
          const rect = verseElement.getBoundingClientRect();
          const verseCenter =
            rect.top -
            container.getBoundingClientRect().top +
            container.scrollTop +
            rect.height / 2;
          const distance = Math.abs(verseCenter - scrollCenter);

          if (distance < minDistance) {
            minDistance = distance;
            closestVerse = verse.verse;
          }
        }
      });

      onScroll(container.scrollTop, id, closestVerse);
    }
  }, [onScroll, id, verses]);

  // Set up scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  // Handle verse click for selection
  const handleVerseClick = useCallback(
    (verseNumber) => {
      if (onVerseSelect) {
        onVerseSelect(verseNumber);
      }
    },
    [onVerseSelect]
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
                  verse.text
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default React.memo(ComparisonView);
