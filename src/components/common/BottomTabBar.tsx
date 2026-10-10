import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, AccessibilityInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { MainTab, StylistPermissions } from '../../types/domain';
import { HomeIcon, UsersIcon, ReceiptIcon, ChartIcon } from './SvgIcons';

interface BottomTabBarProps {
  currentTab: MainTab;
  onTabSelect: (tab: MainTab) => void;
  isStylist?: boolean;
  stylistPermissions?: StylistPermissions | null;
}

interface TabDef {
  key: MainTab;
  label: string;
  icon: (color: string) => React.ReactNode;
}

const GOLD = '#D4AF37';
const PILL_FILL = 'rgba(212, 175, 55, 0.18)';
const PILL_BORDER = 'rgba(212, 175, 55, 0.5)';
/** How much wider the selected tab is than the others */
const ACTIVE_GROW = 2.3;
/** Room the label gets inside the selected pill */
const LABEL_MAX_WIDTH = 92;

interface TabItemProps {
  tab: TabDef;
  isActive: boolean;
  iconColor: string;
  labelColor: string;
  reduceMotion: boolean;
  onPress: () => void;
}

/**
 * One tab. The selected tab widens into a gold pill and its name slides out next to the icon;
 * the others shrink back to just an icon. The icon gives a quick pop as it is selected.
 */
const TabItem = ({ tab, isActive, iconColor, labelColor, reduceMotion, onPress }: TabItemProps) => {
  // `grow` changes layout (width), so it cannot use the native driver. `pop` and `press` can.
  const grow = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) {
      grow.setValue(isActive ? 1 : 0);
      return;
    }
    Animated.spring(grow, {
      toValue: isActive ? 1 : 0,
      friction: 9,
      tension: 90,
      useNativeDriver: false,
    }).start();
    if (isActive) {
      Animated.sequence([
        Animated.timing(pop, { toValue: 1.25, duration: 110, useNativeDriver: true }),
        Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
    }
  }, [isActive, reduceMotion, grow, pop]);

  const pressTo = (value: number, bounciness: number) => {
    if (reduceMotion) return;
    Animated.spring(press, { toValue: value, speed: 40, bounciness, useNativeDriver: true }).start();
  };

  const clamp = { extrapolate: 'clamp' as const };
  const flexGrow = grow.interpolate({ inputRange: [0, 1], outputRange: [1, ACTIVE_GROW], ...clamp });
  const labelWidth = grow.interpolate({ inputRange: [0, 1], outputRange: [0, LABEL_MAX_WIDTH], ...clamp });
  const labelOpacity = grow.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1], ...clamp });
  const labelGap = grow.interpolate({ inputRange: [0, 1], outputRange: [0, 7], ...clamp });
  const pillOpacity = grow.interpolate({ inputRange: [0, 1], outputRange: [0, 1], ...clamp });

  return (
    <Animated.View style={[styles.tabSlot, { flexGrow }]}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={tab.label}
        onPress={onPress}
        onPressIn={() => pressTo(0.92, 0)}
        onPressOut={() => pressTo(1, 10)}
        style={styles.tabButton}
      >
        <Animated.View pointerEvents="none" style={[styles.pill, { opacity: pillOpacity }]} />
        <Animated.View style={[styles.row, { transform: [{ scale: press }] }]}>
          <Animated.View style={{ transform: [{ scale: pop }] }}>{tab.icon(iconColor)}</Animated.View>
          <Animated.View style={{ width: labelWidth, marginLeft: labelGap, opacity: labelOpacity, overflow: 'hidden' }}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.tabLabel, { color: labelColor }]}>
              {tab.label}
            </Text>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

export const BottomTabBar = ({
  currentTab,
  onTabSelect,
  isStylist = false,
  stylistPermissions = null,
}: BottomTabBarProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const allTabs: TabDef[] = [
    {
      key: 'home',
      label: t('home', 'Home'),
      icon: (color) => <HomeIcon size={21} color={color} />,
    },
    {
      key: 'customers',
      label: t('customers', 'Customers'),
      icon: (color) => <UsersIcon size={21} color={color} />,
    },
    {
      key: 'sales',
      label: t('sales', 'Sales'),
      icon: (color) => <ReceiptIcon size={21} color={color} />,
    },
    {
      key: 'accounts',
      label: t('accounts', 'Accounts'),
      icon: (color) => <ChartIcon size={21} color={color} />,
    },
  ];

  const tabs = allTabs.filter((tab) => {
    if (isStylist && stylistPermissions) {
      if (tab.key === 'customers' && stylistPermissions.customers === false) return false;
      if (tab.key === 'sales' && stylistPermissions.sales === false) return false;
    }
    return true;
  });

  // People who turned animations off in their phone settings get no movement
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const isDark = colors.isDark;
  const barBg = isDark ? '#0B1F44' : '#FFFFFF';
  const activeColor = isDark ? GOLD : '#B8921F';
  const inactiveColor = isDark ? '#A7B0C3' : '#475569';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: barBg,
          borderTopColor: colors.divider,
          paddingBottom: Math.max(insets.bottom, 6),
        },
      ]}
    >
      {tabs.map((tab) => {
        const isActive = currentTab === tab.key;
        return (
          <TabItem
            key={tab.key}
            tab={tab}
            isActive={isActive}
            iconColor={isActive ? activeColor : inactiveColor}
            labelColor={activeColor}
            reduceMotion={reduceMotion}
            onPress={() => onTabSelect(tab.key)}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 7,
    paddingHorizontal: 8,
    gap: 4,
  },
  tabSlot: {
    flexBasis: 0,
  },
  tabButton: {
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 22,
    backgroundColor: PILL_FILL,
    borderWidth: 1,
    borderColor: PILL_BORDER,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
