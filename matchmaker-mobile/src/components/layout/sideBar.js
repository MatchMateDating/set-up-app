import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@env';
import { Picker } from '@react-native-picker/picker';

const SideBar = ({ onSelectedDaterChange }) => {
  const navigation = useNavigation();
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [role, setRole] = useState(null);
  const [linkedDaters, setLinkedDaters] = useState([]);
  const [selectedDater, setSelectedDater] = useState('');

  useEffect(() => {
    const fetchProfileAndReferrals = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) return;

        const res = await fetch(`${API_BASE_URL}/profile/`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return;

        const data = await res.json();
        setRole(data.user.role);

        if (data.user.role === 'matchmaker') {
          const referralRes = await fetch(`${API_BASE_URL}/referral/referrals/${data.user.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (referralRes.ok) {
            const referralData = await referralRes.json();
            setLinkedDaters(referralData.linked_daters || []);

            const stored = await AsyncStorage.getItem('selectedDater');
            const backendSelected = data.user.referred_by_id?.toString() || '';
            const selected = stored || backendSelected;
            setSelectedDater(selected);
            if (selected) {
              await AsyncStorage.setItem('selectedDater', selected);
            }
          }
        }
      } catch (err) {
        console.error('Error loading data:', err);
      }
    };
    fetchProfileAndReferrals();
  }, []);

  const toggleSidePanel = () => setSidePanelOpen(!sidePanelOpen);

  const handleDaterChange = async (newDaterId) => {
    setSelectedDater(newDaterId);
    await AsyncStorage.setItem('selectedDater', newDaterId);
    
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`${API_BASE_URL}/referral/set_selected_dater`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ selected_dater_id: newDaterId }),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Error', data.error || 'Failed to set selected dater');
      } else {
        if (onSelectedDaterChange) onSelectedDaterChange(newDaterId);
      }
    } catch (err) {
      console.error('Error setting selected dater:', err);
      Alert.alert('Error', 'Failed to set selected dater');
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    navigation.navigate('Login');
  };

  return (
    <>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.sidepanelToggle} onPress={toggleSidePanel}>
          <Ionicons name="menu" size={24} color="#6B46C1" />
        </TouchableOpacity>
        {role === 'matchmaker' && linkedDaters.length > 0 && (
          <View style={styles.daterDropdown}>
            <Picker
              selectedValue={selectedDater}
              onValueChange={handleDaterChange}
              style={styles.picker}
            >
              <Picker.Item label="Select Dater" value="" />
              {linkedDaters.map((dater) => (
                <Picker.Item
                  key={dater.id}
                  label={dater.name || `Dater ${dater.id}`}
                  value={dater.id.toString()}
                />
              ))}
            </Picker>
          </View>
        )}
      </View>

      <Modal
        visible={sidePanelOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={toggleSidePanel}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={toggleSidePanel}
        >
          <View style={[styles.sidePanel, sidePanelOpen && styles.sidePanelOpen]}>
            <View style={styles.sidePanelHeader}>
              <Text style={styles.sidePanelTitle}>Menu</Text>
              <TouchableOpacity onPress={toggleSidePanel}>
                <Ionicons name="close" size={24} color="#222" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.sidePanelMenu}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  toggleSidePanel();
                  navigation.navigate('Settings');
                }}
              >
                <Ionicons name="settings-outline" size={20} color="#6B46C1" />
                <Text style={styles.menuItemText}>Settings</Text>
              </TouchableOpacity>
              {role === 'user' && (
                <>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      toggleSidePanel();
                      navigation.navigate('Preferences');
                    }}
                  >
                    <Ionicons name="heart-outline" size={20} color="#6B46C1" />
                    <Text style={styles.menuItemText}>Preferences</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      toggleSidePanel();
                      navigation.navigate('PuzzlesHub');
                    }}
                  >
                    <Ionicons name="game-controller-outline" size={20} color="#6B46C1" />
                    <Text style={styles.menuItemText}>Puzzles</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={[styles.menuItem, styles.logoutItem]}
                onPress={() => {
                  toggleSidePanel();
                  handleLogout();
                }}
              >
                <Ionicons name="log-out-outline" size={20} color="#e53e3e" />
                <Text style={[styles.menuItemText, styles.logoutText]}>Log Out</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e6ef',
  },
  sidepanelToggle: {
    padding: 8,
  },
  daterDropdown: {
    flex: 1,
    marginLeft: 12,
    borderWidth: 1,
    borderColor: '#e0e6ef',
    borderRadius: 8,
  },
  picker: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidePanel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '70%',
    maxWidth: 300,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  sidePanelOpen: {
    // Already defined above
  },
  sidePanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e6ef',
  },
  sidePanelTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
  },
  sidePanelMenu: {
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemText: {
    fontSize: 16,
    color: '#222',
  },
  logoutItem: {
    marginTop: 'auto',
  },
  logoutText: {
    color: '#e53e3e',
  },
});

export default SideBar;
