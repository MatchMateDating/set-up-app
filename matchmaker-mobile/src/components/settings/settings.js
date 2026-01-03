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
import { API_BASE_URL, SIGNUP_URL } from '../../env';
import FormField from '../profile/components/formField';
import MultiSelectGender from '../profile/components/multiSelectGender';
import MultiSlider from '@ptomasroos/react-native-multi-slider';

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
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralInput, setReferralInput] = useState('');
  const radiusUnit = user?.unit === 'imperial' ? 'mi' : 'km';
  const radiusMax = radiusUnit === 'km' ? 800 : 500;
  const [formData, setFormData] = useState({
    preferredAgeMin: '0',
    preferredAgeMax: '0',
    preferredGenders: [],
    matchRadius: 50,
    fontFamily: 'Arial',
    profileStyle: 'classic',
    imageLayout: 'grid'
  });
  const displayRadius = user?.unit === 'imperial'
      ? Math.round(formData.matchRadius * 0.621371)
      : formData.matchRadius;
  const [originalFormData, setOriginalFormData] = useState(null);

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
      
      // Only set referralCode for daters (users) - for matchmakers, keep it empty for the input field
      if (data.user.role === 'user' && data.user?.referral_code) {
        setReferralCode(data.user.referral_code);
      } else {
        setReferralCode(''); // Clear referral code for matchmakers
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
        matchRadius: user.match_radius ?? 50,
        fontFamily: user.fontFamily || 'Arial',
        profileStyle: user.profileStyle || 'classic',
        imageLayout: user.imageLayout || 'grid'
      };
      setFormData(baseFormData);
    }
  }, [user]);

//  useEffect(() => {
//    if (!user) return;
//
//    setFormData(prev => {
//      let newRadius = prev.matchRadius;
//
//      if (user.unit === 'imperial') {
//        newRadius = Math.round(prev.matchRadius * 0.621371);
//      } else {
//        newRadius = Math.round(prev.matchRadius / 0.621371);
//      }
//
//      return {
//        ...prev,
//        matchRadius: Math.min(newRadius, radiusMax),
//      };
//    });
//  }, [user?.unit]);

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
        // Refresh user profile to get updated linked daters list
        fetchUserProfile();
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
        preferredAgeMin: Number(formData.preferredAgeMin),
        preferredAgeMax: Number(formData.preferredAgeMax),
        preferredGenders: formData.preferredGenders,
        matchRadius: Number(formData.matchRadius),
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
    if (originalFormData) {
        setFormData(originalFormData);
    }
    setEditing(false);
  };

  const handleCreateDaterAccount = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/profile/create_linked_dater`, {
        method: 'POST',
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

      if (!res.ok) {
        const data = await res.json();
        Alert.alert('Error', data.error || 'Failed to create dater account');
        return;
      }

      const data = await res.json();
      // Update token to switch to dater account context
      if (data.token) {
        await AsyncStorage.setItem('token', data.token);
      }
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      Alert.alert('Success', 'Dater account created! You can now complete your profile.');
      navigation.navigate('CompleteProfile');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to create dater account');
    }
  };

  const handleCreateMatchmakerAccount = () => {
    setShowReferralModal(true);
  };

  const submitCreateMatchmaker = async () => {
    if (!referralInput.trim()) {
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

      const res = await fetch(`${API_BASE_URL}/profile/create_linked_matchmaker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ referral_code: referralInput.trim() }),
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

      if (!res.ok) {
        const data = await res.json();
        Alert.alert('Error', data.error || 'Failed to create matchmaker account');
        return;
      }

      const data = await res.json();
      // Update token to switch to matchmaker account context
      if (data.token) {
        await AsyncStorage.setItem('token', data.token);
      }
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      setShowReferralModal(false);
      setReferralInput('');
      Alert.alert('Success', 'Matchmaker account created successfully!');
      fetchUserProfile();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to create matchmaker account');
    }
  };

  const handleSwitchAccount = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/profile/switch_account`, {
        method: 'POST',
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

      if (!res.ok) {
        const data = await res.json();
        Alert.alert('Error', data.error || 'Failed to switch account');
        return;
      }

      const data = await res.json();
      await AsyncStorage.setItem('token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      Alert.alert('Success', `Switched to ${data.user.role} account`);
      fetchUserProfile();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to switch account');
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Settings</Text>

        {/* Role Toggle - Show if user has both accounts */}
        {user?.linked_account && (
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Account Type</Text>
            <Text style={styles.cardDescription}>
              You have both a dater and matchmaker account. Switch between them below.
            </Text>
            <TouchableOpacity style={styles.switchBtn} onPress={handleSwitchAccount}>
              <Text style={styles.switchBtnText}>
                Switch to {user.linked_account.role === 'matchmaker' ? 'Matchmaker' : 'Dater'} Account
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Create Matchmaker Account Button - Show if user is dater and doesn't have linked account */}
        {role === 'user' && !user?.linked_account && (
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Create Matchmaker Account</Text>
            <Text style={styles.cardDescription}>
              Create a matchmaker account linked to your dater account. Both accounts will share the same email and password.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateMatchmakerAccount}>
              <Text style={styles.primaryBtnText}>Create Matchmaker Account</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Create Dater Account Button - Show if user is matchmaker and doesn't have linked account */}
        {role === 'matchmaker' && !user?.linked_account && (
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Create Dater Account</Text>
            <Text style={styles.cardDescription}>
              Create a dater account linked to your matchmaker account. Both accounts will share the same email and password.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateDaterAccount}>
              <Text style={styles.primaryBtnText}>Create Dater Account</Text>
            </TouchableOpacity>
          </View>
        )}

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

        {/* Referral Code Modal for Matchmaker Account Creation */}
        <Modal
          visible={showReferralModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowReferralModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create Matchmaker Account</Text>
              <Text style={styles.modalSubtitle}>Enter a referral code to create your matchmaker account</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter referral code"
                placeholderTextColor="#999"
                value={referralInput}
                onChangeText={setReferralInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowReferralModal(false);
                    setReferralInput('');
                  }}
                >
                  <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSend]}
                  onPress={submitCreateMatchmaker}
                >
                  <Text style={styles.modalButtonTextSend}>Create</Text>
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
                  <TouchableOpacity onPress={() => {
                                            setOriginalFormData({ ...formData });
                                            setEditing(true);
                                            }}
                  >
                    <Ionicons name="create-outline" size={24} color="#6B46C1" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <FormField
              label={editing
               ? `Preferred Age (${formData.preferredAgeMin}–${formData.preferredAgeMax})`
               : 'Preferred Age'}
              editing={editing}
              value={
                formData.preferredAgeMin || formData.preferredAgeMax
                  ? `${formData.preferredAgeMin || ''} - ${formData.preferredAgeMax || ''}`
                  : ''
              }
              input={
                editing ? (
                  <View style={{ alignItems: 'center', marginTop: 10 }}>
                      <MultiSlider
                        values={[
                          Number(formData.preferredAgeMin) || 18,
                          Number(formData.preferredAgeMax) || 60,
                        ]}
                        min={18}
                        max={100}
                        step={1}
                        sliderLength={280}
                        onValuesChange={(values) => {
                          handleInputChangeWrapper('preferredAgeMin', values[0].toString());
                          handleInputChangeWrapper('preferredAgeMax', values[1].toString());
                        }}
                        selectedStyle={{ backgroundColor: '#6B46C1' }}
                        unselectedStyle={{ backgroundColor: '#E5E7EB' }}
                        markerStyle={{
                          backgroundColor: '#6B46C1',
                          height: 22,
                          width: 22,
                          borderRadius: 11,
                          borderWidth: 0,
                        }}
                        trackStyle={{ height: 6, borderRadius: 3 }}
                        containerStyle={{ height: 40 }}
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

            <FormField
              label={
                editing ? `Match Radius (${displayRadius} ${radiusUnit})`
                    : `Match Radius (${radiusUnit})`
              }
              editing={editing}
              value={
                formData.matchRadius
              }
              input={
                editing ? (
                  <View style={{ alignItems: 'center', marginTop: 10 }}>
                      <MultiSlider
                        values={[formData.matchRadius]}
                        min={1}
                        max={radiusMax}
                        step={1}
                        sliderLength={280}
                        onValuesChange={(values) => {
                            const displayValue = values[0];

                                const canonicalKm =
                                  user?.unit === 'imperial'
                                    ? Math.round(displayValue / 0.621371)
                                    : displayValue;
                            handleInputChangeWrapper('matchRadius', values[0]);
                        }}
                        selectedStyle={{ backgroundColor: '#6B46C1' }}
                        unselectedStyle={{ backgroundColor: '#E5E7EB' }}
                        markerStyle={{
                          backgroundColor: '#6B46C1',
                          height: 22,
                          width: 22,
                          borderRadius: 11,
                        }}
                        trackStyle={{ height: 6, borderRadius: 3 }}
                        containerStyle={{ height: 40 }}
                        enableLabel={false}
                        allowOverlap={false}
                        snapped
                      />
                  </View>
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
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 40,
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
  cardDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  switchBtn: {
    backgroundColor: '#6B46C1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  switchBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
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
