import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaUser, FaHeart, FaComments, FaCog } from 'react-icons/fa';
import { getRoleAccentColor } from '../../theme/roleTheme';
import './bottomTab.css';

const tabs = [
  {
    path: '/profile',
    match: (p) => p === '/profile' || (p.startsWith('/profile/') && p !== '/profile'),
    Icon: FaUser,
  },
  {
    path: '/match',
    match: (p) => p === '/match',
    Icon: FaHeart,
  },
  {
    path: '/conversations',
    match: (p) => p === '/conversations',
    Icon: FaComments,
  },
  {
    path: '/settings',
    match: (p) => p === '/settings',
    Icon: FaCog,
  },
];

const BottomTab = ({ role: roleProp }) => {
  const navigate = useNavigate();
  const location = useLocation();
  let role = roleProp;
  if (!role) {
    try {
      role = JSON.parse(localStorage.getItem('user') || '{}')?.role || 'matchmaker';
    } catch {
      role = 'matchmaker';
    }
  }
  const accentColor = getRoleAccentColor(role);
  const isDater = role === 'user';

  return (
    <nav
      className={`bottom-tab ${isDater ? 'dater' : 'matchmaker'}`}
      style={{ '--tab-accent': accentColor }}
    >
      {tabs.map(({ path, match, Icon }) => {
        const active = match(location.pathname);
        return (
          <button
            key={path}
            type="button"
            className={`tab-button ${active ? 'active' : ''}`}
            onClick={() => navigate(path)}
            aria-label={path.slice(1)}
          >
            <Icon className="tab-icon" size={20} />
          </button>
        );
      })}
    </nav>
  );
};

export default BottomTab;
