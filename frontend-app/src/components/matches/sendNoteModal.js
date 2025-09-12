import React, { useState } from 'react';
import './sendNoteModal.css';

const SendNoteModal = ({ onClose, onSend }) => {
  const [note, setNote] = useState("");

  const handleSend = () => {
    if (note.trim()) {
      onSend(note);
      setNote("");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-button" onClick={onClose}>✕</button>
        <h3>Send a Note</h3>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Write your note here..."
        />
        <button className="send-button" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
};

export default SendNoteModal;
