import React from 'react';
import { X } from 'lucide-react';
import './viewNoteModal.css';

const ViewNoteModal = ({ note, authorLabel, accentColor = '#ef4d73', onClose }) => {
  return (
    <div className="view-note-overlay" onClick={onClose} role="presentation">
      <div
        className="view-note-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Note"
      >
        <div className="view-note-header">
          <h3 className="view-note-title">Note</h3>
          <button
            type="button"
            className="view-note-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={22} color="#9ca3af" />
          </button>
        </div>

        <p className="view-note-author" style={{ color: accentColor }}>
          {authorLabel}
        </p>

        <div className="view-note-body">
          <p className="view-note-text">{note}</p>
        </div>
      </div>
    </div>
  );
};

export default ViewNoteModal;
