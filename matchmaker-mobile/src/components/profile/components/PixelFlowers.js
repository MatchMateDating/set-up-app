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
const FlowerFromMap = ({ map = [], shiftX = 0, shiftY = 0, style }) => (
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

/* =========================
   🌹 Pixel Rose (red + stem)
========================= */
const ROSE = [
  // petals
  { x: 8, y: 16, c: '#c4162a' },
  { x: 0, y: 24, c: '#c4162a' }, { x: 16, y: 24, c: '#c4162a' },
  { x: 8, y: 32, c: '#c4162a' },

  // center
  { x: 8, y: 24, c: '#7a0b18' },
];

/* =========================
   🌼 Pixel Daisy (white petals)
========================= */
const DAISY = [
  // outline
  {x:-16, y:88, c: '#737373'}, {x:-8, y:88, c: '#737373'}, {x:24, y:88, c: '#737373'}, {x:32, y:88, c: '#737373'},
  {x:-24, y:80, c: '#737373'}, {x:0, y:80, c: '#737373'}, {x:8, y:80, c: '#737373'}, {x:16, y:80, c: '#737373'}, {x:40, y:80, c: '#737373'},
  {x:-32, y:72, c: '#737373'}, {x:-24, y:72, c: '#737373'}, {x:8, y:72, c: '#737373'}, {x:40, y:72, c: '#737373'}, {x:40, y:72, c: '#737373'}, {x:48, y:72, c: '#737373'},
  {x:-40, y:64, c: '#737373'}, {x:-24, y:64, c: '#737373'}, {x:8, y:64, c: '#737373'}, {x:40, y:64, c: '#737373'}, {x:56, y:64, c: '#737373'},
  {x:-48, y:56, c: '#737373'}, {x:-16, y:56, c: '#737373'}, {x:32, y:56, c: '#737373'}, {x:64, y:56, c: '#737373'},
  {x:-48, y:48, c: '#737373'}, {x:64, y:48, c: '#737373'},
  {x:-40, y:40, c: '#737373'},{x:56, y:40, c: '#737373'},
  {x:-40, y:32, c: '#737373'}, {x:-32, y:32, c: '#737373'}, {x:-24, y:32, c: '#737373'}, {x:40, y:32, c: '#737373'}, {x:48, y:32, c: '#737373'}, {x:56, y:32, c: '#737373'},
  {x:-40, y:24, c: '#737373'},{x:56, y:24, c: '#737373'},
  {x:-48, y:16, c: '#737373'}, {x:64, y:16, c: '#737373'},
  {x:-48, y:8, c: '#737373'}, {x:-16, y:8, c: '#737373'}, {x:32, y:8, c: '#737373'}, {x:64, y:8, c: '#737373'},
  {x:-40, y:0, c: '#737373'}, {x:-24, y:0, c: '#737373'}, {x:8, y:0, c: '#737373'}, {x:40, y:0, c: '#737373'}, {x:56, y:0, c: '#737373'},
  {x:-32, y:-8, c: '#737373'}, {x:-24, y:-8, c: '#737373'}, {x:8, y:-8, c: '#737373'},{x:40, y:-8, c: '#737373'}, {x:48, y:-8, c: '#737373'},
  {x:-24, y:-16, c: '#737373'}, {x:0, y:-16, c: '#737373'},{x:8, y:-16, c: '#737373'}, {x:16, y:-16, c: '#737373'}, {x:40, y:-16, c: '#737373'},
  {x:-16, y:-24, c: '#737373'}, {x:-8, y:-24, c: '#737373'}, {x:24, y:-24, c: '#737373'}, {x:32, y:-24, c: '#737373'},

  // petals
  {x:-16, y:-16, c: '#FFFFFF'}, {x:-8, y:-16, c: '#FFFFFF'}, {x:24, y:-16, c: '#FFFFFF'}, {x:32, y:-16, c: '#FFFFFF'},
  {x:-16, y:-8, c: '#FFFFFF'}, {x:-8, y:-8, c: '#FFFFFF'}, {x:-0, y:-8, c: '#FFFFFF'}, {x:16, y:-8, c: '#FFFFFF'}, {x:24, y:-8, c: '#FFFFFF'}, {x:32, y:-8, c: '#FFFFFF'},
  {x:-32, y:0, c: '#FFFFFF'}, {x:-16, y:0, c: '#FFFFFF'}, {x:-8, y:0, c: '#FFFFFF'}, {x:-0, y:0, c: '#FFFFFF'}, {x:16, y:0, c: '#FFFFFF'}, {x:24, y:0, c: '#FFFFFF'}, {x:32, y:0, c: '#FFFFFF'}, {x:48, y:0, c: '#FFFFFF'},
  {x:-40, y:8, c: '#FFFFFF'},  {x:-32, y:8, c: '#FFFFFF'},  {x:-24, y:8, c: '#FFFFFF'},  {x:-8, y:8, c: '#FFFFFF'}, {x:24, y:8, c: '#FFFFFF'}, {x:40, y:8, c: '#FFFFFF'}, {x:48, y:8, c: '#FFFFFF'}, {x:56, y:8, c: '#FFFFFF'},
  {x:-40, y:16, c: '#FFFFFF'}, {x:-32, y:16, c: '#FFFFFF'},  {x:-24, y:16, c: '#FFFFFF'}, {x:-16, y:16, c: '#FFFFFF'}, {x:32, y:16, c: '#FFFFFF'}, {x:40, y:16, c: '#FFFFFF'}, {x:48, y:16, c: '#FFFFFF'}, {x:56, y:16, c: '#FFFFFF'},
  {x:-32, y:24, c: '#FFFFFF'}, {x:-24, y:24, c: '#FFFFFF'}, {x:40, y:24, c: '#FFFFFF'}, {x:48, y:24, c: '#FFFFFF'},
  {x:-32, y:40, c: '#FFFFFF'}, {x:-24, y:40, c: '#FFFFFF'}, {x:40, y:40, c: '#FFFFFF'}, {x:48, y:40, c: '#FFFFFF'},
  {x:-40, y:48, c: '#FFFFFF'}, {x:-32, y:48, c: '#FFFFFF'},  {x:-24, y:48, c: '#FFFFFF'}, {x:-16, y:48, c: '#FFFFFF'}, {x:32, y:48, c: '#FFFFFF'}, {x:40, y:48, c: '#FFFFFF'}, {x:48, y:48, c: '#FFFFFF'}, {x:56, y:48, c: '#FFFFFF'},
  {x:-40, y:56, c: '#FFFFFF'},  {x:-32, y:56, c: '#FFFFFF'},  {x:-24, y:56, c: '#FFFFFF'},  {x:-8, y:56, c: '#FFFFFF'}, {x:24, y:56, c: '#FFFFFF'}, {x:40, y:56, c: '#FFFFFF'}, {x:48, y:56, c: '#FFFFFF'}, {x:56, y:56, c: '#FFFFFF'},
  {x:-32, y:64, c: '#FFFFFF'}, {x:-16, y:64, c: '#FFFFFF'}, {x:-8, y:64, c: '#FFFFFF'}, {x:-0, y:64, c: '#FFFFFF'}, {x:16, y:64, c: '#FFFFFF'}, {x:24, y:64, c: '#FFFFFF'}, {x:32, y:64, c: '#FFFFFF'}, {x:48, y:64, c: '#FFFFFF'},
  {x:-16, y:72, c: '#FFFFFF'}, {x:-8, y:72, c: '#FFFFFF'}, {x:-0, y:72, c: '#FFFFFF'}, {x:16, y:72, c: '#FFFFFF'}, {x:24, y:72, c: '#FFFFFF'}, {x:32, y:72, c: '#FFFFFF'},
  {x:-16, y:80, c: '#FFFFFF'}, {x:-8, y:80, c: '#FFFFFF'}, {x:24, y:80, c: '#FFFFFF'}, {x:32, y:80, c: '#FFFFFF'},

  // center
  { x: 0, y: 8, c: '#492000' }, { x: 8, y: 8, c: '#492000' }, { x: 16, y: 8, c: '#492000' },
  { x: -8, y: 16, c: '#492000' }, { x: 0, y: 16, c: '#7C4700' },  { x: 8, y: 16, c: '#7C4700' }, { x: 16, y: 16, c: '#7C4700' },  { x: 24, y: 16, c: '#492000' },
  { x: -16, y: 24, c: '#492000' }, { x: -8, y: 24, c: '#7C4700' }, { x: 0, y: 24, c: '#7C4700' }, { x: 8, y: 24, c: '#492000' }, { x: 16, y: 24, c: '#7C4700' }, { x: 24, y: 24, c: '#7C4700' }, { x: 32, y: 24, c: '#492000' },
  { x: -16, y: 32, c: '#492000' }, { x: -8, y: 32, c: '#7C4700' }, { x: 0, y: 32, c: '#492000' }, { x: 8, y: 32, c: '#7C4700' }, { x: 16, y: 32, c: '#492000' }, { x: 24, y: 32, c: '#7C4700' }, { x: 32, y: 32, c: '#492000' },
  { x: -16, y: 40, c: '#492000' }, { x: -8, y: 40, c: '#7C4700' }, { x: 0, y: 40, c: '#7C4700' }, { x: 8, y: 40, c: '#492000' }, { x: 16, y: 40, c: '#7C4700' }, { x: 24, y: 40, c: '#7C4700' }, { x: 32, y: 40, c: '#492000' },
  { x: -8, y: 48, c: '#492000' }, { x: 0, y: 48, c: '#7C4700' }, { x: 8, y: 48, c: '#7C4700' }, { x: 16, y: 48, c: '#7C4700' }, { x: 24, y: 48, c: '#492000' },
  { x: 0, y: 56, c: '#492000' }, { x: 8, y: 56, c: '#492000' }, { x: 16, y: 56, c: '#492000' },
];

const HIBISCUS = [
     // petals (red)
     {x:-16,y:24,c:'#E63B2E'},{x:-8,y:24,c:'#E63B2E'},{x:0,y:24,c:'#E63B2E'},{x:8,y:24,c:'#E63B2E'},{x:16,y:24,c:'#E63B2E'},
     {x:-24,y:32,c:'#D83228'},{x:-16,y:32,c:'#E63B2E'},{x:-8,y:32,c:'#E63B2E'},{x:0,y:32,c:'#E63B2E'},{x:8,y:32,c:'#E63B2E'},{x:16,y:32,c:'#E63B2E'},{x:24,y:32,c:'#D83228'},
     {x:-24,y:40,c:'#D83228'},{x:-16,y:40,c:'#E63B2E'},{x:-8,y:40,c:'#F05A4F'},{x:0,y:40,c:'#F05A4F'},{x:8,y:40,c:'#F05A4F'},{x:16,y:40,c:'#E63B2E'},{x:24,y:40,c:'#D83228'},
     {x:-16,y:48,c:'#E63B2E'},{x:-8,y:48,c:'#F05A4F'},{x:0,y:48,c:'#F05A4F'},{x:8,y:48,c:'#F05A4F'},{x:16,y:48,c:'#E63B2E'},
     {x:-8,y:56,c:'#E63B2E'},{x:0,y:56,c:'#E63B2E'},{x:8,y:56,c:'#E63B2E'},

     // stamen (yellow/orange)
     {x:0,y:32,c:'#FFD200'},
     {x:0,y:24,c:'#FFC400'},
     {x:0,y:16,c:'#FFB000'},
     {x:-8,y:16,c:'#FFD200'},
     {x:8,y:16,c:'#FFD200'},
];

/* =========================
   🌸 Background Layout
========================= */
const PixelFlowers = () => (
  <View pointerEvents="none" style={styles.container}>
    <FlowerFromMap map={ROSE}  style={{ top: 10,  left: 90 }} />
    <FlowerFromMap map={HIBISCUS} style={{ top: 50, left: 220 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 70,  left: 0 }} />
    <FlowerFromMap map={DAISY}  style={{ top: 180, left: 100 }} />
    <FlowerFromMap map={HIBISCUS} style={{ top: 190, left: 20 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 200,  left: 20 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 280,  left: 90 }} />
    <FlowerFromMap map={HIBISCUS} style={{ top: 330, left: 300 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 335,  left: 10 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 340,  left: 330 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 345,  left: 50 }} />
    <FlowerFromMap map={DAISY} style={{ top: 350, left: 30 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 355,  left: 10 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 357,  left: 330 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 368,  left: 50 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 370,  left: 10 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 373,  left: 280 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 380,  left: 50 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 460,  left: 320}} />
    <FlowerFromMap map={ROSE}  style={{ top: 500, left: 260 }} />
    <FlowerFromMap map={DAISY} style={{ top: 520, left: 60 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 670,  left: 90 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 673,  left: 250 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 673,  left: 50 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 675,  left: 320}} />
    <FlowerFromMap map={HIBISCUS} style={{ top: 680, left: 10 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 720, left: 180 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 723,  left: 90 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 730,  left: 20 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 740,  left: 50 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 743,  left: 320}} />
    <FlowerFromMap map={DAISY} style={{ top: 780, left: 40 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 920, left: 280 }} />
    <FlowerFromMap map={HIBISCUS} style={{ top: 1000, left: 320 }} />
    <FlowerFromMap map={DAISY} style={{ top: 1100, left: 140 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 1150,  left: 90 }} />
    <FlowerFromMap map={HIBISCUS} style={{ top: 1200, left: 20 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 1260,  left: 90 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 1300, left: 180 }} />
    <FlowerFromMap map={HIBISCUS} style={{ top: 1330, left: 30 }} />
    <FlowerFromMap map={DAISY} style={{ top: 1480, left: 40 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 1500, left: 280 }} />
    <FlowerFromMap map={HIBISCUS} style={{ top: 1550, left: 320 }} />
    <FlowerFromMap map={DAISY} style={{ top: 1700, left: 140 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 1750,  left: 90 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 1760, left: 180 }} />
    <FlowerFromMap map={HIBISCUS} style={{ top: 1800, left: 10 }} />
    <FlowerFromMap map={DAISY} style={{ top: 1860, left: 40 }} />
    <FlowerFromMap map={ROSE}  style={{ top: 1900, left: 320 }} />
    <FlowerFromMap map={HIBISCUS} style={{ top: 2000, left: 320 }} />
    <FlowerFromMap map={DAISY} style={{ top: 2030, left: 140 }} />
  </View>
);

export default PixelFlowers;

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
