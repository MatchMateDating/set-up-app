import React, { useEffect, useState, useRef } from 'react';
import './profile.css';
import './components/pixelTheme.css';
import './components/constitutionTheme.css';
import { FaEdit } from 'react-icons/fa';
import {
  calculateAge,
  convertFtInToMetersCm,
  convertMetersCmToFtIn,
  formatHeight,
  normalizeImageLayout,
} from './utils/profileUtils';
import CropperModal from './cropperModal';
import ProfileInfoCard from './profileInfoCard';
import ProfileCard from '../matches/profileCard';
import PixelClouds from './components/PixelClouds';
import { themeDefaultFonts } from './components/themeDefaults';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
const Profile = ({
  user,
  framed,
  editing,
  setEditing,
  onSave,
  editable,
  usePageLayout = false,
  viewerUnit,
  onEditingFormData,
}) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    birthdate: '',
    gender: '',
    heightFeet: '0',
    heightInches: '0',
    heightMeters: '0',
    heightCentimeters: '0',
    preferredAgeMin: '0',
    preferredAgeMax: '0',
    preferredGenders: [],
    bio: '',
    fontFamily: 'Arial',
    profileStyle: 'classic',
    imageLayout: 'grid',
    show_location: false,
  });

  const [referralCode, setReferralCode] = useState('');
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [images, setImages] = useState([]);
  const [heightUnit, setHeightUnit] = useState('ft');
  const [fontManuallyChosen, setFontManuallyChosen] = useState(false);
  const [localUser, setLocalUser] = useState(null);
  const onEditingFormDataRef = useRef(onEditingFormData);

  useEffect(() => {
    onEditingFormDataRef.current = onEditingFormData;
  }, [onEditingFormData]);


  useEffect(() => {
    console.log('User data changed:', editable);
    if (user) {
      setLocalUser(user);
      if (user.images) {
        setImages(user.images);
      }

      const baseFormData = {
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        birthdate: user.birthdate || '',
        gender: user.gender || '',
        preferredAgeMin: user.preferredAgeMin || '',
        preferredAgeMax: user.preferredAgeMax || '',
        preferredGenders: user.preferredGenders || '',
        bio: user.bio || '',
        fontFamily: user.fontFamily || 'Arial',
        profileStyle: user.profileStyle || 'classic',
        imageLayout: user.imageLayout || 'grid',
        show_location: Boolean(user.show_location),
      };
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
          const code = `${user.first_name?.split(' ')[0] || 'user'}-${Math.random().toString(36).substr(2, 6)}`;
          return code.toUpperCase();
        };
        setReferralCode(generateReferralCode());
      }
    }
  }, [user]);

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

    if (name === "fontFamily") {
      setFontManuallyChosen(true);
      setFormData((prev) => ({ ...prev, fontFamily: value }));
      return;
    }

    if (name === 'profileStyle') {
      const newFont = !fontManuallyChosen
        ? themeDefaultFonts[value] || "Arial"
        : formData.fontFamily; // keep custom choice

      setFormData((prev) => ({
        ...prev,
        profileStyle: value,
        fontFamily: newFont
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
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
    console.log('Submitting form data:', formData.fontFamily, formData.profileStyle);
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const heightFormatted = formatHeight(formData, heightUnit);

      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        birthdate: formData.birthdate,
        gender: formData.gender,
        height: heightFormatted,
        preferredAgeMin: formData.preferredAgeMin
          ? Number(formData.preferredAgeMin)
          : undefined,
        preferredAgeMax: formData.preferredAgeMax
          ? Number(formData.preferredAgeMax)
          : undefined,
        preferredGenders: formData.preferredGenders,
        bio: formData.bio,
        fontFamily: formData.fontFamily,
        profileStyle: formData.profileStyle,
        imageLayout: formData.imageLayout,
        show_location: formData.show_location,
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
      const updated = await res.json();
      // Update local user immediately so the non-editing view reflects the saved font/style
      try {
        const newUserData = { ...(localUser || user), ...payload };
        setLocalUser(newUserData);
      } catch (e) {
        // ignore if localUser isn't ready
      }
      setEditing(false);
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

      // Remove image from local state without affecting editing mode
      setImages((prevImages) => prevImages.filter((img) => img.id !== imageId));
    } catch (err) {
      console.error(err);
      alert('Error deleting image');
    }
  };

  const handleCancel = () => {
    // Re-run user sync by cloning user reference after exit
    setEditing(false);
    if (user) {
      setLocalUser({ ...user });
      // Force form reset from current user values on next effect cycle
      setFormData((prev) => ({
        ...prev,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        birthdate: user.birthdate || '',
        gender: user.gender || '',
        preferredAgeMin: user.preferredAgeMin || '',
        preferredAgeMax: user.preferredAgeMax || '',
        preferredGenders: user.preferredGenders || '',
        bio: user.bio || '',
        fontFamily: user.fontFamily || 'Arial',
        profileStyle: user.profileStyle || 'classic',
        imageLayout: user.imageLayout || 'grid',
        show_location: Boolean(user.show_location),
      }));
      if (user.images) setImages(user.images);
    }
  };

  // Keep page-level cancel (header/footer) in sync with form reset
  useEffect(() => {
    if (!editing && user && usePageLayout) {
      setFormData((prev) => {
        if (
          prev.first_name === (user.first_name || '') &&
          prev.bio === (user.bio || '') &&
          prev.profileStyle === (user.profileStyle || 'classic')
        ) {
          return prev;
        }
        return {
          ...prev,
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          birthdate: user.birthdate || '',
          gender: user.gender || '',
          preferredAgeMin: user.preferredAgeMin || '',
          preferredAgeMax: user.preferredAgeMax || '',
          preferredGenders: user.preferredGenders || '',
          bio: user.bio || '',
          fontFamily: user.fontFamily || 'Arial',
          profileStyle: user.profileStyle || 'classic',
          imageLayout: user.imageLayout || 'grid',
          show_location: Boolean(user.show_location),
        };
      });
      if (user.images) setImages(user.images);
    }
  }, [editing, user, usePageLayout]);

  useEffect(() => {
    const notify = onEditingFormDataRef.current;
    if (!notify) return;

    if (editing) {
      notify({
        formData,
        handleInputChange,
        handleFormSubmit,
        handleCancel,
      });
    } else {
      notify(null);
    }
    // Handlers are refreshed each render; parent should keep them in a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, formData]);

  if (!user) return null;

  const showProfileCard = user.role === 'user' && usePageLayout && !editing;
  const showInternalHeader = user.role === 'user' && !usePageLayout;

  return (
    <>
    <div
      className={`profile-container format-${formData.profileStyle}${usePageLayout ? ' profile-page-layout' : ''}`}
      style={{ fontFamily: formData.fontFamily }}
    >
      <style>{`
        .profile-container.format-${formData.profileStyle} .profile-card,
        .profile-container.format-${formData.profileStyle} .profile-card * {
          font-family: "${formData.fontFamily}" !important;
        }

        /* keep edit toolbar and its controls using the system font */
        .profile-container.format-${formData.profileStyle} .profile-card .edit-toolbar,
        .profile-container.format-${formData.profileStyle} .profile-card .edit-toolbar * {
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        }
      `}</style>
      {!usePageLayout && formData.profileStyle === "pixelClouds" && <PixelClouds />}
      <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
      {previewUrl && (
        <CropperModal
          imageSrc={previewUrl}
          onClose={() => setPreviewUrl(null)}
          onCropComplete={handleCropComplete}
        />
      )}

      {showInternalHeader && (
        <div className="profile-header">
          <div className="name-section">
            {!editing && <h2>{user.first_name}</h2>}
          </div>
          {!framed && !editing && editable && (
            <div className="profile-actions">
              <FaEdit className="edit-icon" onClick={() => setEditing(true)} />
            </div>
          )}
        </div>
      )}

      {showProfileCard ? (
        <ProfileCard
          profile={{
            ...user,
            images,
            bio: formData.bio || user.bio,
            imageLayout: normalizeImageLayout(formData.imageLayout),
            profileStyle: formData.profileStyle,
            show_location: formData.show_location ?? user.show_location,
          }}
          userInfo={user}
          preferredViewerUnit={viewerUnit}
          blendWithBackground
        />
      ) : null}

      {user.role === 'user' && !showProfileCard && (
        <form
          className={`profile-card ${framed ? 'framed' : ''}${usePageLayout ? ' profile-card-page' : ''}`}
          onSubmit={handleFormSubmit}
        >
          <ProfileInfoCard
            user={user}
            formData={formData}
            editing={editing}
            heightUnit={heightUnit}
            viewerUnit={viewerUnit}
            onInputChange={handleInputChange}
            onUnitToggle={handleUnitToggle}
            onSubmit={handleFormSubmit}
            onCancel={handleCancel}
            calculateAge={calculateAge}
            editProfile={true}
            images={images}
            onDeleteImage={handleDeleteImage}
            onPlaceholderClick={handlePlaceholderClick}
            profileStyle={formData.profileStyle}
            completeProfile={false}
            pageBackgroundColor={usePageLayout ? '#fff5f7' : undefined}
            hideFormActions={usePageLayout}
            hideToolbar={usePageLayout}
          />
        </form>
      )}
    </div>
    </>
  );
};

export default Profile;
