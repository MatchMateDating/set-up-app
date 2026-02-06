import React, { useState } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import './customDropdown.css';
import { getImageUrl } from '../../utils/imageUtils';

function DaterDropdown({ linkedDaters, selectedDater, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = linkedDaters.find(d => d.id === parseInt(selectedDater));

  return (
    <div className="custom-dropdown">
      {linkedDaters.length === 1 ? (
        <div className="dropdown-header single">
          {selected?.first_image ? (
            <>
              <img
                src={getImageUrl(selected.first_image, process.env.REACT_APP_API_BASE_URL)}
                alt={selected.name}
                className="dropdown-img"
              />
              <span>{selected.name}</span>
            </>
          ) : (
            <span className="placeholder">Select a dater</span>
          )}
        </div>
      ) : (
        <>
          <div
            className={`dropdown-header ${open ? 'open' : ''}`}
            onClick={() => setOpen(!open)}
          >
            {selected?.first_image ? (
              <>
                <img
                  src={getImageUrl(selected.first_image, process.env.REACT_APP_API_BASE_URL)}
                  alt={selected.name}
                  className="dropdown-img"
                />
                <span>{selected.name}</span>
              </>
            ) : (
              <span className="placeholder">Select a dater</span>
            )}
            {open ? <FaChevronUp className="chevron" /> : <FaChevronDown className="chevron" />}
          </div>

          <div className={`dropdown-menu ${open ? 'show' : ''}`}>
            {linkedDaters.map((d) => (
              <div
                key={d.id}
                className={`dropdown-option ${selectedDater === d.id.toString() ? 'active' : ''}`}
                onClick={() => {
                  onChange(d.id);
                  setOpen(false);
                }}
              >
                <img
                  src={getImageUrl(d.first_image, process.env.REACT_APP_API_BASE_URL)}
                  alt={d.name}
                  className="dropdown-img"
                />
                <span>{d.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default DaterDropdown;
