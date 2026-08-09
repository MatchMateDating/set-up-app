import React from 'react';
import './toggleConversations.css';

const ToggleConversations = ({
  showDaterMatches,
  setShowDaterMatches,
  accentColor = '#ef4d73',
}) => (
  <div className="conversations-toggle-track">
    <button
      type="button"
      className={`conversations-toggle-segment${
        showDaterMatches ? ' conversations-toggle-segment-active' : ''
      }`}
      style={showDaterMatches ? { backgroundColor: accentColor } : undefined}
      onClick={() => setShowDaterMatches(true)}
    >
      Dater Matches
    </button>
    <button
      type="button"
      className={`conversations-toggle-segment${
        !showDaterMatches ? ' conversations-toggle-segment-active' : ''
      }`}
      style={!showDaterMatches ? { backgroundColor: accentColor } : undefined}
      onClick={() => setShowDaterMatches(false)}
    >
      Matchmaker Matches
    </button>
  </div>
);

export default ToggleConversations;
