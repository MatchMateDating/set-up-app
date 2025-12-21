import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import {API_BASE_URL} from '@env';

const SignUpScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [first_name, setFirstName] = useState('');
  const [last_name, setLastName] = useState('');
  const [role, setRole] = useState('user');
  const [referralCode, setReferralCode] = useState('');

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
        }
        Alert.alert('Success', 'Registration successful!');
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

  const goToLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
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
        style={styles.input}
        placeholder="First Name"
        value={first_name}
        onChangeText={setFirstName}
      />
      <TextInput
        style={styles.input}
        placeholder="Last Name"
        value={last_name}
        onChangeText={setLastName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        keyboardType="email-address"
        autoCapitalize="none"
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        secureTextEntry
        onChangeText={setPassword}
      />

      {role === 'matchmaker' && (
        <TextInput
          style={styles.input}
          placeholder="Enter Dater's Referral Code"
          value={referralCode}
          onChangeText={setReferralCode}
        />
      )}

      <TouchableOpacity style={styles.submitBtn} onPress={handleRegister}>
        <Text style={styles.submitBtnText}>Sign Up</Text>
      </TouchableOpacity>

      <Text style={styles.loginText}>Already have an account?</Text>
      <TouchableOpacity onPress={goToLogin}>
        <Text style={styles.loginButton}>Login</Text>
      </TouchableOpacity>
    </ScrollView>
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
