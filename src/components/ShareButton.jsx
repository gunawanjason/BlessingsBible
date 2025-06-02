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
          ✅ <span className="share-text">Copied!</span>
        </>
      ) : (
        <>
          🔗 <span className="share-text">Share</span>
          {verseCount > 0 && <span className="share-count">{verseCount}</span>}
        </>
      )}
    </button>
  );
};

export default ShareButton;
