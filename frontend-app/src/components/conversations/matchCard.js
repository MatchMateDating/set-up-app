import React from "react";
import './matchCard.css';
import { FaUser, FaUserFriends, FaRegEye, FaRegEyeSlash } from "react-icons/fa";

const MatchCard = ({ matchObj, API_BASE_URL, userInfo, navigate, unmatch, reveal, hide }) => {
  // safe guards in case backend doesn't include flags
  const bothMm = !!matchObj.both_matchmakers_involved;
  const oneMm = (!!matchObj.user_1_matchmaker_involved || !!matchObj.user_2_matchmaker_involved);
  const isBlind = matchObj.blind_match === 'Blind';

  const renderMatchmakerIcons = () => {
    if (bothMm) return <FaUserFriends title="Both matchmakers involved" className="mm-icon" />;
    if (oneMm) return <FaUser title="One matchmaker involved" className="mm-icon" />;
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
            className={`match-image ${isBlind ? "blurred" : ""}`}
          />
        ) : (
          <div className="match-placeholder">No Image</div>
        )}
        <div className="match-icons">
          {userInfo && userInfo.role === "user" && renderMatchmakerIcons()}
        </div>

        <div className="match-name">{matchObj.match_user.first_name}</div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            unmatch(matchObj.match_id);
          }}
        >
          Unmatch
        </button>
        { userInfo.role === "matchmaker" && isBlind && (
          <FaRegEye 
            onClick={
              async (e) => {e.stopPropagation();
              reveal(matchObj.match_id);
            }}
            title="Reveal Match" 
            className="reveal-icon" />
        )}
        { userInfo.role === "matchmaker" && !isBlind && (
          <FaRegEyeSlash 
            onClick={(e) => {
              e.stopPropagation();
              hide(matchObj.match_id);
            }}
            title="Hide Match" 
            className="hide-icon" />
        )}
      </div>

      {matchObj.linked_dater && userInfo.role === "matchmaker" && (
        <div className="profile-preview">
          {matchObj.linked_dater.first_image ? (
            <img
              src={`${API_BASE_URL}${matchObj.linked_dater.first_image}`}
              alt={`${matchObj.linked_dater.first_name}'s profile`}
              className={`match-image ${isBlind ? "blurred" : ""}`}
            />
          ) : (
            <div className="match-placeholder">No Image</div>
          )}
          <div className="match-name">{matchObj.linked_dater.first_name}</div>
        </div>
      )}
    </div>
  );
};

export default MatchCard;
