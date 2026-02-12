import React from "react";

const ToggleConversations = ({ showDaterMatches, setShowDaterMatches }) => (
  <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "center" }}>
    <button
      onClick={() => setShowDaterMatches(true)}
      style={{
        backgroundColor: showDaterMatches ? "#007bff" : "#ccc",
        color: "white",
        padding: "10px 20px",
        marginRight: "10px",
        borderRadius: "5px",
        border: "none",
      }}
    >
      Dater Matches
    </button>
    <button
      onClick={() => setShowDaterMatches(false)}
      style={{
        backgroundColor: !showDaterMatches ? "#007bff" : "#ccc",
        color: "white",
        padding: "10px 20px",
        borderRadius: "5px",
        border: "none",
      }}
    >
      Matchmaker Matches
    </button>
  </div>
);

export default ToggleConversations;
