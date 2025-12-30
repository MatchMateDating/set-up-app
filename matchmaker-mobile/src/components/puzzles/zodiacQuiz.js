import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '../../env';
import { calculateAge, getZodiacSign, zodiacInfo } from '../profile/utils/profileUtils';

const ZodiacQuiz = () => {
  const navigation = useNavigation();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

      if (!res.ok) throw new Error('Failed to fetch profile');

      const data = await res.json();
      setUser(data.user);
    } catch (err) {
      console.error('Error loading profile:', err);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6B46C1" />
        <Text style={styles.loadingText}>Loading your zodiac info...</Text>
      </View>
    );
  }

  const age = calculateAge(user?.birthdate);
  const zodiacSign = getZodiacSign(user?.birthdate);
  const zodiacDetails = zodiacInfo(zodiacSign);

  const sendResultToMatch = async () => {
    try {
      const matchId = await AsyncStorage.getItem('activeMatchId');
      if (!matchId) {
        Alert.alert('Error', 'No active match found');
        return;
      }

      setSaving(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const message = `My zodiac sign is ${zodiacSign} (age ${age}) 🪐
      
Traits: ${zodiacDetails.traits.join(', ')}
Pros: ${zodiacDetails.pros.join(', ')}
Cons: ${zodiacDetails.cons.join(', ')}
Compatible signs: ${zodiacDetails.compatible.join(', ')}`;

      await fetch(`${API_BASE_URL}/conversation/${matchId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      });

      navigation.navigate('MatchConvo', { matchId });
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to send zodiac info');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Your Zodiac Sign</Text>

      <View style={styles.resultContainer}>
        <Text style={styles.resultSign}>{zodiacSign}</Text>
        <Text style={styles.resultAge}>Age: {age}</Text>

        <Text style={styles.resultHeader}>Traits:</Text>
        <Text style={styles.resultText}>{zodiacDetails.traits.join(', ')}</Text>

        <Text style={styles.resultHeader}>Pros:</Text>
        <Text style={styles.resultText}>{zodiacDetails.pros.join(', ')}</Text>

        <Text style={styles.resultHeader}>Cons:</Text>
        <Text style={styles.resultText}>{zodiacDetails.cons.join(', ')}</Text>

        <Text style={styles.resultHeader}>Compatible Signs:</Text>
        <Text style={styles.resultText}>{zodiacDetails.compatible.join(', ')}</Text>

        <TouchableOpacity
          style={[styles.actionButton, styles.sendButton]}
          onPress={sendResultToMatch}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.actionButtonText}>Send to Match</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={fetchProfile}
        >
          <Text style={styles.actionButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f4fc', paddingTop: 30 },
  content: { padding: 20 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#6b7280' },
  resultContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 24 },
  resultSign: { fontSize: 28, fontWeight: '700', marginBottom: 8, textAlign: 'center', color: '#6B46C1' },
  resultAge: { fontSize: 18, marginBottom: 16, textAlign: 'center' },
  resultHeader: { fontSize: 18, fontWeight: '600', marginTop: 12 },
  resultText: { fontSize: 16, marginTop: 4 },
  actionButton: { backgroundColor: '#6B46C1', padding: 14, borderRadius: 8, width: '100%', alignItems: 'center', marginTop: 16 },
  sendButton: { backgroundColor: '#10b981' },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default ZodiacQuiz;
