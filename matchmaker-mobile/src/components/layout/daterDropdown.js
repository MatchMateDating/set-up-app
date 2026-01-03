import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL } from '../../env';

const DaterDropdown = ({ userInfo, onDaterChange }) => {
  const [open, setOpen] = useState(false);
  const [linkedDaters, setLinkedDaters] = useState([]);
  const [selectedDater, setSelectedDater] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userInfo && userInfo.role === 'matchmaker') {
      fetchLinkedDaters();
    }
  }, [userInfo?.id, API_BASE_URL]);

  // Update selected dater when userInfo.referrer_id or linkedDaters changes
  // This ensures the dropdown stays in sync when navigating between pages
  useEffect(() => {
    if (!userInfo || userInfo.role !== 'matchmaker' || linkedDaters.length === 0) {
      return;
    }

    const currentSelectedId = userInfo.referrer_id;
    let targetDater = null;

    if (currentSelectedId) {
      targetDater = linkedDaters.find(d => d.id === parseInt(currentSelectedId));
      // If referrer_id doesn't match any dater, fallback to first dater
      if (!targetDater && linkedDaters.length > 0) {
        targetDater = linkedDaters[0];
      }
    } else if (linkedDaters.length > 0) {
      // If referrer_id is null/undefined, use first dater
      targetDater = linkedDaters[0];
    }

    // Always update to ensure sync - React will handle preventing unnecessary re-renders
    if (targetDater) {
      setSelectedDater(prev => {
        // Only update if different to avoid unnecessary re-renders
        if (!prev || prev.id !== targetDater.id) {
          return targetDater;
        }
        return prev;
      });
    }
  }, [userInfo?.referrer_id, linkedDaters]);

  const fetchLinkedDaters = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`${API_BASE_URL}/referral/referrals/${userInfo.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          await AsyncStorage.removeItem('token');
          Alert.alert('Session expired', 'Please log in again.');
          return;
        }
      }

      if (!res.ok) {
        throw new Error('Failed to fetch linked daters');
      }

      const data = await res.json();
      const daters = data.linked_daters || [];
      setLinkedDaters(daters);

      // Set selected dater based on userInfo.referrer_id
      // The useEffect will handle syncing when userInfo changes
      const currentSelectedId = userInfo.referrer_id;
      if (currentSelectedId) {
        const selected = daters.find(d => d.id === parseInt(currentSelectedId));
        if (selected) {
          setSelectedDater(selected);
        } else if (daters.length > 0) {
          // Fallback to first dater if referrer_id doesn't match
          setSelectedDater(daters[0]);
        }
      } else if (daters.length > 0) {
        // Set to first dater if referrer_id is null/undefined
        setSelectedDater(daters[0]);
      }
    } catch (err) {
      console.error('Error fetching linked daters:', err);
      Alert.alert('Error', 'Failed to load linked daters');
    } finally {
      setLoading(false);
    }
  };

  const handleDaterSelect = async (dater) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/referral/set_selected_dater`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ selected_dater_id: dater.id }),
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          await AsyncStorage.removeItem('token');
          Alert.alert('Session expired', 'Please log in again.');
          return;
        }
      }

      if (!res.ok) {
        const data = await res.json();
        Alert.alert('Error', data.error || 'Failed to set selected dater');
        return;
      }

      // Immediately update the selected dater for instant UI feedback
      setSelectedDater(dater);
      setOpen(false);
      
      // Call onDaterChange to refresh userInfo on all pages
      if (onDaterChange) {
        onDaterChange(dater.id);
      }
      
      // Also refresh userInfo in the dropdown's context by triggering a re-fetch
      // This ensures the dropdown stays in sync even if parent components don't update
      // We'll let the useEffect handle the sync when userInfo updates
    } catch (err) {
      console.error('Error setting selected dater:', err);
      Alert.alert('Error', 'Failed to set selected dater');
    }
  };

  if (!userInfo || userInfo.role !== 'matchmaker' || loading) {
    return null;
  }

  if (linkedDaters.length === 0) {
    return null;
  }

  const selected = selectedDater || linkedDaters[0];

  return (
    <View style={styles.container}>
      {linkedDaters.length === 1 ? (
        <View style={styles.headerSingle}>
          {selected?.first_image ? (
            <>
              <Image
                source={{ uri: `${API_BASE_URL}${selected.first_image}` }}
                style={styles.image}
              />
              <Text style={styles.name}>{selected.name}</Text>
            </>
          ) : (
            <Text style={styles.placeholder}>Select a dater</Text>
          )}
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.header, open && styles.headerOpen]}
            onPress={() => setOpen(!open)}
          >
            {selected?.first_image ? (
              <>
                <Image
                  source={{ uri: `${API_BASE_URL}${selected.first_image}` }}
                  style={styles.image}
                />
                <Text style={styles.name}>{selected.name}</Text>
              </>
            ) : (
              <Text style={styles.placeholder}>Select a dater</Text>
            )}
            <Ionicons
              name={open ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#9ca3af"
              style={styles.chevron}
            />
          </TouchableOpacity>

          <Modal
            visible={open}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setOpen(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setOpen(false)}
            >
              <View style={styles.menu}>
                <ScrollView>
                  {linkedDaters.map((dater) => (
                    <TouchableOpacity
                      key={dater.id}
                      style={[
                        styles.option,
                        selectedDater?.id === dater.id && styles.optionActive,
                      ]}
                      onPress={() => handleDaterSelect(dater)}
                    >
                      {dater.first_image ? (
                        <Image
                          source={{ uri: `${API_BASE_URL}${dater.first_image}` }}
                          style={styles.image}
                        />
                      ) : (
                        <View style={[styles.image, styles.imagePlaceholder]} />
                      )}
                      <Text
                        style={[
                          styles.optionName,
                          selectedDater?.id === dater.id && styles.optionNameActive,
                        ]}
                      >
                        {dater.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 42,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  headerOpen: {
    borderColor: '#8b5cf6',
  },
  headerSingle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 42,
  },
  image: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  imagePlaceholder: {
    backgroundColor: '#f3f4f6',
  },
  name: {
    fontSize: 14,
    color: '#222',
    flex: 1,
  },
  placeholder: {
    fontSize: 14,
    color: '#9ca3af',
  },
  chevron: {
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    paddingTop: 100,
    paddingHorizontal: 20,
  },
  menu: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    maxHeight: 300,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  optionActive: {
    backgroundColor: '#f3e8ff',
  },
  optionName: {
    fontSize: 14,
    color: '#222',
    flex: 1,
  },
  optionNameActive: {
    color: '#6b21a8',
    fontWeight: '600',
  },
});

export default DaterDropdown;

