import React, { useEffect, useState } from 'react';
import BottomTab from './bottomTab';
import Profile from './profile';
import SideBar from './sideBar';

const Match = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const fetchProfiles = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE_URL}/match/users_to_match`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setProfiles(data);
  };

  const likeUser = async (likedUserId) => {
    const token = localStorage.getItem('token');
    await fetch(`${API_BASE_URL}/match/like`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ liked_user_id: likedUserId })
    });
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
    fetchProfiles();
  }, []);

  return (
    <div>
      <SideBar/>
      <div style={{ paddingBottom: '60px', paddingTop: '66px' }}>
        <h2>Matching Page</h2>
        {profiles.length > 0 && currentIndex < profiles.length ? (
          <>
            <Profile user={profiles[currentIndex]} framed={true} />
            <button onClick={handleLike}>Like</button>
            <button onClick={nextProfile}>Skip</button>
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
