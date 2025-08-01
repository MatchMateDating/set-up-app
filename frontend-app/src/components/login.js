import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './login.css';
import SignUp from './signUp';

function Login() {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleLogin = async () => {
        try {
            const res = await axios.post(`${API_BASE_URL}/auth/login`, {
                email,
                password
            });
            localStorage.setItem('token', res.data.token);
            // test
            localStorage.setItem('user', JSON.stringify(res.data.user));
            alert('Login successful!');
            navigate('/profile'); 
        } catch (err) {
            alert(err.response?.data?.msg || 'Login failed');
        }
    };

    const goToSignUp = async () => {
         navigate('/signup');
    };

    return (
        <div className="login-container">
            <h2>Login</h2>
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
            <button onClick={handleLogin}>Login</button>
            <p>Don't have an account?</p>
            <button onClick={goToSignUp}>Sign Up</button>
        </div>
    );
}

export default Login;
