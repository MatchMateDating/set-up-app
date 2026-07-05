import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: LIGHTBOX_WIN_W, height: LIGHTBOX_WIN_H } = Dimensions.get('window');

export default function ImageLightboxModal({ uris = [], index, onIndexChange, onClose }) {
  const insets = useSafeAreaInsets();
  const visible = index != null && uris.length > 0;

  const goNext = useCallback(() => {
    onIndexChange((i) => {
      if (i == null) return i;
      const last = uris.length - 1;
      if (last < 0) return null;
      return i < last ? i + 1 : i;
    });
  }, [uris.length, onIndexChange]);

  const goPrev = useCallback(() => {
    onIndexChange((i) => {
      if (i == null) return i;
      return i > 0 ? i - 1 : i;
    });
  }, [onIndexChange]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onEnd((e) => {
          'worklet';
          const { translationX, translationY, velocityX, velocityY } = e;
          const T = 48;
          const vT = 380;
          const absX = Math.abs(translationX);
          const absY = Math.abs(translationY);
          if (absX < 10 && absY < 10) return;
          if (absX >= absY) {
            if (translationX > T || velocityX > vT) {
              runOnJS(goPrev)();
            } else if (translationX < -T || velocityX < -vT) {
              runOnJS(goNext)();
            }
          } else {
            if (translationY > T || velocityY > vT) {
              runOnJS(goPrev)();
            } else if (translationY < -T || velocityY < -vT) {
              runOnJS(goNext)();
            }
          }
        }),
    [goNext, goPrev]
  );

  useEffect(() => {
    onIndexChange((i) => {
      if (i == null) return i;
      if (uris.length === 0) return null;
      return i >= uris.length ? uris.length - 1 : i;
    });
  }, [uris]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFillObject, styles.backdrop]}
          onPress={onClose}
          accessibilityLabel="Dismiss image preview"
        />
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFillObject, styles.imageWrap]}>
          {index != null && uris[index] ? (
            <>
              {uris.length > 1 ? (
                <Text style={styles.counter} pointerEvents="none">
                  {index + 1} / {uris.length}
                </Text>
              ) : null}
              <GestureDetector gesture={panGesture}>
                <View
                  style={styles.hitArea}
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={`Photo ${index + 1} of ${uris.length}. Swipe left or up for the next image, right or down for the previous image.`}
                >
                  <Image
                    key={uris[index]}
                    source={{ uri: uris[index] }}
                    style={{
                      width: LIGHTBOX_WIN_W * 0.92,
                      height: LIGHTBOX_WIN_H * 0.78,
                    }}
                    resizeMode="contain"
                  />
                </View>
              </GestureDetector>
            </>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.closeButton, { top: insets.top + 10, right: Math.max(insets.right, 16) }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close image preview"
        >
          <View style={styles.closeButtonInner}>
            <Ionicons name="close" size={28} color="#ffffff" />
          </View>
        </TouchableOpacity>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
  },
  imageWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  counter: {
    position: 'absolute',
    top: '10%',
    zIndex: 2,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  hitArea: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    zIndex: 10,
  },
  closeButtonInner: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 20,
    padding: 6,
  },
});
