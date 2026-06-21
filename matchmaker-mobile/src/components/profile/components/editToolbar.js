import React, { useContext, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { UserContext } from '../../../context/UserContext';
import { DATER_SCREEN_BG, getRoleAccentColor } from '../../layout/components/RoleHeaderBanner';

const FONT_OPTIONS = [
  { label: 'Arial', value: 'Arial', fontFamily: 'Arial' },
  { label: 'Times', value: 'Times New Roman', fontFamily: 'Times New Roman' },
  { label: 'Courier', value: 'Courier New', fontFamily: 'Courier New' },
  { label: 'Georgia', value: 'Georgia', fontFamily: 'Georgia' },
  { label: 'Verdana', value: 'Verdana', fontFamily: 'Verdana' },
];

const THEME_OPTIONS = [
  { label: 'Classic', value: 'classic', swatch: 'classic' },
  { label: 'pixelCloud', value: 'pixelCloud', swatch: 'pixelCloud' },
  { label: 'pixelFlower', value: 'pixelFlower', swatch: 'pixelFlower' },
  { label: 'pixelCactus', value: 'pixelCactus', swatch: 'pixelCactus' },
];

const THEME_SWATCH_GRADIENTS = {
  classic: { from: '#FFFFFF', to: '#F3F4F6' },
  pixelCloud: { from: '#87CEEB', to: '#FFFFFF' },
  pixelFlower: { from: '#FF69B4', to: '#FFFFFF' },
  pixelCactus: { from: '#4ADE80', to: '#FFFFFF' },
};

const ThemeSwatch = ({ swatch, size = 22 }) => {
  const gradient = THEME_SWATCH_GRADIENTS[swatch] || THEME_SWATCH_GRADIENTS.classic;
  const gradientId = `theme-swatch-${swatch}`;

  return (
    <View style={[styles.themeSwatchWrap, swatch === 'classic' && styles.themeSwatchClassic]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={gradient.from} />
            <Stop offset="100%" stopColor={gradient.to} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - (swatch === 'classic' ? 1 : 0)}
          fill={`url(#${gradientId})`}
        />
      </Svg>
    </View>
  );
};

const DropdownMenuItem = ({ onPress, children, accentColor, selected }) => (
  <TouchableOpacity style={styles.dropdownItem} onPress={onPress} activeOpacity={0.7}>
    {children}
    {selected ? (
      <Ionicons name="checkmark" size={18} color={accentColor} />
    ) : (
      <View style={styles.checkPlaceholder} />
    )}
  </TouchableOpacity>
);

const FontDropdown = ({ value, onSelect, accentColor, open, onToggle }) => {
  const selectedOption =
    FONT_OPTIONS.find((opt) => opt.value === value) || FONT_OPTIONS[0];

  return (
    <View style={[styles.dropdownAnchor, open && styles.dropdownAnchorOpen]}>
      <TouchableOpacity
        style={[styles.dropdownTrigger, open && styles.dropdownTriggerOpen]}
        onPress={onToggle}
        activeOpacity={0.85}
      >
        <Text style={[styles.fontIcon, { color: accentColor }]}>Aa</Text>
        <Text style={styles.dropdownText} numberOfLines={1}>
          {selectedOption.label}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={14}
          color="#6B7280"
        />
      </TouchableOpacity>

      {open ? (
        <View style={styles.dropdownMenu}>
          {FONT_OPTIONS.map((opt, index) => {
            const selected = value === opt.value;
            return (
              <View key={opt.value}>
                {index > 0 ? <View style={styles.dropdownDivider} /> : null}
                <DropdownMenuItem
                  selected={selected}
                  accentColor={accentColor}
                  onPress={() => onSelect(opt.value)}
                >
                  <Text style={[styles.dropdownItemText, { fontFamily: opt.fontFamily }]}>
                    {opt.label}
                  </Text>
                </DropdownMenuItem>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
};

const ThemeDropdown = ({ value, onSelect, accentColor, open, onToggle }) => {
  const selectedOption =
    THEME_OPTIONS.find((opt) => opt.value === value) || THEME_OPTIONS[0];

  return (
    <View style={[styles.dropdownAnchor, open && styles.dropdownAnchorOpen]}>
      <TouchableOpacity
        style={[styles.dropdownTrigger, open && styles.dropdownTriggerOpen]}
        onPress={onToggle}
        activeOpacity={0.85}
      >
        <Ionicons name="color-palette" size={16} color={accentColor} />
        <Text style={styles.dropdownText} numberOfLines={1}>
          {selectedOption.label}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={14}
          color="#6B7280"
        />
      </TouchableOpacity>

      {open ? (
        <View style={styles.dropdownMenu}>
          {THEME_OPTIONS.map((opt, index) => {
            const selected = value === opt.value;
            return (
              <View key={opt.value}>
                {index > 0 ? <View style={styles.dropdownDivider} /> : null}
                <DropdownMenuItem
                  selected={selected}
                  accentColor={accentColor}
                  onPress={() => onSelect(opt.value)}
                >
                  <ThemeSwatch swatch={opt.swatch} />
                  <Text style={styles.dropdownItemText}>{opt.label}</Text>
                </DropdownMenuItem>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
};

export const EditToolbar = ({
  formData,
  handleInputChange,
  editing,
  extendToTop = false,
  accentColorOverride,
  sticky = false,
}) => {
  const { user } = useContext(UserContext);
  const [openDropdown, setOpenDropdown] = useState(null);

  if (!editing) return null;
  const accentColor = accentColorOverride || getRoleAccentColor(user?.role || 'matchmaker');

  const update = (name, value) => {
    handleInputChange({ target: { name, value } });
  };

  const toggleDropdown = (key) => {
    setOpenDropdown((prev) => (prev === key ? null : key));
  };

  const containerStyle = [
    styles.container,
    sticky && styles.containerSticky,
    extendToTop && !sticky && styles.containerExtendTop,
    openDropdown && styles.containerDropdownOpen,
  ];

  return (
    <View style={containerStyle}>
      <View style={styles.toolbarGrid}>
        <View style={[styles.toolbarItem, openDropdown === 'font' && styles.toolbarItemOpen]}>
          <Text style={styles.miniLabel}>Font</Text>
          <FontDropdown
            value={formData.fontFamily}
            accentColor={accentColor}
            open={openDropdown === 'font'}
            onToggle={() => toggleDropdown('font')}
            onSelect={(v) => {
              update('fontFamily', v);
              setOpenDropdown(null);
            }}
          />
        </View>

        <View style={[styles.toolbarItem, openDropdown === 'theme' && styles.toolbarItemOpen]}>
          <Text style={styles.miniLabel}>Theme</Text>
          <ThemeDropdown
            value={formData.profileStyle}
            accentColor={accentColor}
            open={openDropdown === 'theme'}
            onToggle={() => toggleDropdown('theme')}
            onSelect={(v) => {
              update('profileStyle', v);
              setOpenDropdown(null);
            }}
          />
        </View>

        <View style={[styles.toolbarItem, styles.layoutFull]}>
          <Text style={styles.miniLabel}>Layout</Text>
          <View style={styles.layoutToggle}>
            <TouchableOpacity
              style={[
                styles.layoutBtn,
                formData.imageLayout === 'topRow' && [styles.layoutBtnActive, { backgroundColor: accentColor }],
              ]}
              onPress={() => update('imageLayout', 'topRow')}
            >
              <Ionicons
                name="images"
                size={18}
                color={formData.imageLayout === 'topRow' ? '#FFF' : accentColor}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.layoutBtn,
                formData.imageLayout === 'vertical' && [styles.layoutBtnActive, { backgroundColor: accentColor }],
              ]}
              onPress={() => update('imageLayout', 'vertical')}
            >
              <Ionicons
                name="reorder-four"
                size={18}
                color={formData.imageLayout === 'vertical' ? '#FFF' : accentColor}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.layoutBtn,
                formData.imageLayout === 'heroStack' && [styles.layoutBtnActive, { backgroundColor: accentColor }],
              ]}
              onPress={() => update('imageLayout', 'heroStack')}
            >
              <Ionicons
                name="image-outline"
                size={18}
                color={formData.imageLayout === 'heroStack' ? '#FFF' : accentColor}
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
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    paddingTop: 0,
    paddingBottom: 12,
    paddingHorizontal: 0,
    width: '100%',
    opacity: 1,
  },
  containerSticky: {
    backgroundColor: DATER_SCREEN_BG,
    paddingBottom: 10,
  },
  containerExtendTop: {
    paddingTop: 8,
  },
  containerDropdownOpen: {
    zIndex: 50,
  },

  toolbarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
  },

  toolbarItem: {
    width: '48%',
  },
  toolbarItemOpen: {
    zIndex: 30,
  },

  layoutFull: {
    width: '100%',
    zIndex: 1,
  },

  miniLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginBottom: 4,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  dropdownAnchor: {
    position: 'relative',
    zIndex: 10,
  },
  dropdownAnchorOpen: {
    zIndex: 40,
  },

  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    height: 40,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  dropdownTriggerOpen: {
    shadowOpacity: 0.02,
    shadowRadius: 2,
  },

  fontIcon: {
    fontSize: 14,
    fontWeight: '700',
  },

  dropdownText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
  },

  dropdownMenu: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
    zIndex: 50,
  },

  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },

  dropdownItemText: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },

  dropdownDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 14,
  },

  checkPlaceholder: {
    width: 18,
  },

  themeSwatchWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
  },
  themeSwatchClassic: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 11,
  },

  layoutToggle: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 4,
    height: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },

  layoutBtn: {
    flex: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  layoutBtnActive: {
    backgroundColor: '#6c5ce7',
  },
});
