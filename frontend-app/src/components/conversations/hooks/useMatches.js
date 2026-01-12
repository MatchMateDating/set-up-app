// hooks/useProfiles.js
import { useState, useEffect, useCallback } from "react";

export const useMatches = (API_BASE_URL) => {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchMatches = useCallback(async () => {
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
            // Handle new structure: {matched: [], pending_approval: []} or old structure: []
            if (Array.isArray(data)) {
                // Old structure - backward compatibility
                setMatches({ matched: data, pending_approval: [] });
            } else {
                // New structure
                setMatches({ matched: data.matched || [], pending_approval: data.pending_approval || [] });
            }
        } catch (err) {
            console.error("Error fetching matches:", err);
        } finally {
            setLoading(false);
        }
    }, [API_BASE_URL]);

    useEffect(() => {
        fetchMatches();
    }, [fetchMatches]);

    return { matches, setMatches, loading, fetchMatches };
};