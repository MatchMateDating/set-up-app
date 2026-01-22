import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '../../env';

const ForgotPasswordScreen = () => {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const identifierRef = useRef(null);

  const handleSendReset = async () => {
    if (!identifier.trim()) {
      Alert.alert('Error', 'Please enter your email or phone number.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/forgot-password`, {
        identifier: identifier.trim()
      });

      Alert.alert(
        'Success',
        res.data.message || 'Password reset instructions have been sent to your email or phone.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (err) {
      Alert.alert('Error', err.response?.data?.msg || 'Failed to send reset instructions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>
          Enter your email or phone number and we'll send you instructions to reset your password.
        </Text>

        <TextInput
          ref={identifierRef}
          style={styles.input}
          placeholder="Email or Phone Number"
          value={identifier}
          onChangeText={setIdentifier}
          keyboardType="default"
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={handleSendReset}
        />

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleSendReset}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send Reset Link'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  input: {
    width: '100%',
    marginVertical: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    fontSize: 16,
  },
  button: {
    width: '100%',
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: '#6B46C1',
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#6B46C1',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ForgotPasswordScreen;
