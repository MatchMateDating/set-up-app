import logo from './logo.svg';
import './App.css';
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/auth/login';
import SignUp from './components/auth/signUp';
import ProfilePage from './components/profile/profilePage';
import Conversations from './components/conversations/conversations';
import Match from './components/matches/match';
import CompleteProfile from './components/profile/completeProfile';
import Settings from './components/settings/settings';
import Preferences from './components/preferences/preferences';
import MatchConvo from './components/conversations/matchConvo';
import PuzzlesHub from './components/puzzles/puzzlesPage';
import PersonalityQuiz from './components/puzzles/personalityQuiz';

function App() {
  
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/:userId?" element={<ProfilePage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/preferences" element={<Preferences />} />
        <Route path="/conversations" element={<Conversations />} />
        <Route path="/conversation/:matchId" element={<MatchConvo />} />
        <Route path="/match" element={<Match />} />
        <Route path="/puzzles" element={<PuzzlesHub />} />
        <Route path="/puzzles/personality-quiz" element={<PersonalityQuiz />} />
      </Routes>
    </Router>
  );
}

export default App;
