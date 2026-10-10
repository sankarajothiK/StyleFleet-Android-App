import React from 'react';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Path,
  Circle,
  Ellipse,
  Line,
} from 'react-native-svg';

interface LoginHeroArtProps {
  width: number;
  height: number;
}

const GOLD = '#D4AF37';
const GOLD_SOFT = '#E0C068';

// 4-point sparkle centred on (x, y)
const sparkle = (x: number, y: number, r: number) =>
  `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`;

/**
 * Vector salon illustration (navy and gold): arched mirror, styling chair,
 * scissors and sparkles. Drawn in a 400x240 box and scaled to fill.
 */
export const LoginHeroArt = ({ width, height }: LoginHeroArtProps) => (
  <Svg width={width} height={height} viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice">
    <Defs>
      <LinearGradient id="heroBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#0B1F44" />
        <Stop offset="1" stopColor="#14336E" />
      </LinearGradient>
      <RadialGradient id="heroGlow" cx="292" cy="115" r="120" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor={GOLD} stopOpacity="0.38" />
        <Stop offset="1" stopColor={GOLD} stopOpacity="0" />
      </RadialGradient>
      <LinearGradient id="heroChair" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#24366A" />
        <Stop offset="1" stopColor="#101C3B" />
      </LinearGradient>
    </Defs>

    <Rect x="0" y="0" width="400" height="240" fill="url(#heroBg)" />
    <Rect x="0" y="0" width="400" height="240" fill="url(#heroGlow)" />

    {/* Wall panelling */}
    <Line x1="170" y1="0" x2="170" y2="214" stroke={GOLD} strokeOpacity="0.12" strokeWidth="1" />
    <Line x1="178" y1="0" x2="178" y2="214" stroke={GOLD} strokeOpacity="0.08" strokeWidth="1" />

    {/* Arched mirror */}
    <Path
      d="M236 205 V92 A56 56 0 0 1 348 92 V205 Z"
      fill={GOLD}
      fillOpacity="0.07"
      stroke={GOLD}
      strokeWidth="2.5"
    />
    <Path
      d="M244 205 V94 A48 48 0 0 1 340 94 V205"
      fill="none"
      stroke={GOLD_SOFT}
      strokeOpacity="0.5"
      strokeWidth="1"
    />
    {/* Mirror shine */}
    <Path d="M262 70 L282 50" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />
    <Path d="M270 82 L294 58" stroke="#FFFFFF" strokeOpacity="0.2" strokeWidth="2" strokeLinecap="round" />

    {/* Styling chair */}
    <Rect x="262" y="120" width="60" height="58" rx="16" fill="url(#heroChair)" stroke={GOLD} strokeWidth="2" />
    <Rect x="250" y="170" width="84" height="24" rx="11" fill="url(#heroChair)" stroke={GOLD} strokeWidth="2" />
    <Rect x="244" y="152" width="14" height="30" rx="7" fill="url(#heroChair)" stroke={GOLD} strokeWidth="1.8" />
    <Rect x="326" y="152" width="14" height="30" rx="7" fill="url(#heroChair)" stroke={GOLD} strokeWidth="1.8" />
    <Rect x="286" y="194" width="12" height="14" fill={GOLD} />
    <Ellipse cx="292" cy="212" rx="34" ry="6" fill="none" stroke={GOLD} strokeWidth="2.5" />

    {/* Floor line */}
    <Line x1="0" y1="214" x2="400" y2="214" stroke={GOLD} strokeOpacity="0.3" strokeWidth="1" />

    {/* Scissors */}
    <Line x1="94" y1="42" x2="134" y2="152" stroke={GOLD} strokeWidth="3.5" strokeLinecap="round" />
    <Line x1="120" y1="42" x2="80" y2="152" stroke={GOLD_SOFT} strokeWidth="3.5" strokeLinecap="round" />
    <Circle cx="107" cy="97" r="3.5" fill="#0B1F44" stroke={GOLD} strokeWidth="1.5" />
    <Circle cx="72" cy="164" r="13" fill="none" stroke={GOLD_SOFT} strokeWidth="3" />
    <Circle cx="142" cy="164" r="13" fill="none" stroke={GOLD} strokeWidth="3" />

    {/* Flowing gold line */}
    <Path
      d="M0 196 C60 170 120 210 190 184 S300 170 400 186"
      fill="none"
      stroke={GOLD}
      strokeOpacity="0.45"
      strokeWidth="1.2"
    />

    {/* Sparkles */}
    <Path d={sparkle(40, 52, 9)} fill={GOLD} />
    <Path d={sparkle(196, 78, 6)} fill={GOLD_SOFT} />
    <Path d={sparkle(362, 46, 8)} fill={GOLD} />
    <Path d={sparkle(214, 28, 5)} fill={GOLD_SOFT} fillOpacity="0.8" />
    <Circle cx="150" cy="30" r="1.8" fill={GOLD_SOFT} />
    <Circle cx="30" cy="120" r="1.6" fill={GOLD_SOFT} />
    <Circle cx="380" cy="130" r="1.8" fill={GOLD_SOFT} />
  </Svg>
);
