import React,{useEffect, useState, useRef} from 'react';
import './profile.css';
import { FaEdit} from 'react-icons/fa';
import CropperModal from './cropperModal'; // Import the cropper modal component
import AvatarSelectorModal from './avatarSelectorModal'; // Import the avatar selector modal component

const Profile = ({ user, framed, onEditClick }) => {
  const [referralCode, setReferralCode] = useState('');
  const fileInputRef = useRef(null);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [images, setImages] = useState([]);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatar, setAvatar] = useState(user?.avatar || 'avatars/allyson_avatar.png');

  useEffect(() => {
    if (user && user.role === 'user') {
      // If you want to generate it on the frontend:
      const generateReferralCode = () => {
        // You can customize this logic
        const code = `${user.name?.split(' ')[0] || 'user'}-${Math.random().toString(36).substr(2, 6)}`;
        return code.toUpperCase();
      };
      setReferralCode(generateReferralCode());
    }
    if (user?.images){
      setImages(user.images);
    }
  }, [user]);

  if (!user) {
    return <div>Loading profile...</div>;
  }

  const {
    name,
    role,
    referral_code,
    age,
    height,
    gender,
    description,
    bio,
  } = user;

  const handleAvatarClick = () => {
    if (user.role === 'matchmaker') {
      setShowAvatarModal(true);
    }
  };


  const handlePlaceholderClick = (index) => {
    // setSelectedPlaceholder(index);
    fileInputRef.current.click();
  }

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
    setPreviewUrl(null); // Close modal
    if (!croppedBlob) return;

    const formData = new FormData();
    formData.append('image', croppedBlob, 'cropped_image.jpg');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/profile/upload_image', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
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

  return (
    <div className="profile-container">
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

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
          style={{cursor: 'pointer'}} />)}
        <div className="profile-info">
          <div className="name-section">
            <h2>{name}</h2>
          </div>
          {!framed && (<div className="profile-actions">
            <FaEdit className="edit-icon" onClick={onEditClick}/>
          </div>)}
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


      <div className={`profile-card ${framed ? 'framed' : ''}`}>
        {user.age && <p><strong>Age:</strong> {user.age}</p>}
        {user.height && <p><strong>Height:</strong> {user.height}</p>}
        {user.gender && <p><strong>Gender:</strong> {user.gender}</p>}
        {user.description && <p><strong>Description:</strong> {user.description}</p>}
        {user.bio && <p><strong>Bio:</strong> {user.bio}</p>}
      </div>

      {role === 'user' && referral_code && (
        <div>
          <div className="section referral-section">
            <h3>Your Referral Code</h3>
            <div className="referral-code">{referral_code}</div>
          </div>
          <div className="section">
            <h3>Profile</h3>
            <div className="image-grid">
              {images.map((img, index) => (
                <img 
                key={index} 
                src={`http://localhost:5000${img.image_url}`} 
                alt={`Profile ${index}`} 
                className="profile-img" />
              ))}
              {[...Array(9 - images.length)].map((_, index) => (
                <div 
                key={index} 
                className="image-placeholder"
                onClick={handlePlaceholderClick}
                >
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
