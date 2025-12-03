import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '@env';
import { calculateAge, convertFtInToMetersCm, convertMetersCmToFtIn, formatHeight } from './utils/profileUtils';
import ProfileInfoCard from './profileInfoCard';

const CompleteProfile = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const today = new Date();
  const defaultBirthdate = new Date(today.setFullYear(today.getFullYear() - 18))
    .toISOString()
    .split('T')[0];

  const [formData, setFormData] = useState({
    birthdate: defaultBirthdate,
    gender: '',
    heightFeet: '0',
    heightInches: '0',
    heightMeters: '0',
    heightCentimeters: '0',
    preferredAgeMax: '',
    preferredAgeMin: '',
    preferredGenders: [],
  });

  const [heightUnit, setHeightUnit] = useState('ft');

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    if (calculateAge(formData.birthdate) < 18) {
      setError('You must be at least 18 years old.');
      setLoading(false);
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const heightFormatted = formatHeight(formData, heightUnit);

      const payload = {
        birthdate: formData.birthdate,
        gender: formData.gender,
        height: heightFormatted,
        preferredAgeMax: formData.preferredAgeMax,
        preferredAgeMin: formData.preferredAgeMin,
        preferredGenders: formData.preferredGenders,
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

      setSuccess('Profile updated successfully 🎉');
      setTimeout(() => navigation.navigate('Main'), 1200);
    } catch (err) {
      console.error(err);
      setError('Error saving profile. Please try again.');
      Alert.alert('Error', 'Error saving profile. Please try again.');
    } finally {
      setLoading(false);
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Complete Your Profile</Text>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B46C1" />
        </View>
      )}

      <ProfileInfoCard
        user={{ role: 'user' }}
        formData={formData}
        editing={true}
        heightUnit={heightUnit}
        onInputChange={handleInputChange}
        onUnitToggle={handleUnitToggle}
        onSubmit={handleSubmit}
        onCancel={() => navigation.navigate('Main')}
        calculateAge={calculateAge}
        completeProfile={true}
      />

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : success ? (
        <Text style={styles.successText}>{success}</Text>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f4fc',
    paddingTop: 40
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
    color: '#222',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  successText: {
    color: '#10b981',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
});

export default CompleteProfile;
