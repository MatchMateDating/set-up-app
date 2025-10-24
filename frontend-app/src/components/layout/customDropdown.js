import React, { useState } from 'react';
import './customDropdown.css';

function DaterDropdown({ linkedDaters, selectedDater, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = linkedDaters.find(d => d.id === parseInt(selectedDater));
  console.log('DaterDropdown selectedDater:', selected?.first_image);

  return (
    <div className="custom-dropdown">
      {linkedDaters.length === 1 && 
        <div className="dropdown-header-1" >
            {selected?.first_image ? (
              <>
                <img src={`${process.env.REACT_APP_API_BASE_URL}${selected?.first_image}`} alt={selected.name} className="dropdown-img" />
                <span>{selected.name}</span>
              </>
            ) : (
              <span>Select a dater</span>
            )}
        </div>}
      {linkedDaters.len > 1 && 
        <>
          <div className="dropdown-header" onClick={() => setOpen(!open)}>
            {selected?.first_image ? (
              <>
                <img src={`${process.env.REACT_APP_API_BASE_URL}${selected?.first_image}`} alt={selected.name} className="dropdown-img" />
                <span>{selected.name}</span>
              </>
            ) : (
              <span>Select a dater</span>
            )}
          </div>

          {open &&  (
            <div className="dropdown-menu">
              {linkedDaters.map((d) => (
                <div
                  key={d.id}
                  className="dropdown-option"
                  onClick={() => {
                    onChange(d.id);
                    setOpen(false);
                  }}
                >
                  <img 
                    src={`${process.env.REACT_APP_API_BASE_URL}${d?.first_image}`} 
                    alt={d.name} 
                    className="dropdown-img" 
                  />
                  <span>{d.name}</span>
                </div>
              ))}
            </div>
          )}
        </>}
    </div>
  );
}

export default DaterDropdown;
