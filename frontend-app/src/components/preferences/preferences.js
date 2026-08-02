import React, { useState, useEffect } from 'react';
import './preferences.css';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaEdit } from 'react-icons/fa';
import FormField from '../profile/components/formField';
import Select from 'react-select';
import AppShell from '../layout/AppShell';

const Preferences = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    preferredAgeMin: '0',
    preferredAgeMax: '0',
    preferredGenders: [],
    matchRadius: '50',
    matchWithAll: false,
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (user) {
      const matchWithAll = (user.match_radius >= 9999);
      setFormData({
        preferredAgeMin: user.preferredAgeMin || '0',
        preferredAgeMax: user.preferredAgeMax || '0',
        preferredGenders: user.preferredGenders || [],
        matchRadius: matchWithAll ? 500 : (user.match_radius || 50),
        matchWithAll,
      });
    }
  }, [user]);

  const fetchProfile = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/profile/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          localStorage.removeItem('token');
          window.location.href = '/';
          return;
        }
      }

      const data = await res.json();
      setUser(data.user);
    } catch (err) {
      console.error('Error loading profile:', err);
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
        match_radius: formData.matchWithAll ? 9999 : Number(formData.matchRadius),
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
          return;
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
    if (user) {
      setFormData({
        preferredAgeMin: user.preferredAgeMin || '0',
        preferredAgeMax: user.preferredAgeMax || '0',
        preferredGenders: user.preferredGenders || [],
        matchRadius: user.match_radius || 50,
      });
    }
    setEditing(false);
  };

  return (
    <AppShell showTabs={false}>
    <div className="preferences-page">
      <div className="preferences-card">
        <div className="preferences-header">
          <button className="back-btn" onClick={() => navigate('/settings')}>
            <FaArrowLeft /> Dating Preferences
          </button>
          {!editing && (
            <FaEdit
              className="edit-icon"
              onClick={() => setEditing(true)}
              title="Edit Preferences"
            />
          )}
        </div>

        <form className="preferences-form" onSubmit={handleFormSubmit}>
          <FormField
            label="Preferred Age"
            editing={editing}
            value={`${formData.preferredAgeMin} - ${formData.preferredAgeMax}`}
            input={
              <div className="form-inline">
                <input
                  type="number"
                  name="preferredAgeMin"
                  placeholder="Min"
                  value={formData.preferredAgeMin}
                  onChange={handleInputChange}
                />
                <span className="dash">-</span>
                <input
                  type="number"
                  name="preferredAgeMax"
                  placeholder="Max"
                  value={formData.preferredAgeMax}
                  onChange={handleInputChange}
                />
              </div>
            }
          />

          <FormField
            label="Preferred Gender(s)"
            editing={editing}
            value={(formData.preferredGenders || []).join(', ')}
            input={
              <Select
                isMulti
                name="preferredGenders"
                className="preferred-genders-select"
                classNamePrefix="pg"
                value={(formData.preferredGenders || []).map((g) => ({
                  label: g,
                  value: g,
                }))}
                onChange={(options) =>
                  handleInputChange({
                    target: {
                      name: 'preferredGenders',
                      value: options ? options.map((opt) => opt.value) : [],
                    },
                  })
                }
                options={[
                  { value: 'female', label: 'Female' },
                  { value: 'male', label: 'Male' },
                  { value: 'nonbinary', label: 'Non-binary' },
                ]}
              />
            }
          />

          <FormField
            label={editing ? `Match Radius (${formData.matchWithAll ? '500+' : formData.matchRadius} mi)` : 'Match Radius'}
            editing={editing}
            value={formData.matchWithAll ? '500+ mi' : `${formData.matchRadius} miles`}
            input={
              <>
                <div className="radius-slider">
                  <input
                    type="range"
                    name="matchRadius"
                    min="1"
                    max="500"
                    step="1"
                    value={Number(formData.matchWithAll ? 500 : formData.matchRadius) || 50}
                    onInput={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        matchRadius: Number(e.target.value),
                        matchWithAll: false,
                      }))
                    }
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        matchRadius: Number(e.target.value),
                        matchWithAll: false,
                      }))
                    }
                  />
                  <span>{formData.matchWithAll ? '500+' : formData.matchRadius} mi</span>
                </div>
                <label className="checkbox-label" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.matchWithAll || false}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      matchWithAll: e.target.checked,
                      matchRadius: e.target.checked ? 500 : 50,
                    }))}
                  />
                  <span>No distance limit</span>
                </label>
              </>
            }
          />

          {editing && (
            <div className="preferences-actions">
              <button type="submit" className="primary-btn">Save</button>
              <button type="button" onClick={handleCancel} className="secondary-btn">Cancel</button>
            </div>
          )}
        </form>
      </div>
    </div>
    </AppShell>
  );
};

export default Preferences;