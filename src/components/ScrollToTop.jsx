import React, { useState, useEffect, useRef, useCallback } from "react";
import "./ScrollToTop.css";

const AUTO_HIDE_DELAY = 1000;

const ScrollToTop = ({
  containerRef = null,
  threshold = 300,
  className = "",
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isFaded, setIsFaded] = useState(false);
  const fadeTimerRef = useRef(null);
  // Remembers which element scrolled past threshold so scrollToTop() knows what to scroll
  const scrollTargetRef = useRef(null);
  // Tracks previous visibility so we only start the timer on the visible→visible transition
  const wasVisibleRef = useRef(false);

  const resetFadeTimer = useCallback(() => {
    setIsFaded(false);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => setIsFaded(true), AUTO_HIDE_DELAY);
  }, []);

  useEffect(() => {
    const handleScroll = (e) => {
      if (containerRef?.current && e.target !== containerRef.current) return;

      const target = e.target;
      const scrollTop =
        target === document || target === window
          ? window.pageYOffset || document.documentElement.scrollTop
          : target.scrollTop;

      const visible = scrollTop > threshold;

      if (visible) {
        scrollTargetRef.current = target === document ? window : target;
      }

      // Only start the fade timer when the button first becomes visible.
      // Do NOT call resetFadeTimer() on every scroll event — iOS momentum scrolling
      // fires scroll events for seconds after the finger lifts, which would prevent
      // the timer from ever firing.
      if (visible && !wasVisibleRef.current) {
        resetFadeTimer();
      }

      wasVisibleRef.current = visible;
      setIsVisible(visible);
    };

    // touchmove fires only while the finger is physically moving (stops at lift,
    // before momentum begins) — safe to reset the timer here
    const handleTouchMove = () => resetFadeTimer();

    // wheel covers desktop mouse wheel and trackpad active scrolling
    const handleWheel = () => resetFadeTimer();

    // capture:true catches scroll from ANY scrollable element (fixes mobile where
    // the scroll container is .chapter-content or .verses-list, not window)
    document.addEventListener("scroll", handleScroll, {
      capture: true,
      passive: true,
    });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("wheel", handleWheel, { passive: true });

    return () => {
      document.removeEventListener("scroll", handleScroll, { capture: true });
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("wheel", handleWheel);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [containerRef, threshold, resetFadeTimer]);

  const scrollToTop = () => {
    if (containerRef?.current) {
      containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    } else if (scrollTargetRef.current) {
      scrollTargetRef.current.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (!isVisible) return null;

  return (
    <button
      className={`scroll-to-top${isFaded ? " scroll-to-top--faded" : ""} ${className}`}
      onClick={scrollToTop}
      aria-label="Scroll to top"
      title="Scroll to top"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="scroll-to-top-icon"
      >
        <polyline points="18,15 12,9 6,15"></polyline>
      </svg>
      <span className="scroll-to-top-label">Top</span>
    </button>
  );
};

export default ScrollToTop;
