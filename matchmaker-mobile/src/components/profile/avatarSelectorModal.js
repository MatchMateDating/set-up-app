import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '@env';

const avatarList = [
  'avatars/dylan_avatar.png',
  'avatars/allyson_avatar.png',
  'avatars/angie_avatar.png',
];

const AvatarSelectorModal = ({ onSelect, onClose, userId }) => {
  const navigation = useNavigation();

  const selectAvatar = async (avatar) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/profile/user/${userId}/avatar`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatar }),
      });

      if (response.status === 401) {
        const data = await response.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          await AsyncStorage.removeItem('token');
          Alert.alert('Session expired', 'Please log in again.');
          navigation.navigate('Login');
          return;
        }
      }

      if (!response.ok) {
        throw new Error('Failed to save avatar');
      }

      const data = await response.json();
      console.log('Avatar saved:', data);
      Alert.alert('Success', 'Avatar updated successfully');
    } catch (err) {
      console.error('Error saving avatar:', err);
      Alert.alert('Error', 'Failed to save avatar');
    }
  };

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.avatarModal}>
          <Text style={styles.modalTitle}>Select an Avatar</Text>
          <ScrollView contentContainerStyle={styles.avatarGrid}>
            {avatarList.map((avatar, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  onSelect(avatar);
                  selectAvatar(avatar);
                  onClose();
                }}
                style={styles.avatarOption}
              >
                <Image
                  source={{ uri: `${API_BASE_URL}/${avatar}` }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    color: '#222',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  avatarOption: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#6B46C1',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  closeBtn: {
    padding: 12,
    backgroundColor: '#6B46C1',
    borderRadius: 8,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AvatarSelectorModal;
