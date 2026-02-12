import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './resetPassword.css';

function ResetPassword() {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    useEffect(() => {
        if (!token) {
            setError('Invalid reset link. Please request a new password reset.');
        }
    }, [token]);

    const handleReset = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (!token) {
            setError('Invalid reset link. Please request a new password reset.');
            return;
        }

        if (!password || !confirmPassword) {
            setError('Please fill in all fields.');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/auth/reset-password`, {
                token,
                password
            });

            setSuccess(true);
            setTimeout(() => {
                navigate('/');
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.msg || 'Failed to reset password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="reset-password-container">
                <h2>Password Reset Successful!</h2>
                <p>Your password has been reset successfully. Redirecting to login...</p>
            </div>
        );
    }

    return (
        <div className="reset-password-container">
            <h2>Reset Password</h2>
            <p className="subtitle">Enter your new password below.</p>
            
            {error && <div className="error-message">{error}</div>}
            
            <form onSubmit={handleReset}>
                <input
                    type="password"
                    placeholder="New Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={!token || loading}
                    required
                />
                <input
                    type="password"
                    placeholder="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={!token || loading}
                    required
                />
                <button type="submit" disabled={!token || loading}>
                    {loading ? 'Resetting...' : 'Reset Password'}
                </button>
            </form>
            
            <p className="back-link">
                <a href="/">Back to Login</a>
            </p>
        </div>
    );
}

export default ResetPassword;
