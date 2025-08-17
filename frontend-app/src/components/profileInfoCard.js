// ProfileInfoCard.js
import React from 'react';
import './profile.css'; // optional separate CSS

const ProfileInfoCard = ({
  user,
  formData,
  editing,
  heightUnit,
  onInputChange,
  onUnitToggle,
  onSubmit,
  onCancel,
  calculateAge
}) => {
  return (
    <form className="profile-info-card" onSubmit={onSubmit}>
      {user.role === 'user' && (
        <>
          {editing ? (
            <div className="profile-field">
              <label>Birthdate:</label>
              <input
                name="birthdate"
                type="date"
                value={formData.birthdate || ''}
                onChange={onInputChange}
              />
            </div>
          ) : user.birthdate && (
            <div className="profile-field">
              <label>Age:</label>
              <span className="profile-value">{calculateAge(user.birthdate)}</span>
            </div>
          )}

          {(editing || user.height) && (
            <div className="profile-field">
              <label>Height:</label>
              {editing ? (
                <div className="height-inputs">
                  {heightUnit === 'ft' ? (
                    <>
                      <select
                        value={formData.heightFeet}
                        onChange={(e) => onInputChange({ target: { name: 'heightFeet', value: e.target.value } })}
                      >
                        {[...Array(8).keys()].map((num) => (
                          <option key={num} value={num}>{num} ft</option>
                        ))}
                      </select>
                      <select
                        value={formData.heightInches}
                        onChange={(e) => onInputChange({ target: { name: 'heightInches', value: e.target.value } })}
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
                        onChange={(e) => onInputChange({ target: { name: 'heightMeters', value: e.target.value } })}
                      >
                        {[...Array(3).keys()].map((num) => (
                          <option key={num} value={num}>{num} m</option>
                        ))}
                      </select>
                      <select
                        value={formData.heightCentimeters}
                        onChange={(e) => onInputChange({ target: { name: 'heightCentimeters', value: e.target.value } })}
                      >
                        {[...Array(100).keys()].map((num) => (
                          <option key={num} value={num}>{num} cm</option>
                        ))}
                      </select>
                    </>
                  )}
                  <button type="button" onClick={onUnitToggle} className="switch-btn">
                    {heightUnit === 'ft' ? 'Switch to meters' : 'Switch to feet'}
                  </button>
                </div>
              ) : (
                <span className="profile-value">{user.height}</span>
              )}
            </div>
          )}

          {(editing || user.gender) && (
            <div className="profile-field">
              <label>Gender:</label>
              {editing ? (
                <input name="gender" value={formData.gender} onChange={onInputChange} />
              ) : (
                <span className="profile-value">{user.gender}</span>
              )}
            </div>
          )}
        </>
      )}

      {user.role === 'matchmaker' && (editing || user.description) && (
        <div className="profile-field">
          <label>Description:</label>
          {editing ? (
            <textarea name="description" value={formData.description} onChange={onInputChange} />
          ) : (
            <p className="profile-value">{user.description}</p>
          )}
        </div>
      )}

      {editing && (
        <div className="form-actions">
          <button type="submit" className="save-btn">Save</button>
          <button type="button" onClick={onCancel} className="cancel-btn">Cancel</button>
        </div>
      )}
    </form>
  );
};

export default ProfileInfoCard;
