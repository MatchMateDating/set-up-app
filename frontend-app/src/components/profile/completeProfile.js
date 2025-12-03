import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import './completeProfile.css';
import './profile.css'; // <-- ensure preview uses shared profile card styles
import { calculateAge, convertFtInToMetersCm, convertMetersCmToFtIn, formatHeight } from "./utils/profileUtils";
import ProfileInfoCard from './profileInfoCard';
import CropperModal from './cropperModal';
import Select from 'react-select';
import PixelClouds from './components/PixelClouds';
import { themeDefaultFonts } from './components/themeDefaults';
import {StepIndicator} from './components/stepIndicator';

const CompleteProfile = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const navigate = useNavigate();

  // Calculate default birthdate as "18 years ago" in the user's LOCAL timezone.
  // Avoid using toISOString() because it converts to UTC and can shift the date
  // earlier/later depending on the user's timezone.
  const localNow = new Date();
  localNow.setFullYear(localNow.getFullYear() - 18);
  const pad = (n) => String(n).padStart(2, '0');
  const defaultBirthdate = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())}`;

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    birthdate: defaultBirthdate,
    gender: "",
    heightFeet: '0',
    heightInches: '0',
    heightMeters: '0',
    heightCentimeters: '0',
    preferredAgeMax: '',
    preferredAgeMin: '',
    preferredGenders: [],
    matchRadius: '',
    fontFamily: 'Arial',
    profileStyle: 'classic',
    imageLayout: 'grid',
  });
  const [images, setImages] = useState([]);
  const [user, setUser] = useState(null);
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fontManuallyChosen, setFontManuallyChosen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [heightUnit, setHeightUnit] = useState('ft');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    // ✅ Age validation
    if (calculateAge(formData.birthdate) < 18) {
      setError("You must be at least 18 years old.");
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");

      const heightFormatted = formatHeight(formData, heightUnit);

      const payload = {
        birthdate: formData.birthdate,
        gender: formData.gender,
        height: heightFormatted,
        preferredAgeMax: formData.preferredAgeMax,
        preferredAgeMin: formData.preferredAgeMin,
        preferredGenders: formData.preferredGenders,
      };

      const res = await fetch(`${API_BASE_URL}/profile/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
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

      if (!res.ok) throw new Error("Failed to update profile");

      setSuccess("Profile updated successfully 🎉");
      setTimeout(() => navigate("/match"), 1200);
    } catch (err) {
      console.error(err);
      setError("Error saving profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Multi-step flow state
  const [step, setStep] = useState(1);

  // Save step 1 (personal info) and go to step 2
  const saveStep1 = async () => {
    setLoading(true);
    setError("");
    try {
      if (!formData.birthdate || calculateAge(formData.birthdate) < 18) {
        setError("You must be at least 18 years old.");
        setLoading(false);
        return;
      }

      if (!formData.first_name?.trim()) {
        setError("First name is required.");
        setLoading(false);
        return;
      }

      if (!formData.last_name?.trim()) {
        setError("Last name is required.");
        setLoading(false);
        return;
      }

      if (!formData.gender) {
        setError("Gender is required.");
        setLoading(false);
        return;
      }

      if (heightUnit === "ft") {
        if (!formData.heightFeet || !formData.heightInches || (formData.heightFeet === '0' && formData.heightInches === '0')) {
          setError("Please enter your height.");
          setLoading(false);
          return;
        }
      } else {
        if (!formData.heightMeters || !formData.heightCentimeters || (formData.heightMeters === '0' && formData.heightCentimeters === '0')) {
          setError("Please enter your height.");
          setLoading(false);
          return;
        }
      }

      const token = localStorage.getItem("token");
      const heightFormatted = formatHeight(formData, heightUnit);

      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        birthdate: formData.birthdate,
        gender: formData.gender,
        height: heightFormatted,
        fontFamily: formData.fontFamily,
        profileStyle: formData.profileStyle,
        imageLayout: formData.imageLayout,
      };

      const res = await fetch(`${API_BASE_URL}/profile/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save step 1");

      setStep(2);
    } catch (err) {
      console.error(err);
      setError("Error saving profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const saveStep3 = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");

      if (!formData.preferredAgeMin || !formData.preferredAgeMax) {
        setError("Please specify both minimum and maximum preferred ages.");
        setLoading(false);
        return;
      }

      if (!formData.preferredGenders) {
        setError("Please specify preferred Gender(s).");
        setLoading(false);
        return;
      }

      if (parseInt(formData.preferredAgeMin) > parseInt(formData.preferredAgeMax)) {
        setError("PreferredAgeMin cannot be greater than preferredAgeMax.");
        setLoading(false);
        return;
      }

      const payload = {
        preferredAgeMax: formData.preferredAgeMax,
        preferredAgeMin: formData.preferredAgeMin,
        preferredGenders: formData.preferredGenders,
        match_radius: formData.matchRadius,
      };

      const res = await fetch(`${API_BASE_URL}/profile/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save preferences");

      setSuccess("Profile updated successfully 🎉");
      setTimeout(() => navigate("/match"), 800);
    } catch (err) {
      console.error(err);
      setError("Error saving preferences. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === 'fontFamily') {
      setFontManuallyChosen(true);
      setFormData((prev) => ({ ...prev, fontFamily: value }));
      return;
    }

    if (name === 'profileStyle') {
      const newFont = !fontManuallyChosen
        ? themeDefaultFonts[value] || 'Arial'
        : formData.fontFamily; // keep custom choice

      setFormData((prev) => ({ ...prev, profileStyle: value, fontFamily: newFont }));
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

  const handlePreferredGendersChange = (selectedOptions) => {
    const selectedValues = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
    setFormData((prev) => ({ ...prev, preferredGenders: selectedValues }));
  };

  useEffect(() => {
    // Load existing profile to prefill fields and images
    const fetchProfile = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE_URL}/profile/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const user = data.user || {};
        setUser(user);
        setFormData((prev) => ({
          ...prev,
          first_name: user.first_name || prev.first_name,
          last_name: user.last_name || prev.last_name,
        }));
        // If the stored font differs from the theme default, treat it as manually chosen
        const storedFont = '';
        const storedStyle = '';
        if (storedFont && storedStyle && themeDefaultFonts[storedStyle] !== storedFont) {
          setFontManuallyChosen(true);
        }
        if (user.images) setImages(user.images);
      } catch (err) {
        console.error('Error loading profile for complete flow:', err);
      }
    };

    fetchProfile();
  }, [API_BASE_URL]);

  const handlePlaceholderClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => setPreviewUrl(reader.result);
  };

  const handleCropComplete = async (croppedBlob) => {
    setPreviewUrl(null);
    if (!croppedBlob) return;

    const fd = new FormData();
    fd.append('image', croppedBlob, 'cropped_image.jpg');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/profile/upload_image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!response.ok) throw new Error('Failed to upload image');
      const newImage = await response.json();
      setImages((prev) => [...prev, newImage]);
    } catch (err) {
      console.error(err);
      alert('Error uploading image');
    }
  };

  const handleDeleteImage = async (imageId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/profile/delete_image/${imageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete image');
      setImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch (err) {
      console.error(err);
      alert('Error deleting image');
    }
  };

  return (
    <div className="profile-page-container">
      <StepIndicator step={step} />

      <div className="space-y-4">
        {step === 1 && (
          <>
            <div
              className={`profile-container format-${formData.profileStyle}`}
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
              {formData.profileStyle === "pixel" && <PixelClouds />}

              <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
              {previewUrl && (
                <CropperModal
                  imageSrc={previewUrl}
                  onClose={() => setPreviewUrl(null)}
                  onCropComplete={handleCropComplete}
                />
              )}

              <form className={`profile-card`} onSubmit={(e) => { e.preventDefault(); saveStep1(); }}>
                <ProfileInfoCard
                  user={user || { role: 'user' }}
                  formData={formData}
                  editing={true}
                  heightUnit={heightUnit}
                  onInputChange={handleInputChange}
                  onUnitToggle={handleUnitToggle}
                  onSubmit={saveStep1}
                  onCancel={() => navigate("/profile")}
                  calculateAge={calculateAge}
                  completeProfile={false}
                  editProfile={true}
                  profileStyle={formData.profileStyle}
                  hideFormActions={true}
                  images={images}
                  onDeleteImage={handleDeleteImage}
                  onPlaceholderClick={handlePlaceholderClick}
                />
              </form>

              <div className="form-actions">
                <button type="button" onClick={() => setStep(3)} className="secondary-btn">Skip</button>
                <button type="button" onClick={saveStep1} className="primary-btn">Next</button>
                
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            {/* Preview step: show non-editable match card (ProfileInfoCard with editing=false) */}
            <div
              className={`profile-container format-${formData.profileStyle}`}
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
              {formData.profileStyle === "pixel" && <PixelClouds />}

              <div className="profile-header">
                <div className="name-section">
                  <h2>{formData.first_name || (user && user.first_name) || ''}</h2>
                </div>
              </div>

              <div className="profile-card">
                {
                  (() => {
                    // Build preview user object that matches profile.js non-edit view:
                    // merge fetched user with formData, compute height and age explicitly,
                    // and ensure images are present.
                    const mergedBirthdate = formData.birthdate || (user && user.birthdate) || '';
                    const previewUser = {
                      ...(user || {}),
                      first_name: formData.first_name || (user && user.first_name) || '',
                      last_name: formData.last_name || (user && user.last_name) || '',
                      birthdate: mergedBirthdate,
                      gender: formData.gender || (user && user.gender) || '',
                      height: formatHeight(formData, heightUnit) || (user && user.height) || '',
                      images: (images && images.length) ? images : (user && user.images) || [],
                      profileStyle: formData.profileStyle || (user && user.profileStyle) || 'classic',
                      role: (user && user.role) || 'user',
                      // include computed age in case ProfileInfoCard expects it directly
                      age: mergedBirthdate ? calculateAge(mergedBirthdate) : (user && calculateAge(user.birthdate)) || null
                    };

                    return (
                      <ProfileInfoCard
                        user={previewUser}
                        formData={formData}
                        editing={false}
                        heightUnit={heightUnit}
                        calculateAge={calculateAge}
                        completeProfile={false}
                        images={images}
                      />
                    );
                  })()
                }
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setStep(1)} className="secondary-btn">Back</button>
                <button type="button" onClick={() => setStep(3)} className="primary-btn">Next</button>
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <div className="preferences-card"> 
            <h3 style={{ marginBottom: '20px' }}>Preferences</h3>

            <div className="preferences-form">

              {/* Preferred Age */}
              <div className="form-field">
                <label>Preferred Age</label>
                <div className="form-inline">
                  <input
                    type="number"
                    name="preferredAgeMin"
                    placeholder="Min"
                    value={formData.preferredAgeMin || ''}
                    onChange={handleInputChange}
                  />
                  <span className="dash">-</span>
                  <input
                    type="number"
                    name="preferredAgeMax"
                    placeholder="Max"
                    value={formData.preferredAgeMax || ''}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              {/* Preferred Gender(s) */}
              <div className="form-field">
                <label>Preferred Gender(s)</label>
                <Select
                  isMulti
                  name="preferredGenders"
                  className="preferred-genders-select"
                  classNamePrefix="pg"
                  value={
                    Array.isArray(formData.preferredGenders)
                      ? formData.preferredGenders.map((g) => ({ label: g, value: g }))
                      : []
                  }
                  onChange={handlePreferredGendersChange}
                  options={[
                    { value: 'female', label: 'Female' },
                    { value: 'male', label: 'Male' },
                    { value: 'nonbinary', label: 'Non-binary' },
                  ]}
                />
              </div>

              {/* Match Radius */}
              <div className="form-field">
                <label>Match Radius</label>
                <div className="radius-slider">
                  <input
                    type="range"
                    name="matchRadius"
                    min="1"
                    max="500"
                    step="1"
                    value={formData.matchRadius || 50}
                    onChange={handleInputChange}
                  />
                  <span>{formData.matchRadius || 50} mi</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="preferences-actions">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="secondary-btn"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={saveStep3}
                  className="primary-btn"
                >
                  Submit
                </button>
              </div>

            </div>
          </div>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm">{success}</p>}
      </div>
    </div>
  );
};

export default CompleteProfile;
