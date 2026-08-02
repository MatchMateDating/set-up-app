// components/FormField.js
import React from "react";

const FormField = ({ label, value, editing, input, style }) => {
  if (!editing && !value) return null;

  if (editing) {
    return (
      <div className="profile-field" style={style}>
        <div className="profile-field-label">{label}</div>
        <div className="profile-field-control">{input}</div>
      </div>
    );
  }

  return (
    <div className="profile-field" style={style}>
      <span className="profile-field-label">{label}: </span>
      <span className="profile-value">{value}</span>
    </div>
  );
};

export default FormField;
