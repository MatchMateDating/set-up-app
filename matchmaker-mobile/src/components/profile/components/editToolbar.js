import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const Dropdown = ({ icon, value, options, onSelect }) => {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.dropdownTrigger}
        onPress={() => setVisible(true)}
      >
        <Ionicons name={icon} size={16} color="#6B46C1" />
        <Text style={styles.dropdownText} numberOfLines={1}>
          {value}
        </Text>
        <Ionicons name="chevron-down" size={14} color="#6B7280" />
      </TouchableOpacity>

      <Modal transparent animationType="fade" visible={visible}>
        <Pressable
          style={styles.backdrop}
          onPress={() => setVisible(false)}
        />

        <View style={styles.dropdownMenu}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={styles.dropdownItem}
              onPress={() => {
                onSelect(opt.value);
                setVisible(false);
              }}
            >
              <Text style={styles.dropdownItemText}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </>
  );
};

export const EditToolbar = ({ formData, handleInputChange, editing }) => {
  if (!editing) return null;

  const update = (name, value) => {
    handleInputChange({ target: { name, value } });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Profile Customization</Text>

      <View style={styles.toolbarGrid}>
        {/* FONT */}
        <View style={styles.toolbarItem}>
          <Text style={styles.miniLabel}>Font</Text>
          <Dropdown
            icon="text"
            value={formData.fontFamily}
            options={[
              { label: 'Arial', value: 'Arial' },
              { label: 'Times', value: 'Times New Roman' },
              { label: 'Courier', value: 'Courier New' },
              { label: 'Georgia', value: 'Georgia' },
              { label: 'Verdana', value: 'Verdana' },
            ]}
            onSelect={(v) => update('fontFamily', v)}
          />
        </View>

        {/* THEME */}
        <View style={styles.toolbarItem}>
          <Text style={styles.miniLabel}>Theme</Text>
          <Dropdown
            icon="color-palette"
            value={formData.profileStyle}
            options={[
              { label: 'Classic', value: 'classic' },
              { label: 'PixelCloud', value: 'pixelCloud' },
              { label: 'PixelFlower', value: 'pixelFlower' },
              { label: 'PixelCactus', value: 'pixelCactus' },
            ]}
            onSelect={(v) => update('profileStyle', v)}
          />
        </View>

        {/* LAYOUT */}
        <View style={[styles.toolbarItem, styles.layoutFull]}>
          <Text style={styles.miniLabel}>Layout</Text>
          <View style={styles.layoutToggle}>
            <TouchableOpacity
              style={[
                styles.layoutBtn,
                formData.imageLayout === 'grid' && styles.layoutBtnActive,
              ]}
              onPress={() => update('imageLayout', 'grid')}
            >
              <Ionicons
                name="grid"
                size={18}
                color={formData.imageLayout === 'grid' ? '#FFF' : '#6B46C1'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.layoutBtn,
                formData.imageLayout === 'vertical' && styles.layoutBtnActive,
              ]}
              onPress={() => update('imageLayout', 'vertical')}
            >
              <Ionicons
                name="reorder-four"
                size={18}
                color={formData.imageLayout === 'vertical' ? '#FFF' : '#6B46C1'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ebe7fb',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    paddingBottom: 12,
    opacity: 0.85,
    borderRadius: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 8,
    letterSpacing: 0.5,
  },

  toolbarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },

  toolbarItem: {
    width: '48%',
  },

  layoutFull: {
    width: '100%',
  },

  miniLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '600',
  },

  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
  },

  dropdownText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },

  dropdownMenu: {
    position: 'absolute',
    top: '40%',
    left: '10%',
    right: '10%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },

  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },

  dropdownItemText: {
    fontSize: 15,
    color: '#111827',
  },

  layoutToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 4,
    height: 36,
  },

  layoutBtn: {
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  layoutBtnActive: {
    backgroundColor: '#6B46C1',
  },
});