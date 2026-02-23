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
    Image,
  } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '../../env';
import { UserContext } from '../../context/UserContext';

const LoginScreen = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const navigation = useNavigation();
  const identifierRef = useRef(null);
  const passwordRef = useRef(null);
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
      // Store token in AsyncStorage
      await AsyncStorage.setItem('token', res.data.token);
      if (res.data.user) {
        await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
        // Update UserContext immediately so viewerUnit is correct
        setUser(res.data.user);
      }
      Alert.alert('Success', 'Login successful!');
      
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
          <TextInput
            ref={passwordRef}
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#6b7280"
            value={password}
            onChangeText={setPassword}
            blurOnSubmit={false}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            secureTextEntry
          />

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
  emailError: {
    color: '#e53e3e',
    fontSize: 13,
    marginTop: -8,
    marginBottom: 8,
    marginLeft: 4,
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
