import React, { useEffect, useState } from 'react';
import BottomTab from './bottomTab';
import Profile from './profile';
import SideBar from './sideBar';
import './match.css';
import { FaUserSecret } from 'react-icons/fa';

const Match = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInfo, setUserInfo] = useState(null);

  const fetchProfiles = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE_URL}/match/users_to_match`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 401) {
      const data = await res.json();
      if (data.error_code === 'TOKEN_EXPIRED') {
        localStorage.removeItem('token');
        window.location.href = '/';
      }
    }

    const data = await res.json();
    setProfiles(data);
  };

  const fetchUserInfo = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE_URL}/profile/`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 401) {
      const data = await res.json();
      if (data.error_code === 'TOKEN_EXPIRED') {
        localStorage.removeItem('token');
        window.location.href = '/';
      }
    }

    const data = await res.json();
    setUserInfo(data.user);
  }

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

  const nextProfile = () => {
    if (currentIndex < profiles.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      alert('No more profiles to show!');
    }
  };

  useEffect(() => {
    fetchUserInfo();
    fetchProfiles();
  }, []);

  return (
    <div>
      <SideBar />
      <div className="match-container">
        {profiles.length > 0 && currentIndex < profiles.length ? (
          <>
            {userInfo?.role === 'matchmaker' && !profiles[currentIndex].liked_linked_dater && (
              <FaUserSecret
                onClick={() => blindMatch(profiles[currentIndex].id)}
                className="blind-match-button"
              />
            )}
            <div className="profile-box">
              <button onClick={nextProfile} className="skip-button"> ✕ </button>
              <Profile user={profiles[currentIndex]} framed={true} />

              {userInfo?.role === 'matchmaker' ? (
                profiles[currentIndex].liked_linked_dater ? (
                  <button
                    onClick={() => blindMatch(profiles[currentIndex].id)}
                    className="like-button"
                  >
                    ❤️
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleLike}
                      className="like-button"
                    >
                      ❤️
                    </button>
                  </>
                )
              ) : (
                <button
                  onClick={handleLike}
                  className="like-button"
                >
                  ❤️
                </button>
              )}
            </div>
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
