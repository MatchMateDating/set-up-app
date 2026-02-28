import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
  Dimensions, // 1. Added Dimensions
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import CalendarPicker from 'react-native-calendar-picker';
import ImageGallery from './images';
import SelectGender from './components/selectGender';

// Get screen width for responsive sizing
const SCREEN_WIDTH = Dimensions.get('window').width;

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
  onSubmit,
  onCancel,
  scrollToBottom,
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempBirthdate, setTempBirthdate] = useState(null);
  const calendarWrapperRef = useRef(null);
  const heightSource = editing ? formData : user;
  const today = new Date();
  const effectiveUnit = editing
    ? heightUnit
    : viewerUnit ?? heightUnit;
  const defaultBirthdate = new Date(today.setFullYear(today.getFullYear() - 18))
    .toISOString()
    .split('T')[0];

  const update = (name, value) =>
    onInputChange({ target: { name, value } });

  const scrollCalendarWrapperIntoView = () => {
    setTimeout(() => {
      if (!calendarWrapperRef.current) {
        scrollToBottom?.('birthdate-calendar');
        return;
      }
      calendarWrapperRef.current.measureInWindow((_, calendarY, __, calendarH) => {
        scrollToBottom?.('calendar-wrapper-end', calendarY + calendarH);
      });
    }, 80);
  };

  const formatHeight = (unit, source) => {
    let totalCm = null;

    // ---------- CASE 1: formData (editing or own profile) ----------
    if (
      source.heightFeet !== undefined ||
      source.heightMeters !== undefined
    ) {
      const feet = Number(source.heightFeet || 0);
      const inches = Number(source.heightInches || 0);
      const meters = Number(source.heightMeters || 0);
      const centimeters = Number(source.heightCentimeters || 0);

      if (feet || inches) {
        totalCm = feet * 30.48 + inches * 2.54;
      } else if (meters || centimeters) {
        totalCm = meters * 100 + centimeters;
      }
    }

    // ---------- CASE 2: user (match card) ----------
    else if (typeof source.height === 'string') {
      if (source.unit === 'imperial') {
        const match = source.height.match(/(\d+)'\s*(\d+)?/);

        if (match) {
          const feet = Number(match[1] || 0);
          const inches = Number(match[2] || 0);
          totalCm = feet * 30.48 + inches * 2.54;
        }
      }
      else {
        const match = source.height.match(/(\d+)m\s*(\d+)?cm?/);
        if (match) {
          const meters = Number(match[1] || 0);
          const cm = Number(match[2] || 0);
          totalCm = meters * 100 + cm;
        }
      }
    }

    // ---------- FORMAT FOR VIEWER ----------
    if (unit === 'imperial' || unit === 'ft') {
      const totalInches = totalCm / 2.54;
      const feet = Math.floor(totalInches / 12);
      const inches = Math.round(totalInches % 12);
      return `${feet}' ${inches}"`;
    }

    const meters = Math.floor(totalCm / 100);
    const centimeters = Math.round(totalCm % 100);
    return `${meters}.${String(centimeters).padStart(2, '0')} m`;
  };


  return (
    <View style={styles.card}>
      {user.role === 'user' && (
        <>
          {['topRow', 'heroStack'].includes(formData.imageLayout) && (
            <>
              {editing && (<Text style={styles.label}>Add Images</Text>)}
              <ImageGallery
                images={images}
                editing={editing}
                onDeleteImage={onDeleteImage}
                onPlaceholderClick={onPlaceholderClick}
                layout={formData.imageLayout}
              />
            </>
          )}

          {editing && (
            <>
              <Text
                style={[
                  styles.label,
                  !['topRow', 'heroStack'].includes(formData.imageLayout) && styles.firstFieldLabel,
                ]}
              >
                First Name
              </Text>
              <TextInput
                style={[styles.input, { fontFamily: formData.profileStyle === 'constitution' ? 'Pinyon Script' : formData.fontFamily }]}
                value={formData.first_name}
                onChangeText={(v) => update('first_name', v)}
              />
            </>
          )}

          {editing && (
            <>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={[styles.input, { fontFamily: formData.profileStyle === 'constitution' ? 'Pinyon Script' : formData.fontFamily }]}
                value={formData.last_name}
                onChangeText={(v) => update('last_name', v)}
              />
            </>
          )}

{editing ? (
            <>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => update('show_location', !formData.show_location)}
              >
                <View style={[styles.checkbox, formData.show_location && styles.checkboxChecked]}>
                  {formData.show_location && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Show location</Text>
              </TouchableOpacity>
              {(user.city || user.state) && (
                <Text style={styles.locationHint}>
                  {[user.city, user.state].filter(Boolean).join(', ')}
                </Text>
              )}
            </>
          ) : null}

          {editing ? (
            <>
              <Text style={styles.label}>Birthdate</Text>
              <TouchableOpacity
                style={[styles.field, styles.dateField, { fontFamily: formData.profileStyle === 'constitution' ? 'Pinyon Script' : formData.fontFamily }]}
                onPress={() => {
                  setTempBirthdate(
                    formData.birthdate
                      ? (() => {
                          const [year, month, day] = formData.birthdate.split('-').map(Number);
                          return new Date(year, month - 1, day); // month is 0-indexed
                        })()
                      : null
                  );
                  setShowDatePicker(true);
                  scrollCalendarWrapperIntoView();
                }}
              >
                <Text style={[styles.dateText, { fontFamily: formData.profileStyle === 'constitution' ? 'Pinyon Script' : formData.fontFamily }]}>
                  {formData.birthdate || 'Select birthdate'}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <View style={styles.calendarContainer}>
                  <Pressable
                    style={styles.calendarBackdrop}
                    onPress={() => {
                      setTempBirthdate(null);
                      setShowDatePicker(false);
                    }}
                  />
                  <View
                    ref={calendarWrapperRef}
                    style={styles.modalCard}
                    onLayout={scrollCalendarWrapperIntoView}
                  >
                    <Text style={styles.modalTitle}>Select Birthdate</Text>
                    <View style={styles.calendarWrapper}>
                      <CalendarPicker
                        onDateChange={(date) => setTempBirthdate(date)}
                        selectedStartDate={tempBirthdate}
                        initialDate={tempBirthdate}
                        maxDate={new Date(defaultBirthdate)}
                        width={SCREEN_WIDTH - 80} // 2. Ensures calendar fits inside the padding of the card
                        restrictMonthNavigation={true}
                        selectedDayColor="#6c5ce7"
                        selectedDayTextColor="#fff"
                        textStyle={{
                          color: '#111',
                          fontSize: 14, // 3. Slightly smaller to prevent overflow
                        }}
                        dayLabelsWrapper={styles.dayLabelsWrapper}
                      />
                    </View>

                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => {
                          setTempBirthdate(null);
                          setShowDatePicker(false);
                        }}
                      >
                        <Text style={styles.cancelText}>Cancel</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.confirmButton}
                        onPress={() => {
                          if (tempBirthdate) {
                            // Ensure tempBirthdate is handled correctly as a moment object or Date
                            const dateObj = tempBirthdate.toDate ? tempBirthdate.toDate() : tempBirthdate;
                            update('birthdate', dateObj.toISOString().split('T')[0]);
                          }
                          setShowDatePicker(false);
                        }}
                      >
                        <Text style={styles.confirmText}>Confirm</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </>
          ) : null}

          {editing ? (
            <>
              <Text style={styles.label}>Gender</Text>
              <SelectGender
                selected={formData.gender}
                onChange={(v) => update('gender', v)}
              />
            </>
          ) : (
            <>
              <Text style={[styles.previewText, { fontFamily: formData.profileStyle === 'constitution' ? 'Pinyon Script' : formData.fontFamily }]}>
                {formData.gender ? formData.gender : '—'}
              </Text>
            </>
          )}

          {editing ? (
            <>
              <Text style={styles.label}>Height ({heightUnit})</Text>
              <View style={[styles.field, styles.heightGroup]}>
                {heightUnit === 'ft' ? (
                  <>
                    <View style={styles.heightPickerWrapper}>
                      <Picker
                        selectedValue={formData.heightFeet}
                        style={styles.pickerSmall}
                        onValueChange={(v) => update('heightFeet', v)}
                      >
                        {Array.from({ length: 8 }, (_, i) => (
                          <Picker.Item key={i} label={`${i}`} value={`${i}`} />
                        ))}
                      </Picker>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.heightPickerWrapper}>
                      <Picker
                        selectedValue={formData.heightInches}
                        style={styles.pickerSmall}
                        onValueChange={(v) => update('heightInches', v)}
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <Picker.Item key={i} label={`${i}`} value={`${i}`} />
                        ))}
                      </Picker>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.heightPickerWrapper}>
                      <Picker
                        selectedValue={formData.heightMeters}
                        style={styles.pickerSmall}
                        onValueChange={(v) => update('heightMeters', v)}
                      >
                        {Array.from({ length: 3 }, (_, i) => (
                          <Picker.Item key={i} label={`${i}`} value={`${i}`} />
                        ))}
                      </Picker>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.heightPickerWrapper}>
                      <Picker
                        selectedValue={formData.heightCentimeters}
                        style={styles.pickerSmall}
                        onValueChange={(v) => update('heightCentimeters', v)}
                      >
                        {Array.from({ length: 100 }, (_, i) => (
                          <Picker.Item key={i} label={`${i}`} value={`${i}`} />
                        ))}
                      </Picker>
                    </View>
                  </>
                )}
              </View>

              <TouchableOpacity onPress={onUnitToggle}>
                <Text style={styles.toggle}>
                  Switch to {heightUnit === 'ft' ? 'meters' : 'feet'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.previewText, { fontFamily: formData.profileStyle === 'constitution' ? 'Pinyon Script' : formData.fontFamily }]}>
                {formatHeight(effectiveUnit, heightSource)}
              </Text>
            </>
          )}

          {editing ? (
            <>
              <Text style={styles.label}>About Me</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.aboutInput,
                  { fontFamily: formData.profileStyle === 'constitution' ? 'Pinyon Script' : formData.fontFamily },
                ]}
                value={formData.bio || ''}
                onChangeText={(v) => update('bio', (v || '').slice(0, 100))}
                placeholder="Tell people a little about yourself"
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={100}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{(formData.bio || '').length}/100</Text>
            </>
          ) : (
            <>
              {Boolean((formData.bio || '').trim()) && (
                <>
                  <Text style={styles.label}>About Me</Text>
                  <Text style={[styles.previewText, { fontFamily: formData.profileStyle === 'constitution' ? 'Pinyon Script' : formData.fontFamily }]}>
                    {formData.bio.trim()}
                  </Text>
                </>
              )}
            </>
          )}

          {!['topRow', 'heroStack'].includes(formData.imageLayout) && (
            <>
              {editing && (<Text style={styles.label}>Add Images</Text>)}
              <ImageGallery
                images={images}
                editing={editing}
                onDeleteImage={onDeleteImage}
                onPlaceholderClick={onPlaceholderClick}
                layout={formData.imageLayout}
              />
            </>
          )}



          {editing && (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.saveBtn} onPress={onSubmit}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {!['topRow', 'heroStack'].includes(formData.imageLayout) && (
            <>
              {editing && (<Text style={styles.label}>Add Images</Text>)}
              <ImageGallery
                images={images}
                editing={editing}
                onDeleteImage={onDeleteImage}
                onPlaceholderClick={onPlaceholderClick}
                layout={formData.imageLayout}
              />
            </>
          )}



          </>
        )}
      </View>
    </>
  );
};

export default ProfileInfoCard;

const styles = StyleSheet.create({
  card: {
    padding: 16,
  },
  cardEditing: {
    paddingTop: 8,
    paddingBottom: 44,
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
    marginTop: 12,
    color: '#111',
  },
  firstFieldLabel: {
    marginTop: 0,
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
  aboutInput: {
    minHeight: 92,
    paddingTop: 10,
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
  },
  previewText: {
    fontSize: 16,
    color: '#111',
    marginTop: 10,
  },
  calendarContainer: {
    position: 'relative',
    zIndex: 10,
    overflow: 'visible',
  },
  calendarBackdrop: {
    position: 'absolute',
    top: -2000,
    left: -2000,
    right: -2000,
    bottom: -2000,
    backgroundColor: 'transparent',
    zIndex: 0,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    marginVertical: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: 'relative',
    zIndex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  calendarWrapper: {
    alignItems: 'center', // Centers the calendar within the modal
    justifyContent: 'center',
    width: '100%',
  },
  dayLabelsWrapper: {
    borderBottomWidth: 0,
    borderTopWidth: 0,
    paddingBottom: 10,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 24,
  },
  cancelText: {
    color: '#6B7280',
    fontSize: 16,
    paddingVertical: 10,
  },
  confirmButton: {
    backgroundColor: '#6c5ce7',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  confirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  heightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'visible',
    ...Platform.select({
      ios: { height: 215 },
      android: { height: 50 },
      default: { height: 50 },
    }),
  },
  heightPickerWrapper: {
    flex: 1,
    overflow: 'visible',
    ...Platform.select({
      ios: { height: 215 },
      android: { height: 50 },
      default: { height: 50 },
    }),
  },
  pickerSmall: {
    width: '100%',
    color: '#111',
    ...Platform.select({
      ios: { height: 215 },
      android: { height: 50 },
      default: { height: 50 },
    }),
  },
  divider: {
    width: 1,
    height: '60%',
    backgroundColor: '#ddd',
  },
  toggle: {
    marginTop: 8,
    color: '#6c5ce7',
    fontWeight: '600',
    textAlign: 'right',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#6c5ce7',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6c5ce7',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  locationHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginLeft: 34,
  },
});
