import React from "react";
import './matchCard.css';
import { FaUser } from "react-icons/fa";
import { FaUserFriends } from "react-icons/fa"; 

const MatchCard = ({ matchObj, API_BASE_URL, userInfo, navigate, unmatch }) => {
  // safe guards in case backend doesn't include flags
  const bothMm = !!matchObj.both_matchmakers_involved;
  const oneMm = (!!matchObj.user_1_matchmaker_involved || !!matchObj.user_2_matchmaker_involved);

  const renderMatchmakerIcons = () => {
    if (bothMm) {
      // Two matchmakers involved 👥
      return (
        <>
          <FaUserFriends title="Both matchmakers involved" className="mm-icon" />
          {/* <FaUser title="Both matchmakers involved" className="mm-icon" /> */}
        </>
      );
    } else if (oneMm) {
      // One matchmaker involved 👤
      return <FaUser title="One matchmaker involved" className="mm-icon" />;
    }
    return null;
  };

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
        <div className="match-icons">
          {userInfo && userInfo.role === "user" && renderMatchmakerIcons()}
        </div>

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
