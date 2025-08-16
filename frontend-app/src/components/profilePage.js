import React, { useEffect, useState } from 'react';
import Profile from './profile';
import BottomTab from './bottomTab';
import SideBar from './sideBar';

const ProfilePage = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [user, setUser] = useState(null);
  const [referrer, setReferrer] = useState(null);
  const [editing, setEditing] = useState(false);

  const fetchProfile = () => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch(`${API_BASE_URL}/profile/`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      .then((res) => res.json())
      .then((data) => {
        console.log(data.user)
        setUser(data.user);
        setReferrer(data.referrer || null);
      })
      .catch((err) => console.error('Error loading profile:', err));
    }
  };

  useEffect(() => { fetchProfile(); }, []);
  useEffect(() => { 
    if (user) console.log('✅ User:', user); 
  }, [user]);

  const handleSave = () => {
    fetchProfile();
    setEditing(false);
  };

  return (
    <>
      <SideBar/>
      <div style={{ paddingBottom: '60px', paddingTop: '66px' }}>
        {user ? (
          <>
            <Profile 
              user={user} 
              framed={false}
              editing={editing}
              onEditClick={() => setEditing(true)}
              onSave={handleSave}
              onCancel={() => setEditing(false)}
            />
          </>
        ) : (
          <p>Loading user profile...</p>
        )}

        {user?.role === 'matchmaker' && referrer && (
          <div className="embedded-profile">
            <h3>Dater's Profile</h3>
            <Profile user={referrer} framed={true} editing={false} />
          </div>
        )}

        <BottomTab />
      </div>
    </>
  );
};

export default ProfilePage;
