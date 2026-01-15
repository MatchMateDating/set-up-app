import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { API_BASE_URL } from '../../env';
import { UserContext } from '../../context/UserContext';

const EmailVerificationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { setUser } = useContext(UserContext);
  const [verificationToken, setVerificationToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  
  // Get identifier (email or phone) and verification method from route params
  const identifier = route.params?.identifier || route.params?.email || '';
  const verificationMethod = route.params?.verificationMethod || (identifier.includes('@') ? 'email' : 'phone');

  const handleVerify = async () => {
    if (!verificationToken.trim()) {
      Alert.alert('Error', 'Please enter the verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/verify-email`, {
        token: verificationToken.trim(),
      });

      if (res.data.token && res.data.user) {
        await AsyncStorage.setItem('token', res.data.token);
        await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
        setUser(res.data.user);
        
        const verificationType = verificationMethod === 'phone' ? 'Phone number' : 'Email';
        Alert.alert('Success', `${verificationType} verified successfully!`, [
          {
            text: 'OK',
            onPress: () => {
              // Navigate based on role
              if (res.data.user.role === 'user') {
                // User will go to CompleteProfile (step will be loaded from user data)
                navigation.navigate('CompleteProfile');
              } else {
                navigation.navigate('Main');
              }
            },
          },
        ]);
      } else {
        Alert.alert('Error', 'Verification failed. Please try again.');
      }
    } catch (err) {
      Alert.alert(
        'Error',
        err.response?.data?.msg || 'Verification failed. Please check your code and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!identifier) {
      Alert.alert('Error', 'Email or phone number not found.');
      return;
    }

    setResendLoading(true);
    try {
      const payload = verificationMethod === 'phone' 
        ? { phone_number: identifier }
        : { email: identifier };
      
      const res = await axios.post(`${API_BASE_URL}/auth/resend-verification`, payload);

      if (res.data.verification_sent) {
        const method = res.data.verification_method || verificationMethod;
        const methodText = method === 'phone' ? 'text message' : 'email';
        Alert.alert('Success', `Verification code sent! Please check your ${methodText}.`);
      } else {
        Alert.alert('Error', 'Failed to send verification code. Please try again.');
      }
    } catch (err) {
      Alert.alert(
        'Error',
        err.response?.data?.msg || 'Failed to send verification code. Please try again.'
      );
    } finally {
      setResendLoading(false);
    }
  };

  const goToLogin = () => {
    navigation.navigate('Login');
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
        <Text style={styles.title}>
          Verify Your {verificationMethod === 'phone' ? 'Phone Number' : 'Email'}
        </Text>
        
        <Text style={styles.description}>
          We've sent a verification code to{'\n'}
          <Text style={styles.emailText}>{identifier}</Text>
        </Text>
        
        <Text style={styles.instruction}>
          Please enter the verification code from your {verificationMethod === 'phone' ? 'text message' : 'email'} to continue.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Enter verification code"
          value={verificationToken}
          onChangeText={setVerificationToken}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="default"
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.verifyBtn, loading && styles.verifyBtnDisabled]}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.verifyBtnText}>Verify</Text>
          )}
        </TouchableOpacity>

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive the code?</Text>
          <TouchableOpacity
            onPress={handleResend}
            disabled={resendLoading}
            style={styles.resendButton}
          >
            {resendLoading ? (
              <ActivityIndicator color="#6B46C1" size="small" />
            ) : (
              <Text style={styles.resendButtonText}>Resend Code</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account?</Text>
          <TouchableOpacity
            onPress={goToLogin}
            activeOpacity={0.7}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Text style={styles.loginButton}>Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
    color: '#666',
  },
  emailText: {
    fontWeight: '600',
    color: '#6B46C1',
  },
  instruction: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    color: '#888',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 2,
  },
  verifyBtn: {
    backgroundColor: '#6B46C1',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  verifyBtnDisabled: {
    opacity: 0.6,
  },
  verifyBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  resendText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  resendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendButtonText: {
    color: '#6B46C1',
    fontWeight: '600',
    fontSize: 14,
  },
  loginContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  loginText: {
    textAlign: 'center',
    marginBottom: 8,
    color: '#666',
  },
  loginButton: {
    textAlign: 'center',
    color: '#6B46C1',
    fontWeight: 'bold',
  },
});

export default EmailVerificationScreen;
