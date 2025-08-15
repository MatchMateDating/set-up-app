import React, { useEffect, useState, useRef } from 'react';
import './profile.css';
import { FaEdit } from 'react-icons/fa';
import CropperModal from './cropperModal';
import AvatarSelectorModal from './avatarSelectorModal';
import ImageGallery from './images';

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
      // Convert ft/in to meters/cm
      const totalInches =
        parseInt(formData.heightFeet || '0') * 12 + parseInt(formData.heightInches || '0');
      const totalCm = totalInches * 2.54;
      const meters = Math.floor(totalCm / 100);
      const centimeters = Math.round(totalCm % 100);

      setFormData((prev) => ({
        ...prev,
        heightMeters: meters.toString(),
        heightCentimeters: centimeters.toString(),
      }));
      setHeightUnit('m');
    } else {
      // Convert meters/cm to ft/in
      const totalCm =
        parseInt(formData.heightMeters || '0') * 100 +
        parseInt(formData.heightCentimeters || '0');
      const totalInches = totalCm / 2.54;
      const feet = Math.floor(totalInches / 12);
      const inches = Math.round(totalInches % 12);

      setFormData((prev) => ({
        ...prev,
        heightFeet: feet.toString(),
        heightInches: inches.toString(),
      }));
      setHeightUnit('ft');
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      let heightFormatted = '';
      if (heightUnit === 'ft') {
        heightFormatted = `${formData.heightFeet}'${formData.heightInches}"`;
      } else {
        heightFormatted = `${formData.heightMeters}m ${formData.heightCentimeters}cm`;
      }

      const res = await fetch(`${API_BASE_URL}/profile/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          height: heightFormatted,
        }),
      });

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

      if (!res.ok) throw new Error('Failed to delete image');

      // Remove image from local state
      setImages((prevImages) => prevImages.filter((img) => img.id !== imageId));
    } catch (err) {
      console.error(err);
      alert('Error deleting image');
    }
  };

  // Renders a field with label, edit mode input, and view mode value
  const renderField = ({ label, editing, value, input }) => {
    if (!editing && !value) return null;

    return (
      <div style={{ marginBottom: '1rem' }}>
        <label>
          {label}: {editing ? input : <span>{value}</span>}
        </label>
      </div>
    );
  };

  // Renders the height selector UI
  const renderHeightSelector = () => (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {heightUnit === 'ft' ? (
        <>
          <select
            value={formData.heightFeet}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, heightFeet: e.target.value }))
            }
          >
            {[...Array(8).keys()].map((num) => (
              <option key={num} value={num}>
                {num} ft
              </option>
            ))}
          </select>
          <select
            value={formData.heightInches}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, heightInches: e.target.value }))
            }
          >
            {[...Array(12).keys()].map((num) => (
              <option key={num} value={num}>
                {num} in
              </option>
            ))}
          </select>
        </>
      ) : (
        <>
          <select
            value={formData.heightMeters}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, heightMeters: e.target.value }))
            }
          >
            {[...Array(3).keys()].map((num) => (
              <option key={num} value={num}>
                {num} m
              </option>
            ))}
          </select>
          <select
            value={formData.heightCentimeters}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, heightCentimeters: e.target.value }))
            }
          >
            {[...Array(100).keys()].map((num) => (
              <option key={num} value={num}>
                {num} cm
              </option>
            ))}
          </select>
        </>
      )}
      <button
        type="button"
        onClick={handleUnitToggle}
        style={{ marginLeft: '10px' }}
      >
        {heightUnit === 'ft' ? 'Switch to meters' : 'Switch to feet'}
      </button>
    </div>
  );

  const renderPreferredAgeField = () => {
    // If not editing and no values, hide it entirely
    console.log(editing, formData)
    if (!editing && !formData.preferredAgeMin) return null;
  
    return (
      <div style={{ marginBottom: '1rem' }}>
        <label>
          Preferred Age:{" "}
          {editing ? (
            <>
              <input
                type="number"
                name="preferredAgeMin"
                placeholder="Min"
                value={formData.preferredAgeMin || ''}
                onChange={handleInputChange}
                style={{ width: '60px', marginRight: '8px' }}
              />
              <input
                type="number"
                name="preferredAgeMax"
                placeholder="Max"
                value={formData.preferredAgeMax || ''}
                onChange={handleInputChange}
                style={{ width: '60px' }}
              />
            </>
          ) : (
            <span>
              {formData.preferredAgeMin} - {formData.preferredAgeMax}
            </span>
          )}
        </label>
      </div>
    );
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

      <form
        className={`profile-card ${framed ? 'framed' : ''}`}
        onSubmit={handleFormSubmit}
      >
        {user.role === 'user' && (
          <>
            {renderField({
              label: editing ? 'Birthdate' : 'Age',
              editing,
              value: editing
                ? formData.birthdate || ''
                : user.age,
              input: (
                <input
                  name="birthdate"
                  type="date"
                  value={formData.birthdate || ''}
                  onChange={handleInputChange}
                />
              ),
            })}

            {renderField({
              label: 'Height',
              editing,
              value: user.height,
              input: renderHeightSelector(),
            })}

            {renderField({
              label: 'Gender',
              editing,
              value: user.gender,
              input: (
                <input
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                />
              ),
            })}

            {renderPreferredAgeField()}

            {renderField({
              label: 'Preferred Gender',
              editing,
              value: user.preferredGender,
              input: (
                <input
                  name="preferredGender"
                  value={formData.preferredGender}
                  onChange={handleInputChange}
                />
              ),
            })}
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
                  <>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {heightUnit === 'ft' ? (
                        <>
                          <select
                            value={formData.heightFeet}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, heightFeet: e.target.value }))
                            }
                          >
                            {[...Array(8).keys()].map((num) => (
                              <option key={num} value={num}>{num} ft</option>
                            ))}
                          </select>
                          <select
                            value={formData.heightInches}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, heightInches: e.target.value }))
                            }
                          >
                            {[...Array(12).keys()].map((num) => (
                              <option key={num} value={num}>{num} in</option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <>
                          <select
                            value={formData.heightMeters}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, heightMeters: e.target.value }))
                            }
                          >
                            {[...Array(3).keys()].map((num) => (
                              <option key={num} value={num}>{num} m</option>
                            ))}
                          </select>
                          <select
                            value={formData.heightCentimeters}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, heightCentimeters: e.target.value }))
                            }
                          >
                            {[...Array(100).keys()].map((num) => (
                              <option key={num} value={num}>{num} cm</option>
                            ))}
                          </select>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={handleUnitToggle}
                        style={{ marginLeft: '10px' }}
                      >
                        {heightUnit === 'ft' ? 'Switch to meters' : 'Switch to feet'}
                      </button>
                    </div>
                  </>
                ) : (
                  <span>
                    {user.height}
                  </span>
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

        {user.role === 'matchmaker' &&
          renderField({
            label: 'Description',
            editing,
            value: <p>{user.description}</p>,
            input: (
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
              />
            ),
          })}

        {editing && (
          <div style={{ marginTop: '1rem' }}>
            <button type="submit">Save</button>
            <button
              type="button"
              onClick={onCancel}
              style={{ marginLeft: '1rem' }}
            >
              Cancel
            </button>
          </div>
        )}
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

