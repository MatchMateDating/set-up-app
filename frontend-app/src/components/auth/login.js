import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './login.css';
import { startLocationWatcher } from './utils/startLocationWatcher';
import { useUser } from '../../context/UserContext';

function Login() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { setUser } = useUser();

  const handleLogin = async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password,
      });
      localStorage.setItem('token', res.data.token);
      startLocationWatcher(API_BASE_URL, res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setUser(res.data.user);

      const incomplete = res.data.user?.role === 'user' && !res.data.user?.first_name;
      navigate(incomplete ? '/complete-profile' : '/match', { replace: true });
    } catch (err) {
      alert(err.response?.data?.msg || 'Login failed');
    }
  };

  const goToSignUp = () => {
    navigate('/signup');
  };

  return (
    <div className="auth-page">
      <div className="login-container">
        <img
          src="/assets/matchmate_logo.png"
          alt="MatchMate"
          className="auth-logo"
        />
        <h2>Welcome back</h2>
        <p className="auth-subtitle">Log in to continue</p>
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
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleLogin();
          }}
        />
        <button type="button" onClick={handleLogin}>
          Login
        </button>
        <p>Don&apos;t have an account?</p>
        <button type="button" className="secondary" onClick={goToSignUp}>
          Sign Up
        </button>
      </div>
    </div>
  );
}

export default Login;
