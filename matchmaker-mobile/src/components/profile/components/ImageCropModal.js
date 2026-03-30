import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
  Image as RNImage,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ImageManipulator, SaveFormat, FlipType } from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CROP_FRACTION = 0.88;
const OVERLAY_COLOR = 'rgba(0,0,0,0.55)';
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

const ImageCropModal = ({
  visible,
  imageUri,
  sourceWidth,
  sourceHeight,
  onCropComplete,
  onCancel,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const [processing, setProcessing] = useState(false);
  const [imageSize, setImageSize] = useState(null);
  /** URI passed through ImageManipulator on Android so preview + crop share one decoded bitmap (EXIF / orientation). */
  const [cropPipelineUri, setCropPipelineUri] = useState(null);
  const [cropLayout, setCropLayout] = useState({ width: 0, height: 0 });
  const [flipH, setFlipH] = useState(false);
  const insets = useSafeAreaInsets();
  const sizedByManipulatorRef = useRef(false);

  const layoutWidth = cropLayout.width > 0 ? cropLayout.width : windowWidth;
  const cropAreaHeight = cropLayout.height;
  const layoutWidthRef = useRef(layoutWidth);
  layoutWidthRef.current = layoutWidth;

  // Use the smaller of width/height so the crop box fits and is never smaller than the available space
  const effectiveCropSize = useMemo(
    () =>
      cropAreaHeight > 0
        ? Math.min(layoutWidth, cropAreaHeight)
        : windowWidth * CROP_FRACTION,
    [cropAreaHeight, layoutWidth, windowWidth]
  );
  const effectiveCropSizeRef = useRef(effectiveCropSize);
  effectiveCropSizeRef.current = effectiveCropSize;
  const cropLeft = (layoutWidth - effectiveCropSize) / 2;

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

  const handleImageLoad = useCallback((e) => {
    if (sizedByManipulatorRef.current) return;
    const src = e.nativeEvent?.source;
    const w = src?.width;
    const h = src?.height;
    if (w > 0 && h > 0) {
      setImageSize((prev) => {
        if (prev && prev.width === w && prev.height === h) return prev;
        return { width: w, height: h };
      });
    }
  }, []);

  const resetGestureBaseline = useCallback(() => {
    pan.setValue({ x: 0, y: 0 });
    scaleAnim.setValue(1);
    rotationAnim.setValue(0);
    panRef.current = { x: 0, y: 0 };
    scaleRef.current = 1;
    rotationRef.current = 0;
    setFlipH(false);
  }, []);

  // Decode + save through ImageManipulator so preview and crop() use the same pixels/orientation.
  // This avoids EXIF/layout mismatches that can cause crops to land in the wrong area.
  useEffect(() => {
    if (!visible || !imageUri) {
      setCropPipelineUri(null);
      setImageSize(null);
      sizedByManipulatorRef.current = false;
      return undefined;
    }

    let cancelled = false;
    sizedByManipulatorRef.current = false;
    setCropPipelineUri(null);
    setImageSize(null);

    (async () => {
      let ctx = null;
      let img = null;
      try {
        ctx = ImageManipulator.manipulate(imageUri);
        img = await ctx.renderAsync();
        if (cancelled) return;
        const w = img.width;
        const h = img.height;
        const saved = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
        if (cancelled) return;
        if (saved?.uri && w > 0 && h > 0) {
          sizedByManipulatorRef.current = true;
          resetGestureBaseline();
          setImageSize({ width: w, height: h });
          setCropPipelineUri(saved.uri);
        } else {
          setCropPipelineUri(imageUri);
        }
      } catch (err) {
        console.warn('ImageCropModal: pipeline decode failed', err);
        if (!cancelled) {
          setCropPipelineUri(imageUri);
        }
      } finally {
        if (img) img.release();
        if (ctx) ctx.release();
      }
    })();

    return () => { cancelled = true; };
  }, [visible, imageUri, resetGestureBaseline]);

  // Fallback: dimensions from picker + getSize; onLoad can refine (unless manipulator already set size).
  const dimensionSourceUri = cropPipelineUri;

  useEffect(() => {
    if (!visible || !dimensionSourceUri) return undefined;
    if (sizedByManipulatorRef.current) return undefined;

    setImageSize(null);

    const hasPickerDims =
      typeof sourceWidth === 'number' &&
      typeof sourceHeight === 'number' &&
      sourceWidth > 0 &&
      sourceHeight > 0;
    const shouldUsePickerDims = Platform.OS === 'android' && hasPickerDims;

    if (shouldUsePickerDims) {
      setImageSize({ width: sourceWidth, height: sourceHeight });
    }

    let cancelled = false;
    if (!shouldUsePickerDims) {
      RNImage.getSize(
        dimensionSourceUri,
        (width, height) => {
          if (!cancelled && width > 0 && height > 0) {
            setImageSize({ width, height });
          }
        },
        () => { if (!cancelled) setImageSize(null); }
      );
    }

    resetGestureBaseline();

    return () => { cancelled = true; };
  }, [visible, dimensionSourceUri, sourceWidth, sourceHeight, resetGestureBaseline]);

  // Once dimensions are known, set the initial scale so the image
  // fully covers the crop window (important for landscape images).
  useEffect(() => {
    if (imageSize && effectiveCropSize > 0 && layoutWidth > 0) {
      const fittedH = imageSize.height * (layoutWidth / imageSize.width);
      const cover = Math.max(effectiveCropSize / layoutWidth, effectiveCropSize / fittedH);
      const initScale = Math.max(1, cover);
      scaleAnim.setValue(initScale);
      scaleRef.current = initScale;
      pan.setValue({ x: 0, y: 0 });
      panRef.current = { x: 0, y: 0 };
    }
  }, [imageSize, effectiveCropSize, layoutWidth]);

  // Fit image so its width = crop container width at scale 1 (based on original dimensions)
  const fitted = useMemo(() => {
    const baseWidth = Platform.OS === 'ios' ? windowWidth : layoutWidth;
    if (!imageSize) return { width: baseWidth, height: baseWidth };
    const ratio = baseWidth / imageSize.width;
    return { width: baseWidth, height: imageSize.height * ratio };
  }, [imageSize, layoutWidth, windowWidth]);

  const fittedRef = useRef(fitted);
  fittedRef.current = fitted;

  // Minimum scale that ensures the image covers the crop window in both
  // dimensions.  For portrait images this is ≤ 1; for landscape it can be > 1.
  const minCoverScale = useMemo(() => {
    if (!imageSize || effectiveCropSize <= 0 || layoutWidth <= 0) return 1;
    const fittedH = imageSize.height * (layoutWidth / imageSize.width);
    return Math.max(effectiveCropSize / layoutWidth, effectiveCropSize / fittedH);
  }, [imageSize, effectiveCropSize, layoutWidth]);

  const minCoverScaleRef = useRef(1);
  minCoverScaleRef.current = minCoverScale;

  // Interpolate rotation for the transform (supports arbitrary angles)
  const rotateStr = rotationAnim.interpolate({
    inputRange: [-3600, 3600],
    outputRange: ['-3600deg', '3600deg'],
  });

  // Clamp pan so the crop window never shows empty space.
  // Takes rotation into account (the bounding box changes when rotated).
  const clampPan = useCallback((tx, ty, s, rotDeg) => {
    const f = fittedRef.current;
    const cropSize = effectiveCropSizeRef.current;
    const rotRad = (rotDeg * Math.PI) / 180;
    const cosR = Math.abs(Math.cos(rotRad));
    const sinR = Math.abs(Math.sin(rotRad));
    const effectiveW = (f.width * cosR + f.height * sinR) * s;
    const effectiveH = (f.width * sinR + f.height * cosR) * s;
    const maxTx = Math.max(0, (effectiveW - cropSize) / 2);
    const maxTy = Math.max(0, (effectiveH - cropSize) / 2);
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
      const newScale = Math.max(minCoverScaleRef.current, Math.min(MAX_SCALE, pinchStartScale.current * scaleRatio));
      scaleAnim.setValue(newScale);

      // Rotation from angle change — snap near 90° positions
      const angleDelta = angle - pinchStartAngle.current;
      const rawRotation = rotationAtPinchStart.current + radToDeg(angleDelta);
      const newRotation = snapRotation(rawRotation, SNAP_THRESHOLD);
      rotationAnim.setValue(newRotation);

      // Pan via midpoint delta (frame-to-frame), clamped to image edges
      if (lastMid.current) {
        const dx = mid.x - lastMid.current.x;
        const dy = mid.y - lastMid.current.y;
        const rawX = panRef.current.x + dx;
        const rawY = panRef.current.y + dy;
        const clamped = clampPan(rawX, rawY, newScale, newRotation);
        pan.setValue({ x: clamped.x, y: clamped.y });
      }
      lastMid.current = mid;

    } else if (touches.length === 1) {
      // Single finger pan — frame-by-frame deltas, clamped to image edges
      if (touchStart.current) {
        const dx = touches[0].pageX - touchStart.current.x;
        const dy = touches[0].pageY - touchStart.current.y;
        const rawX = panRef.current.x + dx;
        const rawY = panRef.current.y + dy;
        const clamped = clampPan(rawX, rawY, scaleRef.current, rotationRef.current);
        pan.setValue({ x: clamped.x, y: clamped.y });
      }
      touchStart.current = { x: touches[0].pageX, y: touches[0].pageY };
    }
  }, []);

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

    // Determine the final scale and rotation values after corrections
    const coverScale = Math.max(1, minCoverScaleRef.current);
    const finalScale = Math.max(scaleRef.current, coverScale);

    const nearest90 = Math.round(rotationRef.current / 90) * 90;
    const shouldSnapRot = Math.abs(rotationRef.current - nearest90) <= 15;
    const finalRotation = shouldSnapRot ? nearest90 : rotationRef.current;

    // Clamp pan to image edges based on the final (post-correction) scale & rotation
    const clamped = clampPan(panRef.current.x, panRef.current.y, finalScale, finalRotation);

    // Build parallel animations for any corrections needed
    const animations = [];

    if (shouldSnapRot) {
      animations.push(Animated.spring(rotationAnim, { toValue: nearest90, useNativeDriver: true }));
    }
    if (scaleRef.current < coverScale) {
      animations.push(Animated.spring(scaleAnim, { toValue: coverScale, useNativeDriver: true }));
    }
    if (clamped.x !== panRef.current.x || clamped.y !== panRef.current.y) {
      animations.push(Animated.spring(pan, { toValue: { x: clamped.x, y: clamped.y }, useNativeDriver: true }));
    }

    if (animations.length > 0) {
      Animated.parallel(animations).start();
    }
  }, []);

  // ── Button handlers ──

  const handleFlipH = () => {
    setFlipH((prev) => !prev);
  };

  const handleReset = () => {
    const resetScale = Math.max(1, minCoverScaleRef.current);
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: resetScale, duration: 200, useNativeDriver: true }),
      Animated.timing(pan, { toValue: { x: 0, y: 0 }, duration: 200, useNativeDriver: true }),
      Animated.timing(rotationAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    panRef.current = { x: 0, y: 0 };
    scaleRef.current = resetScale;
    rotationRef.current = 0;
    setFlipH(false);
  };

  const handleCrop = async () => {
    if (!imageSize || processing) return;
    if (!cropPipelineUri) return;
    setProcessing(true);

    let manipContext = null;
    let renderedRef = null;

    try {
      // Stop every running animation and grab the value at this instant.
      // Spring / timing animations that run on the native driver make
      // __getValue() unreliable on the JS side, so stopAnimation() is
      // the only way to get the true current value.
      const settled = await new Promise((resolve) => {
        const v = {};
        let n = 0;
        const tick = () => { if (++n === 4) resolve(v); };
        scaleAnim.stopAnimation((val) => { v.scale = val; tick(); });
        pan.x.stopAnimation((val) => { v.panX = val; tick(); });
        pan.y.stopAnimation((val) => { v.panY = val; tick(); });
        rotationAnim.stopAnimation((val) => { v.rotation = val; tick(); });
      });

      let currentScale = settled.scale;
      let currentPanX = settled.panX;
      let currentPanY = settled.panY;
      let currentRotation = settled.rotation;

      // ── Apply the same settle logic handleRelease would complete ──

      // Snap rotation to nearest 90° if within 15°
      const nearest90 = Math.round(currentRotation / 90) * 90;
      if (Math.abs(currentRotation - nearest90) <= 15) {
        currentRotation = nearest90;
      }

      // Clamp scale ≥ minCoverScale (ensures crop window is fully covered)
      const coverScale = Math.max(1, minCoverScaleRef.current);
      if (currentScale < coverScale) {
        currentScale = coverScale;
        currentPanX = 0;
        currentPanY = 0;
      }

      // Clamp pan within bounds.
      const cropSize = effectiveCropSizeRef.current;
      if (Platform.OS === 'ios') {
        // Keep iOS aligned with the legacy crop path (pre-branch behavior).
        const f = fittedRef.current;
        const imgW = f.width * currentScale;
        const imgH = f.height * currentScale;
        const maxTx = imgW > cropSize ? (imgW - cropSize) / 2 : 0;
        const maxTy = imgH > cropSize ? (imgH - cropSize) / 2 : 0;
        currentPanX = Math.min(maxTx, Math.max(-maxTx, currentPanX));
        currentPanY = Math.min(maxTy, Math.max(-maxTy, currentPanY));
      } else {
        const panClamped = clampPan(currentPanX, currentPanY, currentScale, currentRotation);
        currentPanX = panClamped.x;
        currentPanY = panClamped.y;
      }

      // Sync the display to match the values we'll actually crop with
      scaleAnim.setValue(currentScale);
      pan.setValue({ x: currentPanX, y: currentPanY });
      rotationAnim.setValue(currentRotation);

      // ── Compute crop in original-pixel space ──

      // Ignore tiny accidental rotations (< 3°)
      const rotDeg = Math.abs(currentRotation % 360) < 3 ? 0 : Math.round(currentRotation % 360);
      const absRot = ((rotDeg % 360) + 360) % 360; // normalize 0-359

      // After rotation, the image bounding box changes
      const rotRad = (absRot * Math.PI) / 180;
      const cosR = Math.abs(Math.cos(rotRad));
      const sinR = Math.abs(Math.sin(rotRad));
      const rotatedW = imageSize.width * cosR + imageSize.height * sinR;
      const rotatedH = imageSize.width * sinR + imageSize.height * cosR;

      const fitScaleBase = Platform.OS === 'ios'
        ? Math.max(1, windowWidth)
        : (() => {
            const f = fittedRef.current;
            return f && typeof f.width === 'number' && f.width > 0 ? f.width : Math.max(1, layoutWidthRef.current);
          })();
      const fitScale = fitScaleBase / imageSize.width;
      const totalScale = fitScale * currentScale;

      const cropW = cropSize / totalScale;
      const cropH = cropSize / totalScale;
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

      const sourceForCrop = cropPipelineUri;
      manipContext = ImageManipulator.manipulate(sourceForCrop);

      if (absRot !== 0) {
        manipContext.rotate(absRot);
      }
      if (flipH) {
        manipContext.flip(FlipType.Horizontal);
      }

      manipContext.crop({ originX, originY, width, height });

      renderedRef = await manipContext.renderAsync();
      const saved = await renderedRef.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.8,
      });

      onCropComplete({ uri: saved.uri });
    } catch (err) {
      console.error('Crop error:', err);
      Alert.alert('Error', 'Failed to crop image');
    } finally {
      if (renderedRef) renderedRef.release();
      if (manipContext) manipContext.release();
      setProcessing(false);
    }
  };

  if (!visible) return null;

  const pipelineUri = cropPipelineUri;
  const showCropper = Boolean(cropPipelineUri && imageSize);

  const cropCenterX = layoutWidth / 2;
  const cropCenterY =
    cropAreaHeight > 0 ? cropAreaHeight / 2 : null;
  /** Local origin for rotate/scale — center of the fitted box (= crop window center on screen). */
  const originX = fitted.width / 2;
  const originY = fitted.height / 2;

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
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setCropLayout({ width, height });
          }}
        >
          {!showCropper ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <>
              {/* Image layer — handles all touch gestures */}
              <View
                style={[StyleSheet.absoluteFill, { overflow: 'visible' }]}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderTerminationRequest={() => false}
                onResponderGrant={handleGrant}
                onResponderMove={handleMove}
                onResponderRelease={handleRelease}
                onResponderTerminate={handleRelease}
              >
                {Platform.OS === 'android' ? (
                  <>
                    {/*
                      Android-only path: anchor transform to crop center and use the manipulator
                      pipeline URI to keep preview/crop pixel space aligned.
                    */}
                    <Animated.View
                      collapsable={false}
                      style={{
                        position: 'absolute',
                        left: cropCenterX - fitted.width / 2,
                        ...(cropCenterY != null
                          ? { top: cropCenterY - fitted.height / 2 }
                          : { top: '50%', marginTop: -fitted.height / 2 }),
                        width: fitted.width,
                        height: fitted.height,
                        overflow: 'visible',
                        transformOrigin: [originX, originY, 0],
                        transform: [
                          { translateX: pan.x },
                          { translateY: pan.y },
                          { scale: scaleAnim },
                          { rotate: rotateStr },
                          { scaleX: flipH ? -1 : 1 },
                        ],
                      }}
                    >
                      <RNImage
                        source={{ uri: pipelineUri }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                        onLoad={handleImageLoad}
                      />
                    </Animated.View>
                  </>
                ) : (
                  <View style={styles.imageCentered}>
                    <Animated.Image
                      source={{ uri: pipelineUri }}
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
                      onLoad={handleImageLoad}
                    />
                  </View>
                )}
              </View>

              {/* Dark overlay — 4 absolutely positioned rects, no gaps */}
              {cropAreaHeight > 0 && (() => {
                const cropTop = Math.round((cropAreaHeight - effectiveCropSize) / 2);
                return (
                  <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    {/* Top */}
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: cropTop, backgroundColor: OVERLAY_COLOR }} />
                    {/* Bottom */}
                    <View style={{ position: 'absolute', top: cropTop + effectiveCropSize, left: 0, right: 0, bottom: 0, backgroundColor: OVERLAY_COLOR }} />
                    {/* Left */}
                    <View style={{ position: 'absolute', top: cropTop, left: 0, width: cropLeft, height: effectiveCropSize, backgroundColor: OVERLAY_COLOR }} />
                    {/* Right */}
                    <View style={{ position: 'absolute', top: cropTop, right: 0, width: cropLeft, height: effectiveCropSize, backgroundColor: OVERLAY_COLOR }} />
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
    overflow: 'visible',
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
    color: '#6c5ce7',
  },
  disabledText: {
    opacity: 0.4,
  },
  cropContainer: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'visible',
  },
  imageCentered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
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
