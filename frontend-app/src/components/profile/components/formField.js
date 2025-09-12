// components/FormField.js
import React from "react";

const FormField = ({ label, value, editing, input }) => {
  if (!editing && !value) return null;
  return (
    <div className="profile-field">
      <label>
        {label}: {editing ? input : <span className="profile-value">{value}</span>}
      </label>
    </div>
  );
};

export default FormField;
