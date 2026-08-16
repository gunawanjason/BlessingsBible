import React, {
  useState,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
} from "react";
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
  const [menuPosition, setMenuPosition] = useState(null);
  const addBtnRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = `${useId()}-translation-menu`;

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

  const closeMenu = useCallback((restoreFocus = false) => {
    setShowAddMenu(false);
    setMenuPosition(null);

    if (restoreFocus) {
      requestAnimationFrame(() => addBtnRef.current?.focus());
    }
  }, []);

  // Keep the portal inside the viewport, opening above the trigger when needed.
  const updateMenuPosition = useCallback(() => {
    const trigger = addBtnRef.current;
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const menu = menuRef.current;
    const viewportPadding = 8;
    const gap = 4;
    const menuWidth = Math.max(menu?.getBoundingClientRect().width || 0, 160);
    const maxViewportHeight = Math.max(
      44,
      window.innerHeight - viewportPadding * 2,
    );
    const measuredHeight =
      menu?.scrollHeight || Math.min(maxViewportHeight, 320);
    const availableBelow = Math.max(
      44,
      window.innerHeight - triggerRect.bottom - gap - viewportPadding,
    );
    const availableAbove = Math.max(
      44,
      triggerRect.top - gap - viewportPadding,
    );
    const openAbove =
      availableBelow < Math.min(measuredHeight, maxViewportHeight) &&
      availableAbove > availableBelow;
    const availableHeight = openAbove ? availableAbove : availableBelow;
    const height = Math.min(
      measuredHeight,
      maxViewportHeight,
      Math.max(44, availableHeight),
    );
    const top = openAbove
      ? Math.max(viewportPadding, triggerRect.top - gap - height)
      : Math.min(
          window.innerHeight - viewportPadding - height,
          triggerRect.bottom + gap,
        );
    const left = Math.min(
      Math.max(viewportPadding, triggerRect.left),
      Math.max(
        viewportPadding,
        window.innerWidth - menuWidth - viewportPadding,
      ),
    );
    const nextPosition = {
      top,
      left,
      maxHeight: Math.max(44, availableHeight),
    };

    setMenuPosition((previous) => {
      if (
        previous &&
        previous.top === nextPosition.top &&
        previous.left === nextPosition.left &&
        previous.maxHeight === nextPosition.maxHeight
      ) {
        return previous;
      }
      return nextPosition;
    });
  }, []);

  const handleToggleMenu = useCallback(() => {
    if (showAddMenu) {
      closeMenu();
      return;
    }

    const rect = addBtnRef.current?.getBoundingClientRect();
    if (!rect) return;

    setMenuPosition({
      top: rect.bottom + 4,
      left: rect.left,
      maxHeight: Math.max(44, window.innerHeight - 16),
    });
    setShowAddMenu(true);
  }, [closeMenu, showAddMenu]);

  const handleAddClick = useCallback(
    (translation) => {
      onAddTranslation(translation);
      closeMenu(true);
    },
    [closeMenu, onAddTranslation],
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
        !menuRef.current?.contains(e.target)
      ) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [closeMenu, showAddMenu]);

  useLayoutEffect(() => {
    if (!showAddMenu) return undefined;

    updateMenuPosition();
    const handleViewportChange = () => updateMenuPosition();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [showAddMenu, updateMenuPosition]);

  useEffect(() => {
    if (!showAddMenu) return;

    const focusMenu = requestAnimationFrame(() => {
      menuRef.current?.querySelector('[role="menuitem"]')?.focus();
    });

    return () => cancelAnimationFrame(focusMenu);
  }, [showAddMenu]);

  const handleMenuKeyDown = useCallback(
    (event) => {
      if (!menuRef.current) return;

      const items = Array.from(
        menuRef.current.querySelectorAll('[role="menuitem"]'),
      );
      if (items.length === 0) return;
      const currentIndex = items.indexOf(document.activeElement);
      let nextIndex = currentIndex;

      if (event.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % items.length;
      } else if (event.key === "ArrowUp") {
        nextIndex = (currentIndex - 1 + items.length) % items.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = items.length - 1;
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
        return;
      } else if (event.key === "Tab") {
        closeMenu();
        return;
      } else {
        return;
      }

      event.preventDefault();
      items[nextIndex]?.focus();
    },
    [closeMenu],
  );

  // Portal dropdown — escapes any overflow:auto container
  const menu =
    showAddMenu && menuPosition
      ? ReactDOM.createPortal(
          <div
            className="translation-menu"
            id={menuId}
            ref={menuRef}
            role="menu"
            aria-label="Available translations"
            onKeyDown={handleMenuKeyDown}
            style={{
              position: "fixed",
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              right: "auto",
              maxHeight: `${menuPosition.maxHeight}px`,
              zIndex: 2000,
            }}
          >
            {filteredTranslations.map((translation) => (
              <button
                key={translation}
                className="menu-item"
                onClick={() => handleAddClick(translation)}
                role="menuitem"
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
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
          >
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
            aria-label={
              index === 0
                ? `${translation}, synced with main translation`
                : `Remove ${translation}`
            }
          >
            {translation}
            {index === 0 ? (
              <span className="sync-icon" aria-hidden="true">
                🔗
              </span>
            ) : (
              <span className="remove-icon" aria-hidden="true">
                ×
              </span>
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
              aria-expanded={showAddMenu}
              aria-haspopup="menu"
              aria-controls={menuId}
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
