import React, { useState, useRef, useContext } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../env';
import { UserContext } from '../../context/UserContext';
import { useNotifications } from '../../context/NotificationContext';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

const SignUpScreen = () => {
  const navigation = useNavigation();
  const { setUser } = useContext(UserContext);
  const { enableNotifications } = useNotifications();
  const [role, setRole] = useState('user'); // 'user' = dater, 'matchmaker' = matchmaker
  const [identifier, setIdentifier] = useState(''); // Email or phone number
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [agreeToTexts, setAgreeToTexts] = useState(false);
  const identifierRef = useRef(null);
  const passwordRef = useRef(null);
  const referralRef = useRef(null);

  // Helper function to detect if identifier is email or phone
  const isEmail = (value) => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(value);
  };

  const handleRegister = async () => {
    try {
      if (!identifier.trim()) {
        Alert.alert('Error', 'Please enter your email or phone number.');
        return;
      }

      if (!password) {
        Alert.alert('Error', 'Please enter a password.');
        return;
      }

      if (role === 'matchmaker' && !referralCode.trim()) {
        Alert.alert('Error', 'Referral code is required for matchmakers.');
        return;
      }

      if (!agreeToTexts) {
        Alert.alert('Error', 'Please agree to receive non promotional texts or emails to continue.');
        return;
      }

      const payload = { password, role };
      const isEmailInput = isEmail(identifier.trim());
      
      if (isEmailInput) {
        payload.email = identifier.trim();
      } else {
        payload.phone_number = identifier.trim();
      }

      if (role === 'matchmaker') {
        payload.referral_code = referralCode.trim();
      }
      
      const res = await axios.post(`${API_BASE_URL}/auth/register`, payload);

      if (res.data.user) {
        // Store user data temporarily (will be saved after verification)
        // Navigate to verification screen
        const method = isEmailInput ? 'email' : 'phone';
        const message = isEmailInput 
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
                  identifier: identifier.trim(),
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

  const requestNotificationPermissions = async () => {
    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus === 'granted') {
        // Enable notifications in the context (this will save to backend)
        // Wait a moment for UserContext to update with the new user
        setTimeout(async () => {
          try {
            await enableNotifications();
          } catch (err) {
            console.error('Error enabling notifications:', err);
            // This is okay - user can enable notifications later in settings
          }
        }, 500);
        
        // Get push token and register with backend
        if (Platform.OS !== 'web') {
          try {
            // Try to get projectId from Constants
            let projectId = null;
            try {
              if (Constants.expoConfig?.extra?.eas?.projectId) {
                projectId = Constants.expoConfig.extra.eas.projectId;
              } else if (Constants.expoConfig?.extra?.projectId) {
                projectId = Constants.expoConfig.extra.projectId;
              } else if (Constants.manifest2?.extra?.eas?.projectId) {
                projectId = Constants.manifest2.extra.eas.projectId;
              }
            } catch (e) {
              console.log('Could not get projectId from Constants:', e);
            }

            if (projectId && projectId !== 'your-project-id-here' && projectId !== 'matchmate') {
              const token = await Notifications.getExpoPushTokenAsync({ projectId });
              
              // Register push token with backend using the new notifications endpoint
              const authToken = await AsyncStorage.getItem('token');
              if (authToken) {
                await fetch(`${API_BASE_URL}/notifications/register_token`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                  },
                  body: JSON.stringify({ push_token: token.data }),
                });
              }
            }
          } catch (error) {
            console.log('Could not get push token during signup:', error);
            // This is okay - user can enable notifications later in settings
          }
        }
      } else {
        // User denied permissions - that's fine, they can enable later
        console.log('User denied notification permissions during signup');
      }
    } catch (error) {
      console.error('Error requesting notification permissions during signup:', error);
      // Don't block signup if notification request fails
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
        <Text style={styles.title}>Sign Up</Text>

        {/* Role toggle */}
        <View style={styles.roleToggleWrapper}>
          <TouchableOpacity
            style={[styles.roleBtn, role === 'user' && styles.activeRoleBtn]}
            onPress={() => {
              setRole('user');
              setReferralCode('');
            }}
          >
            <Text style={[styles.roleBtnText, role === 'user' && styles.activeRoleBtnText]}>Dater</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleBtn, role === 'matchmaker' && styles.activeRoleBtn]}
            onPress={() => {
              setRole('matchmaker');
            }}
          >
            <Text style={[styles.roleBtnText, role === 'matchmaker' && styles.activeRoleBtnText]}>Matchmaker</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          ref={identifierRef}
          style={styles.input}
          placeholder="Email or Phone Number"
          value={identifier}
          keyboardType="default"
          autoCapitalize="none"
          onChangeText={setIdentifier}
          blurOnSubmit={false}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <TextInput
          ref={passwordRef}
          style={styles.input}
          placeholder="Password"
          value={password}
          secureTextEntry
          onChangeText={setPassword}
          blurOnSubmit={false}
          returnKeyType={role === 'matchmaker' ? 'next' : 'done'}
          onSubmitEditing={() => {
            if (role === 'matchmaker') {
              referralRef.current?.focus();
            } else {
              handleRegister();
            }
          }}
        />

        {role === 'matchmaker' && (
          <TextInput
            ref={referralRef}
            style={styles.input}
            placeholder="Enter Dater's Referral Code"
            value={referralCode}
            onChangeText={setReferralCode}
            returnKeyType="done"
            onSubmitEditing={handleRegister}
          />
        )}

        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => setAgreeToTexts(!agreeToTexts)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, agreeToTexts && styles.checkboxChecked]}>
            {agreeToTexts && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>By checking this box, you agree to receive non promotional texts or emails.</Text>
        </TouchableOpacity>

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
  roleToggleWrapper: {
    flexDirection: 'row',
    marginBottom: 14,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  roleBtnText: {
    color: '#6B46C1',
    fontWeight: '600',
  },
  activeRoleBtn: {
    backgroundColor: '#6B46C1',
  },
  activeRoleBtnText: {
    color: '#fff',
    fontWeight: '700',
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

export default SignUpScreen;
