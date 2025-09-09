// ProfileInfoCard.js
import React from 'react';
import './profile.css';
import FormField from './components/formField';
import HeightSelector from './components/heightSelector';

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
    <div className="profile-info-card" onSubmit={onSubmit}>
      {user.role === 'user' && (
        <>
          <FormField
             label={editing ? 'Birthdate' : 'Age'}
             editing={editing}
             value={editing ? formData.birthdate : calculateAge(user.birthdate)}
             input={<input type="date" name="birthdate" value={formData.birthdate} onChange={onInputChange} />}
          />

          <FormField
            label="Height"
            editing={editing}
            value={user.height}
            input={<HeightSelector formData={formData} heightUnit={heightUnit} onInputChange={onInputChange} onUnitToggle={onUnitToggle} />}
          />

          <FormField
            label="Gender"
            editing={editing}
            value={user.gender}
            input={editing? (<select
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
            )}
          />

          <FormField
            label="Preferred Age"
            editing={editing}
            value={
              formData.preferredAgeMin || formData.preferredAgeMax
                ? `${formData.preferredAgeMin || ''} - ${formData.preferredAgeMax || ''}`
                : ''
            }
            input={(
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
            )}
          />


          <FormField
            label="Preferred Gender"
            editing={editing}
            value={formData.preferredGender} 
            input={(
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
            ) 
          }
          />
        </>
      )}

      {user.role === 'matchmaker' && (
        <FormField
        label="Description"
        editing={editing}
        value={user.description}
        input={<textarea name="description" value={formData.description} onChange={onInputChange}/>}
        />
      )}

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

