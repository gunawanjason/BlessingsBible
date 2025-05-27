// src/utils/ga.js
export const GA_MEASUREMENT_ID = "G-F8YY34PNLD";

export function sendPageView(page_path) {
  if (window.gtag) {
    window.gtag("event", "page_view", {
      page_path,
    });
  }
}

export function sendEvent({ action, category, label, value }) {
  if (window.gtag) {
    window.gtag("event", action, {
      event_category: category,
      event_label: label,
      value,
    });
  }
}
