import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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

export const BottomTabBar = ({
  currentTab,
  onTabSelect,
  isStylist = false,
  stylistPermissions = null,
}: BottomTabBarProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const allTabs: { key: MainTab; label: string; icon: (color: string) => React.ReactNode }[] = [
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

  const isDark = colors.isDark;
  const barBg = isDark ? '#0B1F44' : '#FFFFFF';
  const activeIconColor = '#D4AF37';
  const activeLabelColor = isDark ? '#D4AF37' : '#C89F2D';
  const inactiveIconColor = isDark ? '#A7B0C3' : '#475569';
  const inactiveLabelColor = isDark ? '#A7B0C3' : '#334155';

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
      {tabs.map((t) => {
        const isActive = currentTab === t.key;
        const iconColor = isActive ? activeIconColor : inactiveIconColor;
        const labelColor = isActive ? activeLabelColor : inactiveLabelColor;

        return (
          <TouchableOpacity
            key={t.key}
            activeOpacity={0.8}
            onPress={() => onTabSelect(t.key)}
            style={[
              styles.tabButton,
              {
                borderTopColor: isActive ? '#D4AF37' : 'transparent',
              },
            ]}
          >
            {t.icon(iconColor)}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
              style={[styles.tabLabel, { color: labelColor }]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 2,
    gap: 3,
    borderTopWidth: 2,
  },
  tabLabel: {
    fontSize: 11.5,
    fontWeight: '500',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
