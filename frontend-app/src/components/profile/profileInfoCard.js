// ProfileInfoCard.js
import React from 'react';
import './profile.css';
import FormField from './components/formField';
import HeightSelector from './components/heightSelector';
import ImageGallery from './images';
import { editToolbar } from './components/editToolbar';

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
  onPlaceholderClick
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
        </>
      )}

      {user.role === 'matchmaker' && (
        <FormField
          label="Description"
          editing={editing}
          value={user.description}
          input={
            <textarea
              name="description"
              value={formData.description}
              onChange={onInputChange}
              style={{ fontFamily: formData.fontFamily }}
            />
          }
        />
      )}

      {user.role === 'user' && (
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

