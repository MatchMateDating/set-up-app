import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL } from '@env';
import { calculateAge, convertFtInToMetersCm, convertMetersCmToFtIn, formatHeight } from './utils/profileUtils';
import ProfileInfoCard from './profileInfoCard';
import { Ionicons } from '@expo/vector-icons';

const Profile = ({ user, framed, editing, setEditing, onSave }) => {
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
    fontFamily: 'Arial',
    profileStyle: 'classic',
    imageLayout: 'grid'
  });

  const [images, setImages] = useState([]);
  const [heightUnit, setHeightUnit] = useState('ft');
  const navigation = useNavigation();

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
        preferredAgeMin: user.preferredAgeMin || '',
        preferredAgeMax: user.preferredAgeMax || '',
        preferredGenders: user.preferredGenders || [],
        fontFamily: user.fontFamily || 'Arial',
        profileStyle: user.profileStyle || 'classic',
        imageLayout: user.imageLayout || 'grid'
      };

      const heightString = user.height || "0'0";
      if (heightString.includes("'")) {
        const [feet, inches] = heightString.split(/'|"/).map(Number);
        setFormData({
          ...baseFormData,
          heightFeet: feet.toString(),
          heightInches: inches.toString(),
          heightMeters: '0',
          heightCentimeters: '0'
        });
        setHeightUnit('ft');
      } else if (heightString.includes('m')) {
        const [metersPart, cmPart] = heightString.split(' ');
        const meters = metersPart.replace('m', '');
        const centimeters = cmPart.replace('cm', '');
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

  const handlePlaceholderClick = async () => {
    if (!editing) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need camera roll permissions to upload images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

  const handleInputChange = (e) => {
    const name = e.target?.name || e.name;
    const value = e.target?.value !== undefined ? e.target.value : e.value;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

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
        height: heightFormatted,
        preferredAgeMin: formData.preferredAgeMin,
        preferredAgeMax: formData.preferredAgeMax,
        preferredGenders: formData.preferredGenders,
        fontFamily: formData.fontFamily,
        profileStyle: formData.profileStyle,
        imageLayout: formData.imageLayout
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
      
      await res.json();
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

  const handleCancel = () => {
    if (user) {
      setFormData({
        preferredAgeMin: user.preferredAgeMin || '0',
        preferredAgeMax: user.preferredAgeMax || '0',
        preferredGenders: user.preferredGenders || [],
      });
    }
    setEditing(false);
  };

  if (!user) return null;

  return (
    <ScrollView style={[styles.container, framed && styles.framed]}>
      {user.role === 'user' && (
        <View style={styles.profileHeader}>
          <View style={styles.nameSection}>
            {!editing && (
              <Text style={styles.name}>{user.first_name}</Text>
            )}
          </View>
          {!framed && !editing && (
            <View style={styles.profileActions}>
              <TouchableOpacity onPress={() => setEditing(true)}>
                <Ionicons name="create-outline" size={24} color="#6B46C1" />
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
          onInputChange={handleInputChange}
          onUnitToggle={handleUnitToggle}
          onSubmit={handleFormSubmit}
          onCancel={handleCancel}
          calculateAge={calculateAge}
          editProfile={true}
          images={images}
          onDeleteImage={handleDeleteImage}
          onPlaceholderClick={handlePlaceholderClick}
          profileStyle={formData.profileStyle}
          completeProfile={false}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
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
});

export default Profile;
