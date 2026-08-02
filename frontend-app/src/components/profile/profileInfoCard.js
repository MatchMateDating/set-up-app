// ProfileInfoCard.js
import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import Select from 'react-select';
import './profile.css';
import './profileInfoCard.css';
import HeightSelector from './components/heightSelector';
import ImageGallery from './images';
import { editToolbar } from './components/editToolbar';
import SelectGender from './components/selectGender';
import BirthdatePickerModal from './components/BirthdatePickerModal';
import PixelClouds from './components/PixelClouds';
import {
  formatHeight,
  getProfileThemeBackground,
  normalizeImageLayout,
  normalizeProfileStyle,
} from './utils/profileUtils';
import { getRoleAccentColor } from '../../theme/roleTheme';

const TOP_IMAGE_LAYOUTS = ['topRow', 'heroStack', 'vertical'];

const parseBirthdateParts = (iso) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return { day: '', month: '', year: '' };
  }
  const [year, month, day] = iso.split('-');
  return { day, month, year };
};

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
  completeProfile = false,
  hideFormActions = false,
  pageBackgroundColor,
  fieldErrors,
  imageError,
}) => {
  const [showHeightModal, setShowHeightModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const imageLayout = normalizeImageLayout(formData.imageLayout);
  const profileStyle = normalizeProfileStyle(formData.profileStyle);
  const themeBackgroundColor = getProfileThemeBackground(
    formData.profileStyle || 'classic'
  );
  const isBlendedPage = Boolean(pageBackgroundColor);
  const isThemedEdit = editing && isBlendedPage;
  const roleAccent = getRoleAccentColor(user?.role || 'matchmaker');
  const editAccentColor = editing ? '#ef4d73' : roleAccent;
  const locationText = [user.city, user.state].filter(Boolean).join(', ');
  const birthParts = parseBirthdateParts(formData.birthdate);
  const birthdateFieldParts =
    heightUnit === 'ft'
      ? [
          { key: 'month', value: birthParts.month, placeholder: 'MM' },
          { key: 'day', value: birthParts.day, placeholder: 'DD' },
          { key: 'year', value: birthParts.year, placeholder: 'YYYY' },
        ]
      : [
          { key: 'day', value: birthParts.day, placeholder: 'DD' },
          { key: 'month', value: birthParts.month, placeholder: 'MM' },
          { key: 'year', value: birthParts.year, placeholder: 'YYYY' },
        ];
  const fontFamily =
    formData.profileStyle === 'constitution'
      ? 'Pinyon Script'
      : formData.fontFamily;

  const update = (name, value) => onInputChange({ target: { name, value } });

  const renderEditLabel = (text, isFirst = false) => (
    <label
      className={`pic-label${isThemedEdit ? ' pic-label-edit' : ''}${
        isFirst ? ' pic-label-first' : ''
      }`}
    >
      {isThemedEdit ? text.toUpperCase() : text}
    </label>
  );

  const renderImageGallery = (galleryEditing = editing) => (
    <div
      className={
        imageLayout === 'vertical'
          ? galleryEditing
            ? 'pic-vertical-editing'
            : 'pic-vertical-bleed'
          : undefined
      }
    >
      <ImageGallery
        images={images}
        editing={galleryEditing}
        onDeleteImage={onDeleteImage}
        onPlaceholderClick={onPlaceholderClick}
        layout={imageLayout === 'topRow' ? 'grid' : formData.imageLayout}
      />
    </div>
  );

  const renderAddImagesLabel = (isFirstField = false) => {
    const labelText = isThemedEdit ? 'ADD IMAGES' : 'Add Images';
    if (isFirstField && isBlendedPage) {
      return (
        <div className={`pic-add-images-pill${isFirstField ? ' pic-label-first' : ''}`}>
          <span className={`pic-label${isThemedEdit ? ' pic-label-edit' : ''} pic-add-images-label-text`}>
            {labelText}
          </span>
        </div>
      );
    }
    return renderEditLabel('Add Images', isFirstField);
  };

  const renderImageSection = (isFirstField = false) => (
    <>
      {renderAddImagesLabel(isFirstField)}
      {renderImageGallery()}
      {Boolean(imageError) && (
        <p className="pic-validation-error">{imageError}</p>
      )}
    </>
  );

  const renderViewContent = () => (
    <>
      {TOP_IMAGE_LAYOUTS.includes(imageLayout) && renderImageGallery(false)}
      {Boolean((formData.bio || '').trim()) && (
        <p className="pic-preview-text" style={{ fontFamily }}>
          {(formData.bio || '').trim()}
        </p>
      )}
      {!TOP_IMAGE_LAYOUTS.includes(imageLayout) && renderImageGallery(false)}
    </>
  );

  const renderCompleteProfileExtras = () => (
    <>
      <div className="pic-field">
        {renderEditLabel('Preferred Age')}
        <div className="pic-preferred-age-row">
          <input
            type="number"
            name="preferredAgeMin"
            className={`pic-input${isThemedEdit ? ' pic-input-edit' : ''}`}
            placeholder="Min"
            value={formData.preferredAgeMin || ''}
            onChange={onInputChange}
          />
          <input
            type="number"
            name="preferredAgeMax"
            className={`pic-input${isThemedEdit ? ' pic-input-edit' : ''}`}
            placeholder="Max"
            value={formData.preferredAgeMax || ''}
            onChange={onInputChange}
          />
        </div>
      </div>

      <div className="pic-field">
        {renderEditLabel('Preferred Gender(s)')}
        <Select
          isMulti
          name="preferredGenders"
          className="preferred-genders-select"
          classNamePrefix="pg"
          value={
            Array.isArray(formData.preferredGenders)
              ? formData.preferredGenders.map((g) => ({ label: g, value: g }))
              : []
          }
          onChange={(selectedOptions) => {
            const selectedValues = selectedOptions
              ? selectedOptions.map((opt) => opt.value)
              : [];
            update('preferredGenders', selectedValues);
          }}
          options={[
            { value: 'female', label: 'Female' },
            { value: 'male', label: 'Male' },
            { value: 'nonbinary', label: 'Non-binary' },
          ]}
        />
      </div>
    </>
  );

  const renderEditingFields = () => (
    <>
      {editProfile &&
        !isBlendedPage &&
        editToolbar({
          formData,
          handleInputChange: onInputChange,
          editing,
        })}

      {TOP_IMAGE_LAYOUTS.includes(imageLayout) &&
        !completeProfile &&
        renderImageSection(true)}

      {renderEditLabel('Name', !TOP_IMAGE_LAYOUTS.includes(imageLayout) || completeProfile)}
      <input
        type="text"
        name="first_name"
        className={`pic-input${isThemedEdit ? ' pic-input-edit' : ''}`}
        value={formData.first_name}
        onChange={onInputChange}
        style={{ fontFamily }}
        autoComplete="given-name"
      />
      {Boolean(fieldErrors?.first_name) && (
        <p className="pic-validation-error">{fieldErrors.first_name}</p>
      )}

      {renderEditLabel('Last Name')}
      <input
        type="text"
        name="last_name"
        className={`pic-input${isThemedEdit ? ' pic-input-edit' : ''}`}
        value={formData.last_name}
        onChange={onInputChange}
        style={{ fontFamily }}
        autoComplete="family-name"
      />
      {Boolean(fieldErrors?.last_name) && (
        <p className="pic-validation-error">{fieldErrors.last_name}</p>
      )}

      {editProfile && (
        <>
          {renderEditLabel('Your Location')}
          <button
            type="button"
            className="pic-checkbox-row"
            onClick={() => update('show_location', !formData.show_location)}
          >
            <span
              className={`pic-checkbox${formData.show_location ? ' checked' : ''}`}
              style={{
                borderColor: editAccentColor,
                backgroundColor: formData.show_location ? editAccentColor : '#ffffff',
              }}
            >
              {formData.show_location ? '✓' : ''}
            </span>
            <span className={`pic-checkbox-label${isThemedEdit ? ' edit' : ''}`}>
              Show Location
            </span>
          </button>
          {locationText ? (
            <div
              className={`pic-input${isThemedEdit ? ' pic-input-edit' : ''} pic-location-row`}
            >
              <MapPin size={18} color={editAccentColor} />
              <span className="pic-location-value" style={{ fontFamily }}>
                {locationText}
              </span>
            </div>
          ) : null}
        </>
      )}

      {renderEditLabel('Height')}
      <div className="pic-height-unit-row">
        {[
          { unit: 'ft', label: 'ft' },
          { unit: 'm', label: 'meters' },
        ].map(({ unit, label }) => {
          const isActive = heightUnit === unit;
          return (
            <button
              key={unit}
              type="button"
              className="pic-height-unit-option"
              onClick={() => {
                if (!isActive) onUnitToggle();
              }}
            >
              <span
                className={`pic-radio-outer${isActive ? ' active' : ''}`}
                style={isActive ? { borderColor: editAccentColor } : undefined}
              >
                {isActive ? (
                  <span
                    className="pic-radio-inner"
                    style={{ backgroundColor: editAccentColor }}
                  />
                ) : null}
              </span>
              <span className="pic-height-unit-label">{label}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={`pic-input${isThemedEdit ? ' pic-input-edit' : ''} pic-field-button`}
        onClick={() => setShowHeightModal(true)}
      >
        <span style={{ fontFamily }}>{formatHeight(formData, heightUnit)}</span>
      </button>
      {Boolean(fieldErrors?.height) && (
        <p className="pic-validation-error">{fieldErrors.height}</p>
      )}

      {showHeightModal && (
        <div
          className="pic-modal-overlay"
          onClick={() => setShowHeightModal(false)}
          role="presentation"
        >
          <div
            className="pic-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Select height"
          >
            <h3 className="pic-modal-title">Height</h3>
            <HeightSelector
              formData={formData}
              heightUnit={heightUnit}
              onInputChange={onInputChange}
              onUnitToggle={onUnitToggle}
            />
            <button
              type="button"
              className="pic-modal-done"
              style={{ backgroundColor: editAccentColor }}
              onClick={() => setShowHeightModal(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {renderEditLabel('Birthdate')}
      <div className="pic-birthdate-row">
        {birthdateFieldParts.map((part) => (
          <button
            key={part.key}
            type="button"
            className={`pic-input${isThemedEdit ? ' pic-input-edit' : ''} pic-birthdate-part`}
            onClick={() => setShowDatePicker(true)}
          >
            <span
              className={part.value ? 'pic-date-text' : 'pic-date-placeholder'}
              style={{ fontFamily }}
            >
              {part.value || part.placeholder}
            </span>
          </button>
        ))}
      </div>
      <BirthdatePickerModal
        visible={showDatePicker}
        birthdateIso={formData.birthdate || ''}
        onRequestClose={() => setShowDatePicker(false)}
        onSave={(iso) => {
          update('birthdate', iso);
          setShowDatePicker(false);
        }}
        accentColor={editAccentColor}
      />
      {Boolean(fieldErrors?.birthdate) && (
        <p className="pic-validation-error">{fieldErrors.birthdate}</p>
      )}

      {renderEditLabel('Gender')}
      <SelectGender
        selected={formData.gender}
        onChange={(v) => update('gender', v)}
        accentColor={editAccentColor}
        surfaceColor={isThemedEdit ? '#ffffff' : undefined}
      />

      {renderEditLabel('About Me')}
      <textarea
        name="bio"
        className={`pic-input${isThemedEdit ? ' pic-input-edit' : ''} pic-about-input${
          isThemedEdit ? ' pic-about-input-edit' : ''
        }`}
        value={formData.bio || ''}
        onChange={(e) => update('bio', (e.target.value || '').slice(0, 100))}
        placeholder="Tell people a little about yourself..."
        maxLength={100}
        rows={4}
        style={{ fontFamily }}
      />
      <p className="pic-char-count">{(formData.bio || '').length}/100</p>

      {completeProfile && renderCompleteProfileExtras()}

      {!TOP_IMAGE_LAYOUTS.includes(imageLayout) &&
        !completeProfile &&
        renderImageSection()}
    </>
  );

  const cardContent = (
    <>
      {user.role === 'user' && editing ? renderEditingFields() : null}
      {user.role === 'user' && !editing ? renderViewContent() : null}

      {editing && !hideFormActions && (
        <div className="form-actions">
          <button type="submit" className="save-btn">
            Save
          </button>
          <button type="button" onClick={onCancel} className="cancel-btn">
            Cancel
          </button>
        </div>
      )}
    </>
  );

  if (isBlendedPage) {
    return (
      <>
        {editing && editProfile && (
          <div className="pic-edit-toolbar-wrap">
            {editToolbar({
              formData,
              handleInputChange: onInputChange,
              editing,
            })}
          </div>
        )}
        <div
          className="pic-edit-outer"
          style={{ backgroundColor: themeBackgroundColor }}
        >
          <div
            className={`pic-edit-theme${editing ? '' : ' pic-view-theme'}`}
            style={{ backgroundColor: themeBackgroundColor }}
          >
            <div className="pic-theme-layer" aria-hidden="true">
              {profileStyle === 'pixelCloud' && <PixelClouds />}
            </div>
            <div className="pic-content-layer">{cardContent}</div>
          </div>
        </div>
      </>
    );
  }

  return <div className="profile-info-card pic-card">{cardContent}</div>;
};

export default ProfileInfoCard;
