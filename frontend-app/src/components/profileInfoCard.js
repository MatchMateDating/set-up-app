// ProfileInfoCard.js
import React from 'react';
import './profile.css';

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
  const renderField = ({ label, value, editing, input }) => {
    if (!editing && !value) return null;
    return (
      <div className="profile-field">
        <label>{label}: {editing ? input : <span className="profile-value">{value}</span>}</label>
      </div>
    );
  };

  const renderHeightSelector = () => (
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
  );

  return (
    <div className="profile-info-card" onSubmit={onSubmit}>
      {user.role === 'user' && (
        <>
          {renderField({
            label: editing ? 'Birthdate' : 'Age',
            editing,
            value: editing ? formData.birthdate : calculateAge(user.birthdate),
            input: <input type="date" name="birthdate" value={formData.birthdate} onChange={onInputChange} />
          })}

          {renderField({
            label: 'Height',
            editing,
            value: user.height,
            input: renderHeightSelector()
          })}

          {renderField({
            label: 'Gender',
            editing,
            value: user.gender,
            input:  editing ? (
                <select
                name="gender"
                value={formData.gender}
                onChange={onInputChange}
                required
                className="gender-select"
                >
                <option value="">Select gender</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="nonbinary">Non-binary</option>
                </select>
            ) : (
                <span className="profile-value">{user.gender}</span>
            )
          })}

          {renderField({
            label: 'Preferred Age',
            editing,
            value: `${formData.preferredAgeMin || ''} - ${formData.preferredAgeMax || ''}`,
            input: editing ? (
              <>
                <input
                  type="number"
                  name="preferredAgeMin"
                  placeholder="Min"
                  value={formData.preferredAgeMin || ''}
                  onChange={onInputChange}
                  style={{ width: '60px', marginRight: '8px' }}
                />
                <input
                  type="number"
                  name="preferredAgeMax"
                  placeholder="Max"
                  value={formData.preferredAgeMax || ''}
                  onChange={onInputChange}
                  style={{ width: '60px' }}
                />
              </>
            ) : user.preferredAgeMin || user.preferredAgeMax ? (
                <span className="profile-value">
                    {`${user.preferredAgeMin || ''} - ${user.preferredAgeMax || ''}`}
                </span>
            ) : null
          })}

          {renderField({
            label: 'Preferred Gender',
            editing,
            value: user.preferredGender,
            input:  editing ? (
                <select
                    name="preferredGender"
                    value= {formData.preferredGender}
                    onChange={onInputChange}
                    required
                    className="preferred-gender-select"
                >
                <option value="">Select gender</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="nonbinary">Non-binary</option>
                </select>
            ) :  user.preferredGender ? (
                <span className="profile-value">{user.preferredGender}</span>
            ) : null
          })}
        </>
      )}

      {user.role === 'matchmaker' && renderField({
        label: 'Description',
        editing,
        value: user.description,
        input: <textarea name="description" value={formData.description} onChange={onInputChange} />
      })}

      {editing && (
        <div className="form-actions">
          <button type="submit" className="save-btn">Save</button>
          <button type="button" onClick={onCancel} className="cancel-btn">Cancel</button>
        </div>
      )}
    </div>
  );
};

export default ProfileInfoCard;

