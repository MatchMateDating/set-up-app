import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import FormField from './components/formField';
import HeightSelector from './components/heightSelector';
import ImageGallery from './images';

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
  images,
  onDeleteImage,
  onPlaceholderClick
}) => {
  const handleInputChangeWrapper = (name, value) => {
    onInputChange({ target: { name, value } });
  };

  return (
    <View style={styles.profileInfoCard}>
      {user.role === 'user' && (
        <>
          {editing && (
            <>
              <FormField
                label="First Name"
                editing={editing}
                value={user.first_name}
                input={
                  <TextInput
                    style={styles.input}
                    value={formData.first_name}
                    onChangeText={(value) => handleInputChangeWrapper('first_name', value)}
                  />
                }
              />
              <FormField
                label="Last Name"
                editing={editing}
                value={user.last_name}
                input={
                  <TextInput
                    style={styles.input}
                    value={formData.last_name}
                    onChangeText={(value) => handleInputChangeWrapper('last_name', value)}
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
              editing ? (
                <TextInput
                  style={styles.input}
                  value={formData.birthdate}
                  onChangeText={(value) => handleInputChangeWrapper('birthdate', value)}
                  placeholder="YYYY-MM-DD"
                />
              ) : null
            }
          />

          <FormField
            label="Height"
            editing={editing}
            value={user.height}
            input={
              editing ? (<HeightSelector
                formData={formData}
                heightUnit={heightUnit}
                onInputChange={onInputChange}
                onUnitToggle={onUnitToggle}
              />
              ) : null
            }
          />

          <FormField
            label="Gender"
            editing={editing}
            value={user.gender}
            input={
              editing ? (
                <View style={styles.selectContainer}>
                  <Picker
                    selectedValue={formData.gender}
                    onValueChange={(value) => handleInputChangeWrapper('gender', value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Select gender" value="" />
                    <Picker.Item label="Female" value="female" />
                    <Picker.Item label="Male" value="male" />
                    <Picker.Item label="Non-binary" value="nonbinary" />
                  </Picker>
                </View>
              ) : null
            }
          />
        </>
      )}

      {user.role === 'user' && (
        <View style={styles.section}>
          {editing && <Text style={styles.label}>Add Images:</Text>}
          <ImageGallery
            images={images}
            editing={editing}
            onDeleteImage={onDeleteImage}
            onPlaceholderClick={onPlaceholderClick}
            layout={formData.imageLayout}
          />
        </View>
      )}

      {editing && (
        <View style={styles.formActions}>
          <TouchableOpacity style={styles.saveBtn} onPress={onSubmit}>
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  profileInfoCard: {
    padding: 16,
  },
  input: {
    borderBottomWidth: 2,
    borderBottomColor: '#e0e6ef',
    padding: 8,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  selectContainer: {
    borderBottomWidth: 2,
    borderBottomColor: '#e0e6ef',
  },
  picker: {
    height: 130,
    width: 200
  },
  section: {
    marginTop: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#222',
  },
  helperText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    justifyContent: 'flex-end',
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#6B46C1',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ebe7fb',
  },
  cancelBtnText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileInfoCard;
