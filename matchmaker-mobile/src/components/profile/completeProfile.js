import React, { useState, useEffect, useContext, useCallback } from 'react';
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
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import BirthdatePickerModal, {
  MONTHS_ABBR,
} from './components/BirthdatePickerModal';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL } from '../../env';
import { fetchWithRetry, isNetworkFailure } from '../../utils/fetchWithRetry';
import {
  calculateAge,
  convertFtInToMetersCm,
  convertMetersCmToFtIn,
  formatHeight,
  normalizeImageLayout,
} from './utils/profileUtils';

import ProfileInfoCard from './profileInfoCard';
import ProfileCard from '../matches/profileCard';
import StepIndicator from './components/stepIndicator';
import MultiSelectGender from './components/multiSelectGender';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import { EditToolbar } from './components/editToolbar';
import PixelClouds from './components/PixelClouds';
import PixelFlowers from './components/PixelFlowers';
import PixelCactus from './components/PixelCactus';
import { UserContext } from '../../context/UserContext';
import { useNotifications } from '../../context/NotificationContext';
import * as Notifications from 'expo-notifications';
import ImageCropModal from './components/ImageCropModal';
import {
  DATER_SCREEN_BG,
  getRoleAccentColor,
  getRoleContainerColor,
} from '../layout/components/RoleHeaderBanner';

const MATCHMAKER_SETUP_STEPS = [{ number: 1, label: 'Setup' }];
const PROFILE_UPDATE_RETRY = { retries: 3, baseDelayMs: 400 };

const getProfileSaveErrorMessage = (err, fallback) =>
  isNetworkFailure(err)
    ? 'Could not reach the server. Check your connection and try again.'
    : fallback;

const CompleteProfile = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const creatingLinkedDater = route.params?.creatingLinkedDater === true;
  const allowLinkedDaterExitRef = React.useRef(false);
  const resetToMainMatches = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main', params: { screen: 'Matches' } }],
    });
  }, [navigation]);

  const resetToLogin = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  }, [navigation]);

  const { setUser: setContextUser } = useContext(UserContext);
  const { enableNotifications } = useNotifications();
  const scrollRef = React.useRef(null);
  const scrollOffsetYRef = React.useRef(0);
  const firstNameRef = React.useRef(null);
  const lastNameRef = React.useRef(null);
  const defaultBirthdate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split('T')[0];
  })();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [heightUnit, setHeightUnit] = useState('ft');
  const [user, setUser] = useState(null);
  const [images, setImages] = useState([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [cropModalVisible, setCropModalVisible] = useState(false);
  /** Queue of items to crop (multi-select order); width/height from picker when available for Android orientation accuracy */
  const [pendingCropQueue, setPendingCropQueue] = useState([]);
  const [cropKey, setCropKey] = useState(0);
  const radiusUnit = heightUnit === 'ft' ? 'mi' : 'km';
  const milesToKm = (mi) => Math.round(mi * 1.60934);
  const kmToMiles = (km) => Math.round(km / 1.60934);
  const radiusMax = radiusUnit === 'km' ? 800 : 500;
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
    bio: '',
    matchRadius: 50,
    matchWithAll: false,
    imageLayout: 'topRow',
    profileStyle: 'classic',
    fontFamily: 'Arial',
    show_location: false,
  });

  const updateProfile = useCallback(async (payload) => {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      const err = new Error('NO_TOKEN');
      throw err;
    }

    const res = await fetchWithRetry(
      `${API_BASE_URL}/profile/update`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      },
      PROFILE_UPDATE_RETRY
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.error || data.msg || 'Profile update failed');
      err.apiError = data;
      throw err;
    }

    return res.json();
  }, []);

  const saveStepToBackend = async (stepNumber) => {
    try {
      await updateProfile({ profile_completion_step: stepNumber });
    } catch (err) {
      if (!isNetworkFailure(err) && __DEV__) {
        console.warn('Error saving profile step:', err);
      }
    }
  };

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

  const applyUserFromProfile = React.useCallback((profileUser) => {
    if (!profileUser) return;

    setUser(profileUser);

    if (profileUser.profile_completion_step) {
      const nextStep =
        profileUser.role === 'matchmaker' && !creatingLinkedDater
          ? 1
          : profileUser.profile_completion_step;
      setStep(nextStep);
    }

    const userUnit = profileUser.unit === 'metric' ? 'm' : 'ft';
    setHeightUnit(userUnit);
    const parsedHeight = parseHeight(profileUser.height, userUnit);
    const radiusMiles = profileUser.match_radius || 50;
    const radiusInUserUnit = userUnit === 'm' ? milesToKm(radiusMiles) : radiusMiles;

    setFormData((prev) => ({
      ...prev,
      first_name: profileUser.first_name ?? '',
      last_name: profileUser.last_name ?? '',
      birthdate: profileUser.birthdate ?? defaultBirthdate,
      gender: profileUser.gender ?? '',
      bio: profileUser.bio ?? '',
      heightFeet: parsedHeight.heightFeet,
      heightInches: parsedHeight.heightInches,
      heightMeters: parsedHeight.heightMeters,
      heightCentimeters: parsedHeight.heightCentimeters,
      preferredAgeMin: profileUser.preferredAgeMin?.toString() ?? '18',
      preferredAgeMax: profileUser.preferredAgeMax?.toString() ?? '50',
      preferredGenders: profileUser.preferredGenders ?? [],
      matchWithAll: profileUser.match_radius >= 9999,
      matchRadius:
        profileUser.match_radius >= 9999
          ? 500
          : userUnit === 'm'
            ? milesToKm(profileUser.match_radius || 50)
            : profileUser.match_radius || 50,
      imageLayout: normalizeImageLayout(profileUser.imageLayout),
      profileStyle: profileUser.profileStyle ?? 'classic',
      fontFamily: profileUser.fontFamily ?? 'Arial',
      show_location: profileUser.show_location ?? false,
    }));

    if (profileUser.images && profileUser.images.length > 0) {
      setImages(profileUser.images);
    }
  }, [creatingLinkedDater, defaultBirthdate, parseHeight]);

  const getSignUpData = async () => {
    setLoading(true);
    try {
      const userRaw = await AsyncStorage.getItem('user');
      if (userRaw) {
        applyUserFromProfile(JSON.parse(userRaw));
      }

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        return;
      }

      const res = await fetchWithRetry(
        `${API_BASE_URL}/profile/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        { retries: 3, baseDelayMs: 400 }
      );

      if (res.ok) {
        const data = await res.json();
        applyUserFromProfile(data.user);
      }
    } catch (err) {
      if (!isNetworkFailure(err) && __DEV__) {
        console.warn('Error loading profile after signup:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getSignUpData();
  }, []);

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (autoSaveFormData.current) {
        clearTimeout(autoSaveFormData.current);
      }
    };
  }, []);

  const abandonCreatingLinkedDater = useCallback(
    async (navigationAction) => {
      try {
        setLoading(true);
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          Alert.alert('Error', 'Please log in');
          resetToLogin();
          return;
        }

        const res = await fetch(`${API_BASE_URL}/profile/delete_account_by_role`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role: 'user' }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          Alert.alert('Error', errorData.error || 'Failed to remove dater account');
          return;
        }

        const data = await res.json();
        if (data.token) {
          await AsyncStorage.setItem('token', data.token);
        }
        if (data.user) {
          await AsyncStorage.setItem('user', JSON.stringify(data.user));
          setContextUser(data.user);
        }

        allowLinkedDaterExitRef.current = true;
        navigation.dispatch(navigationAction);
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to remove dater account');
      } finally {
        setLoading(false);
      }
    },
    [navigation, resetToLogin, setContextUser]
  );

  useEffect(() => {
    if (!creatingLinkedDater) {
      return undefined;
    }
    return navigation.addListener('beforeRemove', (e) => {
      if (allowLinkedDaterExitRef.current) {
        return;
      }
      if (step !== 1) {
        return;
      }
      e.preventDefault();
      Alert.alert(
        'Stop creating a dater account?',
        'If you go back now, this dater account will be deleted and you will return to your matchmaker account.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go back',
            onPress: () => {
              abandonCreatingLinkedDater(e.data.action);
            },
          },
        ],
        { cancelable: true }
      );
    });
  }, [navigation, creatingLinkedDater, step, abandonCreatingLinkedDater]);

  // Auto-save form data to backend (debounced)
  const autoSaveFormData = React.useRef(null);
  const saveFormDataToBackend = async (dataToSave, stepNumber = null) => {
    try {
      const payload = { ...dataToSave };
      if (stepNumber !== null) {
        payload.profile_completion_step = stepNumber;
      }
      await updateProfile(payload);
    } catch (err) {
      // Background auto-save: ignore transient network failures (LogBox treats console.error as a crash).
      if (!isNetworkFailure(err) && __DEV__) {
        console.warn('Error auto-saving form data:', err);
      }
    }
  };

  const update = (name, value) => {
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      if (name === 'matchWithAll') {
        newData.matchRadius = value ? 500 : 50;
      }
      
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

      if (name === 'bio' && step === 1) {
        if (autoSaveFormData.current) {
          clearTimeout(autoSaveFormData.current);
        }

        autoSaveFormData.current = setTimeout(() => {
          saveFormDataToBackend({
            bio: String(value || '').trim().slice(0, 100),
          });
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
      
      // Auto-save location visibility when changed on step 1 or step 3
      if (name === 'show_location' && (step === 1 || step === 3)) {
        if (autoSaveFormData.current) {
          clearTimeout(autoSaveFormData.current);
        }

        autoSaveFormData.current = setTimeout(() => {
          saveFormDataToBackend({
            show_location: Boolean(value),
          });
        }, 500);
      }

      // Auto-save preferences when changed (for step 3)
      if (['preferredAgeMin', 'preferredAgeMax', 'preferredGenders', 'matchRadius', 'matchWithAll'].includes(name) && step === 3) {
        if (autoSaveFormData.current) {
          clearTimeout(autoSaveFormData.current);
        }
        
        autoSaveFormData.current = setTimeout(() => {
          const saveData = {};
          if (name === 'preferredAgeMin') saveData.preferredAgeMin = parseInt(value, 10);
          if (name === 'preferredAgeMax') saveData.preferredAgeMax = parseInt(value, 10);
          if (name === 'preferredGenders') saveData.preferredGenders = value;
          if (name === 'matchRadius' || name === 'matchWithAll') {
            saveData.match_radius = newData.matchWithAll ? 9999 : (heightUnit === 'ft' ? Number(newData.matchRadius) : kmToMiles(Number(newData.matchRadius)));
          }
          if (Object.keys(saveData).length) saveFormDataToBackend(saveData);
        }, 1000);
      }
      
      return newData;
    });
  };

  const handleInputChange = (e) => {
    const name = e.target?.name || e.name;
    const value = e.target?.value !== undefined ? e.target.value : e.value;
    update(name, value);
  };

  const handleUnitToggle = () => {
    if (heightUnit === 'ft') {
      // ft (mi) -> m (km)
      const { meters, centimeters } = convertFtInToMetersCm(
        formData.heightFeet,
        formData.heightInches
      );

      const nextFormData = {
        ...formData,
        heightMeters: meters,
        heightCentimeters: centimeters,
        matchRadius: formData.matchWithAll ? 500 : milesToKm(Number(formData.matchRadius)),
      };

      setFormData(nextFormData);

      setHeightUnit('m');

      saveFormDataToBackend({
        height: formatHeight(nextFormData, 'm'),
        unit: 'metric',
      });
    } else {
      // m (km) -> ft (mi)
      const { feet, inches } = convertMetersCmToFtIn(
        formData.heightMeters,
        formData.heightCentimeters
      );

      const nextFormData = {
        ...formData,
        heightFeet: feet,
        heightInches: inches,
        matchRadius: formData.matchWithAll ? 500 : kmToMiles(Number(formData.matchRadius)),
      };

      setFormData(nextFormData);

      setHeightUnit('ft');

      saveFormDataToBackend({
        height: formatHeight(nextFormData, 'ft'),
        unit: 'imperial',
      });
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
      await updateProfile({
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        birthdate: formData.birthdate,
        gender: formData.gender,
        bio: (formData.bio || '').trim().slice(0, 100),
        height: formatHeight(formData, heightUnit),
        unit: heightUnit === 'ft' ? 'imperial' : 'metric',
        show_location: formData.show_location ?? false,
        profile_completion_step: 2,
      });
    } catch (err) {
      if (!isNetworkFailure(err) && __DEV__) {
        console.warn('Error saving step 1 data:', err);
      }
    }

    setStep(2);
    saveStepToBackend(2);
  };

  const saveMatchmakerProfile = async () => {
    setError('');

    if (!formData.first_name.trim()) {
      return setError('First name is required.');
    }
    if (!formData.last_name.trim()) {
      return setError('Last name is required.');
    }
    if (!formData.birthdate) {
      return setError('Please select your birthdate.');
    }
    if (calculateAge(formData.birthdate) < 18) {
      return setError('You must be at least 18.');
    }

    setLoading(true);
    try {
      const updatedUser = await updateProfile({
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        birthdate: formData.birthdate,
        profile_completion_step: null,
      });

      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setContextUser(updatedUser);

      Alert.alert(
        'Enable Notifications?',
        'Would you like to receive push notifications for new messages and matches?',
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: resetToMainMatches,
          },
          {
            text: 'Enable',
            onPress: async () => {
              await requestNotificationPermissions();
              resetToMainMatches();
            },
          },
        ],
        { cancelable: false }
      );
    } catch (err) {
      if (err?.message === 'NO_TOKEN') {
        setError('Session expired. Please log in again.');
      } else {
        setError(getProfileSaveErrorMessage(err, 'Something went wrong. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
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
        bio: (formData.bio || '').trim().slice(0, 100),
        height: formatHeight(formData, heightUnit),
        preferredAgeMin: formData.preferredAgeMin
          ? parseInt(formData.preferredAgeMin, 10)
          : 18,
        preferredAgeMax: formData.preferredAgeMax
          ? parseInt(formData.preferredAgeMax, 10)
          : 50,
        preferredGenders: formData.preferredGenders ?? [],
        match_radius: formData.matchWithAll ? 9999 : (heightUnit === 'ft' ? (Number(formData.matchRadius) ?? 50) : (kmToMiles(Number(formData.matchRadius)) ?? 31)),
        show_location: formData.show_location ?? false,
        profileStyle: formData.profileStyle,
        fontFamily: formData.fontFamily,
        imageLayout: normalizeImageLayout(formData.imageLayout),
        unit: heightUnit === 'ft' ? 'imperial' : 'metric',
        profile_completion_step: null, // Clear step when profile is completed
      };

      const updatedUser = await updateProfile(profilePayload);
      
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
              resetToMainMatches();
            },
          },
          {
            text: 'Enable',
            onPress: async () => {
              // User wants to enable - request permissions
              await requestNotificationPermissions();
              resetToMainMatches();
            },
          },
        ],
        { cancelable: false }
      );

    } catch (err) {
      if (err?.message === 'NO_TOKEN') {
        setError('Session expired. Please log in again.');
      } else {
        setError(getProfileSaveErrorMessage(err, 'Something went wrong during submission.'));
      }
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
            if (!isNetworkFailure(err) && __DEV__) {
              console.warn('Error enabling notifications:', err);
            }
          }
        }, 500);
      } else {
        // User denied permissions - that's fine, they can enable later
        console.log('User denied notification permissions during profile completion');
      }
    } catch (error) {
      if (!isNetworkFailure(error) && __DEV__) {
        console.warn('Error requesting notification permissions during profile completion:', error);
      }
    }
  };

  const handleDeleteImage = async (imageId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        resetToLogin();
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
          resetToLogin();
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
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled && result.assets?.length) {
      const items = result.assets.map((a) => ({
        uri: a.uri,
        width: typeof a.width === 'number' && a.width > 0 ? a.width : undefined,
        height: typeof a.height === 'number' && a.height > 0 ? a.height : undefined,
      }));
      setPendingCropQueue(items);
      setCropModalVisible(true);
      setCropKey((prev) => prev + 1);
    }
  };

  const handleCropComplete = async (imageAsset) => {
    if (!imageAsset) return;

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        resetToLogin();
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
          resetToLogin();
          return;
        }
      }

      if (!response.ok) throw new Error('Failed to upload image');

      const newImage = await response.json();
      setImages((prevImages) => [...prevImages, newImage]);

      // Advance to next image in queue, or close modal
      setPendingCropQueue((prev) => {
        const next = prev.slice(1);
        if (next.length === 0) {
          setCropModalVisible(false);
          return [];
        }
        setCropKey((k) => k + 1);
        return next;
      });
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to upload image');
    }
  };

  const isMatchmakerProfileSetup = user?.role === 'matchmaker' && !creatingLinkedDater;
  const setupAccentColor = isMatchmakerProfileSetup
    ? getRoleAccentColor('matchmaker')
    : '#ef4d73';
  const setupHeaderBg = isMatchmakerProfileSetup
    ? getRoleContainerColor('matchmaker')
    : '#ffe6ee';
  const setupScreenBg = isMatchmakerProfileSetup ? '#f5f2ff' : '#ffeef4';
  const isDaterPreviewStep = !isMatchmakerProfileSetup && step === 2;
  const isDaterBlendedLayout = !isMatchmakerProfileSetup && step >= 1 && step <= 3;
  const screenBg = isDaterBlendedLayout ? DATER_SCREEN_BG : setupScreenBg;
  const headerBg = isDaterBlendedLayout ? DATER_SCREEN_BG : setupHeaderBg;
  const fixedFooterPaddingBottom = Math.max(insets.bottom, 8) + 16;
  const hasFixedFooter = step === 1 || isDaterPreviewStep;

  const proceedToStep3 = async () => {
    try {
      await updateProfile({
        preferredAgeMin: formData.preferredAgeMin ? parseInt(formData.preferredAgeMin, 10) : 18,
        preferredAgeMax: formData.preferredAgeMax ? parseInt(formData.preferredAgeMax, 10) : 50,
        preferredGenders: formData.preferredGenders ?? [],
        match_radius: formData.matchWithAll
          ? 9999
          : heightUnit === 'ft'
            ? Number(formData.matchRadius) ?? 50
            : kmToMiles(Number(formData.matchRadius)) ?? 31,
        show_location: formData.show_location ?? false,
        profile_completion_step: 3,
      });
    } catch (err) {
      if (!isNetworkFailure(err) && __DEV__) {
        console.warn('Error saving preferences:', err);
      }
    }
    setStep(3);
    saveStepToBackend(3);
  };

  return (
    <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.screen, { backgroundColor: screenBg }]}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={[styles.fixedHeader, { backgroundColor: headerBg }]}>
          <StepIndicator
            step={step}
            steps={isMatchmakerProfileSetup ? MATCHMAKER_SETUP_STEPS : undefined}
            accentColor={setupAccentColor}
            headerBackgroundColor={headerBg}
          />
          {step === 1 && !isMatchmakerProfileSetup && (
            <EditToolbar
              formData={formData}
              handleInputChange={handleInputChange}
              editing={true}
              accentColorOverride="#ef4d73"
              sticky
            />
          )}
        </View>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, backgroundColor: screenBg }}
          contentContainerStyle={[
            styles.container,
            isDaterBlendedLayout && step !== 1 && styles.containerPreview,
            hasFixedFooter && { paddingBottom: fixedFooterPaddingBottom + 72 },
          ]}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={(event) => {
            scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
          }}
        >

          {step === 1 && (
            <View>
              {!isMatchmakerProfileSetup ? (
                <>
                  <ProfileInfoCard
                    user={{
                      role: 'user',
                      city: user?.city ?? '',
                      state: user?.state ?? '',
                    }}
                    formData={formData}
                    editing={true}
                    heightUnit={heightUnit}
                    viewerUnit={heightUnit}
                    onInputChange={handleInputChange}
                    onUnitToggle={handleUnitToggle}
                    onSubmit={() => {}}
                    onCancel={() => {}}
                    calculateAge={calculateAge}
                    images={images}
                    onDeleteImage={handleDeleteImage}
                    onPlaceholderClick={handlePlaceholderClick}
                    pageBackgroundColor={DATER_SCREEN_BG}
                  />
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                </>
              ) : (
                <View style={[styles.stepContainer, themeStyles[formData.profileStyle]]}>
                  <View style={styles.themeLayer}>
                    {formData.profileStyle === 'pixelCloud' && <PixelClouds />}
                    {formData.profileStyle === 'pixelFlower' && <PixelFlowers />}
                    {formData.profileStyle === 'pixelCactus' && <PixelCactus />}
                  </View>
                  <View style={styles.contentLayer}>
                    <Text style={styles.title}>Complete Your Profile</Text>

                    <Text style={styles.label}>First Name</Text>
                    <TextInput
                      ref={firstNameRef}
                      style={styles.input}
                      value={formData.first_name}
                      onChangeText={(v) => update('first_name', v)}
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
                      onChangeText={(v) => update('last_name', v)}
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        lastNameRef.current?.blur();
                        setShowDatePicker(true);
                      }}
                    />

                    <Text style={styles.label}>Birthdate</Text>
                    <TouchableOpacity
                      style={[
                        styles.field,
                        styles.dateField,
                        showDatePicker && { borderColor: setupAccentColor },
                      ]}
                      onPress={() => {
                        Keyboard.dismiss();
                        setShowDatePicker(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.dateText, !formData.birthdate && styles.placeholderText]}>
                        {formData.birthdate
                          ? (() => {
                              const [y, m, d] = formData.birthdate.split('-').map(Number);
                              const dt = new Date(y, m - 1, d);
                              return `${MONTHS_ABBR[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
                            })()
                          : 'Birthday'}
                      </Text>
                    </TouchableOpacity>

                    <BirthdatePickerModal
                      visible={showDatePicker}
                      birthdateIso={formData.birthdate || ''}
                      onRequestClose={() => setShowDatePicker(false)}
                      onSave={(iso) => {
                        update('birthdate', iso);
                        setShowDatePicker(false);
                      }}
                      accentColor={setupAccentColor}
                    />

                    {error ? <Text style={styles.error}>{error}</Text> : null}
                  </View>
                </View>
              )}
            </View>
          )}

          {!isMatchmakerProfileSetup && step === 2 && (
            <View>
              <ProfileCard
                profile={{
                  id: user?.id,
                  first_name: formData.first_name,
                  last_name: formData.last_name,
                  birthdate: formData.birthdate,
                  gender: formData.gender,
                  bio: formData.bio,
                  city: user?.city ?? '',
                  state: user?.state ?? '',
                  show_location: formData.show_location,
                  images,
                  height: formatHeight(formData, heightUnit),
                  unit: heightUnit === 'ft' ? 'imperial' : 'metric',
                  imageLayout: normalizeImageLayout(formData.imageLayout),
                  profileStyle: formData.profileStyle,
                }}
                userInfo={{
                  role: 'user',
                  unit: heightUnit === 'ft' ? 'imperial' : 'metric',
                }}
                blendWithBackground
              />
            </View>
          )}

          {!isMatchmakerProfileSetup && step === 3 && (
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
                  selectedStyle={{ backgroundColor: '#ef4d73' }}
                  unselectedStyle={{ backgroundColor: '#E5E7EB' }}
                  markerStyle={{
                    backgroundColor: '#ef4d73',
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
                accentColor="#ef4d73"
              />

              <Text style={styles.label}>
                Match Radius ({formData.matchWithAll ? '500+' : formData.matchRadius} {radiusUnit})
              </Text>
              <View style={[formData.matchWithAll && { opacity: 0.5 }, { alignItems: 'center', marginTop: 10 }]}>
                <MultiSlider
                  values={[formData.matchRadius]}
                  min={1}
                  max={radiusMax}
                  step={1}
                  sliderLength={280}
                  onValuesChange={(values) => {
                    if (!formData.matchWithAll) update('matchRadius', values[0]);
                  }}
                  selectedStyle={{ backgroundColor: '#ef4d73' }}
                  unselectedStyle={{ backgroundColor: '#E5E7EB' }}
                  markerStyle={{
                    backgroundColor: '#ef4d73',
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

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => update('matchWithAll', !formData.matchWithAll)}
              >
                <View style={[styles.checkbox, formData.matchWithAll && styles.checkboxChecked]}>
                  {formData.matchWithAll && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>No distance limit</Text>
              </TouchableOpacity>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              {loading ? (
                <ActivityIndicator size="large" color="#ef4d73" />
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

        {step === 1 && (
          <View
            style={[
              styles.stepFooter,
              { backgroundColor: screenBg, paddingBottom: fixedFooterPaddingBottom },
            ]}
          >
            {isMatchmakerProfileSetup ? (
              loading ? (
                <ActivityIndicator size="large" color={setupAccentColor} />
              ) : (
                <TouchableOpacity
                  style={[styles.nextBtn, styles.stepFooterBtn, { backgroundColor: setupAccentColor }]}
                  onPress={saveMatchmakerProfile}
                >
                  <Text style={styles.nextBtnText}>Continue</Text>
                </TouchableOpacity>
              )
            ) : (
              <TouchableOpacity style={[styles.nextBtn, styles.stepFooterBtn]} onPress={saveStep1}>
                <Text style={styles.nextBtnText}>Next</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {isDaterPreviewStep && (
          <View
            style={[
              styles.stepFooter,
              { backgroundColor: screenBg, paddingBottom: fixedFooterPaddingBottom },
            ]}
          >
            <View style={[styles.rowBetween, styles.stepFooterActions]}>
              <TouchableOpacity
                style={[styles.secondaryBtn, styles.stepFooterBtn]}
                onPress={() => {
                  setStep(1);
                  saveStepToBackend(1);
                }}
              >
                <Text style={styles.secondaryBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nextBtn, styles.stepFooterBtn]}
                onPress={proceedToStep3}
              >
                <Text style={styles.nextBtnText}>Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      <ImageCropModal
        key={cropKey}
        visible={cropModalVisible}
        imageUri={pendingCropQueue[0]?.uri ?? null}
        sourceWidth={pendingCropQueue[0]?.width}
        sourceHeight={pendingCropQueue[0]?.height}
        onCropComplete={handleCropComplete}
        onCancel={() => {
          setCropModalVisible(false);
          setPendingCropQueue([]);
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
  screen: {
    flex: 1,
    backgroundColor: '#ffeef4',
  },
  fixedHeader: {
    backgroundColor: '#ffe6ee',
    zIndex: 10,
  },
  container: {
    padding: 20,
    paddingBottom: 80,
    paddingTop: 12,
  },
  containerPreview: {
    paddingTop: 0,
    paddingHorizontal: 20,
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
    overflow: 'visible',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 44,
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
    borderColor: '#ef4d73',
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
  aboutInput: {
    minHeight: 92,
    paddingTop: 10,
    marginBottom: 0,
  },
  charCount: {
    marginTop: 4,
    marginBottom: 4,
    textAlign: 'right',
    color: '#6B7280',
    fontSize: 12,
  },
  smallInput: {
    flex: 1,
    marginRight: 8,
  },
  toggle: {
    marginTop: 8,
    color: '#ef4d73',
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
  stepFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  stepFooterActions: {
    marginTop: 0,
  },
  stepFooterBtn: {
    marginTop: 0,
  },
  nextBtn: {
    backgroundColor: '#ef4d73',
    padding: 14,
    borderRadius: 10,
    marginTop: 20,
  },
  nextBtnText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryBtn: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ef4d73',
    marginTop: 20,
  },
  secondaryBtnText: {
    color: '#ef4d73',
    fontWeight: '700',
  },
  error: {
    marginTop: 10,
    color: 'red',
    textAlign: 'center',
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
    borderColor: '#ef4d73',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#ef4d73',
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
});
