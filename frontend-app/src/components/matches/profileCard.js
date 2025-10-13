import React from 'react';
import Profile from '../profile/profile';
import './profileCard.css';
import CompatibilityScore from './compatibilityScore';

const ProfileCard = ({
  profile,
  userInfo,
  onSkip,
  onLike,
  onBlindMatch,
  onOpenNote
}) => {
  return (
    <div className="profile-box">
      {profile.note && (
        <div className="note-box">
          <strong>
            {profile.matched_by_matcher ? "Matchmaker Note: " : "Note: "}
          </strong>
          {profile.note}
        </div>
      )}

      <button onClick={onSkip} className="skip-button"> ✕ </button>
      <Profile user={profile} framed={true} />

      <button onClick={onOpenNote} className="note-button"> 📝 </button>

      {userInfo?.role === 'matchmaker' && profile.ai_score !== undefined && (
        <div className="ai-score-box">
          <CompatibilityScore score={profile.ai_score} />
        </div>
      )}
      {userInfo?.role === 'matchmaker' ? (
        profile.liked_linked_dater ? (
          <button onClick={() => onBlindMatch(profile.id)} className="like-button">
            ❤️
          </button>
        ) : (
          <button onClick={() => onLike(profile.id)} className="like-button">
            ❤️
          </button>
        )
      ) : (
        <button onClick={() => onLike(profile.id)} className="like-button">
          ❤️
        </button>
      )}
    </div>
  );
};

export default ProfileCard;
