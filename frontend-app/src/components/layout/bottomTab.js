// src/components/BottomTab.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './bottomTab.css';
// import Profile from './profile';
// import Conversations from './conversations';
// import Match from '../matches/match';

const BottomTab = () => {
  const navigate = useNavigate();

  return (
    <div className="bottom-tab">
      <button onClick={() => navigate('/profile')}>Profile</button>
      <button onClick={() => navigate('/conversations')}>Conversations</button>
      <button onClick={() => navigate('/match')}>Match</button>
    </div>
  );
};

export default BottomTab;
