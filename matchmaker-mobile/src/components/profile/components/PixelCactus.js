import React from 'react';
import { View, StyleSheet } from 'react-native';

/* =========================
   Core pixel primitive
========================= */
const Pixel = ({ left, top, color }) => (
  <View style={[styles.pixel, { left, top, backgroundColor: color }]} />
);

/* =========================
   Generic flower renderer
========================= */
const CactusFromMap = ({ map = [], shiftX = 0, shiftY = 0, style }) => (
  <View style={[styles.flowerContainer, style]} pointerEvents="none">
    {map.map((p, i) => (
      <Pixel
        key={i}
        left={shiftX + p.x}
        top={shiftY + p.y}
        color={p.c}
      />
    ))}
  </View>
);

const CACTUS_1 = [
{ x: 8, y: 16, c: '#8BD124' }, { x: 16, y: 16, c: '#8BD124' },
{ x: 8, y: 24, c: '#8BD124' }, { x: 16, y: 24, c: '#8BD124' },
{ x: -8, y: 32, c: '#8BD124' }, { x: 8, y: 32, c: '#67991D' }, { x: 16, y: 32, c: '#8BD124' },
{ x: -8, y: 40, c: '#8BD124' }, { x: 8, y: 40, c: '#67991D' }, { x: 16, y: 40, c: '#8BD124' }, { x: 32, y: 40, c: '#8BD124' },
{ x: -8, y: 48, c: '#8BD124' }, { x: 0, y: 48, c: '#8BD124' }, { x: 8, y: 48, c: '#67991D' }, { x: 16, y: 48, c: '#8BD124' }, { x: 32, y: 48, c: '#8BD124' },
{ x: 8, y: 56, c: '#67991D' }, { x: 16, y: 56, c: '#8BD124' }, { x: 24, y: 56, c: '#67991D' }, { x: 32, y: 56, c: '#8BD124' },
{ x: 8, y: 64, c: '#67991D' }, { x: 16, y: 64, c: '#8BD124' },
{ x: 8, y: 72, c: '#67991D' }, { x: 16, y: 72, c: '#8BD124' },
{ x: 8, y: 80, c: '#67991D' }, { x: 16, y: 80, c: '#8BD124' },

];

const CACTUS_2 = [
{ x: 16, y: 8, c: '#8BD124' },
{ x: 8, y: 16, c: '#8BD124' }, { x: 16, y: 16, c: '#8BD124' }, { x: 24, y: 16, c: '#8BD124' },
{ x: 8, y: 24, c: '#8BD124' }, { x: 16, y: 24, c: '#8BD124' }, { x: 24, y: 24, c: '#8BD124' },
{ x: 8, y: 32, c: '#8BD124' }, { x: 16, y: 32, c: '#8BD124' }, { x: 24, y: 32, c: '#8BD124' },
{ x: 8, y: 40, c: '#8BD124' }, { x: 16, y: 40, c: '#8BD124' }, { x: 24, y: 40, c: '#8BD124' }, { x: 32, y: 40, c: '#8BD124' }, { x: 40, y: 40, c: '#8BD124' },
{ x: -8, y: 48, c: '#8BD124' }, { x: 0, y: 48, c: '#8BD124' }, { x: 8, y: 48, c: '#8BD124' }, { x: 16, y: 48, c: '#8BD124' }, { x: 24, y: 48, c: '#67991D' }, { x: 32, y: 48, c: '#67991D' },
{ x: -8, y: 56, c: '#67991D' },  { x: 0, y: 56, c: '#67991D' },  { x: 8, y: 56, c: '#8BD124' }, { x: 16, y: 56, c: '#8BD124' }, { x: 24, y: 56, c: '#67991D' },
{ x: 0, y: 64, c: '#67991D' }, { x: 8, y: 64, c: '#67991D' }, { x: 16, y: 64, c: '#8BD124' }, { x: 24, y: 64, c: '#8BD124' },
{ x: 8, y: 72, c: '#8BD124' }, { x: 16, y: 72, c: '#8BD124' }, { x: 24, y: 72, c: '#8BD124' }, { x: 32, y: 72, c: '#8BD124' }, { x: 40, y: 72, c: '#8BD124' },
{ x: 8, y: 80, c: '#8BD124' }, { x: 16, y: 80, c: '#8BD124' }, { x: 24, y: 80, c: '#8BD124' }, { x: 32, y: 80, c: '#67991D' }, { x: 40, y: 80, c: '#67991D' },
{ x: 8, y: 88, c: '#8BD124' }, { x: 16, y: 88, c: '#8BD124' }, { x: 24, y: 88, c: '#67991D' },
{ x: 0, y: 96, c: '#8BD124' }, { x: 8, y: 96, c: '#8BD124' }, { x: 16, y: 96, c: '#8BD124' }, { x: 24, y: 96, c: '#67991D' },
{ x: 0, y: 104, c: '#67991D' }, { x: 8, y: 104, c: '#8BD124' }, { x: 16, y: 104, c: '#67991D' }, { x: 24, y: 104, c: '#67991D' },
{ x: 8, y: 112, c: '#67991D' }, { x: 16, y: 112, c: '#67991D' }, { x: 24, y: 112, c: '#67991D' },

];

const CACTUS_3 = [
{ x: 8, y: 0, c: '#FC86F3' },
{ x: 0, y: 8, c: '#FC86F3' },  { x: 8, y: 8, c: '#FC86F3' }, { x: 16, y: 8, c: '#FC86F3' },
{ x: -8, y: 16, c: '#8BD124' },  { x: 0, y: 16, c: '#8BD124' },  { x: 8, y: 16, c: '#8BD124' }, { x: 16, y: 16, c: '#67991D' }, { x: 24, y: 16, c: '#67991D' },
{ x: -8, y: 24, c: '#8BD124' },  { x: 0, y: 24, c: '#8BD124' },  { x: 8, y: 24, c: '#8BD124' }, { x: 16, y: 24, c: '#67991D' }, { x: 24, y: 24, c: '#67991D' },
{ x: -8, y: 32, c: '#8BD124' },  { x: 0, y: 32, c: '#8BD124' },  { x: 8, y: 32, c: '#67991D' }, { x: 16, y: 32, c: '#67991D' }, { x: 24, y: 32, c: '#67991D' },
{ x: 0, y: 40, c: '#8BD124' },  { x: 8, y: 40, c: '#67991D' }, { x: 16, y: 40, c: '#67991D' },
];


const PixelCactus = () => (
  <View pointerEvents="none" style={styles.container}>
    <CactusFromMap map={CACTUS_1}  style={{ top: 5,  left: 90 }} />
    <CactusFromMap map={CACTUS_2} style={{ top: 50, left: 320 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 75,  left: 240}} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 92,  left: -30}} />
    <CactusFromMap map={CACTUS_1}  style={{ top: 120,  left: 90 }} />
    <CactusFromMap map={CACTUS_2} style={{ top: 130, left: 220 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 220,  left: 340}} />
    <CactusFromMap map={CACTUS_1}  style={{ top: 310,  left: 90 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 350,  left: 120 }} />
    <CactusFromMap map={CACTUS_2} style={{ top: 380, left: 220 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 420,  left: 280 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 460,  left: 0 }} />
    <CactusFromMap map={CACTUS_1}  style={{ top: 500,  left: 300 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 570,  left: 150}} />
    <CactusFromMap map={CACTUS_2} style={{ top: 580, left: 220 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 640,  left: 90}} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 670,  left: 180 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 710,  left: 320 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 740,  left: 40 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 780,  left: 180}} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 830,  left: 0 }} />
    <CactusFromMap map={CACTUS_1}  style={{ top: 850,  left: 150 }} />
    <CactusFromMap map={CACTUS_2} style={{ top: 920, left: 220 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 970,  left: -10 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 1020,  left: 260 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 1070,  left: 10 }} />
    <CactusFromMap map={CACTUS_1}  style={{ top: 1120,  left: 90 }} />
    <CactusFromMap map={CACTUS_2} style={{ top: 1210, left: 220 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 1270,  left: 0 }} />
    <CactusFromMap map={CACTUS_1}  style={{ top: 1300,  left: 120 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 1320,  left: 340}} />
    <CactusFromMap map={CACTUS_2} style={{ top: 1350, left: 220 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 1370,  left: 300 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 1420,  left: 150 }} />
    <CactusFromMap map={CACTUS_1}  style={{ top: 1500,  left: 320 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 1570,  left: 180 }} />
    <CactusFromMap map={CACTUS_2} style={{ top: 1630, left: 220 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 1700,  left: 0 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 1770,  left: 130 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 1820,  left: 40 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 1900,  left: 320}} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 1950,  left: 80 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 2000,  left: 0 }} />
    <CactusFromMap map={CACTUS_2} style={{ top: 2020, left: 220 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 2080,  left: 280 }} />
    <CactusFromMap map={CACTUS_3}  style={{ top: 2100,  left: 0 }} />
    <CactusFromMap map={CACTUS_1}  style={{ top: 2150,  left: 90 }} />
  </View>
);

export default PixelCactus;

/* =========================
   Styles
========================= */
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
    zIndex: -1,
  },
  flowerContainer: {
    position: 'absolute',
    width: 64,
    height: 96,
  },
  pixel: {
    position: 'absolute',
    width: 8,
    height: 8,
  },
});