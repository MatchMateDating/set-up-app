import React, { use, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './signUp.css';

function SignUp() {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [first_name, setFirstName] = useState('');
    const [last_name, setLastName] = useState('');
    const [role, setRole] = useState('user'); // 'user' = dater, 'matchmaker' = matcher
    const [referralCode, setReferralCode] = useState('');

    const navigate = useNavigate();

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
            console.log("Base Url", API_BASE_URL);
            const res = await axios.post(`${API_BASE_URL}/auth/register`, payload);

            if (res.data.token) {
                console.log();
                // ✅ Store the token in localStorage
                localStorage.setItem('token', res.data.token);
                console.log("Token stored successfully!");
                if (role === 'user') {
                    navigate('/complete-profile');
                } else {
                    navigate('/profile');  // Replace with where you want matchmakers to go
                }
            } else {
                console.error("Registration successful, but no token received.");
            }
        } catch (err) {
            alert(err.response?.data?.msg || 'Registration failed');
        }
    };

    return (
        <div className="sign-up-container">
            <h2>Sign Up</h2>

            {/* Role toggle (card-like outline) */}
            <div className="role-toggle-wrapper" aria-hidden={false}>
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
                type="text"
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

            <button onClick={handleRegister}>Sign Up</button>
        </div>
    );
}

export default SignUp;
