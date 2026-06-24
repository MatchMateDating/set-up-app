import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const NOTE_MAX_LENGTH = 100;

const SendNoteModal = ({ onClose, onSend, accentColor = '#ef4d73' }) => {
  const [note, setNote] = useState('');

  const handleSend = () => {
    const trimmed = note.trim();
    if (trimmed) {
      onSend(trimmed);
      setNote('');
    }
  };

  const canSend = Boolean(note.trim());

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Send a Note</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <View style={styles.textAreaWrapper}>
            <TextInput
              style={styles.textArea}
              value={note}
              onChangeText={setNote}
              placeholder="Write your note here..."
              placeholderTextColor="#9ca3af"
              multiline
              maxLength={NOTE_MAX_LENGTH}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>
              {note.length}/{NOTE_MAX_LENGTH}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: accentColor },
              !canSend && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!canSend}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    width: '100%',
    maxWidth: 400,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    minHeight: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: -4,
    top: -4,
    padding: 4,
  },
  textAreaWrapper: {
    position: 'relative',
    marginBottom: 20,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 32,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 140,
    color: '#1f2937',
    backgroundColor: '#fff',
  },
  charCount: {
    position: 'absolute',
    right: 14,
    bottom: 10,
    fontSize: 13,
    color: '#9ca3af',
  },
  sendButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default SendNoteModal;
