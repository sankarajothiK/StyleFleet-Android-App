import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radii, spacing } from '../../theme/spacing';

export interface InputProps extends TextInputProps {
  label?: string;
  optional?: boolean;
  prefix?: string;
  error?: string;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

export const Input = ({
  label,
  optional = false,
  prefix,
  error,
  containerStyle,
  inputStyle,
  multiline,
  numberOfLines,
  ...rest
}: InputProps) => {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {label}
            {optional && (
              <Text style={{ color: colors.textDim }}> · optional</Text>
            )}
          </Text>
        </View>
      )}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.card,
            borderColor: isFocused ? colors.accent : colors.divider,
            minHeight: multiline ? 68 : 42,
            alignItems: multiline ? 'flex-start' : 'center',
          },
        ]}
      >
        {prefix && (
          <View
            style={[
              styles.prefixContainer,
              {
                backgroundColor: colors.card,
                borderColor: colors.divider,
              },
            ]}
          >
            <Text style={{ color: colors.textMuted, fontSize: 15 }}>{prefix}</Text>
          </View>
        )}
        <TextInput
          placeholderTextColor={colors.placeholder || colors.textDim}
          style={[
            styles.textInput,
            {
              color: colors.text,
              paddingTop: multiline ? 8 : 0,
              paddingBottom: multiline ? 8 : 0,
            },
            inputStyle,
          ]}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...rest}
        />
      </View>
      {error ? (
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  prefixContainer: {
    marginRight: 8,
    borderRightWidth: 1,
    paddingRight: 8,
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
});
