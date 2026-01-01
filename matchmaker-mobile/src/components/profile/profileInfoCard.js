import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
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
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempBirthdate, setTempBirthdate] = useState(null);
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
          {editing && (
            <>
              <Text style={styles.label}>First Name</Text>
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
                }}
              >
                <Text style={[styles.dateText, { fontFamily: formData.profileStyle === 'constitution' ? 'Pinyon Script' : formData.fontFamily }]}>
                  {formData.birthdate || 'Select birthdate'}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>Select Birthdate</Text>
                  <View style={styles.calendarWrapper}>
                    <CalendarPicker
                      onDateChange={(date) => setTempBirthdate(date)}
                      selectedStartDate={tempBirthdate}
                      initialDate={tempBirthdate}
                      maxDate={new Date(defaultBirthdate)}
                      width={SCREEN_WIDTH - 80} // 2. Ensures calendar fits inside the padding of the card
                      restrictMonthNavigation={true}
                      selectedDayColor="#6B46C1"
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
              )}
            </>
          ) : (
            <>
              <Text style={[styles.previewText, { fontFamily: formData.profileStyle === 'constitution' ? 'Pinyon Script' : formData.fontFamily }]}>
                {formData.birthdate
                  ? `${calculateAge(formData.birthdate)}`
                  : '—'}
              </Text>
            </>
          )}

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

          {editing && (<Text style={styles.label}>Add Images</Text>)}
          <ImageGallery
            images={images}
            editing={editing}
            onDeleteImage={onDeleteImage}
            onPlaceholderClick={onPlaceholderClick}
            layout={formData.imageLayout}
          />

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
        </>
      )}
    </View>
  );
};

export default ProfileInfoCard;

const styles = StyleSheet.create({
  card: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
    marginTop: 12,
    color: '#111',
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
    backgroundColor: '#6B46C1',
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
    color: '#6B46C1',
    fontWeight: '600',
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#6B46C1',
  },
  saveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6B46C1',
    backgroundColor: 'transparent',
  },
  cancelBtnText: {
    color: '#6B46C1',
    fontSize: 16,
    fontWeight: '600',
  },
});
