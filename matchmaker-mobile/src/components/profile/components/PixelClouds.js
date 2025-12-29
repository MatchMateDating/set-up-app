import React from 'react';
import { View, StyleSheet } from 'react-native';

// A single 8x8 pixel block
const Pixel = ({ left, top, color = '#fff' }) => (
  <View style={[styles.pixel, { left, top, backgroundColor: color }]} />
);

// Helper to render a cloud from a list of pixel offsets
const CloudFromMap = ({ map = [], shiftX = 80, shiftY = 0, style }) => (
  <View style={[styles.cloudContainer, style]} pointerEvents="none">
    {map.map((p, i) => (
      <Pixel key={i} left={shiftX + p.x} top={shiftY + p.y} color={p.c || '#fff'} />
    ))}
  </View>
);

// Cloud 1: map approximating .cloud-1 from CSS
const CLOUD1 = [
  { x: 8, y: 0 },
  { x: -8, y: 8 }, { x: 0, y: 8 }, { x: 8, y: 8 }, { x: 16, y: 8 }, { x: 24, y: 8 },
  { x: -40, y: 16 }, { x: -32, y: 16 }, { x: -16, y: 16 }, { x: -8, y: 16 }, { x: 0, y: 16 }, { x: 8, y: 16 }, { x: 16, y: 16 }, { x: 24, y: 16 }, { x: 32, y: 16 },
  { x: -48, y: 24 }, { x: -40, y: 24 }, { x: -32, y: 24 }, { x: -24, y: 24, c: '#e7e3eb' }, { x: -16, y: 24, c: '#e7e3eb' }, { x: -8, y: 24 }, { x: 0, y: 24 }, { x: 8, y: 24 }, { x: 16, y: 24 }, { x: 24, y: 24 }, { x: 32, y: 24 },
  { x: -56, y: 32 }, { x: -48, y: 32 }, { x: -40, y: 32 }, { x: -32, y: 32, c: '#e7e3eb' }, { x: -24, y: 32, c: '#e7e3eb' }, { x: -16, y: 32, c: '#e7e3eb' }, { x: -8, y: 32, c: '#e7e3eb' }, { x: 0, y: 32 }, { x: 8, y: 32 }, { x: 16, y: 32 }, { x: 24, y: 32 }, { x: 32, y: 32 }, { x: 40, y: 32 },
  { x: -64, y: 40 }, { x: -56, y: 40 }, { x: -48, y: 40 }, { x: -40, y: 40 }, { x: -32, y: 40 }, { x: -24, y: 40 }, { x: -16, y: 40 }, { x: -8, y: 40, c: '#e7e3eb' }, { x: 0, y: 40, c: '#e7e3eb' }, { x: 8, y: 40, c: '#e7e3eb' }, { x: 16, y: 40 }, { x: 24, y: 40 }, { x: 32, y: 40 }, { x: 40, y: 40 },
  { x: -72, y: 48 }, { x: -64, y: 48 }, { x: -56, y: 48 }, { x: -48, y: 48 }, { x: -40, y: 48 }, { x: -32, y: 48 }, { x: -24, y: 48 }, { x: -16, y: 48 }, { x: -8, y: 48 }, { x: 0, y: 48 }, { x: 8, y: 48 }, { x: 16, y: 48, c: '#e7e3eb' }, { x: 24, y: 48 }, { x: 32, y: 48 }, { x: 40, y: 48 }, { x: 48, y: 48 },
];

// Cloud 2: map approximating .cloud-2 from CSS
const CLOUD2 = [
  { x: 8, y: 0, c: '#e7e3eb' },
  { x: -8, y: 8 }, { x: 0, y: 8 }, { x: 8, y: 8 }, { x: 16, y: 8 }, { x: 24, y: 8 },
  { x: -40, y: 16, c: '#e7e3eb' }, { x: -32, y: 16 }, { x: -16, y: 16, c: '#e7e3eb' }, { x: -8, y: 16, c: '#e7e3eb' }, { x: 0, y: 16 }, { x: 8, y: 16 }, { x: 16, y: 16 }, { x: 24, y: 16 }, { x: 32, y: 16 },
  { x: -48, y: 24 }, { x: -40, y: 24 }, { x: -32, y: 24 }, { x: -24, y: 24 }, { x: -16, y: 24 }, { x: -8, y: 24 }, { x: 0, y: 24, c: '#e7e3eb' }, { x: 8, y: 24, c: '#e7e3eb' }, { x: 16, y: 24 }, { x: 24, y: 24 }, { x: 32, y: 24 },
  { x: -56, y: 32 }, { x: -48, y: 32 }, { x: -40, y: 32 }, { x: -32, y: 32 }, { x: -24, y: 32 }, { x: -16, y: 32 }, { x: -8, y: 32 }, { x: 0, y: 32 }, { x: 8, y: 32, c: '#e7e3eb' }, { x: 16, y: 32, c: '#e7e3eb' }, { x: 24, y: 32 }, { x: 32, y: 32 }, { x: 40, y: 32 },
  { x: -56, y: 40, c: '#e7e3eb' }, { x: -48, y: 40 }, { x: -40, y: 40 }, { x: -32, y: 40 }, { x: -24, y: 40 }, { x: -16, y: 40 }, { x: -8, y: 40 }, { x: 0, y: 40 }, { x: 8, y: 40 }, { x: 16, y: 40 }, { x: 24, y: 40, c: '#e7e3eb' }, { x: 32, y: 40 },
  { x: -64, y: 48 }, { x: -56, y: 48 }, { x: -48, y: 48 }, { x: -40, y: 48 }, { x: -32, y: 48 }, { x: -24, y: 48 }, { x: -16, y: 48 }, { x: -8, y: 48 }, { x: 0, y: 48 }, { x: 8, y: 48 }, { x: 16, y: 48 }, { x: 24, y: 48 }, { x: 32, y: 48 }, { x: 40, y: 48 },
];

// Cloud 3: map approximating .cloud-3 from CSS
const CLOUD3 = [
  { x: -24, y: 0 }, { x: 8, y: 0 }, { x: 16, y: 0 },
  { x: -8, y: 8 }, { x: 0, y: 8 }, { x: 8, y: 8 }, { x: 16, y: 8 }, { x: 24, y: 8 }, { x: 32, y: 8 }, { x: 40, y: 8 },
  { x: -48, y: 16 }, { x: -40, y: 16 }, { x: -32, y: 16 }, { x: -8, y: 16, c: '#e7e3eb' }, { x: 0, y: 16, c: '#e7e3eb' }, { x: 8, y: 16 }, { x: 16, y: 16 }, { x: 24, y: 16 }, { x: 32, y: 16 }, { x: 40, y: 16 }, { x: 48, y: 16 }, { x: 56, y: 16 },
  { x: -80, y: 24 }, { x: -56, y: 24 }, { x: -48, y: 24 }, { x: -40, y: 24 }, { x: -32, y: 24 }, { x: -24, y: 24, c: '#e7e3eb' }, { x: -16, y: 24, c: '#e7e3eb' }, { x: -8, y: 24, c: '#e7e3eb' }, { x: 0, y: 24, c: '#e7e3eb' }, { x: 8, y: 24, c: '#e7e3eb' }, { x: 16, y: 24 }, { x: 24, y: 24 }, { x: 32, y: 24 }, { x: 40, y: 24 }, { x: 48, y: 24 },
  { x: -64, y: 32 }, { x: -56, y: 32 }, { x: -48, y: 32 }, { x: -40, y: 32 }, { x: -32, y: 32 }, { x: -24, y: 32 }, { x: -16, y: 32 }, { x: -8, y: 32 }, { x: 0, y: 32 }, { x: 8, y: 32, c: '#e7e3eb' }, { x: 16, y: 32, c: '#e7e3eb' }, { x: 24, y: 32 }, { x: 32, y: 32 }, { x: 40, y: 32 }, { x: 48, y: 32 },
  { x: -64, y: 40 }, { x: -56, y: 40 }, { x: -48, y: 40 }, { x: -40, y: 40 }, { x: -32, y: 40 }, { x: -24, y: 40 }, { x: -16, y: 40 }, { x: -8, y: 40 }, { x: 0, y: 40 }, { x: 8, y: 40 }, { x: 16, y: 40 }, { x: 24, y: 40 }, { x: 32, y: 40 }, { x: 40, y: 40 }, { x: 48, y: 40 }, { x: 56, y: 40 },
];

const PixelClouds = () => (
  <View pointerEvents="none" style={styles.container}>
    {/* spread instances across the background */}
    <CloudFromMap map={CLOUD3} style={{ top: 5, left: 280 }} />
    <CloudFromMap map={CLOUD1} style={{ top: 10, left: 10 }} />
    <CloudFromMap map={CLOUD2} style={{ top: 150, left: 40 }} />
    <CloudFromMap map={CLOUD2} style={{ top: 200, left: -80 }} />
    <CloudFromMap map={CLOUD1} style={{ top: 220, left: 350 }} />
    <CloudFromMap map={CLOUD2} style={{ top: 240, left: -30 }} />
    <CloudFromMap map={CLOUD3}  style={{ top: 300, left: 240 }} />
    <CloudFromMap map={CLOUD3}  style={{ top: 360, left: 40 }} />
    <CloudFromMap map={CLOUD1} style={{ top: 420, left: 350 }} />
    <CloudFromMap map={CLOUD2} style={{ top: 530, left: 240 }} />
    <CloudFromMap map={CLOUD3} style={{ top: 600, left: 20 }} />
    <CloudFromMap map={CLOUD1} style={{ top: 680, left: 320 }} />
    <CloudFromMap map={CLOUD2} style={{ top: 720, left: 150 }} />
    <CloudFromMap map={CLOUD3} style={{ top: 800, left: -80 }} />
    <CloudFromMap map={CLOUD3}  style={{ top: 900, left: 240 }} />
    <CloudFromMap map={CLOUD3}  style={{ top: 960, left: -40 }} />
    <CloudFromMap map={CLOUD1} style={{ top: 1080, left: 300 }} />
    <CloudFromMap map={CLOUD2} style={{ top: 1110, left: -80 }} />
    <CloudFromMap map={CLOUD3} style={{ top: 1250, left: 20 }} />
    <CloudFromMap map={CLOUD3}  style={{ top: 1300, left: 240 }} />
    <CloudFromMap map={CLOUD3}  style={{ top: 1420, left: 40 }} />
    <CloudFromMap map={CLOUD1} style={{ top: 1560, left: 350 }} />
    <CloudFromMap map={CLOUD2} style={{ top: 1620, left: 240 }} />
    <CloudFromMap map={CLOUD3} style={{ top: 1700, left: 20 }} />
    <CloudFromMap map={CLOUD1} style={{ top: 1720, left: 320 }} />
    <CloudFromMap map={CLOUD2} style={{ top: 1800, left: 150 }} />
    <CloudFromMap map={CLOUD3} style={{ top: 1820, left: -80 }} />
    <CloudFromMap map={CLOUD3}  style={{ top: 1900, left: 40 }} />
    <CloudFromMap map={CLOUD1} style={{ top: 1940, left: 350 }} />
    <CloudFromMap map={CLOUD2} style={{ top: 2100, left: 240 }} />
    <CloudFromMap map={CLOUD3} style={{ top: 2350, left: 20 }} />

  </View>
);

export default PixelClouds;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
    zIndex: -1,
  },
  cloudContainer: {
    position: 'absolute',
    width: 360,
    height: 120,
    overflow: 'visible',
  },
  pixel: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 0,
  },
});