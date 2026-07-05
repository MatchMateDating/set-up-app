import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ViewNoteModal = ({ note, authorLabel, accentColor = '#ef4d73', onClose }) => {
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
            <Text style={styles.title}>Note</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <Text style={[styles.authorLabel, { color: accentColor }]}>{authorLabel}</Text>

          <ScrollView
            style={styles.noteScroll}
            contentContainerStyle={styles.noteScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.noteText}>{note}</Text>
          </ScrollView>
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
    maxHeight: '70%',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
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
  authorLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  noteScroll: {
    flexGrow: 0,
  },
  noteScrollContent: {
    paddingBottom: 4,
  },
  noteText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
  },
});

export default ViewNoteModal;
