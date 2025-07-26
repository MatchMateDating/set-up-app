import React, { useEffect, useState } from 'react';
import Profile from './profile';
import EditProfile from './editProfile';
import BottomTab from './bottomTab';

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [referrer, setReferrer] = useState(null);
  const [editing, setEditing] = useState(false);

  const fetchProfile = () => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch('http://localhost:5000/profile/', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user);
        setReferrer(data.referrer || null);
      })
      .catch((err) => console.error('Error loading profile:', err));
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      console.log('Fetching profile with token:', token);
      fetch('http://localhost:5000/profile/', {
        headers: {
          // ✅ Send the token with the "Bearer " prefix
          'Authorization': `Bearer ${token}`,
        },
      })
      .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch profile');
          return res.json();
      })
      .then((data) => {
        setUser(data.user);
        setReferrer(data.referrer || null);
      })
      .catch((err) => console.error('Error loading profile:', err));
    }
  }, [localStorage.getItem('token')]);

  useEffect(() => {
    if (user) {
      console.log('✅ User:', user);
    }
  }, [user]);

  useEffect(() => {
    if (referrer) {
      console.log('📌 Referrer:', referrer);
      console.log('check: ', user?.role === 'matchmaker')
    }
  }, [referrer]);

  return (
  <>
      {user ? (
        <>
          {editing ? (
            <EditProfile 
            user={user} 
            onSave={() => { fetchProfile(); setEditing(false); }} 
            onCancel={() => setEditing(false)} />
          ) : (
            <>
              <Profile 
              user={user} 
              framed={false}
              onEditClick={()=> setEditing(true)}/>
              {/* <button onClick={() => setEditing(true)}>Edit Profile</button> */}
            </>
          )}
        </>
      ) : (
        <p>Loading user profile...</p>
      )}
      {user?.role === 'matchmaker' && referrer && (
        <div className="embedded-profile">
          <h3>Dater's Profile</h3>
          <Profile user={referrer} framed={true} />
        </div>
      )}
      <div style={{ paddingBottom: '60px' }}>
        <BottomTab />
      </div>
    </>
  );
};

export default ProfilePage;
