import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../layout/AppShell';
import './puzzles.css';
import { FaArrowLeft } from 'react-icons/fa';

export const games = [
  {
    name: 'Spirit Animal Quiz',
    path: '/puzzles/spirit-animal',
    description: "5 questions · find your match's animal",
    icon: '🦊',
    iconBg: '#FFE8EE',
  },
  {
    name: 'Zodiac Sign Quiz',
    path: '/puzzles/zodiac',
    description: "Guess each other's signs",
    icon: '♒',
    iconBg: '#EDE8F8',
  },
  {
    name: 'Trivia Challenge',
    path: '/puzzles/trivia',
    description: '10 rounds · head to head',
    icon: '🏆',
    iconBg: '#E2F5EC',
  },
];

const PuzzlesHub = () => {
  const navigate = useNavigate();

  return (
    <AppShell showTabs={false}>
      <div className="puzzles-container">
        <button type="button" className="back-btn" onClick={() => navigate('/settings')}>
          <FaArrowLeft /> Back
        </button>
        <h1 className="puzzles-title">Puzzles Hub</h1>
        <div className="puzzles-grid">
          {games.map((game) => (
            <button
              key={game.path}
              type="button"
              onClick={() => navigate(game.path)}
              className="puzzle-button puzzle-button-card"
            >
              <span className="puzzle-button-icon" aria-hidden="true">
                {game.icon}
              </span>
              <span className="puzzle-button-name">{game.name}</span>
              {game.description ? (
                <span className="puzzle-button-desc">{game.description}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
};

export default PuzzlesHub;
