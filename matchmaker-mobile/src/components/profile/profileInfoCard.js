import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ImageGallery from './images';
import SelectGender from './components/selectGender';
import BirthdatePickerModal from './components/BirthdatePickerModal';
import HeightPickerModal from './components/HeightPickerModal';
import PixelClouds from './components/PixelClouds';
import PixelFlowers from './components/PixelFlowers';
import PixelCactus from './components/PixelCactus';
import {
  formatHeight,
  getProfileThemeBackground,
  normalizeImageLayout,
  PROFILE_THEME_STYLES,
} from './utils/profileUtils';
import { DATER_SURFACE_BORDER, getRoleAccentColor } from '../layout/components/RoleHeaderBanner';

const parseBirthdateParts = (iso) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return { day: '', month: '', year: '' };
  }
  const [year, month, day] = iso.split('-');
  return { day, month, year };
};

const TOP_IMAGE_LAYOUTS = ['topRow', 'heroStack', 'vertical'];

const ProfileInfoCard = ({
  user,
  formData,
  editing,
  heightUnit,
  viewerUnit,
  onInputChange,
  onUnitToggle,
  calculateAge,
  images,
  onDeleteImage,
  onPlaceholderClick,
  onImagePress,
  imageError,
  fieldErrors,
  onSubmit,
  onCancel,
  scrollToBottom,
  pageBackgroundColor,
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showHeightModal, setShowHeightModal] = useState(false);
  const accentColor = getRoleAccentColor(user?.role || 'matchmaker');
  const editAccentColor = editing ? '#ef4d73' : accentColor;
  const isBlendedPage = Boolean(pageBackgroundColor);
  const isThemedEdit = editing && isBlendedPage;
  const locationText = [user.city, user.state].filter(Boolean).join(', ');
  const birthParts = parseBirthdateParts(formData.birthdate);
  const fontFamily =
    formData.profileStyle === 'constitution' ? 'Pinyon Script' : formData.fontFamily;
  const imageLayout = normalizeImageLayout(formData.imageLayout);
  const profileStyle = formData.profileStyle || 'classic';
  const themeBackgroundColor = getProfileThemeBackground(profileStyle);
  const fieldBackgroundStyle =
    isBlendedPage && editing
      ? { backgroundColor: '#ffffff' }
      : isBlendedPage && !editing
        ? { backgroundColor: themeBackgroundColor }
        : null;

  const update = (name, value) =>
    onInputChange({ target: { name, value } });

  const renderEditLabel = (text, isFirst = false) => (
    <Text
      style={[
        isThemedEdit ? styles.editLabel : styles.label,
        isFirst && styles.firstFieldLabel,
        isBlendedPage && !isThemedEdit && styles.labelBlended,
      ]}
    >
      {isThemedEdit ? text.toUpperCase() : text}
    </Text>
  );

  const renderInput = (props) => (
    <TextInput
      {...props}
      style={[
        isThemedEdit ? styles.editInput : styles.input,
        isBlendedPage && {
          borderColor: isThemedEdit ? '#E5E7EB' : DATER_SURFACE_BORDER,
        },
        fieldBackgroundStyle,
        props.style,
        { fontFamily },
      ]}
    />
  );

  const renderFieldButton = (children, onPress, extraStyle) => (
    <TouchableOpacity
      style={[
        isThemedEdit ? styles.editInput : styles.field,
        isThemedEdit ? styles.editFieldTouchable : styles.dateField,
        isBlendedPage && {
          borderColor: isThemedEdit ? '#E5E7EB' : DATER_SURFACE_BORDER,
        },
        fieldBackgroundStyle,
        extraStyle,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {children}
    </TouchableOpacity>
  );

  const renderImageGallery = (galleryEditing = editing) => (
    <View
      style={
        imageLayout === 'vertical'
          ? galleryEditing
            ? styles.verticalImageEditingInset
            : styles.verticalImageBleed
          : undefined
      }
    >
      <ImageGallery
        images={images}
        editing={galleryEditing}
        onDeleteImage={onDeleteImage}
        onPlaceholderClick={onPlaceholderClick}
        onImagePress={onImagePress}
        layout={imageLayout}
        accentColor={editAccentColor}
        surfaceColor={
          isThemedEdit
            ? '#ffffff'
            : isBlendedPage
              ? themeBackgroundColor
              : pageBackgroundColor
        }
        surfaceBorderColor={isThemedEdit ? '#E5E7EB' : isBlendedPage ? DATER_SURFACE_BORDER : undefined}
      />
    </View>
  );

  const renderAddImagesLabel = (isFirstField = false) => {
    const labelText = isThemedEdit ? 'ADD IMAGES' : 'Add Images';
    const labelStyle = [
      isThemedEdit ? styles.editLabel : styles.label,
      isBlendedPage && !isThemedEdit && styles.labelBlended,
      styles.addImagesLabelText,
    ];

    if (isFirstField && isBlendedPage) {
      return (
        <View style={[styles.addImagesLabelPill, styles.firstFieldLabel]}>
          <Text style={labelStyle}>{labelText}</Text>
        </View>
      );
    }

    return renderEditLabel('Add Images', isFirstField);
  };

  const renderImageSection = (isFirstField = false) => (
    <>
      {renderAddImagesLabel(isFirstField)}
      {renderImageGallery()}
      {Boolean(imageError) && (
        <Text style={styles.validationError}>{imageError}</Text>
      )}
    </>
  );

  const renderEditingFields = () => (
    <>
      {TOP_IMAGE_LAYOUTS.includes(imageLayout) && renderImageSection(true)}

      {renderEditLabel('Name', !TOP_IMAGE_LAYOUTS.includes(imageLayout))}
      {renderInput({
        value: formData.first_name,
        onChangeText: (v) => update('first_name', v),
      })}
      {Boolean(fieldErrors?.first_name) && (
        <Text style={styles.validationError}>{fieldErrors.first_name}</Text>
      )}

      {renderEditLabel('Last Name')}
      {renderInput({
        value: formData.last_name,
        onChangeText: (v) => update('last_name', v),
      })}
      {Boolean(fieldErrors?.last_name) && (
        <Text style={styles.validationError}>{fieldErrors.last_name}</Text>
      )}

      {renderEditLabel('Your Location')}
      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => update('show_location', !formData.show_location)}
      >
        <View
          style={[
            styles.checkbox,
            { borderColor: editAccentColor },
            !formData.show_location && fieldBackgroundStyle,
            formData.show_location && { backgroundColor: editAccentColor },
          ]}
        >
          {formData.show_location && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={[styles.checkboxLabel, isThemedEdit && styles.checkboxLabelEdit]}>
          Show Location
        </Text>
      </TouchableOpacity>
      {locationText ? (
        <View
          style={[
            isThemedEdit ? styles.editInput : styles.input,
            styles.locationInputRow,
            isBlendedPage && {
              borderColor: isThemedEdit ? '#E5E7EB' : DATER_SURFACE_BORDER,
            },
            fieldBackgroundStyle,
          ]}
        >
          <Ionicons name="location" size={18} color={editAccentColor} />
          <Text style={[styles.locationValue, { fontFamily }]} numberOfLines={1}>
            {locationText}
          </Text>
        </View>
      ) : null}

      {renderEditLabel('Birthdate')}
      <View style={styles.birthdateRow}>
        {[
          { key: 'day', value: birthParts.day, placeholder: 'DD' },
          { key: 'month', value: birthParts.month, placeholder: 'MM' },
          { key: 'year', value: birthParts.year, placeholder: 'YYYY' },
        ].map((part) => (
          <TouchableOpacity
            key={part.key}
            style={[
              isThemedEdit ? styles.editInput : styles.input,
              styles.birthdatePart,
              isBlendedPage && {
                borderColor: isThemedEdit ? '#E5E7EB' : DATER_SURFACE_BORDER,
              },
              fieldBackgroundStyle,
            ]}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                part.value ? styles.dateText : styles.datePlaceholder,
                { fontFamily },
              ]}
            >
              {part.value || part.placeholder}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {Boolean(fieldErrors?.birthdate) && (
        <Text style={styles.validationError}>{fieldErrors.birthdate}</Text>
      )}

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

      {renderEditLabel('Gender')}
      <SelectGender
        selected={formData.gender}
        onChange={(v) => update('gender', v)}
        accentColor={editAccentColor}
        surfaceColor={isThemedEdit ? '#ffffff' : isBlendedPage ? themeBackgroundColor : undefined}
      />

      {renderEditLabel('Height')}
      <View style={styles.heightUnitRow}>
        {[
          { unit: 'ft', label: 'ft' },
          { unit: 'm', label: 'meters' },
        ].map(({ unit, label }) => {
          const isActive = heightUnit === unit;
          return (
            <TouchableOpacity
              key={unit}
              style={styles.heightUnitOption}
              onPress={() => {
                if (!isActive) onUnitToggle();
              }}
            >
              <View
                style={[
                  styles.radioOuter,
                  !isActive && fieldBackgroundStyle,
                  isActive && { borderColor: editAccentColor },
                ]}
              >
                {isActive ? (
                  <View style={[styles.radioInner, { backgroundColor: editAccentColor }]} />
                ) : null}
              </View>
              <Text style={styles.heightUnitLabel}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {renderFieldButton(
        <Text style={[styles.dateText, { fontFamily }]}>
          {formatHeight(formData, heightUnit)}
        </Text>,
        () => setShowHeightModal(true)
      )}

      <HeightPickerModal
        visible={showHeightModal}
        heightUnit={heightUnit}
        heightFeet={formData.heightFeet}
        heightInches={formData.heightInches}
        heightMeters={formData.heightMeters}
        heightCentimeters={formData.heightCentimeters}
        onRequestClose={() => setShowHeightModal(false)}
        onSave={(patch) => {
          update('heightFeet', patch.heightFeet);
          update('heightInches', patch.heightInches);
          update('heightMeters', patch.heightMeters);
          update('heightCentimeters', patch.heightCentimeters);
          setShowHeightModal(false);
        }}
        accentColor={editAccentColor}
      />
      {Boolean(fieldErrors?.height) && (
        <Text style={styles.validationError}>{fieldErrors.height}</Text>
      )}

      {renderEditLabel('About Me')}
      {renderInput({
        value: formData.bio || '',
        onChangeText: (v) => update('bio', (v || '').slice(0, 100)),
        placeholder: 'Tell people a little about yourself...',
        placeholderTextColor: '#9CA3AF',
        multiline: true,
        maxLength: 100,
        textAlignVertical: 'top',
        style: isThemedEdit ? styles.editAboutInput : styles.aboutInput,
      })}
      <Text style={styles.charCount}>{(formData.bio || '').length}/100</Text>

      {!TOP_IMAGE_LAYOUTS.includes(imageLayout) && renderImageSection()}
    </>
  );

  const cardContent = (
    <>
      {user.role === 'user' && editing ? renderEditingFields() : null}

      {user.role === 'user' && !editing ? (
        <>
          {TOP_IMAGE_LAYOUTS.includes(imageLayout) && renderImageGallery(false)}
          {Boolean((formData.bio || '').trim()) && (
            <Text style={[styles.previewText, { fontFamily }]}>
              {formData.bio.trim()}
            </Text>
          )}
          {!TOP_IMAGE_LAYOUTS.includes(imageLayout) && renderImageGallery(false)}
        </>
      ) : null}
    </>
  );

  if (isBlendedPage) {
    const themeStyle = PROFILE_THEME_STYLES[profileStyle] || PROFILE_THEME_STYLES.classic;

    return (
      <View style={[styles.editOuterCard, { backgroundColor: themeBackgroundColor }]}>
        <View
          style={[
            styles.editThemeContainer,
            themeStyle,
            !editing && styles.viewThemeContainer,
          ]}
        >
          <View style={styles.themeLayer} pointerEvents="none">
            {profileStyle === 'pixelCloud' && <PixelClouds />}
            {profileStyle === 'pixelFlower' && <PixelFlowers />}
            {profileStyle === 'pixelCactus' && <PixelCactus />}
          </View>
          <View style={styles.contentLayer}>{cardContent}</View>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        editing && styles.cardEditing,
        isBlendedPage && styles.cardBlended,
        editing && isBlendedPage && styles.cardEditingBlended,
        pageBackgroundColor && !isBlendedPage && { backgroundColor: pageBackgroundColor },
      ]}
    >
      {cardContent}
    </View>
  );
};

export default ProfileInfoCard;

const styles = StyleSheet.create({
  card: {
    padding: 16,
  },
  verticalImageBleed: {
    marginHorizontal: -16,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  verticalImageEditingInset: {
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  cardEditing: {
    paddingTop: 44,
    paddingBottom: 44,
  },
  cardBlended: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(239, 77, 115, 0.08)',
  },
  cardEditingBlended: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  editOuterCard: {
    borderRadius: 24,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
    overflow: 'hidden',
  },
  editThemeContainer: {
    position: 'relative',
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  viewThemeContainer: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  themeLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  contentLayer: {
    position: 'relative',
    zIndex: 1,
  },
  labelBlended: {
    textShadowColor: 'transparent',
    textShadowRadius: 0,
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
    marginTop: 12,
    color: '#111',
    textShadowColor: 'rgba(255, 255, 255, 0.95)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 1.5,
  },
  editLabel: {
    fontSize: 11,
    marginBottom: 6,
    marginTop: 14,
    color: '#9CA3AF',
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  firstFieldLabel: {
    marginTop: 0,
  },
  addImagesLabelPill: {
    alignSelf: 'flex-start',
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  addImagesLabelText: {
    marginTop: 0,
    marginBottom: 0,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  editInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    fontSize: 16,
    color: '#111827',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  editFieldTouchable: {
    justifyContent: 'center',
  },
  aboutInput: {
    minHeight: 92,
    paddingTop: 10,
  },
  editAboutInput: {
    minHeight: 110,
    height: undefined,
    paddingTop: 12,
    paddingBottom: 12,
  },
  charCount: {
    marginTop: 4,
    marginBottom: 4,
    textAlign: 'right',
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
  field: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  dateField: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dateText: {
    fontSize: 16,
    color: '#111',
    textShadowColor: 'rgba(255, 255, 255, 0.95)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 1.5,
  },
  datePlaceholder: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  birthdateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  birthdatePart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewText: {
    fontSize: 16,
    color: '#111',
    marginTop: 10,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  checkmark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    textShadowColor: 'rgba(255, 255, 255, 0.95)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 1.5,
  },
  checkboxLabelEdit: {
    color: '#374151',
    fontWeight: '500',
    textShadowColor: 'transparent',
  },
  locationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationValue: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  heightUnitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 8,
    marginTop: 2,
  },
  heightUnitOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  heightUnitLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  validationError: {
    marginTop: 6,
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
  },
});
