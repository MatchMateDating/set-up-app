import React, { useEffect, useState } from 'react';
import { Heart, EyeOff, PenLine, Ban } from 'lucide-react';
import AppShell from '../layout/AppShell';
import './match.css';
import SendNoteModal from './sendNoteModal';
import ProfileCard from './profileCard';
import { useProfiles } from "./hooks/useProfiles";
import { useUserInfo } from "./hooks/useUserInfo";
import { startLocationWatcher, stopLocationWatcher } from '../auth/utils/startLocationWatcher';
import { getRoleAccentColor } from '../../theme/roleTheme';
import { daterNeedsMatchmakerLink } from '../../navigation/matchmakerGate';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';

const Match = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const navigate = useNavigate();
  const { user: contextUser } = useUser();
  const { profiles, setProfiles, loading } = useProfiles(API_BASE_URL);
  const { userInfo } = useUserInfo(API_BASE_URL);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [referrer, setReferrer] = useState(null);
  const gateUser = userInfo || contextUser;
  const isDater = gateUser?.role === 'user';
  const roleAccent = getRoleAccentColor(gateUser?.role);
  const needsMatchmaker = daterNeedsMatchmakerLink(gateUser);

  const fetchProfile = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/profile/`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          localStorage.removeItem('token');
          window.location.href = '/';
          return;
        }
      }
      const data = await res.json();
      setReferrer(data.referrer || null);
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const fetchReferrer = async (daterId) => {
    console.log('Fetching referrer for daterId:', daterId);
    if (!daterId) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/profile/${daterId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setReferrer(data.user);
      console.log('Referrer updated:', data.user);
    } catch (err) {
      console.error('Error fetching referrer:', err);
    }
  };

  const fetchProfiles = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/match/users_to_match`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch profiles");
      const data = await res.json();
      setProfiles(data);
    } catch (err) {
      console.error("Error fetching profiles:", err);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Ensure location watcher runs whenever the match page is opened
  useEffect(() => {
    const token = localStorage.getItem('token');
    startLocationWatcher(API_BASE_URL, token);

    const onLocationUpdated = () => {
      // refresh profiles when location changes
      fetchProfiles();
    };

    window.addEventListener('locationUpdated', onLocationUpdated);

    return () => {
      window.removeEventListener('locationUpdated', onLocationUpdated);
      stopLocationWatcher();
    };
  }, [API_BASE_URL]);

  const nextProfile = () => {
    if (currentIndex < profiles.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      alert("No more profiles to show!");
    }
    fetchProfiles();
  };

  const likeUser = async (likedUserId) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE_URL}/match/like`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ liked_user_id: likedUserId })
    });

    if (res.status === 401) {
      const data = await res.json();
      if (data.error_code === 'TOKEN_EXPIRED') {
        localStorage.removeItem('token');
        window.location.href = '/';
      }
    }
  };

  const blindMatch = async (likedUserId) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE_URL}/match/blind_match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ liked_user_id: likedUserId })
    });
    if (res.status === 401) {
      const data = await res.json();
      if (data.error_code === 'TOKEN_EXPIRED') {
        localStorage.removeItem('token');
        window.location.href = '/';
      }
    }
    nextProfile(); // skip to next profile after match
  };

  const handleLike = () => {
    const likedUser = profiles[currentIndex];
    likeUser(likedUser.id);
    nextProfile();
  };

  const blockUser = async (blockedUserId) => {
    const confirmed = window.confirm(
      'Are you sure you want to block this user? You will never see each other again.'
    );
    if (!confirmed) return;

    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/';
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/match/block/${blockedUserId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          localStorage.removeItem('token');
          window.location.href = '/';
          return;
        }
      }

      if (res.ok) {
        setProfiles((prevProfiles) => {
          const nextProfiles = prevProfiles.filter(
            (profile) => profile.id !== blockedUserId
          );
          setCurrentIndex((prevIndex) => {
            if (nextProfiles.length === 0) return 0;
            if (prevIndex >= nextProfiles.length) {
              return nextProfiles.length - 1;
            }
            return prevIndex;
          });
          return nextProfiles;
        });
        alert('User blocked successfully');
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed to block user');
      }
    } catch (err) {
      console.error('Error blocking user:', err);
      alert('Failed to block user');
    }
  };

  const handleSendNote = async (note) => {
    const likedUser = profiles[currentIndex];
    const token = localStorage.getItem('token');

    await fetch(`${API_BASE_URL}/match/send_note`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ recipient_id: likedUser.id, note })
    });

    setShowNoteModal(false);
    nextProfile();
  };

  if (loading) {
    return (
      <AppShell>
        <p className="match-empty">Loading profiles...</p>
      </AppShell>
    );
  }

  if (needsMatchmaker) {
    return (
      <AppShell>
        <div className="match-container match-gate">
          <p className="match-empty match-gate-text">
            You can&apos;t see matches until you have a matchmaker. Go to Settings
            → Referral Code to share your referral code with a matchmaker.
          </p>
          <button
            type="button"
            className="match-gate-button"
            onClick={() =>
              navigate('/settings?requireMatchmaker=1&openReferral=1')
            }
          >
            Open Referral Settings
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      onSelectedDaterChange={(newDaterId) => {
        fetchReferrer(newDaterId);
        fetchProfiles();
      }}
    >
      <div className="match-container">
        {profiles.length > 0 && currentIndex < profiles.length ? (
          <>
            <ProfileCard
              profile={profiles[currentIndex]}
              userInfo={userInfo}
              preferredViewerUnit={
                userInfo?.role === 'matchmaker' ? referrer?.unit : undefined
              }
              onSkip={nextProfile}
            />
            <div className="match-action-bar">
              <div className="match-action-side match-action-left">
                {isDater && (
                  <button
                    type="button"
                    className="match-action-button"
                    onClick={() => blockUser(profiles[currentIndex].id)}
                    aria-label="Block user"
                  >
                    <Ban size={26} color="#ef4444" />
                  </button>
                )}
                {userInfo?.role === 'matchmaker' &&
                  !profiles[currentIndex].liked_linked_dater && (
                    <button
                      type="button"
                      className="match-action-button"
                      onClick={() => blindMatch(profiles[currentIndex].id)}
                      aria-label="Blind match"
                    >
                      <EyeOff size={24} color={roleAccent} />
                    </button>
                  )}
              </div>
              <div className="match-action-center">
                <button
                  type="button"
                  className="match-action-button match-like-button"
                  onClick={
                    userInfo?.role === 'matchmaker' &&
                    profiles[currentIndex].liked_linked_dater
                      ? () => blindMatch(profiles[currentIndex].id)
                      : handleLike
                  }
                  aria-label="Like"
                >
                  <Heart size={32} color="#ef4d73" fill="#ef4d73" />
                </button>
              </div>
              <div className="match-action-side match-action-right">
                <button
                  type="button"
                  className="match-action-button"
                  onClick={() => setShowNoteModal(true)}
                  aria-label="Send note"
                >
                  <PenLine
                    size={24}
                    color={isDater ? '#374151' : roleAccent}
                  />
                </button>
              </div>
            </div>
            {showNoteModal && (
              <SendNoteModal
                onClose={() => setShowNoteModal(false)}
                onSend={handleSendNote}
              />
            )}
          </>
        ) : (
          <p className="match-empty">No profiles to match with currently, come back later!</p>
        )}
      </div>
    </AppShell>
  );
};

export default Match;
