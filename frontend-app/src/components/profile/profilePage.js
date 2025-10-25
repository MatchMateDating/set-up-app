import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Profile from './profile';
import BottomTab from '../layout/bottomTab';
import SideBar from '../layout/sideBar';
import AvatarSelectorModal from './avatarSelectorModal';
import './profilePage.css';

const ProfilePage = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [user, setUser] = useState(null);
  const [referrer, setReferrer] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatar, setAvatar] = useState(null);
  const { userId } = useParams(); // Used for viewing matched profile
  const navigate = useNavigate();

  const fetchProfile = () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const url = userId ? `${API_BASE_URL}/profile/${userId}` : `${API_BASE_URL}/profile/`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (res.status === 401) {
          const data = await res.json();
          if (data.error_code === "TOKEN_EXPIRED") {
            localStorage.removeItem("token");
            window.location.href = "/";
            return;
          }
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        userId ? setUser(data) : setUser(data.user);
        setReferrer(data.referrer || null);
      })
      .catch((err) => console.error("Error loading profile:", err));
  };

  useEffect(() => {
    fetchProfile();
  }, [userId]);

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

  const isOwnProfile = !userId || userId === user?.id;

  return (
    <>
      <SideBar />
      {userId && (
        <button className="back-button" onClick={() => navigate(-1)}>
          ⬅ Back
        </button>
      )}
      <div className="profile-page-container">
        {user?.role === 'user' && (
          <Profile
            user={user}
            framed={false}
            editing={editing}
            setEditing={setEditing}
            onSave={handleSave}
            editable={!userId}
          />
        )}

        {user?.role === 'matchmaker' && referrer && (
          <>
            <div className="profile-header">
              {isOwnProfile && (
                <img
                  src={avatar || '/avatars/allyson_avatar.png'}
                  alt="Avatar"
                  className="avatar"
                  onClick={handleAvatarClick}
                />
              )}
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
            onSelect={(selectedAvatar) => setAvatar(selectedAvatar)}
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
