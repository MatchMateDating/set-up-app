import React, { useState, useRef, useContext } from 'react';
import {
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '../../env';
import { UserContext } from '../../context/UserContext';

const LoginScreen = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const navigation = useNavigation();
  const identifierRef = useRef(null);
  const passwordRef = useRef(null);
  const { setUser } = useContext(UserContext);

  const handleLogin = async () => {
    try {
      // Support both email and phone number login
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
      Alert.alert('Error', err.response?.data?.msg || 'Login failed');
    }
  };

  const goToSignUp = () => {
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
        <Text style={styles.title}>Login</Text>

          <TextInput
            ref={identifierRef}
            style={styles.input}
            placeholder="Email or Phone Number"
            value={identifier}
            onChangeText={setIdentifier}
            blurOnSubmit={false}
            keyboardType="default"
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <TextInput
            ref={passwordRef}
            style={styles.input}
            placeholder="Password"
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
    flexGrow: 1,           // fill the screen like SignUp
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
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
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signupText: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
    color: '#555',
  },
  signupButton: {
    textAlign: 'center',
    color: '#6B46C1',
    fontWeight: '600',
    marginTop: 6,
    fontSize: 15,
  },
  forgotPasswordButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  forgotPasswordText: {
    color: '#6B46C1',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default LoginScreen;
