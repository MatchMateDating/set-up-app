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
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '../../env';
import { UserContext } from '../../context/UserContext';
import { useNotifications } from '../../context/NotificationContext';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

const SignUpScreen = () => {
  const navigation = useNavigation();
  const { setUser } = useContext(UserContext);
  const { enableNotifications } = useNotifications();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [first_name, setFirstName] = useState('');
  const [last_name, setLastName] = useState('');
  const [role, setRole] = useState('user');
  const [referralCode, setReferralCode] = useState('');
  const firstNameRef = useRef(null);
  const lastNameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const referralRef = useRef(null);

  const handleRegister = async () => {
    try {
      if (!first_name || !last_name || !email || !password) {
        Alert.alert('Error', 'Please fill out all fields.');
        return;
      }
      const payload = { first_name, last_name, email, password, role };
      if (role === 'matchmaker') {
        if (!referralCode) {
          Alert.alert('Error', 'Referral code is required for matchmakers.');
          return;
        }
        payload.referral_code = referralCode;
      }
      const res = await axios.post(`${API_BASE_URL}/auth/register`, payload);

      if (res.data.token) {
        await AsyncStorage.setItem('token', res.data.token);
        if (res.data.user) {
          await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
          // Update UserContext immediately so viewerUnit is correct
          setUser(res.data.user);
        }
        
        // Navigate to next screen - notification prompt will happen after profile completion
        if (role === 'user') {
          navigation.navigate('CompleteProfile');
        } else {
          navigation.navigate('Main');
        }
      } else {
        Alert.alert('Error', 'Registration successful, but no token received.');
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

        <View style={styles.roleToggleWrapper}>
          <TouchableOpacity
            style={[styles.roleBtn, role === 'user' && styles.activeRoleBtn]}
            onPress={() => setRole('user')}
          >
            <Text style={[styles.roleBtnText, role === 'user' && styles.activeRoleBtnText]}>Dater</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleBtn, role === 'matchmaker' && styles.activeRoleBtn]}
            onPress={() => setRole('matchmaker')}
          >
            <Text style={[styles.roleBtnText, role === 'matchmaker' && styles.activeRoleBtnText]}>Matcher</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          ref={firstNameRef}
          style={styles.input}
          placeholder="First Name"
          value={first_name}
          onChangeText={setFirstName}
          blurOnSubmit={false}
          returnKeyType="next"
          onSubmitEditing={() => lastNameRef.current?.focus()}
        />
        <TextInput
          ref={lastNameRef}
          style={styles.input}
          placeholder="Last Name"
          value={last_name}
          onChangeText={setLastName}
          blurOnSubmit={false}
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
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
        <TextInput
          ref={passwordRef}
          style={styles.input}
          placeholder="Password"
          value={password}
          secureTextEntry
          onChangeText={setPassword}
          blurOnSubmit={() => {
            if (role == '') {
              false
            } else {
              true
            }
          }}
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
});

export default SignUpScreen;
