import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import './completeProfile.css';
import { calculateAge, convertFtInToMetersCm, convertMetersCmToFtIn, formatHeight } from "./utils/profileUtils";
import HeightSelector from "./components/heightSelector";
import ProfileInfoCard from './profileInfoCard';

const CompleteProfile = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const navigate = useNavigate();

  const today = new Date();
  const defaultBirthdate = new Date(today.setFullYear(today.getFullYear() - 18))
    .toISOString()
    .split("T")[0];

  const [formData, setFormData] = useState({
    birthdate: defaultBirthdate,
    gender: "",
    heightFeet: '0',
    heightInches: '0',
    heightMeters: '0',
    heightCentimeters: '0',
    preferredAgeMax: '',
    preferredAgeMin: '',
    preferredGenders: [],
  });

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
      setTimeout(() => navigate("/profile"), 1200);
    } catch (err) {
      console.error(err);
      setError("Error saving profile. Please try again.");
    } finally {
      setLoading(false);
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

  return (
    <div className="complete-profile-container">
      <h2 className="text-2xl font-semibold text-center mb-6">
        Complete Your Profile
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <ProfileInfoCard
          user={{ role: "user" }}
          formData={formData}
          editing={true}
          heightUnit={heightUnit}
          onInputChange={handleInputChange}
          onUnitToggle={handleUnitToggle}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/profile")}
          calculateAge={calculateAge}
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm">{success}</p>}
      </form>
    </div>
  );
};

export default CompleteProfile;
