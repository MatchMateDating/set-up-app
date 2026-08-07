import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  getIdentifierKind,
  normalizeUsPhoneToE164,
} from './utils/authIdentifiers';
import './login.css';

function ForgotPassword() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [identifier, setIdentifier] = useState('');
  const [identifierError, setIdentifierError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();

  const handleIdentifierChange = (value) => {
    setIdentifier(value);
    setSuccessMessage('');
    const t = value.trim();
    if (!t) {
      setIdentifierError('');
      return;
    }
    if (getIdentifierKind(t)) {
      setIdentifierError('');
      return;
    }
    if (t.includes('@')) {
      setIdentifierError('Not a valid email');
      return;
    }
    const digits = t.replace(/\D/g, '');
    if (digits.length > 0 && digits.length < 10) {
      setIdentifierError('');
      return;
    }
    setIdentifierError('Enter a valid email or phone number');
  };

  const handleSendReset = async (e) => {
    e?.preventDefault?.();
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

    const payloadIdentifier =
      kind === 'phone' ? normalizeUsPhoneToE164(trimmed) : trimmed;

    setLoading(true);
    setSuccessMessage('');
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/forgot-password`, {
        identifier: payloadIdentifier,
      });
      const defaultMsg =
        kind === 'phone'
          ? 'If an account exists for that number, we sent a text with a link to reset your password.'
          : 'If an account exists for that email, we sent reset instructions to your inbox.';
      setSuccessMessage(res.data.message || defaultMsg);
    } catch (err) {
      alert(
        err.response?.data?.msg ||
          'Failed to send reset instructions. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="login-container">
        <button
          type="button"
          className="auth-back-link"
          onClick={() => navigate('/')}
        >
          ← Back
        </button>
        <img
          src="/assets/matchmate_logo.png"
          alt="MatchMate"
          className="auth-logo"
        />
        <h2>Forgot Password</h2>
        <p className="auth-subtitle">
          Enter your email or US phone number. We will email you a reset link,
          or text you a link if you used your phone number.
        </p>

        {successMessage ? (
          <p className="auth-success-message">{successMessage}</p>
        ) : null}

        <form onSubmit={handleSendReset}>
          <input
            type="text"
            className="auth-input"
            placeholder="Email or phone number"
            value={identifier}
            onChange={(e) => handleIdentifierChange(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            disabled={loading}
          />
          {identifierError ? (
            <p className="auth-field-error">{identifierError}</p>
          ) : null}
          <button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send reset instructions'}
          </button>
        </form>

        <p>
          <button type="button" className="auth-link" onClick={() => navigate('/')}>
            Back to Login
          </button>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;
