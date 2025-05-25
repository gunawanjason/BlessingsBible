import React from 'react';
import './VerseDisplay.css';

const VerseDisplay = ({ verses }) => {
  if (!verses || verses.length === 0) {
    return (
      <div className="verse-display empty">
        <p className="placeholder-text">
          Search for Bible verses to display them here
        </p>
      </div>
    );
  }

  return (
    <div className="verse-display">
      {verses.map((verse, index) => (
        <div key={index} className="verse-item">
          <div className="verse-reference">
            {verse.book} {verse.chapter}:{verse.verse}
          </div>
          <div className="verse-text">
            {verse.text}
          </div>
        </div>
      ))}
    </div>
  );
};

export default VerseDisplay;