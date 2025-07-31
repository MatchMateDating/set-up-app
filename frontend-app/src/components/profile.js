import React, { useEffect, useState, useRef } from 'react';
import './profile.css';
import { FaEdit, FaBars } from 'react-icons/fa';
import CropperModal from './cropperModal';
import AvatarSelectorModal from './avatarSelectorModal';
import {useNavigate} from 'react-router-dom';

const Profile = ({ user, framed, editing, onEditClick, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    birthdate: '',
    gender: '',
    height: '',
    description: '',
  });

  const [referralCode, setReferralCode] = useState('');
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [images, setImages] = useState([]);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatar, setAvatar] = useState(user?.avatar || 'avatars/allyson_avatar.png');
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      setFormData({
        birthdate: user.birthdate || '',
        gender: user.gender || '',
        height: user.height || '',
        description: user.description || '',
      });
      if (user.role === 'user') {
        const generateReferralCode = () => {
          const code = `${user.name?.split(' ')[0] || 'user'}-${Math.random().toString(36).substr(2, 6)}`;
          return code.toUpperCase();
        };
        setReferralCode(generateReferralCode());
      }
      if (user?.images) {
        setImages(user.images);
      }
    }
  }, [user]);

  const toggleSidePanel = () => {
    setSidePanelOpen(!sidePanelOpen);
  };

  const handleAvatarClick = () => {
    if (user.role === 'matchmaker' && editing) {
      setShowAvatarModal(true);
    }
  };

  const handlePlaceholderClick = () => {
    if (editing) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setPreviewUrl(reader.result);
    };
  };

  const handleCropComplete = async (croppedBlob) => {
    setPreviewUrl(null);
    if (!croppedBlob) return;

    const formData = new FormData();
    formData.append('image', croppedBlob, 'cropped_image.jpg');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/profile/upload_image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload image');

      const newImage = await response.json();
      setImages((prevImages) => [...prevImages, newImage]);
    } catch (err) {
      console.error(err);
      alert('Error uploading image');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/profile/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to update profile');
      await res.json();
      onSave();
    } catch (err) {
      console.error(err);
      alert('Error updating profile.');
    }
  };

  const calculateAge = (birthdate) => {
    if (!birthdate) return '';
    const birthDateObj = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birthDateObj.getFullYear();
    const m = today.getMonth() - birthDateObj.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
      age--;
    }
    return age;
  };

  const handleDeleteImage = async (imageId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/profile/delete_image/${imageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to delete image');

      // Remove image from local state
      setImages((prevImages) => prevImages.filter((img) => img.id !== imageId));
    } catch (err) {
      console.error(err);
      alert('Error deleting image');
    }
  };



  return (
    <div className="profile-container">
      <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
      <div className="top-bar">
        <button className="sidepanel-toggle" onClick={toggleSidePanel}>
          <FaBars size={20} />
        </button>
      </div>
      <div className={`side-panel ${sidePanelOpen ? 'open' : ''}`}>
        <div className="side-panel-content">
          <h3>Menu</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li style={{ margin: '10px 0', cursor: 'pointer' }} onClick={() => navigate('/profile')}>Terms and Conditions</li>
            <li style={{ margin: '10px 0', cursor: 'pointer' }} onClick={() => navigate('/settings')}>Settings</li>
          </ul>
        </div>
      </div>

      {previewUrl && (
        <CropperModal
          imageSrc={previewUrl}
          onClose={() => setPreviewUrl(null)}
          onCropComplete={handleCropComplete}
        />
      )}

      <div className="profile-header">
        {user.role === 'matchmaker' && (
          <img
            src={avatar}
            alt="Avatar"
            className="avatar"
            onClick={handleAvatarClick}
            style={{ cursor: editing ? 'pointer' : 'default' }}
          />
        )}
        <div className="profile-info">
          <div className="name-section">
            <h2>{user.name}</h2>
          </div>
          {!framed && !editing && (
            <div className="profile-actions">
              <FaEdit className="edit-icon" onClick={onEditClick} />
            </div>
          )}
        </div>
      </div>

      {showAvatarModal && (
        <AvatarSelectorModal
          onSelect={(selectedAvatar) => {
            setAvatar(selectedAvatar);
            // Optionally: Save avatar to backend here!
          }}
          onClose={() => setShowAvatarModal(false)}
        />
      )}

      <form className={`profile-card ${framed ? 'framed' : ''}`} onSubmit={handleFormSubmit}>
        {user.role === 'user' && (
          <>
            {editing && (
              <label>
                Birthdate:
                <input 
                  name="birthdate" 
                  type="date"
                  value={formData.birthdate || ''} 
                  onChange={handleInputChange} 
                />
              </label>
            )}

            {!editing && user.birthdate && (
              <label>
                Age:
                <span>{calculateAge(user.birthdate)}</span>
              </label>
            )}


            {(editing || user.height) && (
              <label>
                Height:
                {editing ? (
                  <input name="height" value={formData.height} onChange={handleInputChange} />
                ) : (
                  <span>{user.height}</span>
                )}
              </label>
            )}

            {(editing || user.gender) && (
              <label>
                Gender:
                {editing ? (
                  <input name="gender" value={formData.gender} onChange={handleInputChange} />
                ) : (
                  <span>{user.gender}</span>
                )}
              </label>
            )}
          </>
        )}

        {user.role === 'matchmaker' && (editing || user.description) && (
          <label>
            Description:
            {editing ? (
              <textarea name="description" value={formData.description} onChange={handleInputChange} />
            ) : (
              <p>{user.description}</p>
            )}
          </label>
        )}

        {editing && (
          <div style={{ marginTop: '1rem' }}>
            <button type="submit">Save</button>
            <button type="button" onClick={onCancel} style={{ marginLeft: '1rem' }}>
              Cancel
            </button>
          </div>
        )}
      </form>


      {user.role === 'user' && user.referral_code && (
        <div>
          <div className="section referral-section">
            <h3>Your Referral Code</h3>
            <div className="referral-code">{user.referral_code}</div>
          </div>
          <div className="section">
            {editing ? (
              <label> Add Images: </label>
            ) : (
              <label></label>
            )}
            <div className="image-grid">
              {images.map((img, index) => (
                <div key={index} className="image-wrapper">
                  <img
                    src={`http://localhost:5000${img.image_url}`}
                    alt={`Profile ${index}`}
                    className="profile-img"
                  />
                  {editing && (
                    <button
                      className="delete-button"
                      onClick={() => handleDeleteImage(img.id)}
                    >
                      x
                    </button>
                  )}
                </div>
              ))}
              {editing &&
                [...Array(9 - images.length)].map((_, index) => (
                  <div key={index} className="image-placeholder" onClick={handlePlaceholderClick}>
                    <span className="plus-icon">+</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;

