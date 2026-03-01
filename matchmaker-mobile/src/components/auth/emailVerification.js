import React, { useState, useContext, useEffect } from 'react';
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
  Image,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { API_BASE_URL } from '../../env';
import { UserContext } from '../../context/UserContext';
import { startLocationWatcher } from './utils/startLocationWatcher';

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

  // Check if signup data exists on component mount
  useEffect(() => {
    const checkSignupData = async () => {
      const signupDataStr = await AsyncStorage.getItem('signupData');
      const verificationToken = await AsyncStorage.getItem('verificationToken');

      if (!signupDataStr || !verificationToken) {
        Alert.alert(
          'Session Expired',
          'Your signup session has expired. Please sign up again.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('SignUp'),
            },
          ]
        );
      }
    };

    checkSignupData();
  }, []);

  const handleVerify = async () => {
    if (!verificationToken.trim()) {
      Alert.alert('Error', 'Please enter the verification code.');
      return;
    }

    setLoading(true);
    try {
      // Retrieve stored signup data and verification token
      const signupDataStr = await AsyncStorage.getItem('signupData');
      const storedToken = await AsyncStorage.getItem('verificationToken');

      if (!signupDataStr || !storedToken) {
        Alert.alert('Error', 'Signup data not found. Please sign up again.');
        navigation.navigate('SignUp');
        return;
      }

      const signupData = JSON.parse(signupDataStr);

      const res = await axios.post(`${API_BASE_URL}/auth/verify-email`, {
        token: verificationToken.trim(),
        provided_token: storedToken,
        signup_data: signupData,
      });

      if (res.data.token && res.data.user) {
        // Clear stored signup data
        await AsyncStorage.removeItem('signupData');
        await AsyncStorage.removeItem('verificationToken');

        // Store user data and token
        await AsyncStorage.setItem('token', res.data.token);
        await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
        setUser(res.data.user);

        // Start location watcher for nearby matching
        startLocationWatcher(API_BASE_URL, res.data.token);

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
      // Retrieve stored signup data for resend
      const signupDataStr = await AsyncStorage.getItem('signupData');

      if (!signupDataStr) {
        Alert.alert('Error', 'Signup data not found. Please sign up again.');
        navigation.navigate('SignUp');
        return;
      }

      const signupData = JSON.parse(signupDataStr);
      const payload = verificationMethod === 'phone'
        ? { phone_number: identifier }
        : { email: identifier };

      // Add password and other data for re-registration
      payload.password = signupData.password;
      payload.role = signupData.role;
      if (signupData.referral_code) {
        payload.referral_code = signupData.referral_code;
      }

      const res = await axios.post(`${API_BASE_URL}/auth/register`, payload);

      if (res.data.verification_sent) {
        // Update stored verification token
        await AsyncStorage.setItem('verificationToken', res.data.verification_token);

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
      style={{ flex: 1, backgroundColor: '#ffffff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/matchmate_logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

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
          placeholderTextColor="#6b7280"
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
              <ActivityIndicator color="#6c5ce7" size="small" />
            ) : (
              <Text style={styles.resendButtonText}>Resend Code</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

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
    padding: 24,
    paddingTop: 80,
    justifyContent: 'flex-start',
    backgroundColor: '#ffffff',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 72,
    height: 72,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    color: '#1a1a2e',
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
    color: '#6b7280',
    lineHeight: 24,
  },
  emailText: {
    fontWeight: '600',
    color: '#6c5ce7',
  },
  instruction: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 28,
    color: '#6b7280',
    lineHeight: 21,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderRadius: 10,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 2,
    color: '#1a1a2e',
    backgroundColor: '#fafafa',
  },
  verifyBtn: {
    backgroundColor: '#6c5ce7',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  verifyBtnDisabled: {
    opacity: 0.6,
  },
  verifyBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  resendText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  resendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendButtonText: {
    color: '#6c5ce7',
    fontWeight: '600',
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 24,
  },
  loginContainer: {
    alignItems: 'center',
  },
  loginText: {
    textAlign: 'center',
    marginBottom: 8,
    color: '#6b7280',
    fontSize: 14,
  },
  loginButton: {
    textAlign: 'center',
    color: '#6c5ce7',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default EmailVerificationScreen;
