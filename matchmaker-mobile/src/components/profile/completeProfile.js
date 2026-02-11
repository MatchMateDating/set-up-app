import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import Slider from '@react-native-community/slider';
import CalendarPicker from "react-native-calendar-picker";
import ImageGallery from './images';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL } from '../../env';
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
import { UserContext } from '../../context/UserContext';
import { useNotifications } from '../../context/NotificationContext';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import ImageCropModal from './components/ImageCropModal';

const CompleteProfile = () => {
  const navigation = useNavigation();
  const { setUser: setContextUser } = useContext(UserContext);
  const { enableNotifications } = useNotifications();
  const scrollRef = React.useRef(null);
  const firstNameRef = React.useRef(null);
  const lastNameRef = React.useRef(null);
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
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState(null);
  const [cropKey, setCropKey] = useState(0);
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
    profileStyle: 'classic',
    fontFamily: 'Arial',
  });

  const saveStepToBackend = async (stepNumber) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      await fetch(`${API_BASE_URL}/profile/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ profile_completion_step: stepNumber }),
      });
    } catch (err) {
      console.error('Error saving step:', err);
      // Don't show error to user - this is a background operation
    }
  };

  const getSignUpData = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Fetch fresh user data from backend
      const res = await fetch(`${API_BASE_URL}/profile/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const user = data.user;
        setUser(user);
        
        // Restore step if user was in the middle of completing profile
        if (user.profile_completion_step) {
          setStep(user.profile_completion_step);
        }

        // Determine height unit from user's unit preference
        const userUnit = user.unit === 'metric' ? 'm' : 'ft';
        setHeightUnit(userUnit);

        // Parse height from backend format
        const parsedHeight = parseHeight(user.height, userUnit);

        // Load existing user data into form
        setFormData(prev => ({
          ...prev,
          first_name: user.first_name ?? '',
          last_name: user.last_name ?? '',
          birthdate: user.birthdate ?? defaultBirthdate,
          gender: user.gender ?? '',
          heightFeet: parsedHeight.heightFeet,
          heightInches: parsedHeight.heightInches,
          heightMeters: parsedHeight.heightMeters,
          heightCentimeters: parsedHeight.heightCentimeters,
          preferredAgeMin: user.preferredAgeMin?.toString() ?? '18',
          preferredAgeMax: user.preferredAgeMax?.toString() ?? '50',
          preferredGenders: user.preferredGenders ?? [],
          matchRadius: user.match_radius ?? 50,
          imageLayout: user.imageLayout ?? 'grid',
          profileStyle: user.profileStyle ?? 'classic',
          fontFamily: user.fontFamily ?? 'Arial',
        }));

        // Load images if available
        if (user.images && user.images.length > 0) {
          setImages(user.images);
        }
      } else {
        // Fallback to AsyncStorage
        const userRaw = await AsyncStorage.getItem('user');
        if (userRaw) {
          const user = JSON.parse(userRaw);
          setUser(user);
          if (user.profile_completion_step) {
            setStep(user.profile_completion_step);
          }
          
          const userUnit = user.unit === 'metric' ? 'm' : 'ft';
          setHeightUnit(userUnit);
          const parsedHeight = parseHeight(user.height, userUnit);
          
          setFormData(prev => ({
            ...prev,
            first_name: user.first_name ?? '',
            last_name: user.last_name ?? '',
            birthdate: user.birthdate ?? defaultBirthdate,
            gender: user.gender ?? '',
            heightFeet: parsedHeight.heightFeet,
            heightInches: parsedHeight.heightInches,
            heightMeters: parsedHeight.heightMeters,
            heightCentimeters: parsedHeight.heightCentimeters,
            preferredAgeMin: user.preferredAgeMin?.toString() ?? '18',
            preferredAgeMax: user.preferredAgeMax?.toString() ?? '50',
            preferredGenders: user.preferredGenders ?? [],
            matchRadius: user.match_radius ?? 50,
            imageLayout: user.imageLayout ?? 'grid',
            profileStyle: user.profileStyle ?? 'classic',
            fontFamily: user.fontFamily ?? 'Arial',
          }));
        }
      }
    } catch (err) {
      console.error(err);
      // Fallback to AsyncStorage on error
      try {
        const userRaw = await AsyncStorage.getItem('user');
        if (userRaw) {
          const user = JSON.parse(userRaw);
          setUser(user);
          if (user.profile_completion_step) {
            setStep(user.profile_completion_step);
          }
        }
      } catch (e) {
        console.error('Error reading from AsyncStorage:', e);
      }
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
    
    // Cleanup timeout on unmount
    return () => {
      if (autoSaveFormData.current) {
        clearTimeout(autoSaveFormData.current);
      }
    };
  }, [heightUnit]);

  // Parse height from backend format (e.g., "5'10\"" or "1m 78cm") to formData format
  const parseHeight = React.useCallback((heightString, unit) => {
    if (!heightString) return { heightFeet: '0', heightInches: '0', heightMeters: '0', heightCentimeters: '0' };
    
    if (unit === 'ft' || heightString.includes("'")) {
      // Parse format like "5'10\""
      const match = heightString.match(/(\d+)'(\d+)"/);
      if (match) {
        return {
          heightFeet: match[1],
          heightInches: match[2],
          heightMeters: '0',
          heightCentimeters: '0',
        };
      }
    } else if (unit === 'm' || heightString.includes('m')) {
      // Parse format like "1m 78cm"
      const match = heightString.match(/(\d+)m\s*(\d+)cm/);
      if (match) {
        return {
          heightFeet: '0',
          heightInches: '0',
          heightMeters: match[1],
          heightCentimeters: match[2],
        };
      }
    }
    return { heightFeet: '0', heightInches: '0', heightMeters: '0', heightCentimeters: '0' };
  }, []);

  // Auto-save form data to backend (debounced)
  const autoSaveFormData = React.useRef(null);
  const saveFormDataToBackend = async (dataToSave, stepNumber = null) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const payload = { ...dataToSave };
      if (stepNumber !== null) {
        payload.profile_completion_step = stepNumber;
      }

      await fetch(`${API_BASE_URL}/profile/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Error auto-saving form data:', err);
      // Don't show error to user - this is a background operation
    }
  };

  const update = (name, value) => {
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      // Auto-save certain fields immediately
      if (['first_name', 'last_name', 'birthdate', 'gender'].includes(name)) {
        // Clear any pending auto-save
        if (autoSaveFormData.current) {
          clearTimeout(autoSaveFormData.current);
        }
        
        // Debounce auto-save by 500ms
        autoSaveFormData.current = setTimeout(() => {
          const saveData = {};
          if (name === 'first_name') saveData.first_name = value.trim();
          if (name === 'last_name') saveData.last_name = value.trim();
          if (name === 'birthdate') saveData.birthdate = value;
          if (name === 'gender') saveData.gender = value;
          
          saveFormDataToBackend(saveData);
        }, 500);
      }
      
      // Auto-save height when changed (for step 1)
      if (['heightFeet', 'heightInches', 'heightMeters', 'heightCentimeters'].includes(name) && step === 1) {
        if (autoSaveFormData.current) {
          clearTimeout(autoSaveFormData.current);
        }
        
        autoSaveFormData.current = setTimeout(() => {
          const height = formatHeight(newData, heightUnit);
          saveFormDataToBackend({
            height: height,
            unit: heightUnit === 'ft' ? 'imperial' : 'metric',
          });
        }, 1000);
      }
      
      // Auto-save preferences when changed (for step 3)
      if (['preferredAgeMin', 'preferredAgeMax', 'preferredGenders', 'matchRadius'].includes(name) && step === 3) {
        if (autoSaveFormData.current) {
          clearTimeout(autoSaveFormData.current);
        }
        
        autoSaveFormData.current = setTimeout(() => {
          const saveData = {};
          if (name === 'preferredAgeMin') saveData.preferredAgeMin = parseInt(value, 10);
          if (name === 'preferredAgeMax') saveData.preferredAgeMax = parseInt(value, 10);
          if (name === 'preferredGenders') saveData.preferredGenders = value;
          if (name === 'matchRadius') saveData.match_radius = Number(value);
          
          saveFormDataToBackend(saveData);
        }, 1000);
      }
      
      return newData;
    });
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

    // Save all step 1 data to backend
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        const height = formatHeight(formData, heightUnit);
        await fetch(`${API_BASE_URL}/profile/update`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            birthdate: formData.birthdate,
            gender: formData.gender,
            height: height,
            unit: heightUnit === 'ft' ? 'imperial' : 'metric',
            profile_completion_step: 2,
          }),
        });
      }
    } catch (err) {
      console.error('Error saving step 1 data:', err);
      // Don't block user from proceeding, but log the error
    }

    setStep(2);
    saveStepToBackend(2);
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
        first_name: formData.first_name,
        last_name: formData.last_name,
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
        profile_completion_step: null, // Clear step when profile is completed
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

      // Get the updated user data from the response
      const updatedUser = await updateRes.json();
      
      // Update AsyncStorage and UserContext with the updated user (including unit)
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setContextUser(updatedUser);

      // Ask user if they want to enable notifications after profile completion
      Alert.alert(
        'Enable Notifications?',
        'Would you like to receive push notifications for new messages and matches?',
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: () => {
              navigation.navigate('Main', {
                screen: 'Matches',
              });
            },
          },
          {
            text: 'Enable',
            onPress: async () => {
              // User wants to enable - request permissions
              await requestNotificationPermissions();
              // Navigate after handling notifications
              navigation.navigate('Main', {
                screen: 'Matches',
              });
            },
          },
        ],
        { cancelable: false }
      );

    } catch (err) {
      console.error(err);
      setError("Something went wrong during submission.");
    } finally {
      setLoading(false);
    }
  };

  const requestNotificationPermissions = async () => {
    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus === 'granted') {
        // Enable notifications in the context (this will save to backend)
        // Wait a moment for UserContext to update with the new user
        setTimeout(async () => {
          try {
            await enableNotifications();
          } catch (err) {
            console.error('Error enabling notifications:', err);
            // This is okay - user can enable notifications later in settings
          }
        }, 500);
        
        // Get push token and register with backend
        if (Platform.OS !== 'web') {
          try {
            // Try to get projectId from Constants
            let projectId = null;
            try {
              if (Constants.expoConfig?.extra?.eas?.projectId) {
                projectId = Constants.expoConfig.extra.eas.projectId;
              } else if (Constants.expoConfig?.extra?.projectId) {
                projectId = Constants.expoConfig.extra.projectId;
              } else if (Constants.manifest2?.extra?.eas?.projectId) {
                projectId = Constants.manifest2.extra.eas.projectId;
              }
            } catch (e) {
              console.log('Could not get projectId from Constants:', e);
            }

            if (projectId && projectId !== 'your-project-id-here' && projectId !== 'matchmate') {
              const token = await Notifications.getExpoPushTokenAsync({ projectId });
              
              // Register push token with backend using the new notifications endpoint
              const authToken = await AsyncStorage.getItem('token');
              if (authToken) {
                await fetch(`${API_BASE_URL}/notifications/register_token`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                  },
                  body: JSON.stringify({ push_token: token.data }),
                });
              }
            }
          } catch (error) {
            console.log('Could not get push token during profile completion:', error);
            // This is okay - user can enable notifications later in settings
          }
        }
      } else {
        // User denied permissions - that's fine, they can enable later
        console.log('User denied notification permissions during profile completion');
      }
    } catch (error) {
      console.error('Error requesting notification permissions during profile completion:', error);
      // Don't block navigation if notification request fails
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
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImageUri(result.assets[0].uri);
      setCropModalVisible(true);
      setCropKey(prev => prev + 1);
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
    <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <View style={styles.fixedHeader}>
          <StepIndicator step={step} />
          {step === 1 && (
            <EditToolbar
              formData={formData}
              handleInputChange={handleInputChange}
              editing={true}
            />
          )}
        </View>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >

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
              <Text style={styles.title}>Complete Your Profile</Text>

                  <Text style={styles.label}>First Name</Text>
                  <TextInput
                    ref={firstNameRef}
                    style={styles.input}
                    value={formData.first_name}
                    onChangeText={(v) => update("first_name", v)}
                    returnKeyType="next"
                    onSubmitEditing={() => {
                      lastNameRef.current?.focus();
                    }}
                    blurOnSubmit={false}
                  />

                  <Text style={styles.label}>Last Name</Text>
                  <TextInput
                    ref={lastNameRef}
                    style={styles.input}
                    value={formData.last_name}
                    onChangeText={(v) => update("last_name", v)}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      lastNameRef.current?.blur();
                      // Open date picker
                      setTempBirthdate(
                        formData.birthdate
                          ? (() => {
                              const [year, month, day] = formData.birthdate.split('-').map(Number);
                              return new Date(year, month - 1, day);
                            })()
                          : null
                      );
                      setShowDatePicker(true);
                      setTimeout(() => {
                        scrollRef.current?.scrollTo({
                          y: 300,
                          animated: true,
                        });
                      }, 200);
                    }}
                  />

                  <Text style={styles.label}>Birthdate</Text>
                  <TouchableOpacity
                    style={[styles.field, styles.dateField, showDatePicker && styles.fieldActive]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setTempBirthdate(
                        formData.birthdate
                          ? (() => {
                              const [year, month, day] = formData.birthdate.split('-').map(Number);
                              return new Date(year, month - 1, day); // month is 0-indexed
                            })()
                          : null
                      );
                      setShowDatePicker(true);
                      setTimeout(() => {
                            scrollRef.current?.scrollTo({
                              y: 300, // adjust if needed
                              animated: true,
                            });
                          }, 200);
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
                          selectedDayColor="#6c5ce7"
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
              <TouchableOpacity style={styles.skipBtn} onPress={() => {
                setStep(3);
                saveStepToBackend(3);
              }}>
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
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => {
                  setStep(1);
                  saveStepToBackend(1);
                }}>
                  <Text style={styles.secondaryBtnText}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.nextBtn} onPress={async () => {
                  // Save preferences before moving to step 3
                  try {
                    const token = await AsyncStorage.getItem('token');
                    if (token) {
                      await fetch(`${API_BASE_URL}/profile/update`, {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                          preferredAgeMin: formData.preferredAgeMin ? parseInt(formData.preferredAgeMin, 10) : 18,
                          preferredAgeMax: formData.preferredAgeMax ? parseInt(formData.preferredAgeMax, 10) : 50,
                          preferredGenders: formData.preferredGenders ?? [],
                          match_radius: Number(formData.matchRadius) ?? 50,
                          profile_completion_step: 3,
                        }),
                      });
                    }
                  } catch (err) {
                    console.error('Error saving preferences:', err);
                  }
                  setStep(3);
                  saveStepToBackend(3);
                }}>
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
                  selectedStyle={{ backgroundColor: '#6c5ce7' }}
                  unselectedStyle={{ backgroundColor: '#E5E7EB' }}
                  markerStyle={{
                    backgroundColor: '#6c5ce7',
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
                  selectedStyle={{ backgroundColor: '#6c5ce7' }}
                  unselectedStyle={{ backgroundColor: '#E5E7EB' }}
                  markerStyle={{
                    backgroundColor: '#6c5ce7',
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
                <ActivityIndicator size="large" color="#6c5ce7" />
              ) : (
                <View style={styles.rowBetween}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => {
                    setStep(2);
                    saveStepToBackend(2);
                  }}>
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

      <ImageCropModal
        key={cropKey}
        visible={cropModalVisible}
        imageUri={selectedImageUri}
        onCropComplete={(croppedImage) => {
          setCropModalVisible(false);
          setSelectedImageUri(null);
          handleCropComplete(croppedImage);
        }}
        onCancel={() => {
          setCropModalVisible(false);
          setSelectedImageUri(null);
        }}
      />
    </KeyboardAvoidingView>
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
  fixedHeader: {
    backgroundColor: '#ebe7fb',
    zIndex: 10,
  },
  container: {
    padding: 20,
    paddingBottom: 80,
    paddingTop: 12,
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
    borderColor: '#6c5ce7',
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
    backgroundColor: '#6c5ce7',
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
    color: '#6c5ce7',
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
    backgroundColor: '#6c5ce7',
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
    borderColor: '#6c5ce7',
    marginTop: 20,
  },
  skipBtnText: {
    color: '#6c5ce7',
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryBtn: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6c5ce7',
    marginTop: 20,
  },
  secondaryBtnText: {
    color: '#6c5ce7',
    fontWeight: '700',
  },
  error: {
    marginTop: 10,
    color: 'red',
    textAlign: 'center',
  },
});
