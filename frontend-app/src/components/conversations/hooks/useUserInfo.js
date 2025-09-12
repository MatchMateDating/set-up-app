// hooks/useProfiles.js
import { useState, useEffect } from "react";

export const useUserInfo = (API_BASE_URL) => {
  const [userInfo, setUserInfo] = useState([]);
  const [referrerInfo, setReferrerInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserInfo = async () => {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/profile/`, {
        headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
            localStorage.removeItem('token');
            window.location.href = '/';
        }
        }
        
        const data = await res.json();
        setUserInfo(data.user);
        setReferrerInfo(data.referrer);
    };

    fetchUserInfo();
  }, [API_BASE_URL]);

  return {userInfo, setUserInfo, referrerInfo, setReferrerInfo, loading};
};