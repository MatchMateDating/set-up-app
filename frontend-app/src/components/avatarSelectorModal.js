import React from 'react';
import './avatarSelectorModal.css';

const avatarList = [
  '/avatars/dylan_avatar.png',
  '/avatars/allyson_avatar.png',
];

const AvatarSelectorModal = ({ onSelect, onClose }) => {
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
