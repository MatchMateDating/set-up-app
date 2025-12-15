import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import Slider from '@react-native-community/slider';
import ImageGallery from './images';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL } from '@env';

import {
  calculateAge,
  convertFtInToMetersCm,
  convertMetersCmToFtIn,
  formatHeight
} from './utils/profileUtils';

import Profile from './profile';
import StepIndicator from './components/stepIndicator';
import MultiSelectGender from './components/multiSelectGender';

const CompleteProfile = () => {
  const navigation = useNavigation();

  const today = new Date();
  const defaultBirthdate = new Date(today.setFullYear(today.getFullYear() - 18))
    .toISOString()
    .split('T')[0];

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [heightUnit, setHeightUnit] = useState('ft');
  const [user, setUser] = useState(null);
  const [images, setImages] = useState([]);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    birthdate: defaultBirthdate,
    gender: '',
    heightFeet: '0',
    heightInches: '0',
    heightMeters: '0',
    heightCentimeters: '0',
    preferredAgeMin: '',
    preferredAgeMax: '',
    preferredGenders: [],
    matchRadius: 50,
  });

  const getSignUpData = async () => {
    setLoading(true);
    try {
      const userRaw = await AsyncStorage.getItem('user');
      if (userRaw) {
        const user = JSON.parse(userRaw);
        setUser(user);
        setFormData({ ...formData, 
          first_name: user.first_name ?? '', 
          last_name: user.last_name ?? ''
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getSignUpData();
  }, []);

  const update = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleUnitToggle = () => {
    if (heightUnit === 'ft') {
      const { meters, centimeters } = convertFtInToMetersCm(
        formData.heightFeet, formData.heightInches
      );
      setFormData({ ...formData, heightMeters: meters, heightCentimeters: centimeters });
      setHeightUnit('m');
    } else {
      const { feet, inches } = convertMetersCmToFtIn(
        formData.heightMeters, formData.heightCentimeters
      );
      setFormData({ ...formData, heightFeet: feet, heightInches: inches });
      setHeightUnit('ft');
    }
  };

  // STEP 1 LOCAL VALIDATION
  const saveStep1 = async () => {
    setError('');

    if (calculateAge(formData.birthdate) < 18)
      return setError('You must be at least 18.');

    if (!formData.first_name.trim())
      return setError('First name is required.');

    if (!formData.last_name.trim())
      return setError('Last name is required.');

    if (!formData.gender)
      return setError('Gender is required.');

    setStep(2);
  };

  const handleFinish = async () => {
    setError('');
    setLoading(true);
  
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setError("Session expired. Please log in again.");
        return;
      }
  
      // Validate preferences
      if (formData.preferredAgeMin && formData.preferredAgeMax) {
        if (parseInt(formData.preferredAgeMin) > parseInt(formData.preferredAgeMax))
          return setError("Min age cannot be greater than max age");
      }
  
      const profilePayload = {
        birthdate: formData.birthdate,
        gender: formData.gender,
        height: (formData.heightFeet || formData.heightInches || formData.heightMeters || formData.heightCentimeters) ? formatHeight(formData, heightUnit) : '',
        preferredAgeMin: formData.preferredAgeMin ?? '',
        preferredAgeMax: formData.preferredAgeMax ?? '',
        preferredGenders: formData.preferredGenders ?? [],
        match_radius: formData.matchRadius ?? 50,
      };
  
      const updateRes = await fetch(`${API_BASE_URL}/profile/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profilePayload),
      });
  
      if (!updateRes.ok) {
        const updateError = await updateRes.json();
        setError(updateError.msg || "Profile update failed");
        return;
      }
  
      navigation.navigate("Main");
    } catch (err) {
      console.error(err);
      setError("Something went wrong during submission.");
    } finally {
      setLoading(false);
    }
  };

  const setUserHeight = () => {
    if (heightUnit == "ft" && (formData.heightFeet || formData.heightInches)) {
      return `${formData.heightFeet}'${formData.heightInches}`;
    } else if (heightUnit == "m" && (formData.heightMeters || formData.heightCentimeters)) {
      return `${formData.heightMeters}m ${formData.heightCentimeters}cm`
    } else {
      return null;
    }
  }

  const handleDeleteImage = async (imageId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/profile/delete_image/${imageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          await AsyncStorage.removeItem('token');
          Alert.alert('Session expired', 'Please log in again.');
          navigation.navigate('Login');
          return;
        }
      }

      if (!res.ok) throw new Error('Failed to delete image');

      setImages((prevImages) => prevImages.filter((img) => img.id !== imageId));
      Alert.alert('Success', 'Image deleted successfully');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to delete image');
    }
  };

  const handlePlaceholderClick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need camera roll permissions to upload images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {

      await handleCropComplete(result.assets[0]);
    }
  };

  const handleCropComplete = async (imageAsset) => {
    if (!imageAsset) return;

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const formDataToSend = new FormData();
      formDataToSend.append('image', {
        uri: imageAsset.uri,
        type: 'image/jpeg',
        name: 'image.jpg',
      });

      const response = await fetch(`${API_BASE_URL}/profile/upload_image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formDataToSend,
      });

      if (response.status === 401) {
        const data = await response.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          await AsyncStorage.removeItem('token');
          Alert.alert('Session expired', 'Please log in again.');
          navigation.navigate('Login');
          return;
        }
      }

      if (!response.ok) throw new Error('Failed to upload image');

      const newImage = await response.json();
      setImages((prevImages) => [...prevImages, newImage]);
      Alert.alert('Success', 'Image uploaded successfully');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to upload image');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StepIndicator step={step} />

      {step === 1 && (
        <View>
          <Text style={styles.title}>Complete Your Profile</Text>

          <Text style={styles.label}>First Name</Text>
          <TextInput
            style={styles.input}
            value={formData.first_name}
            onChangeText={(v) => update("first_name", v)}
          />

          <Text style={styles.label}>Last Name</Text>
          <TextInput
            style={styles.input}
            value={formData.last_name}
            onChangeText={(v) => update("last_name", v)}
          />

          <Text style={styles.label}>Birthdate</Text>
          <TextInput
            style={styles.input}
            value={formData.birthdate}
            onChangeText={(v) => update("birthdate", v)}
            placeholder="YYYY-MM-DD"
          />

          <Text style={styles.label}>Gender</Text>
          <Picker
            selectedValue={formData.gender}
            onValueChange={(v) => update("gender", v)}
            style={styles.picker}
          >
            <Picker.Item label="Select gender" value="" />
            <Picker.Item label="Female" value="female" />
            <Picker.Item label="Male" value="male" />
            <Picker.Item label="Non-binary" value="nonbinary" />
          </Picker>

          <Text style={styles.label}>Height ({heightUnit})</Text>
          {heightUnit === 'ft' ? (
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.smallInput]}
                keyboardType="numeric"
                value={formData.heightFeet}
                onChangeText={(v) => {
                  update("heightFeet", v); 
                  update("heightMeters", "");
                }}
              />
              <TextInput
                style={[styles.input, styles.smallInput]}
                keyboardType="numeric"
                value={formData.heightInches}
                onChangeText={(v) => {
                  update("heightInches", v); 
                  update("heightCentimeters", "");
                }}
              />
            </View>
          ) : (
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.smallInput]}
                keyboardType="numeric"
                value={formData.heightMeters}
                onChangeText={(v) => {
                  update("heightMeters", v); 
                  update("heightFeet", "");
                }}
              />
              <TextInput
                style={[styles.input, styles.smallInput]}
                keyboardType="numeric"
                value={formData.heightCentimeters}
                onChangeText={(v) => {
                  update("heightCentimeters", v); 
                  update("heightInches", "");
                }}
              />
            </View>
          )}

          <TouchableOpacity onPress={handleUnitToggle}>
            <Text style={styles.toggle}>Switch to {heightUnit === 'ft' ? 'meters' : 'feet'}</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Add Images:</Text>
          <ImageGallery
            images={images}
            editing={true}
            onDeleteImage={handleDeleteImage}
            onPlaceholderClick={handlePlaceholderClick}
          />
          
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.nextBtn} onPress={saveStep1}>
            <Text style={styles.nextBtnText}>Next</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={() => setStep(3)}>
            <Text style={styles.skipBtnText}>Skip</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 2 && (
        <View>
          <Text style={styles.title}>Preview</Text>

          <Profile
            user={{
              ...formData,
              height: setUserHeight(),
              role: user.role
            }}
            framed={true}
            editing={false}
          />

          <View style={styles.rowBetween}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(1)}>
              <Text style={styles.secondaryBtnText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(3)}>
              <Text style={styles.nextBtnText}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 3 && (
        <View>
          <Text style={styles.title}>Preferences</Text>

          <Text style={styles.label}>Preferred Age Range</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.smallInput]}
              keyboardType="numeric"
              placeholder="Min"
              value={formData.preferredAgeMin}
              onChangeText={(v) => update("preferredAgeMin", v)}
            />
            <TextInput
              style={[styles.input, styles.smallInput]}
              keyboardType="numeric"
              placeholder="Max"
              value={formData.preferredAgeMax}
              onChangeText={(v) => update("preferredAgeMax", v)}
            />
          </View>

          <Text style={styles.label}>Preferred Genders</Text>
          <MultiSelectGender
            selected={formData.preferredGenders || []}
            onChange={(v) => update("preferredGenders", v)}
          />

          <Text style={styles.label}>Match Radius ({formData.matchRadius} mi)</Text>
          <Slider
            minimumValue={1}
            maximumValue={500}
            step={1}
            value={formData.matchRadius}
            onValueChange={(v) => update("matchRadius", v)}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {loading ? (
            <ActivityIndicator size="large" color="#6B46C1" />
          ) : (
            <View style={styles.rowBetween}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(2)}>
                <Text style={styles.secondaryBtnText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.nextBtn} onPress={handleFinish}>
                <Text style={styles.nextBtnText}>Submit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

export default CompleteProfile;

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 80,
    paddingTop: 60
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    marginBottom: 4,
  },
  smallInput: {
    flex: 1,
    marginRight: 8,
  },
  picker: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 6,
  },
  toggle: {
    marginTop: 8,
    color: '#6B46C1',
    fontWeight: '600',
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  nextBtn: {
    backgroundColor: '#6B46C1',
    padding: 14,
    borderRadius: 10,
    marginTop: 20,
  },
  nextBtnText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
  skipBtn: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6B46C1',
    marginTop: 20,
  },
  skipBtnText: {
    color: '#6B46C1',
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryBtn: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6B46C1',
    marginTop: 20,
  },
  secondaryBtnText: {
    color: '#6B46C1',
    fontWeight: '700',
  },
  error: {
    marginTop: 10,
    color: 'red',
    textAlign: 'center',
  },
});
