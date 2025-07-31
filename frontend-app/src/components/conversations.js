import React, { useEffect, useState } from 'react';
import BottomTab from './bottomTab';
import './conversations.css'; // optional for styling

const Conversations = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [matches, setMatches] = useState([]);

  const fetchMatches = async () => {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE_URL}/match/matches`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setMatches(data);
  };

  const unmatch = async (matchId) => {
    const token = localStorage.getItem('token');
    console.log(`Unmatching user with ID: ${matchId}`);
    const res = await fetch(`${API_BASE_URL}/match/unmatch/${matchId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
      // Remove the match from state after successful unmatch
      setMatches(matches.filter(match => match.match_user.id !== matchId && match.linked_dater?.id !== matchId));
    } else {
      const data = await res.json();
      alert(`Failed to unmatch: ${data.message}`);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  return (
    <div style={{ paddingBottom: '60px' }}>
      <h2>Conversations Page</h2>
      <div className="match-list">
        {matches.length > 0 ? (
          matches.map((matchObj, index) => (
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

