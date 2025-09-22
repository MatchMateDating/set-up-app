import React, { useState, useEffect } from 'react';
import './preferences.css';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';
import { FaEdit } from 'react-icons/fa';
import FormField from './components/formField';

const Preferences = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [user, setUser] = useState(null);
  const [referrer, setReferrer] = useState(null);
  const [formData, setFormData] = useState({
    preferredAgeMin: '0',
    preferredAgeMax: '0',
    preferredGender: ''
  });

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let newValue = value;

    if (name === "preferredAgeMin" && value !== "") {
      newValue = Math.max(18, parseInt(value, 10));
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');

      const payload = {
        preferredAgeMin: formData.preferredAgeMin,
        preferredAgeMax: formData.preferredAgeMax,
        preferredGender: formData.preferredGender,
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
      fetchProfile();
      setEditing(false);
    } catch (err) {
      console.error(err);
      alert('Error updating profile.');
    }
  };

  const handleCancel = () => {
    // Reset formData back to user values
    if (user) {
      setFormData({
        preferredAgeMin: user.preferredAgeMin || '0',
        preferredAgeMax: user.preferredAgeMax || '0',
        preferredGender: user.preferredGender || '',
      });
    }
    setEditing(false);
  };

  return (
    <div className="preferences-container">
      <button className="back-btn" onClick={() => navigate(-1)}>
        <FaArrowLeft /> Back
      </button>
      {!editing && (
        <div className="profile-actions">
          <FaEdit className="edit-icon" onClick={() => setEditing(true)} />
        </div>
      )}
      <form className="preferences-form" onSubmit={handleFormSubmit}>
        <FormField
          label="Preferred Age"
          editing={editing}
          value={
            formData.preferredAgeMin || formData.preferredAgeMax
              ? `${formData.preferredAgeMin || ''} - ${formData.preferredAgeMax || ''}`
              : ''
          }
          input={(
            <>
              <input
                type="number"
                name="preferredAgeMin"
                placeholder="Min"
                value={formData.preferredAgeMin || ''}
                onChange={handleInputChange}
                min="18"
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
          )}
        />


        <FormField
          label="Preferred Gender"
          editing={editing}
          value={formData.preferredGender}
          input={(
            <select
              name="preferredGender"
              value={formData.preferredGender}
              onChange={handleInputChange}
              required
              className="preferred-gender-select"
            >
              <option value="">Select gender</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="nonbinary">Non-binary</option>
            </select>
          )}
        />
        {editing && (
          <div className="form-actions">
            <button type="submit" className="save-btn">Save</button>
            <button type="button" onClick={handleCancel} className="cancel-btn">Cancel</button>
          </div>
        )}
      </form>
    </div>
  );
};

export default Preferences;