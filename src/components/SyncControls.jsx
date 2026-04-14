import React, { useState, useCallback, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import "./SyncControls.css";

const SyncControls = ({
  translations,
  onAddTranslation,
  onRemoveTranslation,
  syncEnabled,
  onToggleSync,
  maxTranslations = 4,
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [menuCoords, setMenuCoords] = useState(null);
  const addBtnRef = useRef(null);

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
    "CUV",
  ];

  const filteredTranslations = availableTranslations.filter(
    (t) => !translations.includes(t),
  );
  const atMax = translations.length >= maxTranslations;

  const handleToggleMenu = useCallback(() => {
    if (!showAddMenu && addBtnRef.current) {
      const rect = addBtnRef.current.getBoundingClientRect();
      setMenuCoords(rect);
    }
    setShowAddMenu((prev) => !prev);
  }, [showAddMenu]);

  const handleAddClick = useCallback(
    (translation) => {
      onAddTranslation(translation);
      setShowAddMenu(false);
    },
    [onAddTranslation],
  );

  const handleRemoveClick = useCallback(
    (translation) => {
      onRemoveTranslation(translation);
    },
    [onRemoveTranslation],
  );

  // Close menu on outside click
  useEffect(() => {
    if (!showAddMenu) return;
    const handler = (e) => {
      if (
        addBtnRef.current &&
        !addBtnRef.current.contains(e.target) &&
        !e.target.closest(".translation-menu")
      ) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [showAddMenu]);

  // Portal dropdown — escapes any overflow:auto container
  const menu =
    showAddMenu && menuCoords
      ? ReactDOM.createPortal(
          <div
            className="translation-menu"
            style={{
              position: "fixed",
              // Open downward from the button's bottom edge
              top: `${menuCoords.bottom + 4}px`,
              left: `${Math.min(menuCoords.left, window.innerWidth - 150)}px`,
              zIndex: 2000,
            }}
          >
            {filteredTranslations.map((translation) => (
              <button
                key={translation}
                className="menu-item"
                onClick={() => handleAddClick(translation)}
              >
                {translation}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

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
              <g>
                <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z" />
                <path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z" />
              </g>
            ) : (
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

        {filteredTranslations.length > 0 && !atMax && (
          <div className="add-translation-container">
            <button
              ref={addBtnRef}
              className="add-translation"
              onClick={handleToggleMenu}
              title="Add translation"
            >
              + Add
            </button>
            {menu}
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
  maxTranslations: PropTypes.number,
};
