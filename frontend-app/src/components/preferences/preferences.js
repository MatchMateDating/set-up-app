import React, { useState, useEffect } from 'react';
import './preferences.css';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';
import { FaEdit } from 'react-icons/fa';
import FormField from '../profile/components/formField';
import Select from 'react-select';

const Preferences = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    preferredAgeMin: '0',
    preferredAgeMax: '0',
    preferredGenders: []
  });

  useEffect(() => {
    fetchProfile();
  }, []);


  useEffect(() => {
    if (user) {
      setFormData({
        preferredAgeMin: user.preferredAgeMin || '0',
        preferredAgeMax: user.preferredAgeMax || '0',
        preferredGenders: user.preferredGenders || '',
      });
    }
  }, [user]);

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
        })
        .catch((err) => console.error('Error loading profile:', err));
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

      const payload = {
        preferredAgeMin: formData.preferredAgeMin,
        preferredAgeMax: formData.preferredAgeMax,
        preferredGenders: formData.preferredGenders,
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
        preferredGenders: user.preferredGenders || '',
      });
    }
    setEditing(false);
  };

  return (
    <div className="preferences-page">
      <div className="preferences-card">
        <div className="preferences-nav">
          <button className="back-btn" onClick={() => navigate(-1)}>
            <FaArrowLeft/> Back
          </button>

          {!editing && (
            <div className="preferences-actions">
              <FaEdit className="edit-icon" onClick={() => setEditing(true)} />
            </div>
          )}
        </div>

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
              )}
            />

            <FormField
              label="Preferred Gender(s)"
              editing={editing}
              value={(formData.preferredGenders || []).join(', ')}
              input={(
                <Select
                  isMulti
                  name="preferredGenders"
                  className="preferred-genders-select"
                  classNamePrefix="pg"
                  value={Array.isArray(formData.preferredGenders)
                    ? formData.preferredGenders.map(g => ({ label: g, value: g }))
                    : []}
                  onChange={(selectedOptions) => {
                    const selectedValues = selectedOptions
                      ? selectedOptions.map(opt => opt.value)
                      : [];
                    handleInputChange({
                      target: {
                        name: "preferredGenders",
                        value: selectedValues,
                      },
                    });
                  }}
                  options={[
                    { value: 'female', label: 'Female' },
                    { value: 'male', label: 'Male' },
                    { value: 'nonbinary', label: 'Non-binary' },
                  ]}
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      border: 'none',
                      borderRadius: 0,
                      boxShadow: 'none',
                      background: 'transparent',
                      minHeight: '32px',
                    }),
                    valueContainer: (base) => ({
                      ...base,
                      padding: "0 4px"
                    }),
                    input: (base) => ({
                      ...base,
                      margin: 0,
                      padding: 0
                    }),
                    multiValue: (base) => ({
                      ...base,
                      background: "var(--primary)",
                      color: "white",
                      borderRadius: "12px",
                      padding: "0 4px"
                    }),
                    multiValueLabel: (base) => ({
                      ...base,
                      color: "white",
                      fontSize: "0.9rem"
                    }),
                    multiValueRemove: (base) => ({
                      ...base,
                      color: "white",
                      ':hover': {
                        background: "var(--primary-dark)",
                        color: "white"
                      }
                    })
                  }}
                />
              )}
            />

          {editing && (
            <div className="settings-actions">
              <button type="submit" className="primary-btn">Save</button>
              <button type="button" onClick={handleCancel} className="secondary-btn">Cancel</button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default Preferences;