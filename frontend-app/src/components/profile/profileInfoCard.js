// ProfileInfoCard.js
import React from 'react';
import './profile.css';
import FormField from './components/formField';
import HeightSelector from './components/heightSelector';
import ImageGallery from './images';
import { editToolbar } from './components/editToolbar';
import Select from 'react-select';

const ProfileInfoCard = ({
  user,
  formData,
  editing,
  heightUnit,
  onInputChange,
  onUnitToggle,
  onSubmit,
  onCancel,
  calculateAge,
  editProfile = false,
  images,
  onDeleteImage,
  onPlaceholderClick, 
  completeProfile = false
}) => {
  return (
    <div className="profile-info-card" onSubmit={onSubmit}>
      {user.role === 'user' && (
        <>
          {editProfile && editing && (
            <>
              <div className="edit-toolbar-container">
                {editToolbar({
                  formData,
                  handleInputChange: onInputChange,
                  editing
                })}
              </div>
              <FormField
                label="First Name"
                editing={editing}
                value={user.first_name}
                input={
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={onInputChange}
                  />
                }
              />
              <FormField
                label="Last Name"
                editing={editing}
                value={user.last_name}
                input={
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={onInputChange}
                  />
                }
              />
            </>
          )}

          <FormField
            label={editing ? 'Birthdate' : 'Age'}
            editing={editing}
            value={editing ? formData.birthdate : calculateAge(user.birthdate)}
            input={
              <input
                type="date"
                name="birthdate"
                value={formData.birthdate}
                onChange={onInputChange}
              />}
            style={{ fontFamily: formData.fontFamily }}
          />

          <FormField
            label="Height"
            editing={editing}
            value={user.height}
            input={
              <HeightSelector
                formData={formData}
                heightUnit={heightUnit}
                onInputChange={onInputChange}
                onUnitToggle={onUnitToggle}
              />}
            style={{ fontFamily: formData.fontFamily }}
          />

          <FormField
            label="Gender"
            editing={editing}
            value={user.gender}
            input={editing ? (<select
              name="gender"
              value={formData.gender}
              onChange={onInputChange}
              required
              className="gender-select"
            >
              <option value="" style={{ fontFamily: formData.fontFamily }}>Select gender</option>
              <option value="female" style={{ fontFamily: formData.fontFamily }}>Female</option>
              <option value="male" style={{ fontFamily: formData.fontFamily }}>Male</option>
              <option value="nonbinary" style={{ fontFamily: formData.fontFamily }}>Non-binary</option>
            </select>
            ) : (
              <span className="profile-value" style={{ fontFamily: formData.fontFamily }}>{user.gender}</span>
            )}
            style={{ fontFamily: formData.fontFamily }}
          />

          {completeProfile && (
            <>
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
              label="Preferred Gender(s)"
              editing={editing}
              value={(formData.preferredGenders || []).join(', ')}
              input={(
                <Select
                  isMulti
                  name="preferredGenders"
                  className="preferred-genders-select"
                  classNamePrefix="pg"
                  value={Array.isArray(formData.preferredGenders)
                    ? formData.preferredGenders.map(g => ({ label: g, value: g }))
                    : []}
                  onChange={(selectedOptions) => {
                    const selectedValues = selectedOptions
                      ? selectedOptions.map(opt => opt.value)
                      : [];
                    onInputChange({
                      target: {
                        name: "preferredGenders",
                        value: selectedValues,
                      },
                    });
                  }}
                  options={[
                    { value: 'female', label: 'Female' },
                    { value: 'male', label: 'Male' },
                    { value: 'nonbinary', label: 'Non-binary' },
                  ]}
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      border: 'none',
                      borderRadius: 0,
                      boxShadow: 'none',
                      background: 'transparent',
                      minHeight: '32px',
                    }),
                    valueContainer: (base) => ({
                      ...base,
                      padding: "0 4px"
                    }),
                    input: (base) => ({
                      ...base,
                      margin: 0,
                      padding: 0
                    }),
                    multiValue: (base) => ({
                      ...base,
                      background: "var(--primary)",
                      color: "white",
                      borderRadius: "12px",
                      padding: "0 4px"
                    }),
                    multiValueLabel: (base) => ({
                      ...base,
                      color: "white",
                      fontSize: "0.9rem"
                    }),
                    multiValueRemove: (base) => ({
                      ...base,
                      color: "white",
                      ':hover': {
                        background: "var(--primary-dark)",
                        color: "white"
                      }
                    })
                  }}
                />
              )}
            />
          </>
          )}

        </>
      )} 

      {user.role === 'user' && !completeProfile && (
        <div className="section">
          {editing ? <label>Add Images:</label> : <label></label>}
          <ImageGallery
            images={images}
            editing={editing}
            onDeleteImage={onDeleteImage}
            onPlaceholderClick={onPlaceholderClick}
            layout={formData.imageLayout}
          />
        </div>
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