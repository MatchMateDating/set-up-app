import React from "react";
import { games } from "../puzzles/puzzlesPage";
import "./conversationPuzzle.css";

const SendPuzzle = ({ selectedPuzzleType, selectedPuzzleLink, onPuzzleChange, onClose }) => {
    return (
      <div className="send-puzzle">
        <div className="send-puzzle-row">
          <select
            className="send-puzzle-select"
            value={selectedPuzzleLink}
            onChange={(e) => {
              const selectedGame = games.find(game => game.path === e.target.value);
              if (selectedGame) {
                onPuzzleChange(selectedGame.name, selectedGame.path);
              }
            }}
          >
            {games.map((game) => (
              <option key={game.path} value={game.path}>{game.name}</option>
            ))}
          </select>
          <button className="send-puzzle-close" onClick={onClose}>✖</button>
        </div>
      </div>
    );
  };
  

export default SendPuzzle;
