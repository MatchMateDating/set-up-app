import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  Image as RNImage,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ImageManipulator, SaveFormat, FlipType } from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CROP_SIZE = SCREEN_WIDTH * 0.88;
const OVERLAY_COLOR = 'rgba(0,0,0,0.55)';
const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const SNAP_THRESHOLD = 5; // degrees — how close to a 90° position before it "sticks"

const getDistance = (touches) => {
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
};

const getMidpoint = (touches) => ({
  x: (touches[0].pageX + touches[1].pageX) / 2,
  y: (touches[0].pageY + touches[1].pageY) / 2,
});

const getAngle = (touches) => {
  const dx = touches[1].pageX - touches[0].pageX;
  const dy = touches[1].pageY - touches[0].pageY;
  return Math.atan2(dy, dx); // radians
};

const radToDeg = (rad) => rad * (180 / Math.PI);

// Snap rotation to nearest 90° if within threshold
const snapRotation = (deg, threshold) => {
  const nearest90 = Math.round(deg / 90) * 90;
  return Math.abs(deg - nearest90) <= threshold ? nearest90 : deg;
};

const CROP_LEFT = (SCREEN_WIDTH - CROP_SIZE) / 2;

const ImageCropModal = ({ visible, imageUri, onCropComplete, onCancel }) => {
  const [processing, setProcessing] = useState(false);
  const [imageSize, setImageSize] = useState(null);
  const [cropAreaHeight, setCropAreaHeight] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const insets = useSafeAreaInsets();

  // Animated values for display
  const pan = useRef(new Animated.ValueXY(0, 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current; // degrees

  // Mutable refs — always up-to-date, used inside touch handlers
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const rotationRef = useRef(0); // degrees

  // Touch gesture tracking refs
  const touchStart = useRef({ x: 0, y: 0 });
  const panAtStart = useRef({ x: 0, y: 0 });
  const pinchStartDist = useRef(null);
  const pinchStartScale = useRef(1);
  const pinchStartAngle = useRef(null);
  const rotationAtPinchStart = useRef(0);
  const lastMid = useRef(null);

  // Keep animated values synced to refs
  useEffect(() => {
    const xId = pan.x.addListener(({ value }) => { panRef.current.x = value; });
    const yId = pan.y.addListener(({ value }) => { panRef.current.y = value; });
    const sId = scaleAnim.addListener(({ value }) => { scaleRef.current = value; });
    const rId = rotationAnim.addListener(({ value }) => { rotationRef.current = value; });
    return () => {
      pan.x.removeListener(xId);
      pan.y.removeListener(yId);
      scaleAnim.removeListener(sId);
      rotationAnim.removeListener(rId);
    };
  }, []);

  // Fetch image dimensions when URI changes
  useEffect(() => {
    if (imageUri) {
      RNImage.getSize(
        imageUri,
        (width, height) => setImageSize({ width, height }),
        () => setImageSize(null)
      );
      pan.setValue({ x: 0, y: 0 });
      scaleAnim.setValue(1);
      rotationAnim.setValue(0);
      panRef.current = { x: 0, y: 0 };
      scaleRef.current = 1;
      rotationRef.current = 0;
      setFlipH(false);
    }
  }, [imageUri]);

  // Fit image so its width = SCREEN_WIDTH at scale 1 (based on original dimensions)
  const fitted = useMemo(() => {
    if (!imageSize) return { width: SCREEN_WIDTH, height: SCREEN_WIDTH };
    const ratio = SCREEN_WIDTH / imageSize.width;
    return { width: SCREEN_WIDTH, height: imageSize.height * ratio };
  }, [imageSize]);

  const fittedRef = useRef(fitted);
  fittedRef.current = fitted;

  // Interpolate rotation for the transform (supports arbitrary angles)
  const rotateStr = rotationAnim.interpolate({
    inputRange: [-3600, 3600],
    outputRange: ['-3600deg', '3600deg'],
  });

  // Clamp helper
  const doClamp = useCallback((tx, ty, s) => {
    const f = fittedRef.current;
    const imgW = f.width * s;
    const imgH = f.height * s;
    const maxTx = imgW > CROP_SIZE ? (imgW - CROP_SIZE) / 2 : 0;
    const maxTy = imgH > CROP_SIZE ? (imgH - CROP_SIZE) / 2 : 0;
    return {
      x: Math.min(maxTx, Math.max(-maxTx, tx)),
      y: Math.min(maxTy, Math.max(-maxTy, ty)),
    };
  }, []);

  // ── Touch handlers ──

  const handleGrant = useCallback((evt) => {
    const touches = evt.nativeEvent.touches;
    if (touches.length >= 1) {
      touchStart.current = { x: touches[0].pageX, y: touches[0].pageY };
      panAtStart.current = { ...panRef.current };
    }
    pinchStartDist.current = null;
    pinchStartAngle.current = null;
    lastMid.current = null;
  }, []);

  const handleMove = useCallback((evt) => {
    const touches = evt.nativeEvent.touches;
    if (!touches || touches.length === 0) return;

    if (touches.length >= 2) {
      const dist = getDistance(touches);
      const mid = getMidpoint(touches);
      const angle = getAngle(touches);

      if (!pinchStartDist.current) {
        // First frame with 2 fingers — initialize pinch + rotation
        pinchStartDist.current = dist;
        pinchStartScale.current = scaleRef.current;
        pinchStartAngle.current = angle;
        rotationAtPinchStart.current = rotationRef.current;
        lastMid.current = mid;
        panAtStart.current = { ...panRef.current };
        return;
      }

      // Scale from pinch
      const scaleRatio = dist / pinchStartDist.current;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchStartScale.current * scaleRatio));
      scaleAnim.setValue(newScale);

      // Rotation from angle change — snap near 90° positions
      const angleDelta = angle - pinchStartAngle.current;
      const rawRotation = rotationAtPinchStart.current + radToDeg(angleDelta);
      const newRotation = snapRotation(rawRotation, SNAP_THRESHOLD);
      rotationAnim.setValue(newRotation);

      // Pan via midpoint delta (frame-to-frame)
      if (lastMid.current) {
        const dx = mid.x - lastMid.current.x;
        const dy = mid.y - lastMid.current.y;
        const newX = panRef.current.x + dx;
        const newY = panRef.current.y + dy;
        const c = doClamp(newX, newY, newScale);
        pan.setValue({ x: c.x, y: c.y });
      }
      lastMid.current = mid;

    } else if (touches.length === 1) {
      // Single finger pan
      const dx = touches[0].pageX - touchStart.current.x;
      const dy = touches[0].pageY - touchStart.current.y;
      const newX = panAtStart.current.x + dx;
      const newY = panAtStart.current.y + dy;
      const c = doClamp(newX, newY, scaleRef.current);
      pan.setValue({ x: c.x, y: c.y });
    }
  }, [doClamp]);

  const handleRelease = useCallback((evt) => {
    const remaining = evt.nativeEvent.touches;

    if (remaining && remaining.length >= 1) {
      // Went from 2+ fingers to fewer — reset single-finger tracking
      touchStart.current = { x: remaining[0].pageX, y: remaining[0].pageY };
      panAtStart.current = { ...panRef.current };
      pinchStartDist.current = null;
      pinchStartAngle.current = null;
      lastMid.current = null;
      return;
    }

    // All fingers lifted
    pinchStartDist.current = null;
    pinchStartAngle.current = null;
    lastMid.current = null;

    // Snap rotation to nearest 90° if within 15° on release
    const nearest90 = Math.round(rotationRef.current / 90) * 90;
    if (Math.abs(rotationRef.current - nearest90) <= 15) {
      Animated.spring(rotationAnim, { toValue: nearest90, useNativeDriver: true }).start();
    }

    if (scaleRef.current < 1) {
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
      Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
    } else {
      const c = doClamp(panRef.current.x, panRef.current.y, scaleRef.current);
      pan.setValue({ x: c.x, y: c.y });
    }
  }, [doClamp]);

  // ── Button handlers ──

  const handleFlipH = () => {
    setFlipH((prev) => !prev);
  };

  const handleReset = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(pan, { toValue: { x: 0, y: 0 }, duration: 200, useNativeDriver: true }),
      Animated.timing(rotationAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    panRef.current = { x: 0, y: 0 };
    scaleRef.current = 1;
    rotationRef.current = 0;
    setFlipH(false);
  };

  const handleCrop = async () => {
    if (!imageSize || processing) return;
    setProcessing(true);

    try {
      // Read current values directly from animated objects (avoids stale refs)
      const currentScale = scaleAnim.__getValue();
      const currentPanX = pan.x.__getValue();
      const currentPanY = pan.y.__getValue();
      const currentRotation = rotationAnim.__getValue();

      // Ignore tiny accidental rotations (< 3°)
      const rotDeg = Math.abs(currentRotation % 360) < 3 ? 0 : Math.round(currentRotation % 360);
      const absRot = ((rotDeg % 360) + 360) % 360; // normalize 0-359

      // After rotation, the image bounding box changes
      const rotRad = (absRot * Math.PI) / 180;
      const cosR = Math.abs(Math.cos(rotRad));
      const sinR = Math.abs(Math.sin(rotRad));
      const rotatedW = imageSize.width * cosR + imageSize.height * sinR;
      const rotatedH = imageSize.width * sinR + imageSize.height * cosR;

      const fitScale = SCREEN_WIDTH / imageSize.width;
      const totalScale = fitScale * currentScale;

      const cropW = CROP_SIZE / totalScale;
      const cropH = CROP_SIZE / totalScale;
      const centerX = rotatedW / 2 - currentPanX / totalScale;
      const centerY = rotatedH / 2 - currentPanY / totalScale;

      // Use floor for origin (push slightly outward) and ceil for size
      // so the crop always includes the full visible area
      let originX = Math.max(0, Math.floor(centerX - cropW / 2));
      let originY = Math.max(0, Math.floor(centerY - cropH / 2));
      let width = Math.ceil(Math.min(cropW, rotatedW - originX));
      let height = Math.ceil(Math.min(cropH, rotatedH - originY));

      width = Math.max(1, width);
      height = Math.max(1, height);

      const context = ImageManipulator.manipulate(imageUri);

      if (absRot !== 0) {
        context.rotate(absRot);
      }
      if (flipH) {
        context.flip(FlipType.Horizontal);
      }

      context.crop({ originX, originY, width, height });

      const imageRef = await context.renderAsync();
      const saved = await imageRef.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.8,
      });

      onCropComplete({ uri: saved.uri });
    } catch (err) {
      console.error('Crop error:', err);
      Alert.alert('Error', 'Failed to crop image');
    } finally {
      setProcessing(false);
    }
  };

  if (!visible) return null;

  const showCropper = imageUri && imageSize;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8, zIndex: 10 }]}>
          <TouchableOpacity onPress={onCancel} style={styles.headerBtnLeft}>
            <Ionicons name="close" size={28} color="#fff" />
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Crop Image</Text>
          <TouchableOpacity
            onPress={handleCrop}
            style={styles.headerBtnRight}
            disabled={processing || !showCropper}
          >
            {processing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={[styles.doneText, !showCropper && styles.disabledText]}>Done</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Crop Area */}
        <View
          style={styles.cropContainer}
          onLayout={(e) => setCropAreaHeight(e.nativeEvent.layout.height)}
        >
          {!showCropper ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <>
              {/* Image layer — handles all touch gestures */}
              <View
                style={StyleSheet.absoluteFill}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderTerminationRequest={() => false}
                onResponderGrant={handleGrant}
                onResponderMove={handleMove}
                onResponderRelease={handleRelease}
                onResponderTerminate={handleRelease}
              >
                <View style={styles.imageCentered}>
                  <Animated.Image
                    source={{ uri: imageUri }}
                    style={{
                      width: fitted.width,
                      height: fitted.height,
                      transform: [
                        { translateX: pan.x },
                        { translateY: pan.y },
                        { scale: scaleAnim },
                        { rotate: rotateStr },
                        { scaleX: flipH ? -1 : 1 },
                      ],
                    }}
                    resizeMode="cover"
                  />
                </View>
              </View>

              {/* Dark overlay — 4 absolutely positioned rects, no gaps */}
              {cropAreaHeight > 0 && (() => {
                const cropTop = Math.round((cropAreaHeight - CROP_SIZE) / 2);
                return (
                  <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    {/* Top */}
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: cropTop, backgroundColor: OVERLAY_COLOR }} />
                    {/* Bottom */}
                    <View style={{ position: 'absolute', top: cropTop + CROP_SIZE, left: 0, right: 0, bottom: 0, backgroundColor: OVERLAY_COLOR }} />
                    {/* Left */}
                    <View style={{ position: 'absolute', top: cropTop, left: 0, width: CROP_LEFT, height: CROP_SIZE, backgroundColor: OVERLAY_COLOR }} />
                    {/* Right */}
                    <View style={{ position: 'absolute', top: cropTop, right: 0, width: CROP_LEFT, height: CROP_SIZE, backgroundColor: OVERLAY_COLOR }} />
                  </View>
                );
              })()}
            </>
          )}
        </View>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12, zIndex: 10 }]}>
          <TouchableOpacity onPress={handleFlipH} style={styles.footerBtn}>
            <Ionicons name="swap-horizontal" size={24} color="#fff" />
            <Text style={styles.footerBtnText}>Flip</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleReset} style={styles.footerBtn}>
            <Ionicons name="refresh" size={24} color="#fff" />
            <Text style={styles.footerBtnText}>Reset</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default ImageCropModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#1a1a1a',
    elevation: 10,
  },
  headerBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 80,
  },
  headerBtnRight: {
    minWidth: 80,
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  cancelText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 4,
  },
  doneText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#6B46C1',
  },
  disabledText: {
    opacity: 0.4,
  },
  cropContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageCentered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingTop: 14,
    backgroundColor: '#1a1a1a',
    elevation: 10,
  },
  footerBtn: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  footerBtnText: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 4,
  },
});
