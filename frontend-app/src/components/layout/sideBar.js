import React, { useState, useEffect } from 'react';
import './sideBar.css';
import { useNavigate } from 'react-router-dom';
import { FaBars } from 'react-icons/fa';
import DaterDropdown from '../layout/customDropdown';

const SideBar = ({onSelectedDaterChange}) => {
const SideBar = ({onSelectedDaterChange}) => {
    const navigate = useNavigate();
    const [sidePanelOpen, setSidePanelOpen] = useState(false);
    const [role, setRole] = useState(null);
    const [linkedDaters, setLinkedDaters] = useState([]);
    const [selectedDater, setSelectedDater] = useState('');
    const [role, setRole] = useState(null);
    const [linkedDaters, setLinkedDaters] = useState([]);
    const [selectedDater, setSelectedDater] = useState('');
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

    useEffect(() => {
        const fetchProfileAndReferrals = async () => {
            const token = localStorage.getItem('token');
            if (!token) return;

            try {
                const res = await fetch(`${API_BASE_URL}/profile/`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
    useEffect(() => {
        const fetchProfileAndReferrals = async () => {
            const token = localStorage.getItem('token');
            if (!token) return;

            try {
                const res = await fetch(`${API_BASE_URL}/profile/`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                setRole(data.user.role);

                if (data.user.role === 'matchmaker') {
                    const referralRes = await fetch(`${API_BASE_URL}/referral/referrals/${data.user.id}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const referralData = await referralRes.json();
                    setLinkedDaters(referralData.linked_daters || []);

                    const stored = localStorage.getItem('selectedDater');
                    const backendSelected = data.user.referred_by_id || '';
                    const selected = stored || backendSelected;
                    setSelectedDater(selected);
                    localStorage.setItem('selectedDater', selected);
                }
            } catch (err) {
                console.error('Error loading data:', err);
            }
        };
        fetchProfileAndReferrals();
    }, [API_BASE_URL]);

    const toggleSidePanel = () => {setSidePanelOpen(!sidePanelOpen);};

    const handleDaterChange = async (e) => {
        const newDaterId = e.target.value;
        setSelectedDater(newDaterId);
        localStorage.setItem('selectedDater', newDaterId);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${API_BASE_URL}/referral/set_selected_dater`, {
                method: 'POST',
                headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ selected_dater_id: newDaterId }),
            });

            const data = await res.json();
            if (!res.ok) {
                alert(data.error || 'Failed to set selected dater');
            } else {
                console.log('Selected dater updated:', data);
                if (onSelectedDaterChange) onSelectedDaterChange(newDaterId);
            }
        } catch (err) {
            console.error('Error setting selected dater:', err);
        }
    const toggleSidePanel = () => {setSidePanelOpen(!sidePanelOpen);};

    const handleDaterChange = async (e) => {
        const newDaterId = e.target.value;
        setSelectedDater(newDaterId);
        localStorage.setItem('selectedDater', newDaterId);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${API_BASE_URL}/referral/set_selected_dater`, {
                method: 'POST',
                headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ selected_dater_id: newDaterId }),
            });

            const data = await res.json();
            if (!res.ok) {
                alert(data.error || 'Failed to set selected dater');
            } else {
                console.log('Selected dater updated:', data);
                if (onSelectedDaterChange) onSelectedDaterChange(newDaterId);
            }
        } catch (err) {
            console.error('Error setting selected dater:', err);
        }
    };

    return (
        <div>
            <div className="top-bar">
                <button className="sidepanel-toggle" onClick={toggleSidePanel}>
                    <FaBars size={20} />
                </button>
                {role === 'matchmaker' && (
                    <select
                        className="linked-dater-dropdown"
                        value={selectedDater}
                        onChange={handleDaterChange}
                    >
                        <option value=""></option>
                        {linkedDaters.map((d) => (
                        <option key={d.id} value={d.id}>
                            {d.name}
                        </option>
                        ))}
                    </select>
                )}
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
