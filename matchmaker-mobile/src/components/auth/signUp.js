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
  Modal,
  Keyboard,
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
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const identifierRef = useRef(null);
  const passwordRef = useRef(null);
  const referralRef = useRef(null);

  // Helper function to detect if identifier is email or phone
  const isEmail = (value) => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(value);
  };

  const handleSignUpClick = () => {
    // Validate basic fields first
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

      if (res.data.verification_sent) {
        // Store signup data in AsyncStorage for verification
        const signupData = {
          email: isEmailInput ? identifier.trim() : null,
          phone_number: !isEmailInput ? identifier.trim() : null,
          password,
          role,
          referral_code: role === 'matchmaker' ? referralCode.trim() : null
        };

        await AsyncStorage.setItem('signupData', JSON.stringify(signupData));
        await AsyncStorage.setItem('verificationToken', res.data.verification_token);

        // Navigate to verification screen
        const method = isEmailInput ? 'email' : 'phone';
        const message = isEmailInput
          ? 'Verification code sent! Please check your email for the verification code.'
          : 'Verification code sent! Please check your phone for the verification code.';

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
        Alert.alert('Error', 'Failed to send verification code. Please try again.');
      }
    } catch (err) {
        Alert.alert('Error', err.response?.data?.msg || 'Registration failed');
    } finally {
      setShowTermsModal(false);
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
              handleSignUpClick();
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
          <Text style={styles.checkboxLabel}>By checking this box, you agree to receive non promotional texts or emails.</Text>
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

By accessing and using this application, you accept and agree to be bound by the terms and provision of this agreement.

2. USE LICENSE

Permission is granted to temporarily use this application for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:

- Modify or copy the materials;
- Use the materials for any commercial purpose or for any public display;
- Attempt to decompile or reverse engineer any software contained in the application;
- Remove any copyright or other proprietary notations from the materials; or
- Transfer the materials to another person or "mirror" the materials on any other server.

3. USER ACCOUNTS

You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account or password.

4. USER CONDUCT

You agree to use the application only for lawful purposes and in a way that does not infringe the rights of, restrict or inhibit anyone else's use and enjoyment of the application.

5. PRIVACY POLICY

Your use of the application is also governed by our Privacy Policy. Please review our Privacy Policy to understand our practices.

6. INTELLECTUAL PROPERTY

The application and its original content, features, and functionality are and will remain the exclusive property of the application and its licensors.

7. TERMINATION

We may terminate or suspend your account and bar access to the application immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever and without limitation.

8. DISCLAIMER

The information on this application is provided on an "as is" basis. To the fullest extent permitted by law, this application excludes all representations, warranties, and conditions.

9. LIMITATION OF LIABILITY

In no event shall the application, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages.

10. GOVERNING LAW

These terms shall be governed and construed in accordance with the laws, without regard to its conflict of law provisions.

11. CHANGES TO TERMS

We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect.

12. CONTACT INFORMATION

If you have any questions about these Terms of Service, please contact us.`}
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
    paddingTop: 300,
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
    color: '#333',
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
    lineHeight: 20,
    color: '#333',
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
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
    color: '#333',
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
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f0f0f0',
  },
  modalButtonAccept: {
    backgroundColor: '#6B46C1',
  },
  modalButtonDisabled: {
    backgroundColor: '#ccc',
  },
  modalButtonCancelText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 16,
  },
  modalButtonAcceptText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  modalButtonTextDisabled: {
    color: '#999',
  },
});

export default SignUpScreen;
