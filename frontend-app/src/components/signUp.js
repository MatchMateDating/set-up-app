import React, { use, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './signUp.css';

function SignUp() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const navigate = useNavigate();

    const handleRegister = async () => {
        try {
            const res = await axios.post('http://localhost:5000/auth/register', {
                name,
                email,
                password
            });
            if (res.data.token) {
                // ✅ Store the token in localStorage
                localStorage.setItem('token', res.data.token);
                console.log("Token stored successfully!");
                navigate('/profile'); // Navigate after storing the token
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
            <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
            <button onClick={handleRegister}>Sign Up</button>
        </div>
    );
}

export default SignUp;
