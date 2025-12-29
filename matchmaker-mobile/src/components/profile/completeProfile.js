import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import Slider from '@react-native-community/slider';
import CalendarPicker from "react-native-calendar-picker";
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
import SelectGender from './components/selectGender';
import MultiSelectGender from './components/multiSelectGender';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import { EditToolbar } from './components/editToolbar';
import PixelClouds from './components/PixelClouds';
import PixelFlowers from './components/PixelFlowers';
import PixelCactus from './components/PixelCactus';

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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempBirthdate, setTempBirthdate] = useState(null);
  const radiusUnit = heightUnit === 'ft' ? 'mi' : 'km';
  const milesToKm = (mi) => Math.round(mi * 1.60934);
  const kmToMiles = (km) => Math.round(km / 1.60934);
  const radiusMax = radiusUnit === 'km' ? 800 : 500;
  const SCREEN_WIDTH = Dimensions.get('window').width;

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    birthdate: defaultBirthdate,
    gender: '',
    heightFeet: '0',
    heightInches: '0',
    heightMeters: '0',
    heightCentimeters: '0',
    preferredAgeMin: '18',
    preferredAgeMax: '50',
    preferredGenders: [],
    matchRadius: 50,
    imageLayout: 'grid',
    profileStyle: 'Classic',
    fontFamily: 'Arial',
  });

  const getSignUpData = async () => {
    setLoading(true);
    try {
      const userRaw = await AsyncStorage.getItem('user');
      if (userRaw) {
        const user = JSON.parse(userRaw);
        setUser(user);
        setFormData({
          ...formData,
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
    setFormData(prev => {
      const current = prev.matchRadius;

      if (heightUnit === 'm') {
        // switched to metric → km
        return { ...prev, matchRadius: milesToKm(current) };
      } else {
        // switched to imperial → mi
        return { ...prev, matchRadius: kmToMiles(current) };
      }
    });
  }, [heightUnit]);

  const update = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleInputChange = (e) => {
      const name = e.target?.name || e.name;
      const value = e.target?.value !== undefined ? e.target.value : e.value;
      setFormData((prev) => ({ ...prev, [name]: value }));
    };

  const handleUnitToggle = () => {
    if (heightUnit === 'ft') {
      // ft → m (radius km → mi)
      const { meters, centimeters } = convertFtInToMetersCm(
        formData.heightFeet,
        formData.heightInches
      );

      setFormData(prev => ({
        ...prev,
        heightMeters: meters,
        heightCentimeters: centimeters,
        matchRadius: kmToMiles(prev.matchRadius),
      }));

      setHeightUnit('m');
    } else {
      // m → ft (radius mi → km)
      const { feet, inches } = convertMetersCmToFtIn(
        formData.heightMeters,
        formData.heightCentimeters
      );

      setFormData(prev => ({
        ...prev,
        heightFeet: feet,
        heightInches: inches,
        matchRadius: milesToKm(prev.matchRadius),
      }));

      setHeightUnit('ft');
    }
  };

  const getHeightInCm = (formData, heightUnit) => {
    if (heightUnit === 'ft') {
      const feet = parseInt(formData.heightFeet, 10) || 0;
      const inches = parseInt(formData.heightInches, 10) || 0;
      return Math.round((feet * 12 + inches) * 2.54);
    } else {
      const meters = parseInt(formData.heightMeters, 10) || 0;
      const cm = parseInt(formData.heightCentimeters, 10) || 0;
      return meters * 100 + cm;
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

    if (formData.gender == "")
      return setError('Please select your gender.');

    if ((heightUnit == 'ft' && formData.heightFeet == '0' && formData.heightInches == '0')
      || (heightUnit == 'm' && formData.heightMeters == '0' && formData.heightCentimeters == '0'))
      return setError('Please select your height.');

    if (!images || images.length === 0)
      return setError('Please upload at least one image.');

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

      if (formData.preferredAgeMin && formData.preferredAgeMax) {
        if (parseInt(formData.preferredAgeMin) > parseInt(formData.preferredAgeMax))
          return setError("Min age cannot be greater than max age");
      }

      if (!formData.preferredGenders || formData.preferredGenders.length === 0) {
        return setError("Please select your preferred Gender(s).");
      }

      const profilePayload = {
        birthdate: formData.birthdate,
        gender: formData.gender,
        height: formatHeight(formData, heightUnit),
        preferredAgeMin: formData.preferredAgeMin
          ? parseInt(formData.preferredAgeMin, 10)
          : 18,
        preferredAgeMax: formData.preferredAgeMax
          ? parseInt(formData.preferredAgeMax, 10)
          : 50,
        preferredGenders: formData.preferredGenders ?? [],
        match_radius: Number(formData.matchRadius) ?? 50,
        profileStyle: formData.profileStyle,
        fontFamily: formData.fontFamily,
        imageLayout: formData.imageLayout,
        unit: heightUnit === 'ft' ? 'imperial' : 'metric',
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

      navigation.navigate('Main', {
        screen: 'Matches',
      });

    } catch (err) {
      console.error(err);
      setError("Something went wrong during submission.");
    } finally {
      setLoading(false);
    }
  };

  const setUserHeight = () => {
    if (heightUnit == "ft" && (formData.heightFeet || formData.heightInches)) {
      return `${formData.heightFeet}'${formData.heightInches}"`;
    } else if (heightUnit == "m" && (formData.heightMeters || formData.heightCentimeters)) {
      return `${formData.heightMeters}m ${formData.heightCentimeters}cm`
    } else {
      return "0'0\"";
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
        <View style={[
            styles.stepContainer,
            themeStyles[formData.profileStyle],
        ]}>
          <View style={styles.themeLayer}>
            {formData.profileStyle === 'pixelCloud' && <PixelClouds />}
            {formData.profileStyle === 'pixelFlower' && <PixelFlowers />}
            {formData.profileStyle === 'pixelCactus' && <PixelCactus />}
          </View>
            <EditToolbar
                formData={formData}
                handleInputChange={handleInputChange}
                editing={true}
              />
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
              <TouchableOpacity
                style={[styles.field, styles.dateField, showDatePicker && styles.fieldActive]}
                onPress={() => {
                  setTempBirthdate(
                    formData.birthdate ? new Date(formData.birthdate) : null
                  );
                  setShowDatePicker(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.dateText, !formData.birthdate && styles.placeholderText]}>
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
                      width={SCREEN_WIDTH - 80}
                      minimumDate={new Date(
                        new Date().setFullYear(new Date().getFullYear() - 100)
                      )}
                      todayBackgroundColor="#E9D8FD"
                      selectedDayColor="#6B46C1"
                      selectedDayTextColor="#fff"
                      textStyle={{
                        color: '#111',
                        fontSize: 14,
                      }}
                      dayLabelsWrapper={styles.dayLabelsWrapper}
                      style={{
                        borderRadius: 8,
                        overflow: 'hidden',
                      }}
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
                          update(
                            'birthdate', tempBirthdate.toISOString().split('T')[0]
                          );
                        }
                        setShowDatePicker(false);
                      }}
                    >
                      <Text style={styles.confirmText}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
            </View>
          )}


          <Text style={styles.label}>Gender</Text>
          <SelectGender
            selected={formData.gender}
            onChange={(value) => update("gender", value)}
          />

          <Text style={styles.label}>Height ({heightUnit})</Text>
          <View style={[styles.field, styles.heightGroup]}>
            {heightUnit === 'ft' ? (
              <>
                {/* FEET */}
                <View style={styles.heightPickerWrapper}>
                  <Picker
                    selectedValue={formData.heightFeet}
                    style={styles.pickerSmall}
                    onValueChange={(v) => {
                      update('heightFeet', v);
                      update('heightMeters', '');
                    }}
                  >
                    {Array.from({ length: 8 }, (_, i) => (
                      <Picker.Item key={i} label={`${i}`} value={`${i}`} />
                    ))}
                  </Picker>
                </View>

                <View style={styles.divider} />

                {/* INCHES */}
                <View style={styles.heightPickerWrapper}>
                  <Picker
                    selectedValue={formData.heightInches}
                    style={styles.pickerSmall}
                    onValueChange={(v) => {
                      update('heightInches', v);
                      update('heightCentimeters', '');
                    }}
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <Picker.Item key={i} label={`${i}`} value={`${i}`} />
                    ))}
                  </Picker>
                </View>
              </>
            ) : (
              <>
                {/* METERS */}
                <View style={styles.heightPickerWrapper}>
                  <Picker
                    selectedValue={formData.heightMeters}
                    style={styles.pickerSmall}
                    onValueChange={(v) => {
                      update('heightMeters', v);
                      update('heightFeet', '');
                    }}
                  >
                    {Array.from({ length: 3 }, (_, i) => (
                      <Picker.Item key={i} label={`${i}`} value={`${i}`} />
                    ))}
                  </Picker>
                </View>

                <View style={styles.divider} />

                {/* CENTIMETERS */}
                <View style={styles.heightPickerWrapper}>
                  <Picker
                    selectedValue={formData.heightCentimeters}
                    style={styles.pickerSmall}
                    onValueChange={(v) => {
                      update('heightCentimeters', v);
                      update('heightInches', '');
                    }}
                  >
                    {Array.from({ length: 100 }, (_, i) => (
                      <Picker.Item key={i} label={`${i}`} value={`${i}`} />
                    ))}
                  </Picker>
                </View>
              </>
            )}
          </View>

          <TouchableOpacity onPress={handleUnitToggle}>
            <Text style={styles.toggle}>Switch to {heightUnit === 'ft' ? 'meters' : 'feet'}</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Add Images:</Text>
          <ImageGallery
            images={images}
            editing={true}
            onDeleteImage={handleDeleteImage}
            onPlaceholderClick={handlePlaceholderClick}
            layout={formData.imageLayout}
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
              images: images,
              height: setUserHeight(),
              role: 'user'
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

          <Text style={styles.label}>
            Preferred Age Range ({formData.preferredAgeMin}–{formData.preferredAgeMax})
          </Text>

          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <MultiSlider
              values={[
                Number(formData.preferredAgeMin) || 18,
                Number(formData.preferredAgeMax) || 60,
              ]}
              min={18}
              max={100}
              step={1}
              sliderLength={280}
              onValuesChange={(values) => {
                update('preferredAgeMin', values[0].toString());
                update('preferredAgeMax', values[1].toString());
              }}
              selectedStyle={{ backgroundColor: '#6B46C1' }}
              unselectedStyle={{ backgroundColor: '#E5E7EB' }}
              markerStyle={{
                backgroundColor: '#6B46C1',
                height: 22,
                width: 22,
                borderRadius: 11,
                borderWidth: 0,
              }}
              trackStyle={{ height: 6, borderRadius: 3 }}
              containerStyle={{ height: 40 }}
            />
          </View>


          <Text style={styles.label}>Preferred Genders</Text>
          <MultiSelectGender
            selected={formData.preferredGenders || []}
            onChange={(v) => update("preferredGenders", v)}
          />

          <Text style={styles.label}>
            Match Radius ({formData.matchRadius} {radiusUnit})
          </Text>
          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <MultiSlider
              values={[formData.matchRadius]}
              min={1}
              max={radiusMax}
              step={1}
              sliderLength={280}
              onValuesChange={(values) => {
                update('matchRadius', values[0]);
              }}
              selectedStyle={{ backgroundColor: '#6B46C1' }}
              unselectedStyle={{ backgroundColor: '#E5E7EB' }}
              markerStyle={{
                backgroundColor: '#6B46C1',
                height: 22,
                width: 22,
                borderRadius: 11,
              }}
              trackStyle={{ height: 6, borderRadius: 3 }}
              containerStyle={{ height: 40 }}
              enableLabel={false}
              allowOverlap={false}
              snapped
            />
          </View>

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

const themeStyles = {
  pixelCloud: {
    backgroundColor: '#87CEEB',
  },
  pixelFlower: {
    backgroundColor: '#F2F6FF',
  },
  pixelCactus: {
    backgroundColor: '#FFEBF3',
  },
  minimal: {
    backgroundColor: '#FFFFFF',
  },
  bold: {
    backgroundColor: '#F5F3FF',
  },
  constitution: {
    backgroundColor: '#FDF5D9',
  },
  classic: {
    backgroundColor: '#FFFFFF',
  },
};

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
  stepContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden', // VERY important
    padding: 16,
  },
  themeLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  contentLayer: {
    position: 'relative',
    zIndex: 1,
  },
  field: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
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
  placeholderText: {
    color: '#9CA3AF',
  },
  fieldActive: {
    borderColor: '#6B46C1',
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
    // Add overflow hidden to ensure nothing leaks out of the rounded corners
    overflow: 'hidden',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  calendarWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    // Adding a slight horizontal padding to the wrapper itself
    paddingHorizontal: 10,
  },
  dayLabelsWrapper: {
    borderBottomWidth: 1,
    borderTopWidth: 0,
    borderColor: '#eee',
    paddingBottom: 10,
    // Ensure this doesn't exceed the width of its parent
    width: '100%',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 24,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cancelText: {
    color: '#6B7280',
    fontSize: 16,
  },
  confirmButton: {
    backgroundColor: '#6B46C1',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  confirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    marginBottom: 4,
    fontSize: 16,
  },
  smallInput: {
    flex: 1,
    marginRight: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    justifyContent: 'center',
    backgroundColor: '#fff',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        height: 120,
      },
      android: {
        height: 48,
      },
      default: {
        height: 48,
      },
    }),
  },
  picker: {
    width: '100%',
    ...Platform.select({
      ios: {
        height: 215,
      },
      android: {
        height: 48,
      },
      default: {
        height: 48,
      },
    }),
  },
  pickerSmall: {
    width: '100%',
    paddingTop: 6,
    ...Platform.select({
      ios: {
        height: 215,
      },
      android: {
        height: 50,
      },
      default: {
        height: 50,
      },
    }),
  },
  heightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'visible',
    ...Platform.select({
      ios: {
        height: 215,
      },
      android: {
        height: 50,
      },
      default: {
        height: 50,
      },
    }),
  },
  heightPickerWrapper: {
    flex: 1,
    overflow: 'visible',
    ...Platform.select({
      ios: {
        height: 215,
      },
      android: {
        height: 50,
      },
      default: {
        height: 50,
      },
    }),
  },
  heightInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 16,
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
