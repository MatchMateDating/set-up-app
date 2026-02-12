// components/HeightSelector.js
import React from "react";
import './heightSelector.css';

const HeightSelector = ({ formData, heightUnit, onInputChange, onUnitToggle }) => (
  <div className="height-inputs">
    {heightUnit === "ft" ? (
      <>
        <select
          value={formData.heightFeet}
          onChange={(e) => onInputChange({ target: { name: "heightFeet", value: e.target.value } })}
        >
          {[...Array(8).keys()].map((num) => (
            <option key={num} value={num}>{num} ft</option>
          ))}
        </select>
        <select
          value={formData.heightInches}
          onChange={(e) => onInputChange({ target: { name: "heightInches", value: e.target.value } })}
        >
          {[...Array(12).keys()].map((num) => (
            <option key={num} value={num}>{num} in</option>
          ))}
        </select>
      </>
    ) : (
      <>
        <select
          value={formData.heightMeters}
          onChange={(e) => onInputChange({ target: { name: "heightMeters", value: e.target.value } })}
        >
          {[...Array(3).keys()].map((num) => (
            <option key={num} value={num}>{num} m</option>
          ))}
        </select>
        <select
          value={formData.heightCentimeters}
          onChange={(e) => onInputChange({ target: { name: "heightCentimeters", value: e.target.value } })}
        >
          {[...Array(100).keys()].map((num) => (
            <option key={num} value={num}>{num} cm</option>
          ))}
        </select>
      </>
    )}
    <button type="button" onClick={onUnitToggle} className="switch-btn">
      {heightUnit === "ft" ? "Switch to meters" : "Switch to feet"}
    </button>
  </div>
);

export default HeightSelector;
