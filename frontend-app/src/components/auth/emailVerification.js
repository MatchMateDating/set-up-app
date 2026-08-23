import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { startLocationWatcher } from './utils/startLocationWatcher';
import {
  SIGNUP_DATA_KEY,
  VERIFICATION_TOKEN_KEY,
} from './utils/authIdentifiers';
import './login.css';

function EmailVerification() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useUser();

  const identifier =
    location.state?.identifier ||
    sessionStorage.getItem('verifyIdentifier') ||
    '';
  const verificationMethod =
    location.state?.verificationMethod ||
    sessionStorage.getItem('verifyMethod') ||
    (identifier.includes('@') ? 'email' : 'phone');

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    const signupDataStr = sessionStorage.getItem(SIGNUP_DATA_KEY);
    const verificationToken = sessionStorage.getItem(VERIFICATION_TOKEN_KEY);
    if (!signupDataStr || !verificationToken) {
      alert('Your signup session has expired. Please sign up again.');
      navigate('/signup', { replace: true });
    }
  }, [navigate]);

  const handleVerify = async (e) => {
    e?.preventDefault?.();
    if (!code.trim()) {
      setError('Please enter the verification code.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const signupDataStr = sessionStorage.getItem(SIGNUP_DATA_KEY);
      const storedToken = sessionStorage.getItem(VERIFICATION_TOKEN_KEY);
      if (!signupDataStr || !storedToken) {
        alert('Signup data not found. Please sign up again.');
        navigate('/signup', { replace: true });
        return;
      }

      const signupData = JSON.parse(signupDataStr);
      const res = await axios.post(`${API_BASE_URL}/auth/verify-email`, {
        token: code.trim(),
        provided_token: storedToken,
        signup_data: signupData,
      });

      if (res.data.token && res.data.user) {
        sessionStorage.removeItem(SIGNUP_DATA_KEY);
        sessionStorage.removeItem(VERIFICATION_TOKEN_KEY);
        sessionStorage.removeItem('verifyIdentifier');
        sessionStorage.removeItem('verifyMethod');

        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setUser(res.data.user);
        startLocationWatcher(API_BASE_URL, res.data.token);

        const incomplete =
          res.data.user?.role === 'user' && !res.data.user?.first_name;
        const needsMatchmaker =
          res.data.user?.role === 'user' &&
          res.data.user?.has_linked_matchmaker !== true;

        if (incomplete) {
          navigate('/complete-profile', { replace: true });
        } else if (needsMatchmaker) {
          navigate('/settings?requireMatchmaker=1&openReferral=1', {
            replace: true,
          });
        } else if (
          signupData?.role === 'matchmaker' &&
          !String(signupData?.referral_code || '').trim()
        ) {
          navigate('/settings?openReferral=1', { replace: true });
        } else {
          navigate('/match', { replace: true });
        }
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch (err) {
      setError(
        err.response?.data?.msg ||
          'Verification failed. Please check your code and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!identifier) {
      setError('Email or phone number not found.');
      return;
    }
    setResendLoading(true);
    setError('');
    setInfo('');
    try {
      const signupDataStr = sessionStorage.getItem(SIGNUP_DATA_KEY);
      if (!signupDataStr) {
        alert('Signup data not found. Please sign up again.');
        navigate('/signup', { replace: true });
        return;
      }
      const signupData = JSON.parse(signupDataStr);
      const payload =
        verificationMethod === 'phone'
          ? { phone_number: identifier }
          : { email: identifier };
      payload.password = signupData.password;
      payload.role = signupData.role;
      if (signupData.referral_code) {
        payload.referral_code = signupData.referral_code;
      }

      const res = await axios.post(`${API_BASE_URL}/auth/register`, payload);
      if (res.data.verification_sent) {
        sessionStorage.setItem(
          VERIFICATION_TOKEN_KEY,
          res.data.verification_token
        );
        const method = res.data.verification_method || verificationMethod;
        setInfo(
          `A new code was sent via ${method === 'phone' ? 'text message' : 'email'}.`
        );
      } else {
        setError('Failed to send verification code. Please try again.');
      }
    } catch (err) {
      setError(
        err.response?.data?.msg ||
          'Failed to send verification code. Please try again.'
      );
    } finally {
      setResendLoading(false);
    }
  };

  const methodLabel =
    verificationMethod === 'phone' ? 'phone number' : 'email';

  return (
    <div className="auth-page">
      <div className="login-container">
        <img
          src="/assets/matchmate_logo.png"
          alt="MatchMate"
          className="auth-logo"
        />
        <h2>Verify your {methodLabel}</h2>
        <p className="auth-subtitle">
          Enter the code we sent to{' '}
          <strong>{identifier || `your ${methodLabel}`}</strong>
        </p>

        {error ? <div className="error-message">{error}</div> : null}
        {info ? <p className="auth-success-message">{info}</p> : null}

        <form onSubmit={handleVerify}>
          <input
            type="text"
            className="auth-input auth-code-input"
            placeholder="Verification code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>

        <button
          type="button"
          className="secondary"
          onClick={handleResend}
          disabled={resendLoading}
        >
          {resendLoading ? 'Sending...' : 'Resend code'}
        </button>

        <p>
          <button type="button" className="auth-link" onClick={() => navigate('/')}>
            Back to Login
          </button>
        </p>
      </div>
    </div>
  );
}

export default EmailVerification;
