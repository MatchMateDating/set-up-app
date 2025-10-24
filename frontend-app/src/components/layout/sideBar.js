import React, { useState, useEffect } from 'react';
import './sideBar.css';
import { useNavigate } from 'react-router-dom';
import { FaBars } from 'react-icons/fa';

const SideBar = () => {
    const navigate = useNavigate();
    const [sidePanelOpen, setSidePanelOpen] = useState(false);
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
    const [role, setRole] = useState(null);

    const fetchProfile = () => {
        const token = localStorage.getItem('token');
        if (token) {
            fetch(`${API_BASE_URL}/profile/`, {
                headers: { 'Authorization': `Bearer ${token}` },
            })
            .then(async (res) => {
            if (res.status === 401) {
                const data = await res.json();
                if (data.error_code === 'TOKEN_EXPIRED') {
                localStorage.removeItem('token'); // clear invalid token
                window.location.href = '/';  // redirect to login
                return; // stop execution
                }
            }
            return res.json();
            })
            .then((data) => {
            if (!data) return; // avoid running if we already redirected
            setRole(data.user.role);
            })
            .catch((err) => console.error('Error loading profile:', err));
        }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const toggleSidePanel = () => {
        setSidePanelOpen(!sidePanelOpen);
    };

    return (
        <div>
            <div className="top-bar">
                <button className="sidepanel-toggle" onClick={toggleSidePanel}>
                    <FaBars size={20} />
                </button>
            </div>
            <div className={`side-panel ${sidePanelOpen ? 'open' : ''}`}>
                <div className="side-panel-content">
                    <h3>Menu</h3>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        <li style={{ margin: '10px 0', cursor: 'pointer' }} onClick={() => navigate('/profile')}>Terms and Conditions</li>
                        <li style={{ margin: '10px 0', cursor: 'pointer' }} onClick={() => navigate('/settings')}>Settings</li>
                        {role === "user" && (
                            <>
                            <li style={{ margin: '10px 0', cursor: 'pointer' }} onClick={() => navigate('/preferences')}>Preferences</li>
                            <li style={{ margin: '10px 0', cursor: 'pointer' }} onClick={() => navigate('/puzzles')}>Puzzles</li>
                            </>
                        )}
                        <li style={{ margin: '10px 0', cursor: 'pointer' }} onClick={() => navigate('/')}>Log out</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default SideBar;
