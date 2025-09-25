// hooks/useProfiles.js
import { useState, useEffect } from "react";

export const useMatches = (API_BASE_URL) => {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMatches = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_BASE_URL}/match/matches`, {
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
                setMatches(data);
            } catch (err) {
                console.error("Error fetching matches:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchMatches();
    }, [API_BASE_URL]);

    return { matches, setMatches, loading };
};