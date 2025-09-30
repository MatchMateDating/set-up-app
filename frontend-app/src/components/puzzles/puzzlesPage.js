// src/components/GameHub.js
import React from "react";
import { useNavigate } from "react-router-dom";
import SideBar from '../layout/sideBar';
import './puzzles.css';
import { FaArrowLeft } from 'react-icons/fa';

const PuzzlesHub = () => {
  const navigate = useNavigate();

  const games = [
    { name: "Personality Quiz", path: "/puzzles/personality-quiz" },
    { name: "Memory Match", path: "/puzzles/memory" },
    { name: "Trivia Challenge", path: "/puzzles/trivia" }
  ];

  return (
    <div className="puzzles-page">
      <SideBar/>
      <div className="puzzles-container">
        <button className="back-btn" onClick={() => navigate('/profile')}>
          <FaArrowLeft /> Back
        </button>
        <h1 className="puzzles-title">🎮 Puzzles Hub</h1>
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
    </div>
  );
};

export default PuzzlesHub;
