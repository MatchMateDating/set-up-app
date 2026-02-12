import React from 'react';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Path, Rect } from 'react-native-svg';

const JaggedMask = () => (
  <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
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
  </Svg>
);

export const ConstitutionMask = ({ children }) => {
  return (
    <MaskedView
      style={{ flex: 1 }}
      maskElement={<JaggedMask />}
    >
      {children}
    </MaskedView>
  );
};
