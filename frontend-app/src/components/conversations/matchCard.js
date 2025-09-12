import React from "react";
import './matchCard.css';

const MatchCard = ({ matchObj, API_BASE_URL, userInfo, navigate, unmatch }) => {
  return (
    <div
      onClick={() => navigate(`/conversation/${matchObj.match_id}`)}
      className="match-card"
    >
      <div className="profile-preview">
        {matchObj.match_user.first_image ? (
          <img
            src={`${API_BASE_URL}${matchObj.match_user.first_image}`}
            alt={`${matchObj.match_user.name}'s profile`}
            className={`match-image ${matchObj.blind_match ? "blurred" : ""}`}
          />
        ) : (
          <div className="match-placeholder">No Image</div>
        )}
        <div className="match-name">{matchObj.match_user.name}</div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            unmatch(matchObj.match_id);
          }}
        >
          Unmatch
        </button>
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
  );
};

export default MatchCard;
