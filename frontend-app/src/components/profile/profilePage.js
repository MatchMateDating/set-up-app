import React, { useEffect, useState } from 'react';
import Profile from './profile';
import BottomTab from '../layout/bottomTab';
import SideBar from '../layout/sideBar';
import AvatarSelectorModal from './avatarSelectorModal';

const ProfilePage = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [user, setUser] = useState(null);
  const [referrer, setReferrer] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatar, setAvatar] = useState(null);
  // const [avatar, setAvatar] = useState(user?.avatar || 'avatars/allyson_avatar.png');

  const fetchProfile = () => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch(`${API_BASE_URL}/profile/`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
        .then(async (res) => {
          if (res.status === 401) {
            const data = await res.json();
            if (data.error_code === 'TOKEN_EXPIRED') {
              localStorage.removeItem('token'); // clear invalid token
              window.location.href = '/';  // redirect to login
              return; // stop execution
            }
          }
          return res.json();
        })
        .then((data) => {
          if (!data) return; // avoid running if we already redirected
          setUser(data.user);
          setReferrer(data.referrer || null);
        })
        .catch((err) => console.error('Error loading profile:', err));
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  useEffect(() => {
    // When user info loads, sync avatar state with user.avatar
    if (user?.avatar) {
      setAvatar(user.avatar);
    }
  }, [user]);

  const handleAvatarClick = () => {
    setShowAvatarModal(true);
  };

  const handleSave = () => {
    fetchProfile();
    setEditing(false);
  };

  return (
    <>
      <SideBar />
      <div style={{ paddingBottom: '60px', paddingTop: '66px' }}>
        {user?.role ==='user' && (
          <>
            <Profile
              user={user}
              framed={false}
              editing={editing}
              setEditing={setEditing}
              onSave={handleSave}
            />
          </>
        )}

        {user?.role === 'matchmaker' && referrer && (
          <>
            <div className="profile-header">
              <img
                src={avatar || '/avatars/allyson_avatar.png'}
                alt="Avatar"
                className="avatar"
                onClick={handleAvatarClick}
              />
              <div className="profile-info">
                <div className="name-section">
                  <h2>{user.first_name}</h2>
                </div>
              </div>
            </div>
            <div className="embedded-profile">
              <h3>Dater's Profile</h3>
              <Profile user={referrer} framed={true} editing={false} />
            </div>
          </>
        )}
        {showAvatarModal && (
          <AvatarSelectorModal
            onSelect={(selectedAvatar) => {
              setAvatar(selectedAvatar);
            }}
            userId={user.id}
            onClose={() => setShowAvatarModal(false)}
          />
        )}

        <BottomTab />
      </div>
    </>
  );
};

export default ProfilePage;
