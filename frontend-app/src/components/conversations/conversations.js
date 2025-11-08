import React, { useEffect, useState } from 'react';
import BottomTab from '../layout/bottomTab';
import './conversations.css';
import SideBar from '../layout/sideBar';
import { useNavigate } from 'react-router-dom';
import MatchCard from './matchCard';
import ToggleConversations from './toggleConversations';
import { useMatches } from './hooks/useMatches';
import { useUserInfo } from './hooks/useUserInfo';

const Conversations = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [showDaterMatches, setShowDaterMatches, loading] = useState(true);
  const { userInfo, setUserInfo} = useUserInfo(API_BASE_URL);
  const { matches, setMatches, fetchMatches } = useMatches(API_BASE_URL);
  const navigate = useNavigate();
  const [referrer, setReferrer] = useState(null);

  const fetchProfile = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/profile/`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          localStorage.removeItem('token');
          window.location.href = '/';
          return;
        }
      }
      const data = await res.json();
      setUserInfo(data.user);
      setReferrer(data.referrer || null);
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchMatches();
  }, []);

  const getFilteredMatches = () => {
    if (!userInfo || userInfo.role !== 'user') return matches;

    return matches.filter(match => {
      if (showDaterMatches) {
        return !match.both_matchmakers_involved && match.linked_dater === null;
      } else {
        return match.both_matchmakers_involved || match.linked_dater !== null;
      }
    });
  };

  const unmatch = async (matchId) => {
    console.log(`Unmatching user with ID: ${matchId}`);
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE_URL}/match/unmatch/${matchId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 401) {
      const data = await res.json();
      if (data.error_code === 'TOKEN_EXPIRED') {
        localStorage.removeItem('token');
        window.location.href = '/';
      }
    }

    if (res.ok) {
      setMatches(matches.filter(match => match.match_id !== matchId));
    } else {
      const data = await res.json();
      alert(`Failed to unmatch: ${data.message}`);
    }
  };

  const reveal = async (matchId) => {
    try {
      const token = localStorage.getItem('token');
      console.log("Revealing match:", matchId);
      console.log(`${API_BASE_URL}/match/reveal/${matchId}`);
      const res = await fetch(`${API_BASE_URL}/match/reveal/${matchId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      console.log("Response status:", res.status);
      let data;
      try {
        data = await res.json();
        console.log("Response data:", data);
      } catch (jsonErr) {
        console.error("JSON parse error:", jsonErr);
        alert("Server did not return valid JSON.");
        return;
      }

      if (!res.ok) {
        alert(`Failed to reveal match: ${data.message}`);
        return;
      }

      setMatches(prevMatches =>
        prevMatches.map(m =>
          m.match_id === matchId ? { ...m, blind_match: 'Revealed' } : m
        )
      );
    } catch (err) {
      console.error("Error revealing match:", err);
      alert("Something went wrong revealing the match.");
    }
  };

  const hide = async (matchId) => {
    try {
      const token = localStorage.getItem('token');
      console.log("Hiding match:", matchId);
      console.log(`${API_BASE_URL}/match/hide/${matchId}`);
      const res = await fetch(`${API_BASE_URL}/match/hide/${matchId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      console.log("Response status:", res.status);
      let data;
      try {
        data = await res.json();
        console.log("Response data:", data);
      } catch (jsonErr) {
        console.error("JSON parse error:", jsonErr);
        alert("Server did not return valid JSON.");
        return;
      }

      if (!res.ok) {
        alert(`Failed to hide match: ${data.message}`);
        return;
      }

      setMatches(prevMatches =>
        prevMatches.map(m =>
          m.match_id === matchId ? { ...m, blind_match: 'Blind' } : m
        )
      );
    } catch (err) {
      console.error("Error hiding match:", err);
      alert("Something went wrong hiding the match.");
    }
  };


  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <SideBar 
      onSelectedDaterChange={(newDaterId) => {
        console.log('Dater changed to:', newDaterId);
        fetchProfile()
        fetchMatches()
      }}/>
      <div style={{ paddingBottom: '60px', paddingTop: '66px' }}>
        {userInfo && userInfo.role === 'user' && matches.length > 0 && (
          <ToggleConversations
            showDaterMatches={showDaterMatches}
            setShowDaterMatches={setShowDaterMatches}
          />
        )}
        <div className="match-list">
          {getFilteredMatches().length > 0 ? (
            getFilteredMatches().map((matchObj, index) => (
              <MatchCard
                key={index}
                matchObj={matchObj}
                API_BASE_URL={API_BASE_URL}
                userInfo={userInfo}
                navigate={navigate}
                unmatch={unmatch}
                reveal={reveal}
                hide={hide}
              />
            ))
          ) : (
            <p>No matches yet!</p>
          )}
        </div>
        <BottomTab />
      </div>
    </div>
  );
};

export default Conversations;


