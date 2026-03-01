import React, { useState, useRef, useContext, useEffect } from 'react';
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
    Image,
  } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '../../env';
import { UserContext } from '../../context/UserContext';
import { startLocationWatcher } from './utils/startLocationWatcher';
import { Ionicons } from '@expo/vector-icons';

const LoginScreen = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [emailError, setEmailError] = useState('');
  const navigation = useNavigation();
  const identifierRef = useRef(null);
  const passwordRef = useRef(null);
  const passwordRevealTimeoutRef = useRef(null);
  const { setUser } = useContext(UserContext);

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleEmailChange = (value) => {
    setIdentifier(value);
    if (value.trim() && !isValidEmail(value.trim())) {
      setEmailError('Not a valid email');
    } else {
      setEmailError('');
    }
  };

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const shouldStaySignedIn = await AsyncStorage.getItem('staySignedIn');
        if (shouldStaySignedIn !== null) {
          setStaySignedIn(shouldStaySignedIn === 'true');
        }

        if (shouldStaySignedIn === 'true') {
          const token = await AsyncStorage.getItem('token');
          const storedUser = await AsyncStorage.getItem('user');
          if (token && storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            if (parsedUser.role === 'user' && parsedUser.profile_completion_step) {
              navigation.navigate('CompleteProfile');
            } else {
              navigation.navigate('Main', { screen: 'Matches' });
            }
          }
        }
      } catch (err) {
        console.error('Error bootstrapping auth state:', err);
      }
    };

    bootstrapAuth();

    return () => {
      if (passwordRevealTimeoutRef.current) {
        clearTimeout(passwordRevealTimeoutRef.current);
      }
    };
  }, [navigation, setUser]);

  const clearPasswordRevealTimer = () => {
    if (passwordRevealTimeoutRef.current) {
      clearTimeout(passwordRevealTimeoutRef.current);
      passwordRevealTimeoutRef.current = null;
    }
  };

  const handlePasswordVisibilityToggle = () => {
    if (showPassword) {
      setShowPassword(false);
      clearPasswordRevealTimer();
      return;
    }

    setShowPassword(true);
    clearPasswordRevealTimer();
    passwordRevealTimeoutRef.current = setTimeout(() => {
      setShowPassword(false);
      passwordRevealTimeoutRef.current = null;
    }, 10000);
  };

  const handleLogin = async () => {
    if (!identifier.trim()) {
      Alert.alert('Error', 'Please enter your email.');
      return;
    }
    if (!isValidEmail(identifier.trim())) {
      setEmailError('Not a valid email');
      return;
    }
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/login`, { 
        identifier: identifier,
        password 
      });
      await AsyncStorage.setItem('staySignedIn', staySignedIn ? 'true' : 'false');
      // Store token in AsyncStorage
      await AsyncStorage.setItem('token', res.data.token);
      if (res.data.user) {
        await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
        // Update UserContext immediately so viewerUnit is correct
        setUser(res.data.user);
      }

      // Start location watcher for nearby matching (runs in background)
      startLocationWatcher(API_BASE_URL, res.data.token);

      // Check if user needs to complete profile
      if (res.data.user && res.data.user.role === 'user' && res.data.user.profile_completion_step) {
        navigation.navigate('CompleteProfile');
      } else {
        navigation.navigate('Main', {
          screen: 'Matches',
        });
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.response?.data?.msg || 'Login failed';
      Alert.alert('Error', errorMessage);
    }
  };

  const goToSignUp = () => {
    navigation.navigate('SignUp');
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

        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

          <TextInput
            ref={identifierRef}
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#6b7280"
            value={identifier}
            onChangeText={handleEmailChange}
            blurOnSubmit={false}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          {emailError ? <Text style={styles.emailError}>{emailError}</Text> : null}
          <View style={styles.passwordInputWrapper}>
            <TextInput
              ref={passwordRef}
              style={[styles.input, styles.passwordInput]}
              placeholder="Password"
              placeholderTextColor="#6b7280"
              value={password}
              onChangeText={setPassword}
              blurOnSubmit={false}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={styles.passwordToggleBtn}
              onPress={handlePasswordVisibilityToggle}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color="#6c5ce7"
              />
              <Text style={styles.passwordToggleText}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </TouchableOpacity>
          </View>

        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => setStaySignedIn((prev) => !prev)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, staySignedIn && styles.checkboxChecked]}>
            {staySignedIn && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>Remember Me</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotPasswordButton}>
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.signupText}>Don't have an account?</Text>
        <TouchableOpacity onPress={goToSignUp}>
          <Text style={styles.signupButton}>Sign Up</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    padding: 24,
    paddingTop: 80,
    backgroundColor: '#ffffff',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
    color: '#1a1a2e',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    width: '100%',
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    fontSize: 16,
    color: '#1a1a2e',
    backgroundColor: '#fafafa',
  },
  passwordInputWrapper: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 88,
  },
  passwordToggleBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  passwordToggleText: {
    color: '#6c5ce7',
    fontSize: 12,
    fontWeight: '700',
  },
  emailError: {
    color: '#e53e3e',
    fontSize: 13,
    marginTop: -8,
    marginBottom: 8,
    marginLeft: 4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#6c5ce7',
    borderRadius: 6,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#6c5ce7',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#4a4a68',
  },
  button: {
    width: '100%',
    marginTop: 8,
    paddingVertical: 15,
    backgroundColor: '#6c5ce7',
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotPasswordButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  forgotPasswordText: {
    color: '#6c5ce7',
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 24,
  },
  signupText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#6b7280',
  },
  signupButton: {
    textAlign: 'center',
    color: '#6c5ce7',
    fontWeight: '600',
    marginTop: 6,
    fontSize: 15,
  },
});

export default LoginScreen;
