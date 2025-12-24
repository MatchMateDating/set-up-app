import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Share,
  Modal,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { API_BASE_URL, SIGNUP_URL } from '@env';
import FormField from '../profile/components/formField';
import MultiSelectGender from '../profile/components/multiSelectGender';

const Settings = () => {
  const [referralCode, setReferralCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [role, setRole] = useState(null);
  const [savedReferrals, setSavedReferrals] = useState([]);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [editing, setEditing] = useState(false);
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    preferredAgeMin: '0',
    preferredAgeMax: '0',
    preferredGenders: [],
    fontFamily: 'Arial',
    profileStyle: 'classic',
    imageLayout: 'grid'
  });

  const fetchUserProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/profile/`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          await AsyncStorage.removeItem('token');
          Alert.alert('Session expired', 'Please log in again.');
          navigation.navigate('Login');
          return;
        }
      }

      if (!res.ok) throw new Error('Failed to fetch user profile');
      const data = await res.json();
      setUser(data.user);
      setRole(data.user.role);
      if (data.user?.referral_code) {
        setReferralCode(data.user.referral_code);
      }

      if (data.user.role === 'matchmaker') {
        const linkedRes = await fetch(
          `${API_BASE_URL}/referral/referrals/${data.user.id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (linkedRes.ok) {
          const linkedData = await linkedRes.json();
          setSavedReferrals(linkedData.linked_daters || []);
        }
      }

      await AsyncStorage.setItem('user', JSON.stringify(data.user));
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load settings');
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  useEffect(() => {
    if (user) {
      const baseFormData = {
        preferredAgeMin: user.preferredAgeMin || '',
        preferredAgeMax: user.preferredAgeMax || '',
        preferredGenders: user.preferredGenders || [],
        fontFamily: user.fontFamily || 'Arial',
        profileStyle: user.profileStyle || 'classic',
        imageLayout: user.imageLayout || 'grid'
      };
      setFormData(baseFormData);
    }
  }, [user]);

  const handleToggleCode = () => setShowCode((prev) => !prev);

  const handleShare = async () => {
    try {
      const shareUrl = `${SIGNUP_URL || 'https://yourapp.com/signup'}?ref=${referralCode}`;
      await Share.share({
        message: `Join this app! Sign up using my referral code: ${referralCode}\n${shareUrl}`,
        title: 'Join this app!',
      });
    } catch (err) {
      console.error('Error sharing:', err);
      Alert.alert('Error', 'Failed to share');
    }
  };

  const handleInvite = () => {
    setShowEmailModal(true);
  };

  const sendInvite = async () => {
    if (!emailInput.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/invite/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: emailInput, referralCode }),
      });

      if (res.ok) {
        Alert.alert('Success', 'Email invite sent!');
        setEmailInput('');
        setShowEmailModal(false);
      } else {
        const data = await res.json();
        Alert.alert('Error', data.error || 'Failed to send invite');
      }
    } catch (err) {
      console.error('Error sending invite:', err);
      Alert.alert('Error', 'Failed to send invite');
    }
  };

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(referralCode);
      Alert.alert('Success', 'Referral code copied to clipboard!');
    } catch (err) {
      console.error('Error copying:', err);
      Alert.alert('Error', 'Failed to copy');
    }
  };

  const handleSaveReferral = async () => {
    const code = referralCode.trim();
    if (!code) {
      Alert.alert('Error', 'Please enter a referral code');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/referral/link_referral`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ referral_code: code }),
      });

      const data = await res.json();
      if (res.ok) {
        let name = data.message.split(' linked')[0];
        name = name.replace(/^Dater\s*/i, '').trim();
        const newDater = { name, referral_code: code };
        setSavedReferrals((prev) => [...prev, newDater]);
        setReferralCode('');
        Alert.alert('Success', 'Referral code linked successfully!');
      } else {
        Alert.alert('Error', data.error || 'Failed to link referral');
      }
    } catch (err) {
      console.error('Error linking referral:', err);
      Alert.alert('Error', 'Failed to link referral');
    }
  };

  const handleSignOut = async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (err) {
      console.error('Error signing out:', err);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const handleInputChange = (e) => {
    const name = e.target?.name || e.name;
    const value = e.target?.value !== undefined ? e.target.value : e.value;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleInputChangeWrapper = (name, value) => {
    handleInputChange({ target: { name, value } });
  };

  const handleSave = () => {
    fetchUserProfile();
    setEditing(false);
  };

  const handleFormSubmit = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const payload = {
        preferredAgeMin: formData.preferredAgeMin,
        preferredAgeMax: formData.preferredAgeMax,
        preferredGenders: formData.preferredGenders,
        fontFamily: formData.fontFamily,
        profileStyle: formData.profileStyle
      };

      const res = await fetch(`${API_BASE_URL}/profile/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          await AsyncStorage.removeItem('token');
          Alert.alert('Session expired', 'Please log in again.');
          navigation.navigate('Login');
          return;
        }
      }

      if (!res.ok) throw new Error('Failed to update profile');
      
      await res.json();
      Alert.alert('Success', 'Dating preferences updated successfully');
      handleSave();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleCancel = () => {
    setEditing(false);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Settings</Text>

        {/* User Referral Code */}
        {role === 'user' && (
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Your Referral Code</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleToggleCode}>
              <Text style={styles.primaryBtnText}>
                {showCode ? 'Hide Code' : 'Show Code'}
              </Text>
            </TouchableOpacity>
            {showCode && (
              <View style={styles.referralDisplay}>
                <View style={styles.referralCodeBox}>
                  <Text style={styles.referralCodeText}>{referralCode}</Text>
                </View>
                <View style={styles.buttonGroup}>
                  <TouchableOpacity style={styles.iconBtn} onPress={handleCopy}>
                    <Ionicons name="copy-outline" size={24} color="#6B46C1" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={handleShare}>
                    <Ionicons name="share-outline" size={24} color="#6B46C1" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={handleInvite}>
                    <Ionicons name="mail-outline" size={24} color="#6B46C1" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Matchmaker Referral Linking */}
        {role === 'matchmaker' && (
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Link Additional Daters</Text>
            <View style={styles.referralInputGroup}>
              <TextInput
                style={styles.referralInput}
                value={referralCode}
                placeholder="Enter referral code"
                onChangeText={setReferralCode}
                placeholderTextColor="#999"
              />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveReferral}>
                <Ionicons name="person-add-outline" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.savedReferrals}>
              <Text style={styles.savedReferralsTitle}>Linked Daters</Text>
              {savedReferrals.length > 0 ? (
                <View style={styles.referralList}>
                  {savedReferrals.map((ref, idx) => (
                    <View key={idx} style={styles.referralItem}>
                      <Text style={styles.referralName}>{ref.name}</Text>
                      <View style={styles.referralTag}>
                        <Text style={styles.referralTagText}>{ref.referral_code}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyState}>No linked daters yet.</Text>
              )}
            </View>
          </View>
        )}

        {/* Email Invite Modal */}
        <Modal
          visible={showEmailModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowEmailModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Invite by Email</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter email address"
                placeholderTextColor="#999"
                value={emailInput}
                onChangeText={setEmailInput}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowEmailModal(false);
                    setEmailInput('');
                  }}
                >
                  <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSend]}
                  onPress={sendInvite}
                >
                  <Text style={styles.modalButtonTextSend}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* User Dating Preferences */}
        {role === 'user' && (
          <View style={styles.cardActions}>
            <View style={styles.cardActionsHeader}>
              <Text style={styles.cardHeader}>Dating Preferences</Text>
              {!editing && (
                <View style={styles.profileActions}>
                  <TouchableOpacity onPress={() => setEditing(true)}>
                    <Ionicons name="create-outline" size={24} color="#6B46C1" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <View style={styles.preferencesCard}>
              <FormField
                label="Preferred Age"
                editing={editing}
                value={
                  (formData.preferredAgeMin && formData.preferredAgeMax) ?
                  `${formData.preferredAgeMin ?? ''} - ${formData.preferredAgeMax ?? ''}` 
                  : ""
                }
                input={
                  editing ? (
                    <View style={styles.ageInputContainer}>
                    <TextInput
                      style={[styles.input, styles.ageInput]}
                      value={formData.preferredAgeMin?.toString() ?? ''}
                      onChangeText={(value) => handleInputChangeWrapper('preferredAgeMin', value)}
                      placeholder="Min"
                      keyboardType="numeric"
                    />
                    <TextInput
                      style={[styles.input, styles.ageInput]}
                      value={formData.preferredAgeMax?.toString() ?? ''}
                      onChangeText={(value) => handleInputChangeWrapper('preferredAgeMax', value)}
                      placeholder="Max"
                      keyboardType="numeric"
                    />
                  </View>
                  ) : null
                }
              />

              <FormField
                label="Preferred Gender(s)"
                editing={editing}
                value={(formData.preferredGenders || []).join(', ')}
                input={
                  editing ? (
                    <MultiSelectGender
                      selected={formData.preferredGenders || []}
                      onChange={(newList) => handleInputChangeWrapper("preferredGenders", newList)}
                    />
                  ) : null
                }
              />

              {editing && (
                <View style={styles.formActions}>
                  <TouchableOpacity style={styles.saveBtn} onPress={handleFormSubmit}>
                    <Text style={styles.saveBtnText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f4fc',
    paddingTop: 40,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#222',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardActions: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardActionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  cardHeader: {
    fontSize: 20,
    fontWeight: '600',
    color: '#222',
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: '#6B46C1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  referralDisplay: {
    marginTop: 16,
  },
  referralCodeBox: {
    backgroundColor: '#f6f4fc',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#6B46C1',
  },
  referralCodeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6B46C1',
    textAlign: 'center',
    letterSpacing: 2,
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f6f4fc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  referralInputGroup: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  referralInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e6ef',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B46C1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  savedReferrals: {
    marginTop: 20,
  },
  savedReferralsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
    marginBottom: 12,
  },
  referralList: {
    gap: 12,
  },
  referralItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f6f4fc',
    borderRadius: 8,
  },
  referralName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  referralTag: {
    backgroundColor: '#6B46C1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  referralTagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e0e6ef',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalButtonCancel: {
    backgroundColor: 'transparent',
  },
  modalButtonSend: {
    backgroundColor: '#6B46C1',
  },
  modalButtonTextCancel: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextSend: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutBtn: {
    marginTop: 32,
    backgroundColor: '#E53E3E',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  signOutBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  ageInputContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 30
  },
  ageInput: {
    width: 80,
  },
  input: {
    borderBottomWidth: 2,
    borderBottomColor: '#e0e6ef',
    padding: 8,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    justifyContent: 'flex-end',
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#6B46C1',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ebe7fb',
  },
  cancelBtnText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Settings;
