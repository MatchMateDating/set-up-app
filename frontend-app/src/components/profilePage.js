import React, { useEffect, useState } from 'react';
import Profile from './profile';

const ProfilePage = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
        fetch('http://localhost:5000/profile/', {
          headers: {
            // ✅ Send the token with the "Bearer " prefix
            'Authorization': `Bearer ${token}`,
          },
        })
        .then((res) => {
            if (!res.ok) {
                // Handle errors like expired tokens
                throw new Error('Failed to fetch profile');
            }
            return res.json();
        })
        .then((data) => setUser(data))
        .catch((err) => console.error('Error loading profile:', err));
    }
  }, []);

  return <Profile user={user} />;
};

export default ProfilePage;
