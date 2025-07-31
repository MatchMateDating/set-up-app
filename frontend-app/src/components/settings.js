import React, { useState, useEffect } from 'react';

const Settings = () => {
  const [referralCode, setReferralCode] = useState('');
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    // Assuming user info is stored in localStorage after login
    const userData = JSON.parse(localStorage.getItem('user'));
    if (userData && userData.referral_code) {
      setReferralCode(userData.referral_code);
    } else {
      // If user doesn't have a code, generate one here if needed
      setReferralCode('NO-CODE');
    }
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
        </div>
      )}
    </div>
  );
};

export default Settings;
