import React from 'react';
import { FaHeart } from 'react-icons/fa';
import { getRoleAccentColor, getRoleLabel } from '../../theme/roleTheme';
import './RoleHeaderBanner.css';

const RoleHeaderBanner = ({ role }) => {
  const accentColor = getRoleAccentColor(role);
  const roleLabel = getRoleLabel(role);
  const isDater = role === 'user';

  return (
    <div className="role-header-banner">
      <div className="role-badge" style={{ backgroundColor: accentColor }}>
        {isDater ? (
          <FaHeart className="role-badge-icon" />
        ) : (
          <img
            src="/assets/matchmaker_pill_logo.png"
            alt=""
            className="role-badge-logo"
          />
        )}
        <span className="role-badge-text">{roleLabel}</span>
      </div>
    </div>
  );
};

export default RoleHeaderBanner;
