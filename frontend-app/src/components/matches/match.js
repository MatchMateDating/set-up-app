import React, { useEffect, useState } from 'react';
import BottomTab from '../layout/bottomTab';
import SideBar from '../layout/sideBar';
import './match.css';
import SendNoteModal from './sendNoteModal';
import BlindMatchButton from './blindMatchButton';
import ProfileCard from './profileCard';
import { useProfiles } from "./hooks/useProfiles";
import { useUserInfo } from "./hooks/useUserInfo";

const Match = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const { profiles, setProfiles, loading } = useProfiles(API_BASE_URL);
  const { userInfo } = useUserInfo(API_BASE_URL);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNoteModal, setShowNoteModal] = useState(false);

  const nextProfile = () => {
    if (currentIndex < profiles.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      alert("No more profiles to show!");
    }
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

  // useEffect(() => {
  //   fetchUserInfo();
  //   fetchProfiles();
  // }, []);

  if (loading) return <p>Loading profiles...</p>;

  return (
    <div>
      <SideBar />
      <div className="match-container">
        {profiles.length > 0 && currentIndex < profiles.length ? (
          <>
            {userInfo?.role === 'matchmaker' && !profiles[currentIndex].liked_linked_dater && (
              <BlindMatchButton onClick={() => blindMatch(profiles[currentIndex].id)} />
            )}
            <ProfileCard
              profile={profiles[currentIndex]}
              userInfo={userInfo}
              onSkip={nextProfile}
              onLike={handleLike}
              onBlindMatch={blindMatch}
              onOpenNote={() => setShowNoteModal(true)}
            />
            {showNoteModal && (
              <SendNoteModal
                onClose={() => setShowNoteModal(false)}
                onSend={handleSendNote}
              />
            )}
          </>
        ) : (
          <p>No profiles to match with currently, come back later!</p>
        )}
        <BottomTab />
      </div>
    </div>
  );
};

export default Match;
