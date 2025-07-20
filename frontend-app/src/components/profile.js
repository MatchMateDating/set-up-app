import React from 'react';
import './profile.css';
import { FaEdit, FaLock } from 'react-icons/fa';

const Profile = ({ user }) => {
  if (!user) {
    return <div>Loading profile...</div>;
  }

  const {
    name,
    images = [],
  } = user;

  console.log('User data:', name);

  return (
    <div className="profile-container">
      {/* Header */}
      <div className="profile-header">
        <img src={user.avatar || '/default-avatar.png'} alt="Avatar" className="avatar" />
        <div className="profile-info">
          <div className="name-section">
            <h2>{name}</h2>
          </div>
          <div className="profile-actions">
            <FaEdit className="edit-icon" />
            <FaLock className="lock-icon" />
          </div>
        </div>
      </div>

      {/* Profile Images */}
      <div className="section">
        <h3>Profile</h3>
        <div className="image-grid">
          {images.map((img, index) => (
            <img key={index} src={img.image_url} alt={`Profile ${index}`} className="profile-img" />
          ))}
          {[...Array(9 - images.length)].map((_, index) => (
            <div key={index} className="image-placeholder">
              <span className="plus-icon">+</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Profile;
