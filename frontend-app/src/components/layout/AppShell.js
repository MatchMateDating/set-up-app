import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { getRoleBackgroundTint } from '../../theme/roleTheme';
import RoleHeaderBanner from './RoleHeaderBanner';
import BottomTab from './bottomTab';
import DaterDropdown from './customDropdown';
import './AppShell.css';

const TAB_PATHS = ['/profile', '/match', '/conversations', '/settings'];

const AppShell = ({
  children,
  showTabs = true,
  showHeader = true,
  onSelectedDaterChange,
  hideTabsOverride = false,
  shellBackgroundColor,
  headerCenter = null,
  headerTrailing = null,
  hideRoleBanner = false,
}) => {
  const location = useLocation();
  const { user, setUser, isProfileEditing, refreshUser } = useUser();
  const role = user?.role || 'matchmaker';
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  const [linkedDaters, setLinkedDaters] = useState([]);
  const [selectedDater, setSelectedDater] = useState('');

  const isTabRoute = TAB_PATHS.some(
    (p) => location.pathname === p || location.pathname.startsWith(`${p}/`)
  );
  const isConversation = location.pathname.startsWith('/conversation/');
  const isActivePuzzle = location.pathname.startsWith('/puzzles/');
  const effectiveShowHeader = showHeader && !isActivePuzzle;
  const showDaterDropdown =
    role === 'matchmaker' &&
    !isProfileEditing &&
    (location.pathname === '/profile' ||
      location.pathname.startsWith('/profile/') ||
      location.pathname === '/match' ||
      location.pathname === '/conversations');

  const labelText =
    location.pathname === '/conversations'
      ? 'MATCHING FOR'
      : "YOU'RE CHOOSING FOR";

  const fetchLinkedDaters = useCallback(async () => {
    if (!user?.id || user.role !== 'matchmaker') return;
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/referral/referrals/${user.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;
      const data = await res.json();
      const daters = data.linked_daters || [];
      setLinkedDaters(daters);

      const backendSelected = String(
        user.referrer_id ?? user.referred_by_id ?? ''
      );
      const stored = localStorage.getItem('selectedDater') || '';
      const selected = backendSelected || stored || (daters[0] ? String(daters[0].id) : '');
      setSelectedDater(selected);
      if (selected) localStorage.setItem('selectedDater', selected);
    } catch (err) {
      console.error('Error loading linked daters:', err);
    }
  }, [API_BASE_URL, user?.id, user?.role, user?.referrer_id, user?.referred_by_id]);

  useEffect(() => {
    fetchLinkedDaters();
  }, [fetchLinkedDaters]);

  const handleDaterChange = async (newDaterId) => {
    const id = String(newDaterId);
    setSelectedDater(id);
    localStorage.setItem('selectedDater', id);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/referral/set_selected_dater`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ selected_dater_id: Number(newDaterId) }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to set selected dater');
        return;
      }
      const refreshed = await refreshUser();
      if (refreshed) setUser(refreshed);
      if (onSelectedDaterChange) onSelectedDaterChange(newDaterId);
    } catch (err) {
      console.error('Error setting selected dater:', err);
    }
  };

  const hideTabs =
    hideTabsOverride ||
    isProfileEditing ||
    isConversation ||
    !showTabs ||
    !isTabRoute;

  return (
    <div className="app-shell-backdrop">
      <div
        className={`app-shell ${hideTabs ? 'no-nav' : 'with-nav'}${
          isConversation ? ' app-shell-conversation' : ''
        }`}
        data-role={role}
        style={{
          backgroundColor:
            shellBackgroundColor || getRoleBackgroundTint(role),
        }}
      >
        <div className="app-shell-body">
          {effectiveShowHeader && (
            <header
              className={`app-shell-header app-shell-rail${
                headerCenter ? ' app-shell-header-with-center' : ''
              }`}
            >
              <img
                src="/assets/matchmate_logo.png"
                alt="MatchMate"
                className="app-shell-logo"
              />
              {headerCenter ? (
                <div className="app-shell-header-center">{headerCenter}</div>
              ) : null}
              <div className="app-shell-header-trailing">
                {headerTrailing}
                {!hideRoleBanner ? (
                  <div className="app-shell-role-badge">
                    <RoleHeaderBanner role={role} />
                  </div>
                ) : null}
              </div>
            </header>
          )}

          {showDaterDropdown && (
            <div className="app-shell-dater-overlay app-shell-rail">
              <DaterDropdown
                linkedDaters={linkedDaters}
                selectedDater={selectedDater}
                onChange={handleDaterChange}
                showLabel
                labelText={labelText}
              />
            </div>
          )}

          <main
            className={`app-shell-content ${hideTabs ? 'no-tabs' : ''} ${
              showDaterDropdown ? 'with-dater' : ''
            }${isActivePuzzle ? ' puzzle-fullscreen' : ''}`}
          >
            {children}
          </main>
        </div>

        {!hideTabs && <BottomTab role={role} />}
      </div>
    </div>
  );
};

export default AppShell;
