import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Defs, Mask, Path, Rect, RadialGradient, Stop } from 'react-native-svg';

const { width: W, height: H } = Dimensions.get('window');

const ConstitutionDecor = () => {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Jagged SVG mask */}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Mask id="mask">
            <Rect width="100%" height="100%" fill="white" />
            <JaggedMask />
          </Mask>
        </Defs>

        {/* parchment */}
        <Rect
          width="100%"
          height="100%"
          fill="#FDF5D9"
          mask="url(#mask)"
        />
      </Svg>

      {/* radial parchment shading */}
      <View style={styles.parchment}>
        <Parchment />
      </View>

      {/* paper grain dots */}
      {GRAIN.map((d, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { left: d.x, top: d.y, opacity: d.o }
          ]}
        />
      ))}
    </View>
  );
};

const GRAIN = Array.from({ length: 60 }).map((_, i) => ({
  x: (i * 37) % W,
  y: (i * 61) % 600,
  o: 0.04,
}));

const JaggedMask = () => (
  <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
    <Defs>
      <Mask id="jaggedMask">
        <Rect width="100" height="100" fill="white" />
        <Path
          d={`
            M0 0
            L2 .5 L14 1 L18 .5 L22 1.1 L26 .7
            L42 1.3 L48 .4 L54 1.2 L60 .5
            L66 .1 L78 1.2 L84 .4 L96 .4 L100 0
            L100 4 L99 8 L100 12 L100 20 L99 24
            L100 28 L99 32 L100 44 L99 48 L100 52
            L99 56 L100 60 L99 64 L99 72 L100 76
            L99 80 L100 84 L99 96 L100 100
            L96 99 L92 100 L88 99 L84 100 L68 100
            L64 99.2 L60 100 L56 99.3 L52 100
            L48 99 L40 99.8 L36 100 L32 99
            L24 99 L12 100 L8 99.5 L4 100 L0 100
            L1.4 96 L0 92 L.3 80 L0 76 L.1 72
            L0 60 L.1 56 L0 52 L.6 48 L0 44
            L1 40 L0 36 L1 32 L0 28 L.2 24
            L0 20 L.1 16 L.6 12 L.4 8 L0 4 Z
          `}
          fill="black"
        />
      </Mask>
    </Defs>
  </Svg>
);

const Parchment = () => (
  <Svg width="100%" height="100%" preserveAspectRatio="none">
    <Defs>
      <RadialGradient id="paper" cx="50%" cy="35%" r="70%">
        <Stop offset="0%" stopColor="#FDF5D9" />
        <Stop offset="70%" stopColor="#E9D8A6" />
        <Stop offset="100%" stopColor="#D4A373" />
      </RadialGradient>
    </Defs>

    <Rect width="100%" height="100%" fill="url(#paper)" />
  </Svg>
);

export default ConstitutionDecor;

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: -2,
    },
    parchment: {
        position: 'absolute',
        inset: 0,
        backgroundColor: '#FDF5D9',
    },
    radial: {
        position: 'absolute',
        width: W * 1.6,
        height: W * 1.6,
        borderRadius: W * 0.8,
        backgroundColor: 'rgba(233,216,166,0.18)',
        top: -W * 0.9,
        left: -W * 0.2,
        opacity: 1, },
    stripe: {
        position: 'absolute',
        left: -W * 0.4,
        width: W * 2,
        height: 56,
        backgroundColor: 'rgba(0,0,0,0.04)' },
    corner: {
        position: 'absolute',
        width: 140,
        height: 52,
        bottom: 18,
        left: 12,
        backgroundColor: 'rgba(212,163,115,0.06)',
        transform: [{ rotate: '-6deg' }],
        borderRadius: 2, },
    triangle: {
        position: 'absolute',
        width: 0,
        height: 0,
        borderLeftWidth: 12,
        borderRightWidth: 12,
        borderBottomWidth: 14,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: '#fff', },
    dot: {
        position: 'absolute',
        backgroundColor: 'rgba(0,0,0,0.08)',
        borderRadius: 2,
    },
});