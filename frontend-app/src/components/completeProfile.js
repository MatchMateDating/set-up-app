import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CompleteProfile = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [birthdate, setBirthdate] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/profile/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ birthdate }),
      });

      if (!res.ok) throw new Error('Failed to update age');
      navigate('/profile');  // Redirect to profile page after saving
    } catch (err) {
      console.error(err);
      alert('Error saving birthdate');
    }
  };

  return (
    <div className="complete-profile-container">
      <h2>Complete Your Profile</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Birthdate:
          <input
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            required
          />
        </label>
        <button type="submit">Continue</button>
      </form>
    </div>
  );
};

export default CompleteProfile;
