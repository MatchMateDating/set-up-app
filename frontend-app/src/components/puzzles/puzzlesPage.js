// src/components/GameHub.js
import React from "react";
import { useNavigate } from "react-router-dom";
import AppShell from '../layout/AppShell';
import './puzzles.css';
import { FaArrowLeft } from 'react-icons/fa';

export const games = [
  { name: "Personality Quiz", path: "/puzzles/personality-quiz" },
  { name: "Memory Match", path: "/puzzles/memory" },
  { name: "Trivia Challenge", path: "/puzzles/trivia" }
];

const PuzzlesHub = () => {
  const navigate = useNavigate();

  return (
    <AppShell showTabs={false}>
      <div className="puzzles-container">
        <button className="back-btn" onClick={() => navigate('/settings')}>
          <FaArrowLeft /> Back
        </button>
        <h1 className="puzzles-title">Puzzles Hub</h1>
        <div className="puzzles-grid">
          {games.map((game) => (
            <button
              key={game.path}
              onClick={() => navigate(game.path)}
              className="puzzle-button"
            >
              {game.name}
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
};

export default PuzzlesHub;
