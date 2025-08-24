import React, { useState, useEffect } from 'react';
import { FaCopy } from 'react-icons/fa';

const Settings = () => {
  const [referralCode, setReferralCode] = useState('');
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/profile/`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error('Failed to fetch user profile');

        const data = await res.json();
        if (data.user?.referral_code) {
          setReferralCode(data.user.referral_code);
        } else {
          setReferralCode('NO-CODE');
        }

        // Optional: Update localStorage user object to keep in sync
        localStorage.setItem('user', JSON.stringify(data.user));

      } catch (err) {
        console.error(err);
      }
    };

    fetchUserProfile();
  }, []);

  const handleShowCode = () => {
    setShowCode(true);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Settings</h2>
      <button onClick={handleShowCode}>Show Referral Code</button>
      {showCode && (
        <div style={{ marginTop: '20px', fontSize: '1.2em', color: '#2a9d8f' }}>
          {referralCode}
          <button onClick={() => navigator.clipboard.writeText(referralCode)}>
            <FaCopy style={{ cursor: 'pointer' }} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Settings;
