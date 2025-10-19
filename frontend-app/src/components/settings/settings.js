import React, { useState, useEffect } from 'react';
import { FaCopy, FaShare, FaEnvelope, FaArrowLeft } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import './settings.css';

const Settings = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [referralCode, setReferralCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const navigate = useNavigate();
  const [role, setRole] = useState(null);
  const [referralCodes, setReferralCodes] = useState([]);
  const [savedReferrals, setSavedReferrals] = useState([]);


  useEffect(() => {
    const fetchUserProfile = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const res = await fetch(`${API_BASE_URL}/profile/`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error('Failed to fetch user profile');
        const data = await res.json();
        console.log('referral codes', data.user.referral_code);
        setRole(data.user.role);
        if (data.user?.referral_code) {
          setReferralCode(data.user.referral_code);
        } 

        if (data.user.role === "matchmaker") {
          const linkedRes = await fetch(`${API_BASE_URL}/referral/referrals/${data.user.id}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          const linkedData = await linkedRes.json();
          console.log('linked data', linkedData);
          setSavedReferrals(linkedData.linked_daters || []);
          console.log('linked daters', linkedData.linked_daters);
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
    setShowCode((prev) => !prev);
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

  const handleSaveReferral = async () => {
    const code = referralCode.trim();
    if (!code) return;

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE_URL}/referral/link_referral`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ referral_code: code }),
      });

      const data = await res.json();
      if (res.ok) {
        // data.message or data.linked_dater contains the new linked dater
        const newDater = {
          name: data.message.split(" linked")[0], // or if your backend returns a 'name', use that
          referral_code: code
        };

        setSavedReferrals(prev => [...prev, newDater]);
        setReferralCode('');
        alert(`Linked to ${newDater.name}`);
      } else {
        alert(data.error || "Failed to link referral");
      }
    } catch (err) {
      console.error("Error linking referral:", err);
      alert("Something went wrong linking referral");
    }
  };


  return (
    <div className="settings-page">
      <div className="settings-card">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <FaArrowLeft /> Back
        </button>

        <h2 className="settings-title">Settings</h2>

        {role === "user" && (<div className="settings-actions">
          {(<button className="primary-btn" onClick={handleToggleCode}>
            {showCode ? "Hide Referral Code" : "Show Referral Code"}
          </button>)}
        </div>)}
      </div>

      {showCode && role === "user" && (
        <div className="settings-card">
          <div className="referral-section">
            <span className="referral-code">{referralCode}</span>
            <div className="button-group">
              <button
                className="icon-btn"
                onClick={() => navigator.clipboard.writeText(referralCode)}
                title="Copy"
              >
                <FaCopy />
              </button>
              <button className="secondary-btn" onClick={handleShare} title="Share">
                <FaShare />
              </button>
              <button className="secondary-btn" onClick={handleInvite} title="Invite by email">
                <FaEnvelope />
              </button>
            </div>
          </div>
        </div>
      )}
      {role === "matchmaker" && (
        <div className="settings-card">
          <h3>Link Additional Daters:</h3>
            <div className="referral-input-group">
              <input
                type="text"
                value={referralCode}
                placeholder="Enter referral code"
                onChange={(e) => setReferralCode(e.target.value)}
                className="referral-input"
              />
              <button
                className="save-btn"
                onClick={() => handleSaveReferral()}
              >
                Save
              </button>
            </div>

          {/* Display saved referral codes */}
          <div className="saved-referrals">
            <h4>Linked Referral Codes:</h4>
            {savedReferrals.length > 0 ? (
              <ul>
                {savedReferrals.map((ref, idx) => (
                  <li key={idx}>
                    <strong>{ref.name}</strong> — {ref.referral_code}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No linked daters yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
