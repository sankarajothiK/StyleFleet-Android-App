import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { getGlass } from '../../theme/glass';

interface GlassBackdropProps {
  isDark: boolean;
}

/** Soft gold and blue glows that give glass cards something to show through. */
export const GlassBackdrop = ({ isDark }: GlassBackdropProps) => {
  const { width, height } = useWindowDimensions();
  const { glowGold, glowBlue } = getGlass(isDark);
  const goldOpacity = isDark ? 0.3 : 0.45;
  const blueOpacity = isDark ? 0.26 : 0.4;

  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width={width}
      height={height}
    >
      <Defs>
        <RadialGradient
          id="glowGoldTop"
          cx={width * 0.9}
          cy={height * 0.06}
          r={width * 0.75}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={glowGold} stopOpacity={goldOpacity} />
          <Stop offset="1" stopColor={glowGold} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient
          id="glowBlueMid"
          cx={width * 0.05}
          cy={height * 0.42}
          r={width * 0.85}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={glowBlue} stopOpacity={blueOpacity} />
          <Stop offset="1" stopColor={glowBlue} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient
          id="glowGoldLow"
          cx={width * 0.95}
          cy={height * 0.82}
          r={width * 0.7}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={glowGold} stopOpacity={goldOpacity * 0.6} />
          <Stop offset="1" stopColor={glowGold} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill="url(#glowGoldTop)" />
      <Rect x="0" y="0" width={width} height={height} fill="url(#glowBlueMid)" />
      <Rect x="0" y="0" width={width} height={height} fill="url(#glowGoldLow)" />
    </Svg>
  );
};
