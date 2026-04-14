import React, { useState } from "react";
import { sendEvent } from "../utils/ga";

const ShareButton = ({ url, disabled = false, verseCount = 0 }) => {
  const [copied, setCopied] = useState(false);

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
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      sendEvent({
        action: "share_verses_clipboard",
        category: "engagement",
        label: analyticsLabel,
      });
    } catch (err) {
      console.error("Sharing failed", err);
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
      className="share-button"
      disabled={disabled}
      title="Share selected verses"
    >
      {copied ? (
        <>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="share-icon"
          >
            <polyline points="20,6 9,17 4,12" />
          </svg>
        </>
      ) : (
        <>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="share-icon"
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
