import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PenLine } from 'lucide-react';
import Profile from './profile';
import ProfileCard from '../matches/profileCard';
import AppShell from '../layout/AppShell';
import { useUser } from '../../context/UserContext';
import { DATER_SCREEN_BG } from '../../theme/roleTheme';
import './profilePage.css';

const ProfilePage = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [user, setUser] = useState(null);
  const [referrer, setReferrer] = useState(null);
  const [editing, setEditing] = useState(false);
  const { userId } = useParams();
  const navigate = useNavigate();
  const { setUser: setContextUser, setIsProfileEditing } = useUser();

  const fetchProfile = () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const url = userId ? `${API_BASE_URL}/profile/${userId}` : `${API_BASE_URL}/profile/`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (res.status === 401) {
          const data = await res.json();
          if (data.error_code === 'TOKEN_EXPIRED') {
            localStorage.removeItem('token');
            window.location.href = '/';
            return;
          }
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setUser(data.user);
        if (!userId && data.user) setContextUser(data.user);
        setReferrer(data.referrer || null);
      })
      .catch((err) => console.error('Error loading profile:', err));
  };

  const fetchReferrer = async (daterId) => {
    if (!daterId) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/profile/${daterId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setReferrer(data.user);
    } catch (err) {
      console.error('Error fetching referrer:', err);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  useEffect(() => {
    if (user?.role === 'matchmaker') {
      if (user.referred_by_id || user.referrer_id) {
        fetchReferrer(user.referred_by_id || user.referrer_id);
      }
    }
  }, [user?.id, user?.role, user?.referred_by_id, user?.referrer_id]);

  useEffect(() => {
    setIsProfileEditing(editing);
    return () => setIsProfileEditing(false);
  }, [editing, setIsProfileEditing]);

  const handleSave = () => {
    fetchProfile();
    setEditing(false);
  };

  const isOwnProfile = !userId || String(userId) === String(user?.id);
  const isDater = user?.role === 'user';
  const isMatchmaker = user?.role === 'matchmaker';
  const showDaterChrome = isDater && !editing && isOwnProfile;
  const showDaterEditChrome = isDater && editing && isOwnProfile;
  // Matchmakers inherit AppShell's background. Setting another translucent
  // purple tint here stacks and darkens the area around the card.
  const screenBackground = isDater ? DATER_SCREEN_BG : undefined;
  const accentColor = isDater ? '#ef4d73' : '#6c5ce7';

  const shellHeaderCenter = (() => {
    if (userId) return 'Dater Profile';
    if (showDaterEditChrome) return null;
    if (showDaterChrome) return 'Your Profile';
    if (isMatchmaker && isOwnProfile) return 'Dater Profile';
    return null;
  })();

  const shellHeaderTrailing = showDaterChrome ? (
    <button
      type="button"
      className="profile-page-edit-btn profile-page-edit-btn-shell"
      onClick={() => setEditing(true)}
      aria-label="Edit profile"
    >
      <PenLine size={22} color={accentColor} />
    </button>
  ) : null;

  return (
    <AppShell
      showHeader={!showDaterEditChrome}
      headerCenter={shellHeaderCenter}
      headerTrailing={shellHeaderTrailing}
      onSelectedDaterChange={(newDaterId) => fetchReferrer(newDaterId)}
    >
      {userId && (
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
      )}
      <div
        className="profile-page-body"
        style={screenBackground ? { backgroundColor: screenBackground } : undefined}
      >
        {showDaterChrome && (
          <div className="profile-page-header profile-page-header-dater">
            <div className="profile-page-header-side" />
            <h1 className="profile-page-title">Your Profile</h1>
            <div className="profile-page-header-side profile-page-header-side-right">
              <button
                type="button"
                className="profile-page-edit-btn"
                onClick={() => setEditing(true)}
                aria-label="Edit profile"
              >
                <PenLine size={22} color={accentColor} />
              </button>
            </div>
          </div>
        )}

        {showDaterEditChrome && (
          <div className="profile-page-header profile-page-header-edit">
            <button
              type="button"
              className="profile-page-edit-back"
              onClick={() => setEditing(false)}
              aria-label="Back"
            >
              ←
            </button>
            <h1 className="profile-page-title">Edit Profile</h1>
            <div className="profile-page-header-side" />
          </div>
        )}

        {isDater && (
          <div className="profile-page-card-wrap">
            <Profile
              user={user}
              framed={false}
              editing={editing}
              setEditing={setEditing}
              onSave={handleSave}
              editable={isOwnProfile}
              usePageLayout
              viewerUnit={user?.unit}
            />
            {showDaterEditChrome && (
              <div className="profile-page-edit-footer">
                <button
                  type="button"
                  className="profile-page-cancel-btn"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="profile-page-save-btn"
                  style={{ backgroundColor: accentColor }}
                  onClick={() => {
                    const form = document.querySelector('.profile-card-page');
                    if (form) form.requestSubmit();
                  }}
                >
                  Save
                </button>
              </div>
            )}
          </div>
        )}

        {isMatchmaker && (
          <>
            {referrer ? (
              <div className="profile-page-card-wrap profile-page-card-wrap-matchmaker">
                <ProfileCard
                  profile={referrer}
                  userInfo={user}
                  preferredViewerUnit={referrer?.unit}
                  blendWithBackground
                  hideProfileThumbnail
                />
              </div>
            ) : (
              <div className="profile-page-no-dater">
                <p className="profile-page-no-dater-text">No dater selected</p>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
};

export default ProfilePage;
