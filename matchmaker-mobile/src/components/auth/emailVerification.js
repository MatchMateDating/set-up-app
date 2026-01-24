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
