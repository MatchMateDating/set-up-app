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
  const { userInfo, setUserInfo, referrerInfo, setReferrerInfo } = useUserInfo(API_BASE_URL);
  const { matches, setMatches } = useMatches(API_BASE_URL);
  const navigate = useNavigate();

  const getFilteredMatches = () => {
    if (!userInfo || userInfo.role !== 'user') return matches;

    return matches.filter(match => {
      if (showDaterMatches) {
        return match.linked_dater === null;  // Matches made by dater
      } else {
        return match.linked_dater !== null;  // Matches made by matchmaker
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

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <SideBar />
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


