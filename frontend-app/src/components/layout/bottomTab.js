import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaUser, FaComments, FaHeart } from 'react-icons/fa';
import './bottomTab.css';

const BottomTab = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { label: '', icon: <FaUser />, path: '/profile' },
    { label: '', icon: <FaComments />, path: '/conversations' },
    { label: '', icon: <FaHeart />, path: '/match' },
  ];

  return (
    <div className="bottom-tab">
      {tabs.map((tab) => (
        <button
          key={tab.path}
          className={`tab-button ${location.pathname === tab.path ? 'active' : ''}`}
          onClick={() => navigate(tab.path)}
        >
          <div className="tab-icon">{tab.icon}</div>
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

export default BottomTab;
