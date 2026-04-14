<div align="center">
  <img src="public/bcc_logo.png" alt="BlessingsBible" width="96" height="96" />

# BlessingsBible

**A fast, modern, multi-translation Bible reader for the web.**

Read Scripture in 11 translations across English, Indonesian, and Chinese — compare translations side by side, highlight verses, and share passages with a single link.

  <p>
    <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" />
    <img alt="Vite" src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" />
    <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white" />
    <img alt="pnpm" src="https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white" />
    <img alt="License" src="https://img.shields.io/badge/license-MIT-green" />
  </p>
</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Supported Translations](#supported-translations)
- [Screenshots & Views](#screenshots--views)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [URL Sharing](#url-sharing)
- [Caching Strategy](#caching-strategy)
- [Analytics](#analytics)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

---

## Overview

**BlessingsBible** is a single-page web app that turns Scripture into a frictionless reading experience. Pick any book and chapter, switch between translations instantly, compare up to **five translations** side by side with synchronized (or independent) scrolling, select verses with a tap, and share or copy them with proper formatting — all without a page reload.

Built with **React 19**, **Vite 6**, and **Tailwind CSS**, it ships with smart client-side caching, a polished dark mode, pericope headings, print-friendly styling, and a responsive UI that works cleanly on mobile, tablet, and desktop.

---

## Features

### Reading

- **Reader view** — Clean, chapter-at-a-time reading with pericope headings and typographic spacing tuned for long-form scripture.
- **Verse selection** — Click any verse to select it. Select multiple verses to form ranges (ranges are auto-detected and collapsed, e.g. `3:16-18`).
- **Highlight-on-search** — Searched verses are visually highlighted and auto-scrolled into view.
- **Previous / Next chapter** — Navigate seamlessly across chapters _and_ across book boundaries (Revelation 22 → Genesis 1 stops at the ends).
- **Scroll-to-top** — Elegant floating button appears after scrolling down a chapter.
- **Print-ready** — A dedicated print stylesheet produces clean, distraction-free pages.

### Translation & Comparison

- **11 translations** across 3 languages (English, Indonesian, Traditional & Simplified Chinese).
- **Instant translation switcher** — Dropdown on desktop, native-feeling bottom sheet on mobile.
- **Side-by-side comparison** — Compare **2 to 5 translations** simultaneously.
- **Synchronized scroll** — Scroll one panel, the rest follow. Toggle sync off to scroll each column independently.
- **Localized book names** — Book names automatically display in the active translation's language.

### Sharing & Clipboard

- **Shareable URLs** — Every reading state (book, chapter, translation, selected verses) is encoded in the URL. Copy it, paste it, and friends land exactly where you were.
- **Smart copy format** — Copied text includes the full citation header (e.g. `John 3:16-18 ESV`) and preserves line breaks.
- **Comparison copy** — Copying in comparison view includes all selected translations, labelled and formatted.

### Experience

- **Dark mode** — Persisted to `localStorage`, with smooth theming across every component via CSS tokens.
- **Welcome banner** — One-time onboarding that surfaces the selection & copy tips.
- **Fast as light** — Smart on-device cache means re-opening a chapter is instant.
- **Responsive** — Desktop, tablet, and mobile layouts with a dedicated mobile nav drawer.
- **Accessible** — Semantic roles (`tab`, `tablist`, `alert`), ARIA labels, and keyboard-friendly controls.

---

## Supported Translations

| Code          | Name                                         | Language   |
| ------------- | -------------------------------------------- | ---------- |
| `KJV`         | King James Version                           | English    |
| `NIV`         | New International Version                    | English    |
| `ESV`         | English Standard Version                     | English    |
| `NLT`         | New Living Translation                       | English    |
| `NASB`        | New American Standard Bible                  | English    |
| `TLB`         | The Living Bible                             | English    |
| `TB`          | Terjemahan Baru                              | Indonesian |
| `CNVS`        | 新汉语译本 (Chinese New Version, Simplified) | 简体中文   |
| `CUNPSS-上帝` | 和合本 (Union Version, 上帝 edition)         | 简体中文   |
| `CUNPSS-神`   | 和合本 (Union Version, 神 edition)           | 简体中文   |
| `CUV`         | 和合本 (Chinese Union Version)               | 繁體中文   |

Translation-to-language mappings live in [`src/utils/translationMappings.js`](src/utils/translationMappings.js), alongside localized book names for each language.

---

## Screenshots & Views

BlessingsBible has two primary views:

- **Reader** — A single translation, rendered as a full chapter with pericope headings.
- **Comparison** — 2–5 translations in parallel columns, with a sync toggle and per-column translation controls.

Toggle between them via the tab bar directly beneath the main navigation.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) **v18+** (v20 LTS recommended)
- [pnpm](https://pnpm.io/) **v8+** — npm and yarn also work, but the lockfile targets pnpm

### Install

```bash
pnpm install
```

### Develop

```bash
pnpm dev
```

Then open [http://localhost:5173](http://localhost:5173).

### Build for production

```bash
pnpm build
```

### Preview the production build

```bash
pnpm preview
```

### Lint

```bash
pnpm lint
```

### Format

```bash
pnpm prettier          # write formatting changes
pnpm prettier:check    # verify formatting (useful in CI)
```

---

## Scripts

| Script                | Purpose                                           |
| --------------------- | ------------------------------------------------- |
| `pnpm dev`            | Start the Vite dev server with HMR                |
| `pnpm build`          | Produce an optimized production bundle in `dist/` |
| `pnpm preview`        | Serve the production build locally                |
| `pnpm lint`           | Run ESLint across the project                     |
| `pnpm prettier`       | Format the codebase with Prettier                 |
| `pnpm prettier:check` | Check formatting without writing changes          |

---

## Project Structure

```
BlessingsBible/
├── public/
│   ├── bcc_logo.ico
│   ├── bcc_logo.png
│   ├── bible-structure.json        # Canonical book/chapter metadata
│   └── vite.svg
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── BookSelector.jsx        # Book + chapter picker with prev/next
│   │   ├── ChapterReader.jsx       # Single-translation reader
│   │   ├── ComparisonView.jsx      # Shared comparison scaffolding
│   │   ├── ScrollToTop.jsx         # Floating scroll-to-top button
│   │   ├── SearchBar.jsx           # Verse reference parser + search
│   │   ├── ShareButton.jsx         # URL share with clipboard fallback
│   │   ├── SyncControls.jsx        # Sync toggle + add/remove translations
│   │   ├── TranslationSwitcher.jsx # Dropdown / bottom-sheet picker
│   │   ├── VerseComparisonPanel.jsx# 2–5 column comparison view
│   │   └── VerseDisplay.jsx        # Selectable verse primitive
│   ├── services/
│   │   ├── bibleApi.js             # API client (fetch/parse/normalize)
│   │   └── bibleCache.js           # In-memory + localStorage cache
│   ├── styles/                     # Design tokens & modular CSS layers
│   │   ├── tokens.css              # Colors, spacing, typography tokens
│   │   ├── base.css
│   │   ├── buttons.css
│   │   ├── layout.css
│   │   ├── navigation.css
│   │   ├── print.css
│   │   ├── status-bar.css
│   │   ├── tab-bar.css
│   │   ├── welcome-banner.css
│   │   └── index.css               # Barrel import
│   ├── utils/
│   │   ├── ga.js                   # Google Analytics helpers
│   │   ├── translationMappings.js  # Translation ↔ language ↔ book names
│   │   └── urlUtils.js             # Shareable URL encode / decode
│   ├── App.jsx                     # Root component & global state
│   ├── VerseContext.jsx            # Verse data context
│   ├── useVerseData.jsx            # Verse provider + hook
│   ├── index.css                   # Tailwind entry
│   └── main.jsx                    # React entry point
├── eslint.config.js
├── index.html
├── package.json
├── pnpm-lock.yaml
├── postcss.config.js
├── tailwind.config.js
└── vite.config.js
```

---

## Architecture

### State ownership

Global app state (selected book, chapter, translation, view mode, dark mode, selections, comparison config) lives in `App.jsx`. A thin **`VerseProvider`** exposes a ref to the currently rendered chapter's verses so that features like copy-to-clipboard can read formatted verse text without prop-drilling.

### Data flow

```
  User action (select book, search, switch translation)
          │
          ▼
  App.jsx state  ──────▶  bibleApi.js (fetch + parse)
          │                       │
          │                       ▼
          │              bibleCache.js  (memory + localStorage)
          │                       │
          ▼                       ▼
  ChapterReader / VerseComparisonPanel  ──▶  VerseDisplay
```

### Styling

Styles are layered: **design tokens → base → components**. All theming (light/dark) flows through CSS custom properties declared in [`src/styles/tokens.css`](src/styles/tokens.css) and toggled by a `data-theme` attribute on `<html>`. Tailwind is present for utility classes where they add value; component CSS files handle more complex patterns.

---

## API Reference

BlessingsBible fetches Bible content from a self-hosted REST API.

**Base URL:** `https://api.blessings365.top`

### Endpoints

**Single verse**

```
GET /{TRANSLATION}/single?book={BOOK}&chapter={CHAPTER}&verse={VERSE}
```

Example:

```
https://api.blessings365.top/ESV/single?book=John&chapter=3&verse=16
```

**Multiple verses, ranges, whole chapters, or mixed references**

```
GET /{TRANSLATION}/multiple?verses={QUERY}
```

`QUERY` accepts:

- a single reference — `John 3:16`
- a range — `John 3:16-18`
- a chapter — `Psalms 23`
- a comma-separated list — `John 3:16-18, Genesis 1:1`

### Response shape

Every verse is returned as a normalized object:

```json
{
  "book": "John",
  "chapter": 3,
  "verse": 16,
  "text": "For God so loved the world…",
  "translation": "ESV",
  "reference": "John 3:16"
}
```

### Client usage

```js
import {
  fetchSingleVerse,
  fetchMultipleVerses,
  fetchVerses,
} from "./src/services/bibleApi";

// Single verse
const v = await fetchSingleVerse("ESV", "John", 3, 16);

// Range
const range = await fetchMultipleVerses("KJV", "Genesis 1:1-3");

// Auto-detects single / range / mixed list
const mixed = await fetchVerses("ESV", "John 3:16, Genesis 1:1-3");

// Compare the same verse across translations in parallel
const [esv, kjv, niv] = await Promise.all([
  fetchSingleVerse("ESV", "John", 3, 16),
  fetchSingleVerse("KJV", "John", 3, 16),
  fetchSingleVerse("NIV", "John", 3, 16),
]);
```

Errors (network failures, verse-not-found) are caught and surfaced in the UI as a dismissible status bar.

---

## URL Sharing

Every reading state is fully encoded in the URL. This means:

- **Deep-linking** — Any chapter, translation, or selected-verse set can be linked to.
- **Copy-paste friendly** — Share URLs preserve the active translation and all selected verses.
- **Stateless refresh** — Reloading the page restores exactly what you were reading.

URL encoding / decoding lives in [`src/utils/urlUtils.js`](src/utils/urlUtils.js). The `ShareButton` component uses the Web Share API where available and falls back to copying the URL to the clipboard.

---

## Caching Strategy

Verse data is cached in two layers via [`src/services/bibleCache.js`](src/services/bibleCache.js):

1. **In-memory** — Instant re-reads within a session.
2. **`localStorage`** — Survives reloads and offline-ish scenarios for previously visited chapters.

The cache is keyed by `{translation, book, chapter}`. Switching translations on a cached chapter is effectively instant on the second visit.

---

## Analytics

The app emits lightweight, privacy-conscious Google Analytics events via [`src/utils/ga.js`](src/utils/ga.js):

- **Page views** on book/chapter/translation change
- **Heartbeats** every 60s for engagement rate
- **Interactions** — `translation_change`, `book_change`, `chapter_change`, `verse_search`, `copy_verses`, `dark_mode_toggle`, `tab_switch`, etc.

Disable analytics by removing or no-op'ing the helpers in `src/utils/ga.js`.

---

## Contributing

Contributions, bug reports, and feature ideas are warmly welcomed.

1. Fork the repository
2. Create a feature branch — `git checkout -b feature/your-feature`
3. Commit your changes — `git commit -am 'feat: add your feature'`
4. Push to your fork — `git push origin feature/your-feature`
5. Open a Pull Request against `main`

Please run `pnpm lint` and `pnpm prettier` before submitting. Small, focused PRs with clear descriptions get merged faster.

---

## License

Released under the **MIT License**. See [`LICENSE`](LICENSE) for details.

---

## Acknowledgments

- [React](https://react.dev/) · [Vite](https://vitejs.dev/) · [Tailwind CSS](https://tailwindcss.com/) · [pnpm](https://pnpm.io/)
- [Blessings365 Bible API](https://api.blessings365.top) — the text engine powering this app
- Every translation committee and publisher whose work makes Scripture accessible across languages

<div align="center">

_Built with care, for the Word._

</div>
