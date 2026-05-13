import React, { useEffect, useMemo, useRef, useState } from 'react';
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

export const MONTHS_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function clampBirthdate(date, minDate, maxDate) {
  const t = date.getTime();
  if (t < minDate.getTime()) return new Date(minDate);
  if (t > maxDate.getTime()) return new Date(maxDate);
  return new Date(date);
}

const WHEEL_ROW_HEIGHT = 40;
const WHEEL_VIEWPORT_HEIGHT = 200;

function BirthdateWheelColumn({ items, value, onChange, height = WHEEL_VIEWPORT_HEIGHT }) {
  const scrollRef = useRef(null);
  const syncingRef = useRef(false);
  const pad = (height - WHEEL_ROW_HEIGHT) / 2;
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
      style={[styles.birthWheelScroll, { height }]}
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
          style={[styles.birthWheelRow, { height: WHEEL_ROW_HEIGHT }]}
        >
          <Text style={styles.birthWheelRowText}>{it.label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

/**
 * Full-screen modal with month / day / year wheels (matches profile edit birthdate UX).
 */
export default function BirthdatePickerModal({
  visible,
  birthdateIso = '',
  onRequestClose,
  onSave,
  accentColor = '#ef4d73',
}) {
  const [tempBirthdate, setTempBirthdate] = useState(null);

  const maxBirthDate = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    d.setHours(12, 0, 0, 0);
    return d;
  }, []);

  const minBirthDate = useMemo(() => {
    const d = new Date(maxBirthDate);
    d.setFullYear(d.getFullYear() - 100);
    return d;
  }, [maxBirthDate]);

  useEffect(() => {
    if (!visible) return;
    if (birthdateIso && /^\d{4}-\d{2}-\d{2}$/.test(birthdateIso)) {
      const [y, m, d] = birthdateIso.split('-').map(Number);
      setTempBirthdate(
        clampBirthdate(new Date(y, m - 1, d), minBirthDate, maxBirthDate)
      );
    } else {
      setTempBirthdate(new Date(maxBirthDate.getTime()));
    }
  }, [visible, birthdateIso, minBirthDate, maxBirthDate]);

  const yearOptions = useMemo(() => {
    const minY = minBirthDate.getFullYear();
    const maxY = maxBirthDate.getFullYear();
    const years = [];
    for (let y = minY; y <= maxY; y += 1) years.push(y);
    return years;
  }, [minBirthDate, maxBirthDate]);

  const applyBirthWheel = (year, monthIndex, day) => {
    const maxD = daysInMonth(year, monthIndex);
    const d = Math.min(Math.max(1, day), maxD);
    let next = new Date(year, monthIndex, d);
    next = clampBirthdate(next, minBirthDate, maxBirthDate);
    setTempBirthdate(next);
  };

  const handleSave = () => {
    const dateObj = tempBirthdate || maxBirthDate;
    const normalized = clampBirthdate(dateObj, minBirthDate, maxBirthDate);
    onSave(normalized.toISOString().split('T')[0]);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      {/* Modal is portaled outside the app GestureHandlerRootView; RNGH ScrollViews need a root here */}
      <GestureHandlerRootView style={styles.gestureRoot}>
      <View style={styles.birthdayModalRoot}>
        <Pressable style={styles.birthdayModalBackdrop} onPress={onRequestClose} />
        <View style={styles.birthdayModalContent} pointerEvents="box-none">
          <View style={styles.birthdayModalCard}>
            <View style={styles.birthdayFakeInput}>
              <Text
                style={
                  tempBirthdate
                    ? styles.birthdayFakeInputFilled
                    : styles.birthdayFakeInputPlaceholder
                }
              >
                {tempBirthdate
                  ? `${MONTHS_ABBR[tempBirthdate.getMonth()]} ${tempBirthdate.getDate()} ${tempBirthdate.getFullYear()}`
                  : 'Birthday'}
              </Text>
            </View>

            <View style={styles.wheelSection}>
              <View style={styles.wheelOverlay} pointerEvents="none" />
              {(() => {
                const cur = tempBirthdate || maxBirthDate;
                const y = cur.getFullYear();
                const m = cur.getMonth();
                const dim = daysInMonth(y, m);
                const safeDay = Math.min(cur.getDate(), dim);
                const monthItems = MONTHS_ABBR.map((label, idx) => ({
                  value: idx,
                  label,
                }));
                const dayItems = Array.from({ length: dim }, (_, i) => ({
                  value: i + 1,
                  label: String(i + 1),
                }));
                const yearItems = yearOptions.map((yr) => ({
                  value: yr,
                  label: String(yr),
                }));
                return (
                  <View style={styles.wheelRow}>
                    <View style={styles.wheelCol}>
                      <BirthdateWheelColumn
                        items={monthItems}
                        value={m}
                        onChange={(monthIndex) =>
                          applyBirthWheel(y, monthIndex, safeDay)
                        }
                      />
                    </View>
                    <View style={styles.wheelCol}>
                      <BirthdateWheelColumn
                        items={dayItems}
                        value={safeDay}
                        onChange={(d) => applyBirthWheel(y, m, d)}
                      />
                    </View>
                    <View style={styles.wheelCol}>
                      <BirthdateWheelColumn
                        items={yearItems}
                        value={y}
                        onChange={(yr) => applyBirthWheel(yr, m, safeDay)}
                      />
                    </View>
                  </View>
                );
              })()}
            </View>

            <TouchableOpacity
              style={[styles.birthdaySaveBtn, { backgroundColor: accentColor }]}
              onPress={handleSave}
            >
              <Text style={styles.birthdaySaveText}>Save</Text>
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
  birthdayModalRoot: {
    flex: 1,
  },
  birthdayModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  birthdayModalContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  birthdayModalCard: {
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
  birthdayFakeInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  birthdayFakeInputPlaceholder: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  birthdayFakeInputFilled: {
    fontSize: 16,
    color: '#111',
    fontWeight: '500',
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
  wheelRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    zIndex: 0,
  },
  wheelCol: {
    flex: 1,
    minWidth: 0,
    overflow: 'visible',
  },
  birthWheelScroll: {
    width: '100%',
  },
  birthWheelRow: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  birthWheelRowText: {
    fontSize: 17,
    color: '#111',
    fontWeight: '500',
  },
  birthdaySaveBtn: {
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
  },
  birthdaySaveText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
