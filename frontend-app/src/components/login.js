import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './login.css';
import SignUp from './signUp';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleLogin = async () => {
        try {
            const res = await axios.post('http://localhost:5000/auth/login', {
                email,
                password
            });
            localStorage.setItem('token', res.data.token);
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
