import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import './login.css';
import { startLocationWatcher } from './utils/startLocationWatcher';
import { useUser } from '../../context/UserContext';
import {
  getIdentifierKind,
  normalizeUsPhoneToE164,
} from './utils/authIdentifiers';

function Login() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [identifierError, setIdentifierError] = useState('');
  const navigate = useNavigate();
  const { setUser } = useUser();

  const handleLogin = async () => {
    const trimmed = identifier.trim();
    if (!trimmed) {
      setIdentifierError('Please enter your email or phone number');
      return;
    }
    const kind = getIdentifierKind(trimmed);
    if (!kind) {
      setIdentifierError(
        trimmed.includes('@')
          ? 'Not a valid email'
          : 'Enter a valid email or phone number'
      );
      return;
    }
    setIdentifierError('');
    const loginIdentifier =
      kind === 'phone' ? normalizeUsPhoneToE164(trimmed) : trimmed;

    try {
      const res = await axios.post(`${API_BASE_URL}/auth/login`, {
        identifier: loginIdentifier,
        password,
        staySignedIn,
      });
      localStorage.setItem('token', res.data.token);
      startLocationWatcher(API_BASE_URL, res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setUser(res.data.user);

      const incomplete =
        res.data.user?.role === 'user' && !res.data.user?.first_name;
      const needsMatchmaker =
        res.data.user?.role === 'user' &&
        res.data.user?.has_linked_matchmaker !== true &&
        !incomplete;
      if (incomplete) {
        navigate('/complete-profile', { replace: true });
      } else if (needsMatchmaker) {
        navigate('/settings?requireMatchmaker=1&openReferral=1', {
          replace: true,
        });
      } else {
        navigate('/match', { replace: true });
      }
    } catch (err) {
      alert(
        err.response?.data?.error ||
          err.response?.data?.msg ||
          'Login failed'
      );
    }
  };

  return (
    <div className="auth-page">
      <div className="login-container">
        <div className="auth-logo-wrap">
          <img
            src="/assets/matchmate_logo.png"
            alt="MatchMate"
            className="auth-logo"
          />
        </div>
        <h2 className="auth-title">Welcome Back</h2>
        <p className="auth-subtitle">Sign in to continue</p>

        <input
          type="text"
          className="auth-input"
          placeholder="Email or phone number"
          value={identifier}
          onChange={(e) => {
            setIdentifier(e.target.value);
            if (identifierError) setIdentifierError('');
          }}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
        />
        {identifierError ? (
          <p className="auth-field-error">{identifierError}</p>
        ) : null}

        <div className="auth-password-wrap">
          <input
            type={showPassword ? 'text' : 'password'}
            className="auth-input auth-input-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLogin();
            }}
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            <span>{showPassword ? 'Hide' : 'Show'}</span>
          </button>
        </div>

        <label className="auth-remember">
          <span
            className={`auth-remember-box ${staySignedIn ? 'checked' : ''}`}
            aria-hidden="true"
          >
            {staySignedIn ? '✓' : ''}
          </span>
          <input
            type="checkbox"
            checked={staySignedIn}
            onChange={(e) => setStaySignedIn(e.target.checked)}
          />
          <span className="auth-remember-label">Remember Me</span>
        </label>

        <button type="button" className="auth-primary-btn" onClick={handleLogin}>
          Login
        </button>

        <button
          type="button"
          className="auth-text-link auth-forgot"
          onClick={() => navigate('/forgot-password')}
        >
          Forgot Password?
        </button>

        <div className="auth-divider" />

        <p className="auth-footer-text">Don&apos;t have an account?</p>
        <button
          type="button"
          className="auth-text-link auth-signup-link"
          onClick={() => navigate('/signup')}
        >
          Sign Up
        </button>
      </div>
    </div>
  );
}

export default Login;
