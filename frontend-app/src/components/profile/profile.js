import React, { useEffect, useState, useRef } from 'react';
import './profile.css';
import { FaEdit } from 'react-icons/fa';
import { calculateAge, convertFtInToMetersCm, convertMetersCmToFtIn, formatHeight } from './utils/profileUtils';
import CropperModal from './cropperModal';
import AvatarSelectorModal from './avatarSelectorModal';
import ImageGallery from './images';
import ProfileInfoCard from './profileInfoCard';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
const Profile = ({ user, framed, editing, onEditClick, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    birthdate: '',
    gender: '',
    heightFeet: '0',
    heightInches: '0',
    heightMeters: '0',
    heightCentimeters: '0',
    description: '',
    preferredAgeMin: '0',
    preferredAgeMax: '0',
    preferredGender: ''
  });

  const [referralCode, setReferralCode] = useState('');
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [images, setImages] = useState([]);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatar, setAvatar] = useState(user?.avatar || 'avatars/allyson_avatar.png');
  const [heightUnit, setHeightUnit] = useState('ft');  

  useEffect(() => {
    if (user) {
      const baseFormData = {
        birthdate: user.birthdate || '',
        gender: user.gender || '',
        description: user.description || '',
        preferredAgeMin: user.preferredAgeMin || '',
        preferredAgeMax: user.preferredAgeMax || '',
        preferredGender: user.preferredGender || ''
      }
      const heightString = user.height || "0'0";
      if (heightString.includes("'")) {
        // Format: 5'11"
        const [feet, inches] = heightString.split(/'|"/).map(Number);
        setFormData({
          ...baseFormData,
          heightFeet: feet.toString(),
          heightInches: inches.toString(),
          heightMeters: '0',
          heightCentimeters: '0'
        });
        setHeightUnit('ft');
      } else if (heightString.includes('m')) {
        // Format: 1m 75cm
        const [metersPart, cmPart] = heightString.split(' ');
        const meters = metersPart.replace('m', '');
        const centimeters = cmPart.replace('cm', '');
        setFormData({
          ...baseFormData,
          heightFeet: '0',
          heightInches: '0',
          heightMeters: meters,
          heightCentimeters: centimeters
        });
        setHeightUnit('m');
      }
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
      const response = await fetch(`${API_BASE_URL}/profile/upload_image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (response.status === 401) {
        const data = await response.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          localStorage.removeItem('token');
          window.location.href = '/';
        }
      }

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

  const handleUnitToggle = () => {
    if (heightUnit === 'ft') {
      const { meters, centimeters } = convertFtInToMetersCm(formData.heightFeet, formData.heightInches);
      setFormData((prev) => ({ ...prev, heightMeters: meters, heightCentimeters: centimeters }));
      setHeightUnit('m');
    } else {
      const { feet, inches } = convertMetersCmToFtIn(formData.heightMeters, formData.heightCentimeters);
      setFormData((prev) => ({ ...prev, heightFeet: feet, heightInches: inches }));
      setHeightUnit('ft');
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const heightFormatted = formatHeight(formData, heightUnit);

      const payload = {
        birthdate: formData.birthdate,
        gender: formData.gender,
        height: heightFormatted,
        description: formData.description,
        preferredAgeMin: formData.preferredAgeMin,
        preferredAgeMax: formData.preferredAgeMax,
        preferredGender: formData.preferredGender
      };
      const res = await fetch(`${API_BASE_URL}/profile/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          localStorage.removeItem('token');
          window.location.href = '/';
        }
      }

      if (!res.ok) throw new Error('Failed to update profile');
      await res.json();
      onSave();
    } catch (err) {
      console.error(err);
      alert('Error updating profile.');
    }
  };

  const handleDeleteImage = async (imageId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/profile/delete_image/${imageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          localStorage.removeItem('token');
          window.location.href = '/';
        }
      }

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
        <ProfileInfoCard
          user={user}
          formData={formData}
          editing={editing}
          heightUnit={heightUnit}
          onInputChange={handleInputChange}
          onUnitToggle={handleUnitToggle}
          onSubmit={handleFormSubmit} // optional, can remove now
          onCancel={onCancel}
          calculateAge={calculateAge}
        />
      </form>
      {user.role === 'user' && (
        <div>
          <div className="section">
            {editing ? (
              <label> Add Images: </label>
            ) : (
              <label></label>
            )}
            <ImageGallery
              images={images}
              editing={editing}
              onDeleteImage={handleDeleteImage}
              onPlaceholderClick={handlePlaceholderClick}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;

