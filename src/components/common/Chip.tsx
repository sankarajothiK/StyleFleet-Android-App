import React from 'react';
import { TouchableOpacity, Text, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radii } from '../../theme/spacing';

export interface ChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'sm' | 'md';
}

export const Chip = ({
  label,
  active,
  onPress,
  icon,
  style,
  textStyle,
  size = 'md',
}: ChipProps) => {
  const { colors } = useTheme();

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: active ? colors.accent : colors.divider,
    backgroundColor: active ? colors.accent900 : 'transparent',
    paddingVertical: size === 'sm' ? 4 : 6,
    paddingHorizontal: size === 'sm' ? 9 : 12,
  };

  const labelStyle: TextStyle = {
    fontSize: size === 'sm' ? 12.5 : 13.5,
    fontWeight: '500',
    color: active ? colors.accent200 : colors.textMuted,
  };

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[containerStyle, style]}
    >
      {icon}
      <Text style={[labelStyle, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );
};
