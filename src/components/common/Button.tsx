import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radii } from '../../theme/spacing';

export interface ButtonProps {
  label?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon';
  disabled?: boolean;
  loading?: boolean;
  block?: boolean;
  style?: ViewStyle;
  labelStyle?: TextStyle;
  children?: React.ReactNode;
  icon?: React.ReactNode;
}

export const Button = ({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  block = false,
  style,
  labelStyle,
  children,
  icon,
}: ButtonProps) => {
  const { colors } = useTheme();

  const getContainerStyle = (): ViewStyle => {
    const base: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: radii.md,
      opacity: disabled ? 0.45 : 1,
    };

    if (block) {
      base.width = '100%';
    }

    switch (variant) {
      case 'primary':
        return {
          ...base,
          backgroundColor: '#D4AF37',
          borderWidth: 1,
          borderColor: '#D4AF37',
          paddingVertical: 12,
          paddingHorizontal: 16,
        };
      case 'secondary':
        return {
          ...base,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.divider,
          paddingVertical: 11,
          paddingHorizontal: 16,
        };
      case 'ghost':
        return {
          ...base,
          backgroundColor: 'transparent',
          paddingVertical: 6,
          paddingHorizontal: 10,
        };
      case 'icon':
        return {
          ...base,
          width: 36,
          height: 36,
          borderRadius: radii.md,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.divider,
          padding: 0,
        };
      default:
        return base;
    }
  };

  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case 'primary':
        return {
          color: colors.isDark ? '#0B1F44' : '#1F2937',
          fontSize: 15,
          fontWeight: '600',
        };
      case 'secondary':
        return {
          color: colors.text,
          fontSize: 14,
          fontWeight: '500',
        };
      case 'ghost':
        return {
          color: colors.accent,
          fontSize: 14,
          fontWeight: '500',
        };
      default:
        return {
          color: colors.text,
          fontSize: 14,
        };
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[getContainerStyle(), style]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? (colors.isDark ? '#0B1F44' : '#1F2937') : colors.text}
        />
      ) : (
        <>
          {icon}
          {label ? <Text style={[getTextStyle(), labelStyle]}>{label}</Text> : children}
        </>
      )}
    </TouchableOpacity>
  );
};
