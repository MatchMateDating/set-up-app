import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../env';
import { getImageUrl } from '../profile/utils/profileUtils';
import { fetchWithRetry, isNetworkFailure } from '../../utils/fetchWithRetry';

const ACCENT_PURPLE = '#6c5ce7';

const getSelectedDaterId = (userInfo) => {
  const raw = userInfo?.referrer_id ?? userInfo?.referred_by_id;
  if (raw == null || raw === '') return null;
  const parsed = parseInt(String(raw), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const DaterDropdown = ({ userInfo, onDaterChange, showLabel = false, labelText = "YOU'RE CHOOSING FOR" }) => {
  const [open, setOpen] = useState(false);
  const [linkedDaters, setLinkedDaters] = useState([]);
  const [selectedDater, setSelectedDater] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectingDaterId, setSelectingDaterId] = useState(null);
  const autoSelectInFlightRef = useRef(false);

  useEffect(() => {
    if (userInfo && userInfo.role === 'matchmaker') {
      setLoading(true);
      fetchLinkedDaters();
    }
  }, [userInfo?.id, userInfo?.referrer_id, userInfo?.referred_by_id, JSON.stringify(userInfo?.linked_daters || []), API_BASE_URL]);

  useEffect(() => {
    if (!userInfo || userInfo.role !== 'matchmaker' || linkedDaters.length === 0) {
      return;
    }

    const currentSelectedId = getSelectedDaterId(userInfo);
    let targetDater = null;

    if (currentSelectedId) {
      targetDater = linkedDaters.find((d) => d.id === currentSelectedId);
      if (!targetDater && linkedDaters.length > 0) {
        targetDater = linkedDaters[0];
      }
    } else if (linkedDaters.length > 0) {
      targetDater = linkedDaters[0];
    }

    if (targetDater) {
      setSelectedDater((prev) => {
        if (!prev || prev.id !== targetDater.id) {
          return targetDater;
        }
        return prev;
      });
    }
  }, [userInfo?.referrer_id, userInfo?.referred_by_id, linkedDaters]);

  const fetchLinkedDaters = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const res = await fetchWithRetry(
        `${API_BASE_URL}/referral/referrals/${userInfo.id}`,
        { headers: { Authorization: `Bearer ${token}` } },
        { retries: 3, baseDelayMs: 400 }
      );

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          await AsyncStorage.removeItem('token');
          return;
        }
      }

      if (!res.ok) {
        throw new Error('Failed to fetch linked daters');
      }

      const data = await res.json();
      const daters = data.linked_daters || [];
      setLinkedDaters(daters);
      if (daters.length === 0) {
        setSelectedDater(null);
      }

      const currentSelectedId = getSelectedDaterId(userInfo);
      if (currentSelectedId) {
        const selected = daters.find((d) => d.id === currentSelectedId);
        if (selected) {
          setSelectedDater(selected);
        } else if (daters.length > 0) {
          setSelectedDater(daters[0]);
        }
      } else if (daters.length > 0) {
        setSelectedDater(daters[0]);
      }
    } catch (err) {
      console.error('Error fetching linked daters:', err);
      Alert.alert('Error', 'Failed to load linked daters');
    } finally {
      setLoading(false);
    }
  };

  const applyDaterSelection = (dater) => {
    setSelectedDater(dater);
    setOpen(false);
    if (onDaterChange) {
      onDaterChange(dater.id);
    }
  };

  const verifySelectedDaterOnServer = async (daterId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return false;

      const res = await fetchWithRetry(
        `${API_BASE_URL}/profile/`,
        { headers: { Authorization: `Bearer ${token}` } },
        { retries: 3, baseDelayMs: 400 }
      );
      if (!res.ok) return false;

      const data = await res.json().catch(() => ({}));
      return getSelectedDaterId(data.user) === Number(daterId);
    } catch (err) {
      console.error('Error verifying selected dater:', err);
      return false;
    }
  };

  const persistSelectedDater = async (dater, { showErrors = true } = {}) => {
    if (!dater?.id) return false;

    setSelectingDaterId(dater.id);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        if (showErrors) Alert.alert('Error', 'Please log in');
        return false;
      }

      const res = await fetchWithRetry(
        `${API_BASE_URL}/referral/set_selected_dater`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ selected_dater_id: dater.id }),
        },
        { retries: 3, baseDelayMs: 400 }
      );

      if (res.status === 401) {
        const data = await res.json().catch(() => ({}));
        if (data.error_code === 'TOKEN_EXPIRED') {
          await AsyncStorage.removeItem('token');
          return false;
        }
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (await verifySelectedDaterOnServer(dater.id)) {
          applyDaterSelection(dater);
          return true;
        }
        if (showErrors) {
          Alert.alert('Error', data.error || 'Failed to set selected dater');
        }
        return false;
      }

      applyDaterSelection(dater);
      return true;
    } catch (err) {
      console.error('Error setting selected dater:', err);
      if (await verifySelectedDaterOnServer(dater.id)) {
        applyDaterSelection(dater);
        return true;
      }
      if (showErrors) {
        Alert.alert(
          'Error',
          isNetworkFailure(err)
            ? 'Could not reach the server. Check your connection and try again.'
            : 'Failed to set selected dater'
        );
      }
      return false;
    } finally {
      setSelectingDaterId(null);
    }
  };

  const handleDaterSelect = async (dater) => {
    if (selectingDaterId != null) return;
    await persistSelectedDater(dater, { showErrors: true });
  };

  useEffect(() => {
    if (!userInfo || userInfo.role !== 'matchmaker' || loading || linkedDaters.length === 0) {
      return;
    }
    if (getSelectedDaterId(userInfo) != null || selectingDaterId != null) {
      return;
    }

    const firstDater = linkedDaters[0];
    if (!firstDater?.id || autoSelectInFlightRef.current) {
      return;
    }

    autoSelectInFlightRef.current = true;
    persistSelectedDater(firstDater, { showErrors: false }).finally(() => {
      autoSelectInFlightRef.current = false;
    });
  }, [
    userInfo?.referrer_id,
    userInfo?.referred_by_id,
    userInfo?.role,
    linkedDaters,
    loading,
    selectingDaterId,
  ]);

  const handleToggleOpen = () => {
    setOpen((prev) => !prev);
  };

  if (!userInfo || userInfo.role !== 'matchmaker' || loading) {
    return null;
  }

  if (linkedDaters.length === 0) {
    return (
      <View style={styles.wrapper}>
        {showLabel ? <Text style={styles.label}>{labelText}</Text> : null}
        <View style={styles.headerSingle}>
          <Text style={styles.placeholder}>No daters available</Text>
        </View>
      </View>
    );
  }

  const selected = selectedDater || linkedDaters[0];
  const isMulti = linkedDaters.length > 1;

  const renderAvatar = (dater, size = 'md') => (
    dater?.first_image ? (
      <Image
        source={{ uri: getImageUrl(dater.first_image, API_BASE_URL) }}
        style={size === 'sm' ? styles.avatarSm : styles.avatar}
      />
    ) : (
      <View style={[size === 'sm' ? styles.avatarSm : styles.avatar, styles.avatarPlaceholder]} />
    )
  );

  return (
    <View style={styles.wrapper}>
      {showLabel ? <Text style={styles.label}>{labelText}</Text> : null}

      <View style={styles.dropdownAnchor}>
        {isMulti ? (
          <TouchableOpacity
            style={[styles.header, open && styles.headerOpen]}
            onPress={handleToggleOpen}
            activeOpacity={0.85}
          >
            {renderAvatar(selected)}
            <Text style={styles.name} numberOfLines={1}>
              {selected?.name || 'Select a dater'}
            </Text>
            <Ionicons
              name={open ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#9ca3af"
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSingle}>
            {renderAvatar(selected)}
            <Text style={styles.name} numberOfLines={1}>
              {selected?.name || 'Select a dater'}
            </Text>
          </View>
        )}

        {open && isMulti ? (
          <View style={styles.menu}>
            {linkedDaters.map((dater, index) => {
              const isSelected = selectedDater?.id === dater.id;
              return (
                <View key={dater.id}>
                  {index > 0 ? <View style={styles.divider} /> : null}
                  <TouchableOpacity
                    style={styles.option}
                    onPress={() => handleDaterSelect(dater)}
                    disabled={selectingDaterId != null}
                    activeOpacity={0.7}
                  >
                    {renderAvatar(dater, 'sm')}
                    <Text style={styles.optionName} numberOfLines={1}>
                      {dater.name}
                    </Text>
                    {isSelected ? (
                      <Ionicons name="checkmark" size={20} color={ACCENT_PURPLE} />
                    ) : (
                      <View style={styles.checkPlaceholder} />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: '#9ca3af',
    marginBottom: 4,
  },
  dropdownAnchor: {
    position: 'relative',
    zIndex: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 52,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  headerOpen: {
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  headerSingle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 52,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarSm: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    backgroundColor: '#f3f4f6',
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  placeholder: {
    fontSize: 14,
    color: '#9ca3af',
  },
  menu: {
    marginTop: 4,
    backgroundColor: '#ffffff',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  optionName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  checkPlaceholder: {
    width: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 14,
  },
});

export default DaterDropdown;
