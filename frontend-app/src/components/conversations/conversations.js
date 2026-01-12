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
  const matchedList = Array.isArray(matches) ? matches : (matches?.matched || []);
  const pendingApprovalList = Array.isArray(matches) ? [] : (matches?.pending_approval || []);
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
    if (!userInfo || userInfo.role !== 'user') {
      // For matchmakers, return both matched and pending_approval
      return { matched: matchedList, pending_approval: pendingApprovalList };
    }

    // For daters, filter matched list
    const filteredMatched = matchedList.filter(match => {
      if (showDaterMatches) {
        return !match.both_matchmakers_involved && match.linked_dater === null;
      } else {
        return match.both_matchmakers_involved || match.linked_dater !== null;
      }
    });
    
    // Pending approval matches go in dater section
    return { matched: filteredMatched, pending_approval: pendingApprovalList };
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
      // Handle both old and new structure
      if (Array.isArray(matches)) {
        setMatches(matches.filter(match => match.match_id !== matchId));
      } else {
        const updatedMatched = (matches.matched || []).filter(match => match.match_id !== matchId);
        const updatedPending = (matches.pending_approval || []).filter(match => match.match_id !== matchId);
        setMatches({ matched: updatedMatched, pending_approval: updatedPending });
      }
      fetchMatches(); // Refresh to get latest data
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
        {userInfo && userInfo.role === 'user' && (matchedList.length > 0 || pendingApprovalList.length > 0) && (
          <ToggleConversations
            showDaterMatches={showDaterMatches}
            setShowDaterMatches={setShowDaterMatches}
          />
        )}
        
        {/* Pending Approval Section - for matchmakers */}
        {userInfo?.role === 'matchmaker' && getFilteredMatches().pending_approval.length > 0 && (
          <div>
            <h2 style={{ padding: '16px', margin: 0 }}>Pending</h2>
            <div className="match-list">
              {getFilteredMatches().pending_approval.map((matchObj, index) => (
                <MatchCard
                  key={`pending-${index}`}
                  matchObj={matchObj}
                  API_BASE_URL={API_BASE_URL}
                  userInfo={userInfo}
                  navigate={navigate}
                  unmatch={unmatch}
                  reveal={reveal}
                  hide={hide}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Approved/Matched Section */}
        <div>
          {userInfo?.role === 'matchmaker' && <h2 style={{ padding: '16px', margin: 0 }}>Approved</h2>}
          <div className="match-list">
            {getFilteredMatches().matched.length > 0 ? (
              getFilteredMatches().matched.map((matchObj, index) => (
                <MatchCard
                  key={`matched-${index}`}
                  matchObj={matchObj}
                  API_BASE_URL={API_BASE_URL}
                  userInfo={userInfo}
                  navigate={navigate}
                  unmatch={unmatch}
                  reveal={reveal}
                  hide={hide}
                />
              ))
            ) : getFilteredMatches().pending_approval.length === 0 ? (
              <p>No matches yet!</p>
            ) : null}
          </div>
        </div>
        
        {/* Pending Approval Section - for daters (in dater section) */}
        {userInfo?.role === 'user' && showDaterMatches && getFilteredMatches().pending_approval.length > 0 && (
          <div className="match-list">
            {getFilteredMatches().pending_approval.map((matchObj, index) => (
              <MatchCard
                key={`pending-${index}`}
                matchObj={matchObj}
                API_BASE_URL={API_BASE_URL}
                userInfo={userInfo}
                navigate={navigate}
                unmatch={unmatch}
                reveal={reveal}
                hide={hide}
              />
            ))}
          </div>
        )}
        <BottomTab />
      </div>
    </div>
  );
};

export default Conversations;


