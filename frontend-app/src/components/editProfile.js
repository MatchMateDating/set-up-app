// EditProfile.js
import React, { useState, useEffect } from 'react';

const EditProfile = ({ user, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    age: '',
    gender: '',
    height: '',
    description: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        age: user.age || '',
        gender: user.gender || '',
        height: user.height || '',
        description: user.description || '',
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
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
      const updated = await res.json();
      onSave(updated);
    } catch (err) {
      console.error(err);
      alert('Error updating profile.');
    }
  };

  return (
    <form className="edit-profile-form" onSubmit={handleSubmit}>
      {user.role === 'user' && (
        <>
          <label>
            Age:
            <input name="age" value={formData.age} onChange={handleChange} type="number" />
          </label>
          <label>
            Height:
            <input name="height" value={formData.height} onChange={handleChange} />
          </label>
          <label>
            Gender:
            <input name="gender" value={formData.gender} onChange={handleChange} />
          </label>
        </>
      )}

      {user.role === 'matchmaker' && (
        <label>
          Description:
          <textarea name="description" value={formData.description} onChange={handleChange} />
        </label>
      )}
      
      <div style={{ marginTop: '1rem' }}>
        <button type="submit">Save</button>
        <button type="button" onClick={onCancel} style={{ marginLeft: '1rem' }}>
          Cancel
        </button>
      </div>
    </form>
  );
};

export default EditProfile;
