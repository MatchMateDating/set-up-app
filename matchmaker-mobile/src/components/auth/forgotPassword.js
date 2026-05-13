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
  Image,
} from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../env';

const ForgotPasswordScreen = () => {
  const [identifier, setIdentifier] = useState('');
  const [identifierError, setIdentifierError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const identifierRef = useRef(null);

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const phoneDigitsOnly = (value) => (value || '').replace(/\D/g, '');
  const isValidPhone = (value) => phoneDigitsOnly(value).length >= 10;

  const normalizeUsPhoneToE164 = (value) => {
    let digits = phoneDigitsOnly(value);
    if (!digits.startsWith('1') && digits.length === 10) {
      digits = `1${digits}`;
    }
    return `+${digits}`;
  };

  const getIdentifierKind = (trimmed) => {
    if (!trimmed) return null;
    if (isValidEmail(trimmed)) return 'email';
    if (isValidPhone(trimmed)) return 'phone';
    return null;
  };

  const handleIdentifierChange = (value) => {
    setIdentifier(value);
    const t = value.trim();
    if (!t) {
      setIdentifierError('');
      return;
    }
    if (isValidEmail(t) || isValidPhone(t)) {
      setIdentifierError('');
      return;
    }
    if (t.includes('@')) {
      setIdentifierError('Not a valid email');
      return;
    }
    const digits = phoneDigitsOnly(t);
    if (digits.length > 0 && digits.length < 10) {
      setIdentifierError('');
      return;
    }
    setIdentifierError('Enter a valid email or phone number');
  };

  const handleSendReset = async () => {
    const trimmed = identifier.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Please enter your email or phone number.');
      return;
    }

    const kind = getIdentifierKind(trimmed);
    if (!kind) {
      if (trimmed.includes('@')) {
        setIdentifierError('Not a valid email');
        Alert.alert('Error', 'Please enter a valid email address.');
      } else {
        setIdentifierError('Enter a valid email or phone number');
        Alert.alert(
          'Error',
          'Please enter a valid email or a US phone number with at least 10 digits.'
        );
      }
      return;
    }

    const payloadIdentifier =
      kind === 'phone' ? normalizeUsPhoneToE164(trimmed) : trimmed;

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/forgot-password`, {
        identifier: payloadIdentifier,
      });

      const defaultMsg =
        kind === 'phone'
          ? 'If an account exists for that number, we sent a text with a link to reset your password.'
          : 'If an account exists for that email, we sent reset instructions to your inbox.';

      Alert.alert('Success', res.data.message || defaultMsg, [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.msg || 'Failed to send reset instructions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#ffffff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#6c5ce7" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView
        style={styles.scrollView}
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

        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>
          Enter your email or US phone number. We will email you a reset link, or text you a link if
          you used your phone number.
        </Text>

        <TextInput
          ref={identifierRef}
          style={styles.input}
          placeholder="Email or phone number"
          placeholderTextColor="#6b7280"
          value={identifier}
          onChangeText={handleIdentifierChange}
          keyboardType="default"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleSendReset}
        />
        {identifierError ? (
          <Text style={styles.fieldError}>{identifierError}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSendReset}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Sending...' : 'Send reset instructions'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    padding: 24,
    paddingTop: 120,
    backgroundColor: '#ffffff',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: '#ffffff',
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButtonText: { color: '#6c5ce7', fontSize: 16, fontWeight: '600' },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 72,
    height: 72,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    color: '#1a1a2e',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 21,
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
  button: {
    width: '100%',
    marginTop: 8,
    paddingVertical: 15,
    backgroundColor: '#6c5ce7',
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fieldError: {
    color: '#e53e3e',
    fontSize: 13,
    marginTop: -4,
    marginBottom: 8,
    marginLeft: 4,
  },
});

export default ForgotPasswordScreen;
