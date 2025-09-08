import React, { useState, useEffect } from 'react';
import { FaCopy, FaShare, FaEnvelope, FaArrowLeft } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import './settings.css';

const Settings = () => {
  const [referralCode, setReferralCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const navigate = useNavigate();

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

  const handleToggleCode = () => {
    setShowCode((prev)=> !prev);
  };

  const handleShare = async () => {
    const shareData = {
      title: "Join this app!",
      text: "Sign up using my referral code!",
      url: `${process.env.REACT_APP_SIGNUP_URL}?ref=${referralCode}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      alert("Sharing not supported on this browser.");
    }
  };

  const handleInvite = async () => {
    const email = window.prompt("Enter email address:");
    if (email) {
      await fetch(`${process.env.REACT_APP_API_BASE_URL}/invite/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, referralCode }),
      });
      alert("Email invite sent!");
    }
  };

  return (
    <div className="settings-container">
      <button className="back-btn" onClick={() => navigate(-1)}>
        <FaArrowLeft /> Back
      </button>
      <h2 className="settings-title">Settings</h2>
      <button className="primary-btn" onClick={handleToggleCode}>
        {showCode ? "Hide Referral Code" : "Show Referral Code"}
      </button>
      {showCode && (
        <div className="referral-section">
          <span className="referral-code">{referralCode}</span>
          <div className="button-group">
            <button 
              className="icon-btn" 
              onClick={() => navigator.clipboard.writeText(referralCode)}
            >
              <FaCopy/>
            </button>
            <button
              className="secondary-btn"
              onClick={handleShare}
            >
              <FaShare/>
            </button>
            <button 
              className="secondary-btn"
              onClick={handleInvite}
            >
              <FaEnvelope/>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
