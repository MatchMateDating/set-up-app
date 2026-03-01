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
  Modal,
  Keyboard,
  Image,
} from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../env';
import { UserContext } from '../../context/UserContext';
import { startLocationWatcher } from './utils/startLocationWatcher';
import { useNotifications } from '../../context/NotificationContext';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

const DEFAULT_TEST_EMAIL_DOMAINS = '@test.com,@example.com,@test.local';
const TEST_EMAIL_DOMAINS = (
  process.env.EXPO_PUBLIC_TEST_EMAIL_DOMAINS || DEFAULT_TEST_EMAIL_DOMAINS
)
  .split(',')
  .map((domain) => domain.trim().toLowerCase())
  .filter(Boolean);

const SignUpScreen = () => {
  const navigation = useNavigation();
  const { setUser } = useContext(UserContext);
  const { enableNotifications } = useNotifications();
  const [role, setRole] = useState('user');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [agreeToTexts, setAgreeToTexts] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const identifierRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  const referralRef = useRef(null);
  const passwordRevealTimeoutRef = useRef(null);
  const confirmPasswordRevealTimeoutRef = useRef(null);

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const isTestEmail = (value) => {
    const normalized = (value || '').trim().toLowerCase();
    return TEST_EMAIL_DOMAINS.some((domain) => normalized.endsWith(domain));
  };
  const getPasswordChecks = (value) => ({
    minLength: (value || '').length >= 8,
    hasUppercase: /[A-Z]/.test(value || ''),
    hasLowercase: /[a-z]/.test(value || ''),
    hasSpecial: /[^A-Za-z0-9]/.test(value || ''),
  });
  const passwordChecks = getPasswordChecks(password);
  const isPasswordStrong = Object.values(passwordChecks).every(Boolean);
  const shouldSkipPasswordRules = isTestEmail(identifier);

  const handleEmailChange = (value) => {
    setIdentifier(value);
    if (value.trim() && !isValidEmail(value.trim())) {
      setEmailError('Not a valid email');
    } else {
      setEmailError('');
    }
  };

  useEffect(() => {
    return () => {
      if (passwordRevealTimeoutRef.current) {
        clearTimeout(passwordRevealTimeoutRef.current);
      }
      if (confirmPasswordRevealTimeoutRef.current) {
        clearTimeout(confirmPasswordRevealTimeoutRef.current);
      }
    };
  }, []);

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

  const clearConfirmPasswordRevealTimer = () => {
    if (confirmPasswordRevealTimeoutRef.current) {
      clearTimeout(confirmPasswordRevealTimeoutRef.current);
      confirmPasswordRevealTimeoutRef.current = null;
    }
  };

  const handleConfirmPasswordVisibilityToggle = () => {
    if (showConfirmPassword) {
      setShowConfirmPassword(false);
      clearConfirmPasswordRevealTimer();
      return;
    }

    setShowConfirmPassword(true);
    clearConfirmPasswordRevealTimer();
    confirmPasswordRevealTimeoutRef.current = setTimeout(() => {
      setShowConfirmPassword(false);
      confirmPasswordRevealTimeoutRef.current = null;
    }, 10000);
  };

  const handleSignUpClick = () => {
    if (!identifier.trim()) {
      Alert.alert('Error', 'Please enter your email.');
      return;
    }

    if (!isValidEmail(identifier.trim())) {
      setEmailError('Not a valid email');
      return;
    }

    if (!password) {
      Alert.alert('Error', 'Please enter a password.');
      return;
    }

    if (!confirmPassword) {
      Alert.alert('Error', 'Please confirm your password.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    if (!shouldSkipPasswordRules && !isPasswordStrong) {
      Alert.alert(
        'Error',
        'Password must be at least 8 characters and include 1 uppercase letter, 1 lowercase letter, and 1 special character.'
      );
      return;
    }

    if (role === 'matchmaker' && !referralCode.trim()) {
      Alert.alert('Error', 'Referral code is required for matchmakers.');
      return;
    }

    if (!agreeToTexts) {
      Alert.alert('Error', 'Please agree to receive non promotional emails to continue.');
      return;
    }

    // Show terms modal
    setShowTermsModal(true);
    setAgreeToTerms(false);
  };

  const handleRegister = async () => {
    if (!agreeToTerms) {
      Alert.alert('Error', 'Please agree to the terms of service to continue.');
      return;
    }

    try {
      const payload = { password, role, email: identifier.trim() };

      if (role === 'matchmaker') {
        payload.referral_code = referralCode.trim();
      }

      const res = await axios.post(`${API_BASE_URL}/auth/register`, payload);

      // Close modal first since registration is starting
      setShowTermsModal(false);

      // Check if this is a test mode response (auto-verified account)
      if (res.data.token && res.data.test_mode) {
        // Test mode: account created and auto-verified, log in directly
        // Make sure to await all AsyncStorage operations before navigating
        await AsyncStorage.setItem('staySignedIn', staySignedIn ? 'true' : 'false');
        await AsyncStorage.setItem('token', res.data.token);
        await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
        setUser(res.data.user);

        // Enable notifications if user agrees (don't block navigation if this fails)
        // Run this in the background - don't await it
        if (agreeToTexts) {
          enableNotifications()
            .catch((err) => {
              // This is okay - user can enable notifications later in settings
            });
        }

        // Start location watcher for nearby matching (runs in background)
        startLocationWatcher(API_BASE_URL, res.data.token);

        // Small delay to ensure state is updated before navigation
        await new Promise(resolve => setTimeout(resolve, 100));

        // Navigate based on user role and profile completion status
        // Use reset to clear the navigation stack and prevent going back
        if (role === 'user' && res.data.user.profile_completion_step) {
          // User needs to complete profile - reset stack to CompleteProfile
          navigation.reset({
            index: 0,
            routes: [{ name: 'CompleteProfile' }],
          });
        } else {
          // Navigate to main app - reset stack to Main
          navigation.reset({
            index: 0,
            routes: [{ name: 'Main', params: { screen: 'Matches' } }],
          });
        }
        
        Alert.alert('Success', 'Account created successfully! (Test Mode - Auto-verified)');
        return;
      }

      if (res.data.verification_sent) {
        const signupData = {
          email: identifier.trim(),
          password,
          role,
          referral_code: role === 'matchmaker' ? referralCode.trim() : null,
          staySignedIn,
        };

        await AsyncStorage.setItem('signupData', JSON.stringify(signupData));
        await AsyncStorage.setItem('verificationToken', res.data.verification_token);

        Alert.alert(
          'Success',
          'Verification code sent! Please check your email for the verification code.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.navigate('EmailVerification', {
                  identifier: identifier.trim(),
                  verificationMethod: 'email'
                });
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to send verification code. Please try again.');
      }
    } catch (err) {
      // Don't close modal on error so user can try again
      const errorMsg = err.response?.data?.msg || 'Registration failed';
      Alert.alert('Error', errorMsg);
    }
  };

  const handleCloseTermsModal = () => {
    setShowTermsModal(false);
    setAgreeToTerms(false);
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
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/matchmate_logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join the community</Text>

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
          placeholder="Email"
          placeholderTextColor="#6b7280"
          value={identifier}
          keyboardType="email-address"
          autoCapitalize="none"
          onChangeText={handleEmailChange}
          blurOnSubmit={false}
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
            secureTextEntry={!showPassword}
            onChangeText={setPassword}
            blurOnSubmit={false}
            returnKeyType="next"
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
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
        <View style={styles.passwordRulesContainer}>
          <Text style={styles.passwordRulesTitle}>Password requirements:</Text>
          <Text
            style={[
              styles.passwordRuleText,
              passwordChecks.minLength ? styles.passwordRulePassed : styles.passwordRulePending,
            ]}
          >
            • At least 8 characters
          </Text>
          <Text
            style={[
              styles.passwordRuleText,
              passwordChecks.hasUppercase ? styles.passwordRulePassed : styles.passwordRulePending,
            ]}
          >
            • 1 uppercase letter
          </Text>
          <Text
            style={[
              styles.passwordRuleText,
              passwordChecks.hasLowercase ? styles.passwordRulePassed : styles.passwordRulePending,
            ]}
          >
            • 1 lowercase letter
          </Text>
          <Text
            style={[
              styles.passwordRuleText,
              passwordChecks.hasSpecial ? styles.passwordRulePassed : styles.passwordRulePending,
            ]}
          >
            • 1 special character
          </Text>
          {shouldSkipPasswordRules && (
            <Text style={styles.passwordRuleTestBypass}>
              Test email detected: password rules are optional for test mode.
            </Text>
          )}
        </View>
        <View style={styles.passwordInputWrapper}>
          <TextInput
            ref={confirmPasswordRef}
            style={[styles.input, styles.passwordInput]}
            placeholder="Confirm Password"
            placeholderTextColor="#6b7280"
            value={confirmPassword}
            secureTextEntry={!showConfirmPassword}
            onChangeText={setConfirmPassword}
            blurOnSubmit={false}
            returnKeyType={role === 'matchmaker' ? 'next' : 'done'}
            onSubmitEditing={() => {
              if (role === 'matchmaker') {
                referralRef.current?.focus();
              } else {
                handleSignUpClick();
              }
            }}
          />
          <TouchableOpacity
            style={styles.passwordToggleBtn}
            onPress={handleConfirmPasswordVisibilityToggle}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color="#6c5ce7"
            />
            <Text style={styles.passwordToggleText}>
              {showConfirmPassword ? 'Hide' : 'Show'}
            </Text>
          </TouchableOpacity>
        </View>
        {confirmPassword.length > 0 && password !== confirmPassword && (
          <Text style={styles.emailError}>Passwords do not match</Text>
        )}

        {role === 'matchmaker' && (
          <TextInput
            ref={referralRef}
            style={styles.input}
            placeholder="Enter Dater's Referral Code"
            placeholderTextColor="#6b7280"
            value={referralCode}
            onChangeText={setReferralCode}
            returnKeyType="done"
            onSubmitEditing={handleSignUpClick}
          />
        )}

        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => {
            Keyboard.dismiss();
            setAgreeToTexts(!agreeToTexts);
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, agreeToTexts && styles.checkboxChecked]}>
            {agreeToTexts && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>By checking this box, you agree to receive non promotional emails.</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => {
            Keyboard.dismiss();
            setStaySignedIn((prev) => !prev);
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, staySignedIn && styles.checkboxChecked]}>
            {staySignedIn && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>Remember Me</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSignUpClick}>
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

      {/* Terms of Service Modal */}
      <Modal
        visible={showTermsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseTermsModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Terms of Service</Text>
            
            <ScrollView style={styles.termsScrollView} contentContainerStyle={styles.termsContent}>
              <Text style={styles.termsText}>
                {`Last Updated: ${new Date().toLocaleDateString()}

1. ACCEPTANCE OF TERMS

By accessing or using this application, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, you may not use the application.

2. ELIGIBILITY

You must be at least 18 years old to use this application. By using the application, you represent and warrant that you meet this requirement.

3. USE LICENSE

Permission is granted to use this application for personal, non-commercial purposes only. This is the grant of a license, not a transfer of title. Under this license, you may not:

Modify or copy the application’s materials

Use the materials for any commercial purpose

Attempt to reverse engineer or decompile any software contained in the application

Remove copyright or proprietary notices

Mirror the application on any other server

4. USER ACCOUNTS

You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.

5. USER CONTENT

You retain ownership of the content you post on the application, including profile information, photos, and messages. By posting content, you grant matchmate a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content for the purpose of operating the application.

6. USER CONDUCT

You agree not to use the application to:

Harass, abuse, or harm other users

Impersonate any person or entity

Post illegal, misleading, or inappropriate content

Use the application for any unlawful purpose

Attempt to access accounts or data without authorization

7. SAFETY AND MODERATION

We reserve the right to review, remove, or restrict content and accounts that violate these Terms or that we believe may pose a risk to other users. We do not guarantee that all users are who they claim to be and encourage you to use caution when interacting with others.

8. PRIVACY POLICY

Your use of the application is governed by our Privacy Policy. Please review it to understand how we collect, use, and protect your information.

9. INTELLECTUAL PROPERTY

The application and its original content, features, and functionality are the exclusive property of matchmate and its licensors.

10. TERMINATION

We may suspend or terminate your account at any time, without notice, if you violate these Terms or misuse the application.

11. DISCLAIMER

The application is provided on an “as is” and “as available” basis. We make no warranties, expressed or implied, regarding the operation or availability of the application.

12. LIMITATION OF LIABILITY

In no event shall matchmate or its affiliates be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the application.

13. GOVERNING LAW

These Terms shall be governed and construed in accordance with applicable laws, without regard to conflict of law principles.

14. CHANGES TO TERMS

We reserve the right to modify these Terms at any time. If changes are material, we will provide notice before the updated Terms take effect.

15. CONTACT INFORMATION

If you have any questions about these Terms of Service, please contact us at: contact@matchmatedating.com`}
              </Text>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.termsCheckboxContainer}
                onPress={() => setAgreeToTerms(!agreeToTerms)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}>
                  {agreeToTerms && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.termsCheckboxLabel}>I agree to these terms of service</Text>
              </TouchableOpacity>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={handleCloseTermsModal}
                >
                  <Text style={styles.modalButtonCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonAccept, !agreeToTerms && styles.modalButtonDisabled]}
                  onPress={handleRegister}
                  disabled={!agreeToTerms}
                >
                  <Text style={[styles.modalButtonAcceptText, !agreeToTerms && styles.modalButtonTextDisabled]}>
                    Accept & Continue
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
    textAlign: 'center',
    marginBottom: 6,
    color: '#1a1a2e',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 28,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
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
  passwordRulesContainer: {
    marginTop: -6,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  passwordRulesTitle: {
    fontSize: 13,
    color: '#4a4a68',
    fontWeight: '600',
    marginBottom: 4,
  },
  passwordRuleText: {
    fontSize: 12,
    marginBottom: 2,
  },
  passwordRulePending: {
    color: '#6b7280',
  },
  passwordRulePassed: {
    color: '#16a34a',
  },
  passwordRuleTestBypass: {
    marginTop: 6,
    fontSize: 12,
    color: '#6c5ce7',
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#6c5ce7',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  loginText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#6b7280',
    fontSize: 14,
  },
  loginButton: {
    textAlign: 'center',
    color: '#6c5ce7',
    fontWeight: '600',
    marginTop: 5,
    fontSize: 15,
  },
  roleToggleWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  roleBtnText: {
    color: '#6c5ce7',
    fontWeight: '600',
  },
  activeRoleBtn: {
    backgroundColor: '#6c5ce7',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxHeight: '85%',
    padding: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
    color: '#1a1a2e',
  },
  termsScrollView: {
    maxHeight: 400,
    marginBottom: 16,
  },
  termsContent: {
    paddingBottom: 10,
  },
  termsText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4a4a68',
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 16,
  },
  termsCheckboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  termsCheckboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#4a4a68',
    marginLeft: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalButtonAccept: {
    backgroundColor: '#6c5ce7',
  },
  modalButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
  modalButtonCancelText: {
    color: '#1a1a2e',
    fontWeight: '600',
    fontSize: 16,
  },
  modalButtonAcceptText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  modalButtonTextDisabled: {
    color: '#6b7280',
  },
});

export default SignUpScreen;
