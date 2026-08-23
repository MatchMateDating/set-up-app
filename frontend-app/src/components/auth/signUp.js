import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import './signUp.css';
import { startLocationWatcher } from './utils/startLocationWatcher';
import { useUser } from '../../context/UserContext';
import {
  getIdentifierKind,
  normalizeUsPhoneToE164,
  SIGNUP_DATA_KEY,
  VERIFICATION_TOKEN_KEY,
} from './utils/authIdentifiers';

const PRIVACY_POLICY_URL = 'https://matchmatedating.com/privacy-policy.html';
const TERMS_AND_CONDITIONS_URL =
  'https://matchmatedating.com/terms-and-conditions.html';

const TERMS_TEXT = `Last Updated: ${new Date().toLocaleDateString()}

1. ACCEPTANCE OF TERMS

By accessing or using this application, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, you may not use the application.

2. ELIGIBILITY

You must be at least 18 years old to use this application. By using the application, you represent and warrant that you meet this requirement.

3. USE LICENSE

Permission is granted to use this application for personal, non-commercial purposes only. This is the grant of a license, not a transfer of title.

4. USER ACCOUNTS

You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.

5. USER CONTENT

You retain ownership of the content you post on the application. By posting content, you grant matchmate a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content for the purpose of operating the application.

6. USER CONDUCT

You agree not to harass, abuse, or harm other users; impersonate any person; post illegal or inappropriate content; or use the application for any unlawful purpose.

7. SAFETY AND MODERATION

We reserve the right to review, remove, or restrict content and accounts that violate these Terms.

8. PRIVACY POLICY

Your use of the application is governed by our Privacy Policy.

9. CONTACT INFORMATION

If you have any questions about these Terms of Service, please contact us at: contact@matchmatedating.com`;

function SignUp() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState('user');
  const [referralCode, setReferralCode] = useState('');
  const [identifierError, setIdentifierError] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [agreeToTexts, setAgreeToTexts] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useUser();

  const passwordChecks = useMemo(
    () => ({
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasSpecial: /[^A-Za-z0-9]/.test(password),
    }),
    [password]
  );

  const passwordStrong = Object.values(passwordChecks).every(Boolean);

  const handleIdentifierChange = (value) => {
    setIdentifier(value);
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

  const handleSignUpClick = async () => {
    const trimmed = identifier.trim();
    const kind = getIdentifierKind(trimmed);
    if (!kind) {
      setIdentifierError(
        trimmed.includes('@')
          ? 'Not a valid email'
          : 'Enter a valid email or phone number'
      );
      return;
    }
    if (!password) {
      alert('Please enter a password.');
      return;
    }
    if (!confirmPassword) {
      alert('Please confirm your password.');
      return;
    }
    if (password !== confirmPassword) {
      alert('Passwords do not match.');
      return;
    }
    if (!passwordStrong) {
      alert(
        'Password must be at least 8 characters and include 1 uppercase letter, 1 lowercase letter, and 1 special character.'
      );
      return;
    }
    if (!agreeToTexts) {
      alert(
        'Please agree to receive non promotional emails or texts to continue.'
      );
      return;
    }
    if (role === 'matchmaker' && referralCode.trim()) {
      try {
        await axios.post(`${API_BASE_URL}/auth/validate-matchmaker-referral`, {
          referral_code: referralCode.trim(),
        });
      } catch (err) {
        alert(err.response?.data?.msg || 'Invalid referral code');
        return;
      }
    }
    setAgreeToTerms(false);
    setShowTermsModal(true);
  };

  const handleRegister = async () => {
    if (!agreeToTerms) {
      alert('Please agree to the terms of service to continue.');
      return;
    }

    const trimmed = identifier.trim();
    const kind = getIdentifierKind(trimmed);
    const phoneE164 =
      kind === 'phone' ? normalizeUsPhoneToE164(trimmed) : null;
    const payload = { password, role, staySignedIn };
    if (kind === 'email') payload.email = trimmed;
    else payload.phone_number = phoneE164;

    const trimmedReferral = referralCode.trim();
    if (role === 'matchmaker' && trimmedReferral) {
      payload.referral_code = trimmedReferral;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/register`, payload);
      setShowTermsModal(false);

      if (res.data.token && res.data.test_mode) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setUser(res.data.user);
        startLocationWatcher(API_BASE_URL, res.data.token);
        if (role === 'user') {
          navigate('/complete-profile', { replace: true });
        } else if (!trimmedReferral) {
          navigate('/settings?openReferral=1', { replace: true });
        } else {
          navigate('/profile', { replace: true });
        }
        return;
      }

      if (res.data.verification_sent) {
        const signupData = {
          password,
          role,
          staySignedIn,
          referral_code:
            role === 'matchmaker' && trimmedReferral ? trimmedReferral : null,
          ...(kind === 'email'
            ? { email: trimmed }
            : { phone_number: phoneE164 }),
        };
        sessionStorage.setItem(SIGNUP_DATA_KEY, JSON.stringify(signupData));
        sessionStorage.setItem(
          VERIFICATION_TOKEN_KEY,
          res.data.verification_token
        );
        const method =
          res.data.verification_method ||
          (kind === 'phone' ? 'phone' : 'email');
        const displayId = kind === 'phone' ? phoneE164 : trimmed;
        sessionStorage.setItem('verifyIdentifier', displayId);
        sessionStorage.setItem('verifyMethod', method);
        navigate('/verify-email', {
          state: { identifier: displayId, verificationMethod: method },
        });
      } else {
        alert('Failed to send verification code. Please try again.');
      }
    } catch (err) {
      alert(err.response?.data?.msg || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="sign-up-container">
        <div className="auth-logo-wrap">
          <img
            src="/assets/matchmate_logo.png"
            alt="MatchMate"
            className="auth-logo"
          />
        </div>
        <p className="auth-subtitle">Join the community</p>

        <div className="role-toggle-wrapper signup-role-toggle">
          <div className="role-toggle" role="tablist" aria-label="Sign up role">
            <button
              type="button"
              className={`role-btn ${role === 'user' ? 'active' : ''}`}
              onClick={() => {
                setRole('user');
                setReferralCode('');
              }}
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
              Matchmaker
            </button>
          </div>
        </div>

        <input
          type="text"
          className="auth-input"
          placeholder="Email or phone number"
          value={identifier}
          onChange={(e) => handleIdentifierChange(e.target.value)}
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
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            autoComplete="new-password"
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowPassword((p) => !p)}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            <span>{showPassword ? 'Hide' : 'Show'}</span>
          </button>
        </div>

        {passwordFocused ? (
          <div className="password-rules">
            <p className="password-rules-title">Password requirements:</p>
            <p className={passwordChecks.minLength ? 'rule-ok' : 'rule-pending'}>
              • At least 8 characters
            </p>
            <p
              className={
                passwordChecks.hasUppercase ? 'rule-ok' : 'rule-pending'
              }
            >
              • 1 uppercase letter
            </p>
            <p
              className={
                passwordChecks.hasLowercase ? 'rule-ok' : 'rule-pending'
              }
            >
              • 1 lowercase letter
            </p>
            <p className={passwordChecks.hasSpecial ? 'rule-ok' : 'rule-pending'}>
              • 1 special character
            </p>
          </div>
        ) : null}

        <div className="auth-password-wrap">
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            className="auth-input auth-input-password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowConfirmPassword((p) => !p)}
          >
            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            <span>{showConfirmPassword ? 'Hide' : 'Show'}</span>
          </button>
        </div>

        {confirmPassword.length > 0 && password !== confirmPassword ? (
          <p className="auth-field-error">Passwords do not match</p>
        ) : null}

        {role === 'matchmaker' && (
          <input
            type="text"
            className="auth-input"
            placeholder="Enter Dater's Referral Code (Optional)"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
            autoComplete="off"
          />
        )}

        <label className="auth-remember auth-consent">
          <span
            className={`auth-remember-box ${agreeToTexts ? 'checked' : ''}`}
            aria-hidden="true"
          >
            {agreeToTexts ? '✓' : ''}
          </span>
          <input
            type="checkbox"
            checked={agreeToTexts}
            onChange={(e) => setAgreeToTexts(e.target.checked)}
          />
          <span className="auth-remember-label auth-consent-label">
            By checking this box, I agree to receive SMS verification codes and
            security alerts from matchmate at the phone number I provide.
            Message &amp; data rates may apply. See our{' '}
            <a
              href={PRIVACY_POLICY_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              Privacy Policy
            </a>{' '}
            and{' '}
            <a
              href={TERMS_AND_CONDITIONS_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              Terms &amp; Conditions
            </a>
          </span>
        </label>

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

        <button
          type="button"
          className="auth-primary-btn"
          onClick={handleSignUpClick}
          disabled={loading}
        >
          Sign Up
        </button>

        <p className="auth-footer-text signup-login-text">
          Already have an account?
        </p>
        <button
          type="button"
          className="auth-text-link auth-signup-link"
          onClick={() => navigate('/')}
        >
          Login
        </button>
      </div>

      {showTermsModal ? (
        <div className="auth-modal-overlay" role="dialog" aria-modal="true">
          <div className="auth-modal">
            <h3 className="auth-modal-title">Terms of Service</h3>
            <div className="auth-modal-body">
              <pre className="auth-terms-text">{TERMS_TEXT}</pre>
            </div>
            <label className="auth-remember auth-modal-agree">
              <span
                className={`auth-remember-box ${agreeToTerms ? 'checked' : ''}`}
                aria-hidden="true"
              >
                {agreeToTerms ? '✓' : ''}
              </span>
              <input
                type="checkbox"
                checked={agreeToTerms}
                onChange={(e) => setAgreeToTerms(e.target.checked)}
              />
              <span className="auth-remember-label">
                I agree to these terms of service
              </span>
            </label>
            <div className="auth-modal-actions">
              <button
                type="button"
                className="auth-modal-cancel"
                onClick={() => {
                  setShowTermsModal(false);
                  setAgreeToTerms(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="auth-primary-btn"
                onClick={handleRegister}
                disabled={loading || !agreeToTerms}
              >
                {loading ? 'Creating...' : 'Accept & Continue'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default SignUp;
