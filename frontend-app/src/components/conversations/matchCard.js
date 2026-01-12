import React from "react";
import './matchCard.css';
import { FaUser, FaUserFriends, FaRegEye, FaRegEyeSlash, FaTimes, FaClock } from "react-icons/fa";

const MatchCard = ({ matchObj, API_BASE_URL, userInfo, navigate, unmatch, reveal, hide }) => {
  const bothMm = !!matchObj.both_matchmakers_involved;
  const oneMm = (!!matchObj.user_1_matchmaker_involved || !!matchObj.user_2_matchmaker_involved);
  const isBlind = matchObj.blind_match === 'Blind';
  const isPendingApproval = matchObj.status === 'pending_approval' || matchObj.message_count !== undefined;
  console.log('MatchCard matchObj:', matchObj.match_user);

  const renderMatchmakerIcons = () => {
    if (bothMm) return <FaUserFriends title="Both matchmakers involved" className="mm-icon both" />;
    if (oneMm) return <FaUser title="One matchmaker involved" className="mm-icon one" />;
    return null;
  };

  return (
    <div
      onClick={() => navigate(`/conversation/${matchObj.match_id}`)}
      className="match-card"
    >
      <div className="profile-section">
        {matchObj.match_user.first_image ? (
          <img
            src={`${API_BASE_URL}${matchObj.match_user.first_image}`}
            alt={`${matchObj.match_user.name}'s profile`}
            className={`match-image ${isBlind ? "blurred" : ""}`}
          />
        ) : (
          <div className="match-placeholder">No Image</div>
        )}

        <div className="match-info">
          <div className="match-name-row">
            <div className="match-name">{matchObj.match_user.first_name}</div>
            {isPendingApproval && <FaClock className="clock-icon" title="Pending Approval" />}
          </div>
          {userInfo?.role === "user" && renderMatchmakerIcons()}
        </div>

        <div className="card-actions">
          <button
            className="icon-btn unmatch"
            onClick={(e) => {
              e.stopPropagation();
              unmatch(matchObj.match_id);
            }}
            title="Unmatch"
          >
            <FaTimes />
          </button>

          {userInfo?.role === "matchmaker" && isBlind && (
            <button
              className="icon-btn reveal"
              onClick={(e) => {
                e.stopPropagation();
                reveal(matchObj.match_id);
              }}
              title="Reveal Match"
            >
              <FaRegEye />
            </button>
          )}

          {userInfo?.role === "matchmaker" && !isBlind && (
            <button
              className="icon-btn hide"
              onClick={(e) => {
                e.stopPropagation();
                hide(matchObj.match_id);
              }}
              title="Hide Match"
            >
              <FaRegEyeSlash />
            </button>
          )}
        </div>
      </div>

      {matchObj.linked_dater && userInfo?.role === "matchmaker" && (
        <div className="linked-section">
          {matchObj.linked_dater.first_image ? (
            <img
              src={`${API_BASE_URL}${matchObj.linked_dater.first_image}`}
              alt={`${matchObj.linked_dater.first_name}'s profile`}
              className="linked-image"
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

