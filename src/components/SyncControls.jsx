import React, { useState, useCallback } from "react";
import PropTypes from "prop-types";
import "./SyncControls.css";

const SyncControls = ({
  translations,
  onAddTranslation,
  onRemoveTranslation,
  syncEnabled,
  onToggleSync,
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const availableTranslations = [
    "TB",
    "KJV",
    "NIV",
    "ESV",
    "NLT",
    "NASB",
    "TLB",
    "CNVS",
    "CUNPSS-上帝",
    "CUNPSS-神",
  ];

  // Filter out already selected translations
  const filteredTranslations = availableTranslations.filter(
    (t) => !translations.includes(t)
  );

  const handleAddClick = useCallback(
    (translation) => {
      onAddTranslation(translation);
      setShowAddMenu(false);
    },
    [onAddTranslation]
  );

  const handleRemoveClick = useCallback(
    (translation) => {
      onRemoveTranslation(translation);
    },
    [onRemoveTranslation]
  );

  return (
    <div className="sync-controls">
      <div className="controls-group">
        <button
          className={`sync-toggle ${syncEnabled ? "active" : ""}`}
          onClick={onToggleSync}
          title={syncEnabled ? "Disable sync" : "Enable sync"}
          aria-pressed={syncEnabled}
          aria-label={
            syncEnabled ? "Disable selection sync" : "Enable selection sync"
          }
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            {syncEnabled ? (
              // Sync enabled: Two connected arrows in a circle
              <g>
                <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z" />
                <path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z" />
              </g>
            ) : (
              // Sync disabled: Broken/disconnected arrows
              <g>
                <path
                  d="M4 12l1.41 1.41L11 7.83V14h2V7.83l5.58 5.59L20 12l-8-8-8 8z"
                  opacity="0.3"
                />
                <path
                  d="M20 12l-1.41-1.41L13 16.17V10h-2v6.17l-5.58-5.59L4 12l8 8 8-8z"
                  opacity="0.3"
                />
                <path d="M2.81 2.81L1.39 4.22l6.18 6.18L4 12l8 8 2.83-2.83L20.78 22.78l1.41-1.41L2.81 2.81z" />
              </g>
            )}
          </svg>
          <span className="sync-text">
            {syncEnabled ? "Selection Sync On" : "Selection Sync Off"}
          </span>
        </button>
      </div>

      <div className="controls-group">
        {translations.map((translation, index) => (
          <button
            key={translation}
            className={`translation-tag ${index === 0 ? "primary" : ""}`}
            onClick={
              index === 0 ? undefined : () => handleRemoveClick(translation)
            }
            title={
              index === 0
                ? `${translation} (synced with main)`
                : `Remove ${translation}`
            }
            disabled={index === 0}
          >
            {translation}
            {index === 0 ? (
              <span className="sync-icon">🔗</span>
            ) : (
              <span className="remove-icon">×</span>
            )}
          </button>
        ))}

        {filteredTranslations.length > 0 && (
          <div className="add-translation-container">
            <button
              className="add-translation"
              onClick={() => setShowAddMenu(!showAddMenu)}
              title="Add translation"
            >
              + Add
            </button>

            {showAddMenu && (
              <div className="translation-menu">
                {filteredTranslations.map((translation) => (
                  <button
                    key={translation}
                    className="menu-item"
                    onClick={() => handleAddClick(translation)}
                  >
                    {translation}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(SyncControls);

SyncControls.propTypes = {
  translations: PropTypes.arrayOf(PropTypes.string).isRequired,
  onAddTranslation: PropTypes.func.isRequired,
  onRemoveTranslation: PropTypes.func.isRequired,
  syncEnabled: PropTypes.bool.isRequired,
  onToggleSync: PropTypes.func.isRequired,
};
