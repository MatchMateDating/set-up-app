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
  Platform,
} from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '../../env';

const MatchmakerSignUpScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [useEmail, setUseEmail] = useState(true); // Toggle between email and phone
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [agreeToTexts, setAgreeToTexts] = useState(false);
  const emailRef = useRef(null);
  const phoneRef = useRef(null);
  const passwordRef = useRef(null);
  const referralRef = useRef(null);

  const handleRegister = async () => {
    try {
      if (!password) {
        Alert.alert('Error', 'Please fill out all fields.');
        return;
      }
      
      if (!email && !phoneNumber) {
        Alert.alert('Error', 'Please provide either an email or phone number.');
        return;
      }
      
      if (email && phoneNumber) {
        Alert.alert('Error', 'Please provide either an email OR phone number, not both.');
        return;
      }
      
      if (!referralCode) {
        Alert.alert('Error', 'Referral code is required for matchmakers.');
        return;
      }
      
      if (!useEmail && !agreeToTexts) {
        Alert.alert('Error', 'Please agree to receive texts to continue.');
        return;
      }
      
      const payload = { password, role: 'matchmaker', referral_code: referralCode };
      if (useEmail && email) {
        payload.email = email;
      } else if (!useEmail && phoneNumber) {
        payload.phone_number = phoneNumber;
      }
      
      const res = await axios.post(`${API_BASE_URL}/auth/register`, payload);

      if (res.data.user) {
        // Store user data temporarily (will be saved after verification)
        // Navigate to verification screen
        const identifier = useEmail ? email : phoneNumber;
        const method = useEmail ? 'email' : 'phone';
        const message = useEmail 
          ? 'Registration successful! Please check your email for a verification code.'
          : 'Registration successful! Please check your phone for a verification code.';
        
        Alert.alert(
          'Success',
          message,
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.navigate('EmailVerification', { 
                  identifier: identifier,
                  verificationMethod: method
                });
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Registration failed. Please try again.');
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.msg || 'Registration failed');
    }
  };

  const goToLogin = () => {
    navigation.navigate('Login');
  };

  const goToDaterSignUp = () => {
    navigation.navigate('SignUp');
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
        <Text style={styles.title}>Sign Up</Text>

        <TouchableOpacity style={styles.switchButton} onPress={goToDaterSignUp}>
          <Text style={styles.switchButtonText}>Switch to Dater Sign Up</Text>
        </TouchableOpacity>

        <View style={styles.authMethodToggleWrapper}>
          <TouchableOpacity
            style={[styles.authMethodBtn, useEmail && styles.activeAuthMethodBtn]}
            onPress={() => {
              setUseEmail(true);
              setPhoneNumber('');
            }}
          >
            <Text style={[styles.authMethodBtnText, useEmail && styles.activeAuthMethodBtnText]}>Email</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.authMethodBtn, !useEmail && styles.activeAuthMethodBtn]}
            onPress={() => {
              setUseEmail(false);
              setEmail('');
              setAgreeToTexts(false);
            }}
          >
            <Text style={[styles.authMethodBtnText, !useEmail && styles.activeAuthMethodBtnText]}>Phone</Text>
          </TouchableOpacity>
        </View>

        {useEmail ? (
          <TextInput
            ref={emailRef}
            style={styles.input}
            placeholder="Email"
            value={email}
            keyboardType="email-address"
            autoCapitalize="none"
            onChangeText={setEmail}
            blurOnSubmit={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        ) : (
          <TextInput
            ref={phoneRef}
            style={styles.input}
            placeholder="Phone Number (e.g., +1234567890)"
            value={phoneNumber}
            keyboardType="phone-pad"
            autoCapitalize="none"
            onChangeText={setPhoneNumber}
            blurOnSubmit={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        )}
        <TextInput
          ref={passwordRef}
          style={styles.input}
          placeholder="Password"
          value={password}
          secureTextEntry
          onChangeText={setPassword}
          blurOnSubmit={false}
          returnKeyType="next"
          onSubmitEditing={() => referralRef.current?.focus()}
        />

        <TextInput
          ref={referralRef}
          style={styles.input}
          placeholder="Enter Dater's Referral Code"
          value={referralCode}
          onChangeText={setReferralCode}
          returnKeyType="done"
          onSubmitEditing={handleRegister}
        />

        {!useEmail && (
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setAgreeToTexts(!agreeToTexts)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, agreeToTexts && styles.checkboxChecked]}>
              {agreeToTexts && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>By checking this box, you agree to receive texts.</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.submitBtn} onPress={handleRegister}>
          <Text style={styles.submitBtnText}>Sign Up</Text>
        </TouchableOpacity>

        <Text style={styles.loginText}>Already have an account?</Text>
        <View style={{ alignItems: 'center', marginTop: 6 }}>
          <TouchableOpacity
            onPress={goToLogin}
            activeOpacity={0.7}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
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
  authMethodToggleWrapper: {
    flexDirection: 'row',
    marginBottom: 14,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  authMethodBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  authMethodBtnText: {
    color: '#6B46C1',
    fontWeight: '600',
  },
  activeAuthMethodBtn: {
    backgroundColor: '#6B46C1',
  },
  activeAuthMethodBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  submitBtn: {
    backgroundColor: '#6B46C1',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  loginText: {
    textAlign: 'center',
    marginTop: 20,
  },
  loginButton: {
    textAlign: 'center',
    color: '#6B46C1',
    fontWeight: 'bold',
    marginTop: 5,
  },
  switchButton: {
    marginBottom: 16,
    alignItems: 'center',
  },
  switchButtonText: {
    color: '#6B46C1',
    fontWeight: '600',
    fontSize: 14,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#6B46C1',
    borderRadius: 4,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#6B46C1',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
});

export default MatchmakerSignUpScreen;
