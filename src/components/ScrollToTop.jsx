import React, { useState, useEffect } from "react";
import "./ScrollToTop.css";

const ScrollToTop = ({
  containerRef = null,
  threshold = 300,
  className = "",
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollContainer = containerRef?.current || window;
      const scrollTop = containerRef?.current
        ? containerRef.current.scrollTop
        : window.pageYOffset || document.documentElement.scrollTop;

      setIsVisible(scrollTop > threshold);
    };

    const scrollContainer = containerRef?.current || window;

    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll, {
        passive: true,
      });

      // Check initial scroll position
      handleScroll();

      return () => {
        scrollContainer.removeEventListener("scroll", handleScroll);
      };
    }
  }, [containerRef, threshold]);

  const scrollToTop = () => {
    const scrollContainer = containerRef?.current || window;

    if (containerRef?.current) {
      // Scroll container element
      containerRef.current.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } else {
      // Scroll window
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  if (!isVisible) return null;

  return (
    <button
      className={`scroll-to-top ${className}`}
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
    </button>
  );
};

export default ScrollToTop;
