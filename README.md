# BlessingsBible

A modern, fast, and user-friendly Bible reading web application built with React and Vite. BlessingsBible allows users to browse, search, and read the Bible with ease, supporting multiple translations and intuitive navigation.

---

## Features

- 📖 **Book & Chapter Navigation**: Quickly select any book and chapter.
- 🔍 **Search**: Find verses or passages by keyword.
- 🌐 **Translation Switcher**: Instantly switch between Bible translations.
- ✨ **Responsive UI**: Clean, mobile-friendly design.
- ⚡ **Fast Performance**: Powered by Vite and React.
- 🗂️ **Structured Data**: Uses a structured JSON for Bible books/chapters.
- 🛠️ **ESLint Integration**: Consistent code quality.

---

## Demo

To run the app locally, see [Getting Started](#getting-started).

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16+ recommended)
- [pnpm](https://pnpm.io/) (preferred, but npm/yarn can be adapted)

### Installation

```bash
pnpm install
```

### Running the App

```bash
pnpm dev
```

The app will be available at [http://localhost:5173](http://localhost:5173) by default.

### Building for Production

```bash
pnpm build
```

### Preview Production Build

```bash
pnpm preview
```

---

## Project Structure

```
BlessingsBible/
├── public/
│   ├── bcc_logo.ico           # BlessingsBible favicon
│   ├── bcc_logo.png           # BlessingsBible logo
│   ├── bible-structure.json   # Bible books/chapters metadata
│   └── vite.svg               # Vite logo
├── src/
│   ├── assets/                # Static assets (e.g., react.svg)
│   ├── components/            # React components
│   │   ├── BookSelector.jsx
│   │   ├── ChapterReader.jsx
│   │   ├── SearchBar.jsx
│   │   ├── TranslationSwitcher.jsx
│   │   └── VerseDisplay.jsx
│   ├── services/
│   │   └── bibleApi.js        # Bible data fetching logic
│   ├── utils/
│   │   └── translationMappings.js
│   ├── App.jsx                # Main app component
│   ├── App.css                # Main app styles
│   ├── index.css              # Global styles
│   └── main.jsx               # App entry point
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── pnpm-lock.yaml
├── vite.config.js
└── README.md
```

---

## Scripts

All scripts use `pnpm` by default:

- `pnpm dev` – Start development server
- `pnpm build` – Build for production
- `pnpm preview` – Preview production build
- `pnpm lint` – Run ESLint

---

## Data

- **Bible Structure**: [`public/bible-structure.json`](public/bible-structure.json:1) contains metadata for books and chapters.
- **Translations**: Managed via [`src/utils/translationMappings.js`](src/utils/translationMappings.js:1) and [`src/components/TranslationSwitcher.jsx`](src/components/TranslationSwitcher.jsx:1).

---

## API

BlessingsBible fetches Bible content from a self-built API:

**Base URL:**  
`https://api.blessings365.top`

### Endpoints Used

- **Single Verse:**  
  `GET /{TRANSLATION}/single?book={BOOK}&chapter={CHAPTER}&verse={VERSE}`  
  Example:  
  `https://api.blessings365.top/ESV/single?book=John&chapter=3&verse=16`

- **Multiple Verses / Ranges / Chapters:**  
  `GET /{TRANSLATION}/multiple?verses={QUERY}`  
  - `QUERY` can be a single reference, a range, or a comma-separated list.  
  Example:  
  `https://api.blessings365.top/ESV/multiple?verses=John%203:16-18,Genesis%201:1`

### Supported Features

- **Translations:** The API supports multiple translations (e.g., ESV, KJV, etc.).
- **Flexible Queries:** Fetch single verses, verse ranges, entire chapters, or multiple references at once.
- **Response Format:** Returns JSON with normalized fields: `book`, `chapter`, `verse`, `text`, `translation`, and `reference`.

### How the App Uses the API

- All Bible text is fetched on demand via [`src/services/bibleApi.js`](src/services/bibleApi.js:1).
- The app parses user input (e.g., "John 3:16" or "Genesis 1:1-3") and constructs the appropriate API request.
- API errors (e.g., verse not found) are handled gracefully in the UI.

### Example Usage

```js
import { fetchSingleVerse, fetchMultipleVerses, fetchVerses } from './src/services/bibleApi';

// Fetch John 3:16 in ESV
const verse = await fetchSingleVerse('ESV', 'John', 3, 16);

// Fetch Genesis 1:1-3 in KJV
const verses = await fetchMultipleVerses('KJV', 'Genesis 1:1-3');

// General fetch (auto-detects single, range, or multiple)
const results = await fetchVerses('ESV', 'John 3:16,Genesis 1:1-3');
```

---

## Contributing

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License.

---

## Acknowledgments

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [pnpm](https://pnpm.io/)
- [Blessings365 Bible API](https://api.blessings365.top)
