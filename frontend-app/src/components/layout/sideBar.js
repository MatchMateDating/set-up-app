import React, { useState } from 'react';
import './sideBar.css';
import { useNavigate } from 'react-router-dom';
import { FaBars } from 'react-icons/fa';

const SideBar = () => {
    const navigate = useNavigate();
    const [sidePanelOpen, setSidePanelOpen] = useState(false);

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
                        <li style={{ margin: '10px 0', cursor: 'pointer' }} onClick={() => navigate('/preferences')}>Preferences</li>
                        <li style={{ margin: '10px 0', cursor: 'pointer' }} onClick={() => navigate('/')}>Log out</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default SideBar;
