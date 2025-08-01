import React, { useEffect, useState } from 'react';
import BottomTab from './bottomTab';
import './conversations.css'; // optional for styling

const Conversations = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [matches, setMatches] = useState([]);
  const [showDaterMatches, setShowDaterMatches] = useState(true);
  const [userInfo, setUserInfo] = useState(null);
  const [referrerInfo, setReferrerInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserInfo = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE_URL}/profile/`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setUserInfo(data.user);
    setReferrerInfo(data.referrer);
  };

  const fetchMatches = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE_URL}/match/matches`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
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
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE_URL}/match/unmatch/${matchId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

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
    <div style={{ paddingBottom: '60px' }}>
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
            <div key={index} className="match-card">
              <div className="profile-preview">
                {matchObj.match_user.first_image ? (
                  <img
                    src={`${API_BASE_URL}${matchObj.match_user.first_image}`}
                    alt={`${matchObj.match_user.name}'s profile`}
                    className="match-image"
                  />
                ) : (
                  <div className="match-placeholder">No Image</div>
                )}
                <div className="match-name">{matchObj.match_user.name}</div>
                <button onClick={() => unmatch(matchObj.match_id)}>Unmatch</button>
              </div>

              {matchObj.linked_dater && (
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
  );
};

export default Conversations;


