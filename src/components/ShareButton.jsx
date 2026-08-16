import React, { useEffect, useRef, useState } from "react";
import { sendEvent } from "../utils/ga";
import { writeTextToClipboard } from "../utils/clipboard";

const ShareButton = ({ url, disabled = false, verseCount = 0 }) => {
  const [shareState, setShareState] = useState("idle");
  const resetTimerRef = useRef(null);

  useEffect(
    () => () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    },
    [],
  );

  const showTemporaryState = (nextState) => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setShareState(nextState);
    resetTimerRef.current = setTimeout(() => {
      setShareState("idle");
      resetTimerRef.current = null;
    }, 2000);
  };

  const handleShare = async () => {
    try {
      // Extract verse info from URL for analytics
      const urlParts = url.split("?");
      const urlParams = new URLSearchParams(urlParts[1] || "");
      const book = urlParams.get("book");
      const chapter = urlParams.get("chapter");
      const verses = urlParams.get("verses");
      const translation = urlParams.get("translation");

      const analyticsLabel =
        book && chapter && verses && translation
          ? `${book} ${chapter}:${verses} ${translation}`
          : "incomplete-url";

      // Copy to clipboard
      await writeTextToClipboard(url);
      showTemporaryState("copied");
      sendEvent({
        action: "share_verses_clipboard",
        category: "engagement",
        label: analyticsLabel,
      });
    } catch (err) {
      console.error("Sharing failed", err);
      showTemporaryState("error");
      sendEvent({
        action: "share_verses_error",
        category: "engagement",
        label: err.message || "Unknown error",
      });
    }
  };

  return (
    <button
      onClick={handleShare}
      className={`share-button ${shareState}`}
      disabled={disabled}
      aria-live="polite"
      aria-label={
        shareState === "copied"
          ? "Share link copied"
          : shareState === "error"
            ? "Could not copy share link"
            : `Copy share link for ${verseCount} selected verse${verseCount === 1 ? "" : "s"}`
      }
      title={
        shareState === "error"
          ? "Copy failed. Try again."
          : "Share selected verses"
      }
    >
      {shareState === "copied" ? (
        <>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="share-icon"
            aria-hidden="true"
          >
            <polyline points="20,6 9,17 4,12" />
          </svg>
        </>
      ) : shareState === "error" ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="share-icon"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="8" y1="8" x2="16" y2="16" />
          <line x1="16" y1="8" x2="8" y2="16" />
        </svg>
      ) : (
        <>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="share-icon"
            aria-hidden="true"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          {verseCount > 0 && <span className="share-count">{verseCount}</span>}
        </>
      )}
    </button>
  );
};

export default ShareButton;
