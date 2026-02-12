import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../env';
import FormField from '../profile/components/formField';

const Preferences = () => {
  const navigation = useNavigation();
  const [editing, setEditing] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    preferredAgeMin: '0',
    preferredAgeMax: '0',
    preferredGenders: []
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (user) {
      setFormData({
        preferredAgeMin: user.preferredAgeMin || '0',
        preferredAgeMax: user.preferredAgeMax || '0',
        preferredGenders: user.preferredGenders || [],
      });
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/profile/`, {
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

      if (!res.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await res.json();
      setUser(data.user);
    } catch (err) {
      console.error('Error loading profile:', err);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const payload = {
        preferredAgeMin: formData.preferredAgeMin,
        preferredAgeMax: formData.preferredAgeMax,
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

      await res.json();
      Alert.alert('Success', 'Preferences updated successfully');
      fetchProfile();
      setEditing(false);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Error updating profile');
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6c5ce7" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.nav}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#6c5ce7" />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>

          {!editing && (
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Ionicons name="create-outline" size={24} color="#6c5ce7" />
            </TouchableOpacity>
          )}
        </View>

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
{/*
        <FormField
          label="Preferred Age"
          editing={editing}
          value={
            formData.preferredAgeMin || formData.preferredAgeMax
              ? `${formData.preferredAgeMin || ''} - ${formData.preferredAgeMax || ''}`
              : ''
          }
          input={
            editing ? (
              <View style={styles.ageInputContainer}>
                <TextInput
                  style={[styles.input, styles.ageInput]}
                  value={formData.preferredAgeMin || ''}
                  onChangeText={(value) => handleInputChange('preferredAgeMin', value)}
                  placeholder="Min"
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, styles.ageInput]}
                  value={formData.preferredAgeMax || ''}
                  onChangeText={(value) => handleInputChange('preferredAgeMax', value)}
                  placeholder="Max"
                  keyboardType="numeric"
                />
              </View>
            ) : null
          }
        />
*/}

        <FormField
          label="Preferred Gender(s)"
          editing={editing}
          value={(formData.preferredGenders || []).join(', ')}
          input={
            editing ? (
              <Text style={styles.helperText}>
                Multi-select not yet implemented in mobile
              </Text>
            ) : null
          }
        />

        {editing && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleFormSubmit}>
              <Text style={styles.primaryBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleCancel}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  content: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtnText: {
    color: '#6c5ce7',
    fontSize: 16,
    fontWeight: '600',
  },
  ageInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    borderBottomWidth: 2,
    borderBottomColor: '#e0e6ef',
    padding: 8,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  ageInput: {
    width: 80,
  },
  helperText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    justifyContent: 'flex-end',
  },
  primaryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#6c5ce7',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ebe7fb',
  },
  secondaryBtnText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Preferences;
