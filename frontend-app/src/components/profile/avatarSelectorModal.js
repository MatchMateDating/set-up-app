import React from 'react';
import './avatarSelectorModal.css';

const avatarList = [
  '/avatars/dylan_avatar.png',
  '/avatars/allyson_avatar.png',
  '/avatars/angie_avatar.png',
];

const AvatarSelectorModal = ({ onSelect, onClose, userId }) => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  const selectAvatar = (avatar) => {
    console.log('Selected avatar:', userId);
    fetch(`${API_BASE_URL}/profile/user/${userId}/avatar`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`, // if using JWT auth
    },
    body: JSON.stringify({ avatar }),
  })
  .then(res => res.json())
  .then(data => console.log('Avatar saved:', data))
  .catch(err => console.error('Error saving avatar:', err));
  }
  
  return (
    <div className="modal-backdrop">
      <div className="avatar-modal">
        <h3>Select an Avatar</h3>
        <div className="avatar-grid">
          {avatarList.map((avatar, index) => (
            <img
              key={index}
              src={avatar}
              alt={`Avatar ${index}`}
              className="avatar-option"
              onClick={() => {
                onSelect(avatar);
                selectAvatar(avatar);
                onClose();
              }}
            />
          ))}
        </div>
        <button onClick={onClose} className="close-btn">Close</button>
      </div>
    </div>
  );
};

export default AvatarSelectorModal;
