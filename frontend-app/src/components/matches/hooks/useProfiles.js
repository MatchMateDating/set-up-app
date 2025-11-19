// hooks/useProfiles.js
import { useState, useEffect } from "react";

export const useProfiles = (API_BASE_URL) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/match/users_to_match`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          const data = await res.json();
          if (data.error_code === "TOKEN_EXPIRED") {
            localStorage.removeItem("token");
            window.location.href = "/";
          }
        }

        const data = await res.json();
        setProfiles(data);
      } catch (err) {
        console.error("Error fetching profiles:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();

    const handleLocationUpdate = () => {
      fetchProfiles();
    };  

    window.addEventListener("locationUpdated", handleLocationUpdate);
    return () => window.removeEventListener("locationUpdated", handleLocationUpdate);
  }, [API_BASE_URL]);

  return { profiles, setProfiles, loading };
};
