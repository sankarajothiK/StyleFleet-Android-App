import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface WelcomeTourScreenProps {
  onFinish: () => void;
}

interface TourSlide {
  eyebrow: string;
  title: string;
  desc: string;
  // Horizontal focus point (0–1) of the salon photo shown for this slide
  focusX: number;
}

const HERO_IMAGE = require('../../assets/home_hero_bg.jpg');
const HERO_ASPECT = 1024 / 575;
const PARALLAX = 0.15; // fraction of screen width the photo drifts while swiping

const SLIDES: TourSlide[] = [
  {
    eyebrow: 'WELCOME',
    title: 'Your salon, beautifully managed',
    desc: 'Billing, customers, appointments and reports, everything your salon needs in one elegant place.',
    focusX: 0.25,
  },
  {
    eyebrow: 'BILLING',
    title: 'Bill in seconds',
    desc: 'Pick services, choose the stylist, take UPI, cash or card, and send the invoice on WhatsApp.',
    focusX: 0.62,
  },
  {
    eyebrow: 'CUSTOMERS',
    title: 'Know every client',
    desc: 'Visit history, pending dues and VIP clients at hand. Book appointments and send reminders.',
    focusX: 0.78,
  },
  {
    eyebrow: 'GROWTH',
    title: 'Grow with real numbers',
    desc: 'Track sales, expenses and team performance, all calculated from your real bills.',
    focusX: 0.92,
  },
];

export const WelcomeTourScreen: React.FC<WelcomeTourScreenProps> = ({ onFinish }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<{ scrollTo: (o: { x: number; animated: boolean }) => void } | null>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);

  const heroHeight = Math.round(height * 0.56);
  const imageWidth = heroHeight * HERO_ASPECT;
  const margin = width * PARALLAX;
  const isLast = index === SLIDES.length - 1;

  const goTo = (next: number) => {
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  };

  const handleNext = () => {
    if (isLast) onFinish();
    else goTo(index + 1);
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  const imageLeft = (focusX: number) => {
    const centered = width / 2 - focusX * imageWidth;
    // keep a margin on both sides so parallax never exposes the image edge
    return Math.min(-margin, Math.max(width - imageWidth + margin, centered));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Animated.ScrollView
        ref={scrollRef as never}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          // Dot width is animated from scrollX; width is not supported by the native driver.
          useNativeDriver: false,
        })}
        onMomentumScrollEnd={handleScrollEnd}
      >
        {SLIDES.map((slide, i) => {
          const range = [(i - 1) * width, i * width, (i + 1) * width];
          const imageShift = scrollX.interpolate({
            inputRange: range,
            outputRange: [margin, 0, -margin],
            extrapolate: 'clamp',
          });
          const textOpacity = scrollX.interpolate({
            inputRange: [(i - 0.6) * width, i * width, (i + 0.6) * width],
            outputRange: [0, 1, 0],
            extrapolate: 'clamp',
          });
          const textShift = scrollX.interpolate({
            inputRange: range,
            outputRange: [40, 0, -40],
            extrapolate: 'clamp',
          });

          return (
            <View key={slide.title} style={{ width }}>
              <View style={{ width, height: heroHeight, overflow: 'hidden' }}>
                <Animated.Image
                  source={HERO_IMAGE}
                  resizeMode="cover"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: imageLeft(slide.focusX),
                    width: imageWidth,
                    height: heroHeight,
                    transform: [{ translateX: imageShift }],
                  }}
                />
                <Svg style={StyleSheet.absoluteFill} width={width} height={heroHeight}>
                  <Defs>
                    <LinearGradient id={`fade${i}`} x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor="#000000" stopOpacity="0.45" />
                      <Stop offset="0.35" stopColor={colors.bg} stopOpacity="0" />
                      <Stop offset="0.72" stopColor={colors.bg} stopOpacity="0.55" />
                      <Stop offset="1" stopColor={colors.bg} stopOpacity="1" />
                    </LinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width={width} height={heroHeight} fill={`url(#fade${i})`} />
                </Svg>
              </View>

              <Animated.View
                style={[
                  styles.textBlock,
                  { opacity: textOpacity, transform: [{ translateX: textShift }] },
                ]}
              >
                <Text style={[styles.eyebrow, { color: colors.accent }]}>
                  {String(i + 1).padStart(2, '0')} · {slide.eyebrow}
                </Text>
                <Text style={[styles.title, { color: colors.text }]}>{slide.title}</Text>
                <View style={[styles.rule, { backgroundColor: colors.accent }]} />
                <Text style={[styles.desc, { color: colors.textMuted }]}>{slide.desc}</Text>
              </Animated.View>
            </View>
          );
        })}
      </Animated.ScrollView>

      {/* Fixed overlays */}
      <View style={[styles.topBar, { top: insets.top + 12 }]} pointerEvents="box-none">
        <Text style={styles.brand}>STYLEFLEET</Text>
        {!isLast && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onFinish}
            style={styles.skipPill}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.dotsRow}>
          {SLIDES.map((slide, i) => {
            const dotWidth = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [6, 22, 6],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={slide.title}
                style={[
                  styles.dot,
                  { width: dotWidth, backgroundColor: i === index ? colors.accent : colors.divider },
                ]}
              />
            );
          })}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleNext}
          style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
        >
          <Text style={styles.primaryBtnText}>{isLast ? 'Get Started' : 'Continue'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    ...typography.presets.label,
    color: '#FFFFFF',
    letterSpacing: 3,
  },
  skipPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  skipText: {
    ...typography.presets.bodyMedium,
    color: '#FFFFFF',
    fontSize: 13,
  },
  textBlock: {
    flex: 1,
    paddingHorizontal: 28,
    marginTop: -12,
  },
  eyebrow: {
    ...typography.presets.label,
    letterSpacing: 2.2,
    marginBottom: 8,
  },
  title: {
    ...typography.presets.heading1,
    fontSize: 28,
    lineHeight: 34,
  },
  rule: {
    width: 40,
    height: 2,
    borderRadius: 1,
    marginTop: 14,
    marginBottom: 14,
  },
  desc: {
    ...typography.presets.body,
    fontSize: 15,
    lineHeight: 23,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    gap: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  primaryBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: {
    ...typography.presets.button,
    color: '#0D0E11',
    fontSize: 16,
  },
});
