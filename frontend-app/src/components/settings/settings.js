import React, { useState, useEffect } from "react";
import {
  FaCopy,
  FaShare,
  FaEnvelope,
  FaArrowLeft,
  FaUserPlus,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import "./settings.css";

const Settings = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [referralCode, setReferralCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [role, setRole] = useState(null);
  const [savedReferrals, setSavedReferrals] = useState([]);
  const navigate = useNavigate();
  const [role, setRole] = useState(null);
  const [referralCodes, setReferralCodes] = useState([]);
  const [savedReferrals, setSavedReferrals] = useState([]);


  useEffect(() => {
    const fetchUserProfile = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        const res = await fetch(`${API_BASE_URL}/profile/`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error("Failed to fetch user profile");
        const data = await res.json();

        setRole(data.user.role);
        if (data.user?.referral_code) {
          setReferralCode(data.user.referral_code);
        }

        if (data.user.role === "matchmaker") {
          const linkedRes = await fetch(
            `${API_BASE_URL}/referral/referrals/${data.user.id}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          const linkedData = await linkedRes.json();
          setSavedReferrals(linkedData.linked_daters || []);
        }

        localStorage.setItem("user", JSON.stringify(data.user));
      } catch (err) {
        console.error(err);
      }
    };

    fetchUserProfile();
  }, []);

  const handleToggleCode = () => setShowCode((prev) => !prev);

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
      await fetch(`${API_BASE_URL}/invite/email`, {
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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ referral_code: code }),
      });

      const data = await res.json();
      if (res.ok) {
        let name = data.message.split(" linked")[0];
        name = name.replace(/^Dater\s*/i, "").trim();

        const newDater = { name, referral_code: code };
        setSavedReferrals((prev) => [...prev, newDater]);
        setReferralCode("");
      } else {
        alert(data.error || "Failed to link referral");
      }
    } catch (err) {
      console.error("Error linking referral:", err);
    }
  };

  return (
    <div className="settings-page">
      <button className="back-btn" onClick={() => navigate(-1)}>
        <FaArrowLeft /> Back
      </button>

      <h2 className="settings-title">Settings</h2>

      {role === "user" && (
        <div className="settings-card fade-in">
          <h3 className="card-header">Your Referral Code</h3>
          <button className="primary-btn" onClick={handleToggleCode}>
            {showCode ? "Hide Code" : "Show Code"}
          </button>

          {showCode && (
            <div className="referral-display">
              <div className="referral-code-box">{referralCode}</div>
              <div className="button-group">
                <button
                  className="icon-btn"
                  onClick={() => navigator.clipboard.writeText(referralCode)}
                  title="Copy"
                >
                  <FaCopy />
                </button>
                <button className="icon-btn" onClick={handleShare} title="Share">
                  <FaShare />
                </button>
                <button
                  className="icon-btn"
                  onClick={handleInvite}
                  title="Invite by Email"
                >
                  <FaEnvelope />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {role === "matchmaker" && (
        <div className="settings-card fade-in">
          <h3 className="card-header">Link Additional Daters</h3>
          <div className="referral-input-group">
            <input
              type="text"
              value={referralCode}
              placeholder="Enter referral code"
              onChange={(e) => setReferralCode(e.target.value)}
              className="referral-input"
            />
            <button className="save-btn" onClick={handleSaveReferral}>
              <FaUserPlus /> Add
            </button>
          </div>

          <div className="saved-referrals">
            <h4>Linked Daters</h4>
            {savedReferrals.length > 0 ? (
              <ul>
                {savedReferrals.map((ref, idx) => (
                  <li key={idx}>
                    <strong>{ref.name}</strong>
                    <span className="referral-tag">{ref.referral_code}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No linked daters yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
