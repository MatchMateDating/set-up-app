import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './signUp.css';
import { startLocationWatcher } from './utils/startLocationWatcher';
import { useUser } from '../../context/UserContext';

function SignUp() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [first_name, setFirstName] = useState('');
  const [last_name, setLastName] = useState('');
  const [role, setRole] = useState('user');
  const [referralCode, setReferralCode] = useState('');
  const navigate = useNavigate();
  const { setUser } = useUser();

  const handleRegister = async () => {
    try {
      const payload = {
        first_name,
        last_name,
        email,
        password,
        role,
      };
      if (role === 'matchmaker') {
        if (!referralCode) {
          alert('Referral code is required for matchmakers.');
          return;
        }
        payload.referral_code = referralCode;
      }
      const res = await axios.post(`${API_BASE_URL}/auth/register`, payload);

      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        startLocationWatcher(API_BASE_URL, res.data.token);
        if (res.data.user) {
          localStorage.setItem('user', JSON.stringify(res.data.user));
          setUser(res.data.user);
        }
        if (role === 'user') {
          navigate('/complete-profile', { replace: true });
        } else {
          navigate('/profile', { replace: true });
        }
      } else {
        console.error('Registration successful, but no token received.');
      }
    } catch (err) {
      alert(err.response?.data?.msg || 'Registration failed');
    }
  };

  return (
    <div className="auth-page">
      <div className="sign-up-container">
        <img
          src="/assets/matchmate_logo.png"
          alt="MatchMate"
          className="auth-logo"
        />
        <h2>Create account</h2>
        <p className="auth-subtitle">Join MatchMate</p>

        <div className="role-toggle-wrapper">
          <div className="role-toggle" role="tablist" aria-label="Sign up role">
            <button
              type="button"
              className={`role-btn ${role === 'user' ? 'active' : ''}`}
              onClick={() => setRole('user')}
              aria-pressed={role === 'user'}
            >
              Dater
            </button>
            <button
              type="button"
              className={`role-btn ${role === 'matchmaker' ? 'active' : ''}`}
              onClick={() => setRole('matchmaker')}
              aria-pressed={role === 'matchmaker'}
            >
              Matcher
            </button>
          </div>
        </div>

        <input
          type="text"
          placeholder="First Name"
          value={first_name}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Last Name"
          value={last_name}
          onChange={(e) => setLastName(e.target.value)}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {role === 'matchmaker' && (
          <input
            type="text"
            placeholder="Enter Dater's Referral Code"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
          />
        )}

        <button type="button" onClick={handleRegister}>
          Sign Up
        </button>
        <p>Already have an account?</p>
        <button type="button" className="secondary" onClick={() => navigate('/')}>
          Login
        </button>
      </div>
    </div>
  );
}

export default SignUp;
