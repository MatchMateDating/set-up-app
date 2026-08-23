import React, { useState } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import './customDropdown.css';
import { getImageUrl } from '../../utils/imageUtils';

function DaterDropdown({
  linkedDaters = [],
  selectedDater,
  onChange,
  showLabel = false,
  labelText = "YOU'RE CHOOSING FOR",
}) {
  const [open, setOpen] = useState(false);
  const selected = linkedDaters.find(
    (d) => String(d.id) === String(selectedDater)
  );

  if (!linkedDaters.length) {
    return (
      <div className="dater-dropdown-wrap">
        {showLabel && <div className="dater-dropdown-label">{labelText}</div>}
        <div className="custom-dropdown">
          <div className="dropdown-header single">
            <span className="placeholder">No linked daters</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dater-dropdown-wrap">
      {showLabel && <div className="dater-dropdown-label">{labelText}</div>}
      <div className="custom-dropdown">
        {linkedDaters.length === 1 ? (
          <div className="dropdown-header single">
            {selected?.first_image ? (
              <>
                <img
                  src={getImageUrl(
                    selected.first_image,
                    process.env.REACT_APP_API_BASE_URL
                  )}
                  alt={selected.name}
                  className="dropdown-img"
                />
                <span>{selected.name || selected.first_name}</span>
              </>
            ) : (
              <span>{selected?.name || selected?.first_name || 'Dater'}</span>
            )}
          </div>
        ) : (
          <>
            <div
              className={`dropdown-header ${open ? 'open' : ''}`}
              onClick={() => setOpen(!open)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setOpen(!open);
              }}
            >
              {selected?.first_image ? (
                <>
                  <img
                    src={getImageUrl(
                      selected.first_image,
                      process.env.REACT_APP_API_BASE_URL
                    )}
                    alt={selected.name}
                    className="dropdown-img"
                  />
                  <span>{selected.name || selected.first_name}</span>
                </>
              ) : (
                <span className="placeholder">Select a dater</span>
              )}
              {open ? (
                <FaChevronUp className="chevron" />
              ) : (
                <FaChevronDown className="chevron" />
              )}
            </div>

            <div className={`dropdown-menu ${open ? 'show' : ''}`}>
              {linkedDaters.map((d) => (
                <div
                  key={d.id}
                  className={`dropdown-option ${
                    String(selectedDater) === String(d.id) ? 'active' : ''
                  }`}
                  onClick={() => {
                    onChange(d.id);
                    setOpen(false);
                  }}
                >
                  {d.first_image && (
                    <img
                      src={getImageUrl(
                        d.first_image,
                        process.env.REACT_APP_API_BASE_URL
                      )}
                      alt={d.name}
                      className="dropdown-img"
                    />
                  )}
                  <span>{d.name || d.first_name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default DaterDropdown;
