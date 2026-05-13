import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
  Modal,
} from 'react-native';
import {
  GestureHandlerRootView,
  ScrollView,
} from 'react-native-gesture-handler';
import { formatHeight } from '../utils/profileUtils';

const WHEEL_ROW_HEIGHT = 40;
const WHEEL_VIEWPORT_HEIGHT = 200;

function HeightWheelColumn({ items, value, onChange, viewportHeight = WHEEL_VIEWPORT_HEIGHT }) {
  const scrollRef = useRef(null);
  const syncingRef = useRef(false);
  const pad = (viewportHeight - WHEEL_ROW_HEIGHT) / 2;
  const valueKey = String(value);
  const selectedIndex = Math.max(
    0,
    items.findIndex((it) => String(it.value) === valueKey)
  );

  useEffect(() => {
    const y = selectedIndex * WHEEL_ROW_HEIGHT;
    syncingRef.current = true;
    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
      setTimeout(() => {
        syncingRef.current = false;
      }, 120);
    });
    return () => cancelAnimationFrame(id);
  }, [selectedIndex, items.length, valueKey]);

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.wheelScroll, { height: viewportHeight }]}
      contentContainerStyle={{ paddingVertical: pad }}
      showsVerticalScrollIndicator
      snapToInterval={WHEEL_ROW_HEIGHT}
      decelerationRate="fast"
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      bounces={false}
      {...Platform.select({ android: { overScrollMode: 'never' } })}
      onMomentumScrollEnd={(e) => {
        if (syncingRef.current) return;
        const y = e.nativeEvent.contentOffset.y;
        let i = Math.round(y / WHEEL_ROW_HEIGHT);
        i = Math.max(0, Math.min(items.length - 1, i));
        const next = items[i];
        if (next && String(next.value) !== valueKey) {
          onChange(next.value);
        }
      }}
    >
      {items.map((it) => (
        <View
          key={String(it.value)}
          style={[styles.wheelItem, { height: WHEEL_ROW_HEIGHT }]}
        >
          <Text style={styles.wheelItemText}>{it.label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function numItems(count) {
  return Array.from({ length: count }, (_, i) => ({
    value: String(i),
    label: String(i),
  }));
}

/**
 * Modal with scroll wheels for height (ft/in or m/cm), same UX as BirthdatePickerModal.
 */
export default function HeightPickerModal({
  visible,
  heightUnit,
  heightFeet = '0',
  heightInches = '0',
  heightMeters = '0',
  heightCentimeters = '0',
  onRequestClose,
  onSave,
  accentColor = '#ef4d73',
}) {
  const [ft, setFt] = useState('0');
  const [inch, setInch] = useState('0');
  const [met, setMet] = useState('0');
  const [cm, setCm] = useState('0');

  useEffect(() => {
    if (!visible) return;
    setFt(String(heightFeet ?? '0'));
    setInch(String(heightInches ?? '0'));
    setMet(String(heightMeters ?? '0'));
    setCm(String(heightCentimeters ?? '0'));
  }, [visible, heightUnit, heightFeet, heightInches, heightMeters, heightCentimeters]);

  const previewForm = {
    heightFeet: ft,
    heightInches: inch,
    heightMeters: met,
    heightCentimeters: cm,
  };

  const handleSave = () => {
    if (heightUnit === 'ft') {
      onSave({
        heightFeet: ft,
        heightInches: inch,
        heightMeters: '',
        heightCentimeters: '',
      });
    } else {
      onSave({
        heightFeet: '',
        heightInches: '',
        heightMeters: met,
        heightCentimeters: cm,
      });
    }
  };

  const feetItems = numItems(8);
  const inchItems = numItems(12);
  const meterItems = numItems(3);
  const cmItems = numItems(100);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={onRequestClose} />
          <View style={styles.content} pointerEvents="box-none">
            <View style={styles.card}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryText}>
                  {formatHeight(previewForm, heightUnit)}
                </Text>
              </View>

              <View style={styles.wheelSection}>
                <View style={styles.wheelOverlay} pointerEvents="none" />
                {heightUnit === 'ft' ? (
                  <View style={styles.wheelColumnsRow}>
                    <View style={styles.wheelCol}>
                      <HeightWheelColumn
                        items={feetItems}
                        value={ft}
                        onChange={setFt}
                      />
                    </View>
                    <View style={styles.wheelCol}>
                      <HeightWheelColumn
                        items={inchItems}
                        value={inch}
                        onChange={setInch}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={styles.wheelColumnsRow}>
                    <View style={styles.wheelCol}>
                      <HeightWheelColumn
                        items={meterItems}
                        value={met}
                        onChange={setMet}
                      />
                    </View>
                    <View style={styles.wheelCol}>
                      <HeightWheelColumn
                        items={cmItems}
                        value={cm}
                        onChange={setCm}
                      />
                    </View>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: accentColor }]}
                onPress={handleSave}
              >
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
    marginVertical: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    position: 'relative',
    zIndex: 1,
  },
  summaryBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 16,
    color: '#111',
    fontWeight: '500',
    textAlign: 'center',
  },
  wheelSection: {
    position: 'relative',
    marginTop: 4,
    height: WHEEL_VIEWPORT_HEIGHT,
    overflow: 'visible',
  },
  wheelOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: -22,
    height: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB',
    zIndex: 2,
  },
  wheelColumnsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    zIndex: 0,
  },
  wheelCol: {
    flex: 1,
    minWidth: 0,
    overflow: 'visible',
  },
  wheelScroll: {
    width: '100%',
  },
  wheelItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelItemText: {
    fontSize: 17,
    color: '#111',
    fontWeight: '500',
  },
  saveBtn: {
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
  },
  saveText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
