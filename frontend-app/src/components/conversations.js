import React, { useEffect, useState } from 'react';
import BottomTab from './bottomTab';
import './conversations.css'; // optional for styling
import SideBar from './sideBar';
import { useNavigate } from 'react-router-dom';

const Conversations = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [matches, setMatches] = useState([]);
  const [showDaterMatches, setShowDaterMatches] = useState(true);
  const [userInfo, setUserInfo] = useState(null);
  const [referrerInfo, setReferrerInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  const token = localStorage.getItem('token');

  const fetchMatches = async () => {
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
  };


  useEffect(() => {
    const fetchData = async () => {
      await fetchUserInfo();
      await fetchMatches();
      setLoading(false);
    };
    fetchData();
  }, []);

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

  const fetchConversation = async (matchId) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`${API_BASE_URL}/conversation/${matchId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        let data = await res.json();
        if (data.length > 0) {
          data = data[0].messages;
        }
        setMessages(data || []);
        setLoadingMessages(false);
      } else {
        console.error('Failed to fetch conversation');
      }
    } catch (error) {
      console.error('Error fetching conversation:', error);
    }
  };

  // Send a new message to conversation or create conversation with message
  const sendMessage = async (matchId) => {
    if (!newMessageText.trim() || !selectedMatchId) return;

    try {
      const payload = {
        message: newMessageText.trim()
      };

      const res = await fetch(`${API_BASE_URL}/conversation/${matchId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok || res.status === 201) {
        let data = await res.json();
        setMessages(data.messages || []);
        setNewMessageText('');
      } else {
        const errorData = await res.json();
        alert(`Error sending message: ${errorData.error || errorData.message}`);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <SideBar/>
      <div style={{ paddingBottom: '60px', paddingTop: '66px' }}>
        <h2>Conversations Page</h2>
        {userInfo && userInfo.role === 'user' && matches.length > 0 && (
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => setShowDaterMatches(true)}
              style={{
                backgroundColor: showDaterMatches ? '#007bff' : '#ccc',
                color: 'white',
                padding: '10px 20px',
                marginRight: '10px',
                borderRadius: '5px',
                border: 'none'
              }}
            >
              Dater Matches
            </button>
            <button
              onClick={() => setShowDaterMatches(false)}
              style={{
                backgroundColor: !showDaterMatches ? '#007bff' : '#ccc',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '5px',
                border: 'none'
              }}
            >
              Matchmaker Matches
            </button>
          </div>
        )}
        <div className="match-list">
          {getFilteredMatches().length > 0 ? (
            getFilteredMatches().map((matchObj, index) => (
              <div 
              onClick={() => navigate(`/conversation/${matchObj.match_id}`)} 
              key={index} 
              className="match-card">
                <div className="profile-preview">
                  {matchObj.match_user.first_image ? (
                    <img
                      src={`${API_BASE_URL}${matchObj.match_user.first_image}`}
                      alt={`${matchObj.match_user.name}'s profile`}
                      className={`match-image ${matchObj.blind_match ? 'blurred' : ''}`}
                    />
                  ) : (
                    <div className="match-placeholder">No Image</div>
                  )}
                  <div className="match-name">{matchObj.match_user.name}</div>
                  <button onClick={(e) =>{
                    e.stopPropagation();
                    unmatch(matchObj.match_id);
                    }}>Unmatch</button>
                </div>

                {matchObj.linked_dater && userInfo.role === "matchmaker" && (
                  <div className="profile-preview">
                    {matchObj.linked_dater.first_image ? (
                      <img
                        src={`${API_BASE_URL}${matchObj.linked_dater.first_image}`}
                        alt={`${matchObj.linked_dater.name}'s profile`}
                        className="match-image"
                      />
                    ) : (
                      <div className="match-placeholder">No Image</div>
                    )}
                    <div className="match-name">{matchObj.linked_dater.name}</div>
                  </div>
                )}
              </div>
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


