import React, { useEffect, useState, useContext, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL } from '../../env';
import { calculateAge, convertFtInToMetersCm, convertMetersCmToFtIn, formatHeight } from './utils/profileUtils';
import ProfileInfoCard from './profileInfoCard';
import PixelClouds from './components/PixelClouds';
import PixelFlowers from './components/PixelFlowers';
import PixelCactus from './components/PixelCactus';
import { Ionicons } from '@expo/vector-icons';
import { UserContext } from '../../context/UserContext';
const Profile = ({ user, framed, viewerUnit, editing, setEditing, onSave, onEditingFormData, parentScrollRef, onRequestCrop }) => {
  const { setUser } = useContext(UserContext);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    birthdate: '',
    gender: '',
    heightFeet: '0',
    heightInches: '0',
    heightMeters: '0',
    heightCentimeters: '0',
    preferredAgeMin: '0',
    preferredAgeMax: '0',
    preferredGenders: [],
    bio: '',
    fontFamily: 'Arial',
    profileStyle: 'classic',
    imageLayout: 'grid',
    show_location: false
  });

  const [images, setImages] = useState([]);
  const [heightUnit, setHeightUnit] = useState('ft');
  const navigation = useNavigation();
  const scrollViewRef = useRef(null);

  useEffect(() => {
    if (user) {
      if (user.images) {
        setImages(user.images);
      }

      const baseFormData = {
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        birthdate: user.birthdate || '',
        gender: user.gender || '',
        bio: user.bio || '',
        preferredAgeMin: user.preferredAgeMin || '',
        preferredAgeMax: user.preferredAgeMax || '',
        preferredGenders: user.preferredGenders || [],
        fontFamily: user.fontFamily || 'Arial',
        profileStyle: user.profileStyle || 'classic',
        imageLayout: user.imageLayout || 'grid',
        show_location: user.show_location ?? false
      };

      const heightString = user.height || "0'0";
      if (heightString.includes("'")) {
        const parts = heightString.split(/'|"/);
        const feet = parts[0] || '0';
        const inches = parts[1] || '0';

        setFormData({
          ...baseFormData,
          heightFeet: feet.toString(),
          heightInches: inches.toString(),
          heightMeters: '0',
          heightCentimeters: '0'
        });
        setHeightUnit('ft');
      } else if (heightString.includes('m')) {
        const parts = heightString.split(' ');
        const meters = parts[0] ? parts[0].replace('m', '') : '0';
        const centimeters = parts[1] ? parts[1].replace('cm', '') : '0';

        setFormData({
          ...baseFormData,
          heightFeet: '0',
          heightInches: '0',
          heightMeters: meters,
          heightCentimeters: centimeters
        });
        setHeightUnit('m');
      } else {
        setFormData(baseFormData);
      }
    }
  }, [user]);

  useEffect(() => {
    if (editing && onEditingFormData) {
      onEditingFormData({ formData, handleInputChange });
    } else if (!editing && onEditingFormData) {
      // Clear form data when editing is turned off
      onEditingFormData(null);
    }
  }, [editing, formData, handleInputChange, onEditingFormData]);

  const handlePlaceholderClick = async () => {
    if (!editing) return;

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
      if (onRequestCrop) {
        onRequestCrop(result.assets[0].uri, handleCropComplete);
      }
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

  const handleInputChange = useCallback((e) => {
    const name = e.target?.name || e.name;
    const value = e.target?.value !== undefined ? e.target.value : e.value;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleUnitToggle = () => {
    if (heightUnit === 'ft') {
      const { meters, centimeters } = convertFtInToMetersCm(formData.heightFeet, formData.heightInches);
      setFormData((prev) => ({ ...prev, heightMeters: meters, heightCentimeters: centimeters }));
      setHeightUnit('m');
    } else {
      const { feet, inches } = convertMetersCmToFtIn(formData.heightMeters, formData.heightCentimeters);
      setFormData((prev) => ({ ...prev, heightFeet: feet, heightInches: inches }));
      setHeightUnit('ft');
    }
  };

  const handleFormSubmit = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const heightFormatted = formatHeight(formData, heightUnit);

      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        birthdate: formData.birthdate,
        gender: formData.gender,
        bio: (formData.bio || '').trim().slice(0, 100),
        height: heightFormatted,
        preferredAgeMin: formData.preferredAgeMin,
        preferredAgeMax: formData.preferredAgeMax,
        preferredGenders: formData.preferredGenders,
        fontFamily: formData.fontFamily,
        profileStyle: formData.profileStyle,
        imageLayout: formData.imageLayout,
        show_location: formData.show_location,
        unit: heightUnit === 'ft' ? 'imperial' : 'metric',
      };

      const res = await fetch(`${API_BASE_URL}/profile/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
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

      if (!res.ok) throw new Error('Failed to update profile');

      const updatedUser = await res.json();

      setUser(prev => ({
        ...prev,
        ...updatedUser,              // keep user data in sync
        unit: payload.unit,          // ← THIS is the critical line
        height: payload.height,      // keep height consistent too
      }));

      Alert.alert('Success', 'Profile updated successfully');
      onSave();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

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

  const formatHeightForViewer = (profile, unit) => {
    if (!profile) return '—';

    if (unit === 'imperial') {
      const feet = profile.height_feet;
      const inches = profile.height_inches;
      if (feet == null && inches == null) return '—';
      return `${feet || 0}' ${inches || 0}"`;
    }

    // metric
    const meters = profile.height_meters;
    const centimeters = profile.height_centimeters;
    if (meters == null && centimeters == null) return '—';

    const totalMeters =
      Number(meters || 0) + Number(centimeters || 0) / 100;

    return `${totalMeters.toFixed(2)} m`;
  };

  const handleCancel = () => {
    setEditing(false);
  };

  if (!user) return null;

  return (
    <ScrollView
        ref={scrollViewRef}
        style={[styles.container, framed && styles.framed, formData.profileStyle === 'pixelCloud' && styles.pixelCloud, formData.profileStyle === 'pixelFlower' && styles.pixelFlower, formData.profileStyle === 'minimal' && styles.minimal, formData.profileStyle === 'bold' && styles.bold, formData.profileStyle === 'classic' && styles.classic]}>
          {formData.profileStyle === 'pixelCloud' && <PixelClouds />}
          {formData.profileStyle === 'pixelFlower' && <PixelFlowers />}
          {formData.profileStyle === 'pixelCactus' && <PixelCactus />}
          {user.role === 'user' && (
        <View style={styles.profileHeader}>
          <View style={styles.nameSection}>
            {!editing && (
              <Text style={[styles.name, { fontFamily: formData.fontFamily }]}>{user.first_name}</Text>
            )}
          </View>
          {!framed && !editing && (
            <View style={styles.profileActions}>
              <TouchableOpacity onPress={() => setEditing(true)}>
                <Ionicons name="create-outline" size={24} color="#6c5ce7" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {user.role === 'user' && (
          <ProfileInfoCard
            user={user}
            formData={formData}
            editing={editing}
            heightUnit={heightUnit}
            viewerUnit={viewerUnit}
            onInputChange={handleInputChange}
            onUnitToggle={handleUnitToggle}
            onSubmit={handleFormSubmit}
            onCancel={handleCancel}
            calculateAge={calculateAge}
            images={images}
            onDeleteImage={handleDeleteImage}
            onPlaceholderClick={handlePlaceholderClick}
            profileStyle={formData.profileStyle}
            scrollToBottom={() => {
                const ref = parentScrollRef || scrollViewRef;
                ref.current?.scrollTo({ y: 300, animated: true });
            }}
          />
      )}

    </ScrollView>
  );
};

export default Profile;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
  },
  card: {
    padding: 16,
    backgroundColor: 'transparent',
  },
  framed: {
    borderWidth: 2,
    borderColor: '#ebe7fb',
    padding: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    padding: 16,
  },
  nameSection: {
    flex: 1,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#222',
  },
  profileActions: {
    flexDirection: 'row',
    gap: 12,
  },
  /* Theme styles */
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
    // subtle frame to mimic papyrus
    borderWidth: 1,
    borderColor: '#eed8a8',
  },
  classic: {
    backgroundColor: '#FFFFFF',
  },
});
