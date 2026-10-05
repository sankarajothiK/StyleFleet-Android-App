import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Platform,
  ScrollView,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../components/common/Button';
import { BackIcon } from '../../components/common/SvgIcons';
import { radii } from '../../theme/spacing';

interface OtpScreenProps {
  phone: string;
  onVerify: (otp: string) => void;
  onBack: () => void;
  onResendOtp?: () => Promise<void> | void;
}

export const OtpScreen = ({ phone, onVerify, onBack, onResendOtp }: OtpScreenProps) => {
  const { colors } = useTheme();
  const [otp, setOtp] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(30);
  const [isResending, setIsResending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // 30-second cooldown timer for Resend OTP
  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsRemaining]);

  const handleTextChange = (text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, 6);
    setOtp(clean);
    if (clean.length === 6) {
      onVerify(clean);
    }
  };

  const handleKeyPress = (key: string) => {
    if (key === '⌫') {
      setOtp((prev) => prev.slice(0, -1));
    } else if (key !== '') {
      if (otp.length < 6) {
        const next = (otp + key).slice(0, 6);
        setOtp(next);
        if (next.length === 6) {
          onVerify(next);
        }
      }
    }
  };

  const handleResend = async () => {
    if (secondsRemaining > 0 || isResending) return;
    setIsResending(true);
    try {
      if (onResendOtp) {
        await onResendOtp();
      }
      setOtp('');
      setSecondsRemaining(30);
    } finally {
      setIsResending(false);
    }
  };

  const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  const otpHint =
    otp.length < 6
      ? 'Enter 6-digit verification code (tap boxes to paste or type)'
      : 'Code entered · ready to verify';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingBottom: Math.max(20, keyboardHeight + 30) },
          ]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          showsVerticalScrollIndicator={false}
        >
          <Button variant="icon" onPress={onBack}>
            <BackIcon size={18} color={colors.text} />
          </Button>

        <Text style={[styles.heading, { color: colors.text }]}>Enter the code</Text>
        <Text style={[styles.subheading, { color: colors.textDim }]}>
          6-digit OTP sent to +91 {phone}
        </Text>

        {/* 6 visible OTP boxes with copy-paste support */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => inputRef.current?.focus()}
          style={styles.boxesContainer}
        >
          <View style={styles.boxesRow}>
            {[0, 1, 2, 3, 4, 5].map((idx) => {
              const digit = otp[idx] || '';
              const isActive = otp.length === idx;
              const isFilled = digit.length > 0;
              return (
                <View
                  key={idx}
                  style={[
                    styles.box,
                    {
                      backgroundColor: colors.surface,
                      borderColor: isActive
                        ? colors.accent
                        : isFilled
                        ? (colors.isDark ? '#FFFFFF' : '#1F2937')
                        : (colors.isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.22)'),
                      borderWidth: isActive ? 2 : 1.5,
                    },
                  ]}
                >
                  <Text style={[styles.boxText, { color: colors.text }]}>{digit}</Text>
                </View>
              );
            })}
          </View>

          {/* Accessible underlying TextInput for system copy/paste and autofill */}
          <TextInput
            ref={inputRef}
            value={otp}
            onChangeText={handleTextChange}
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            style={styles.hiddenInput}
            caretHidden
            selectTextOnFocus
          />
        </TouchableOpacity>

        <Text style={[styles.hintText, { color: colors.textDim }]}>{otpHint}</Text>

        <Button
          label="Verify & continue"
          block
          disabled={otp.length < 6}
          onPress={() => onVerify(otp)}
          style={{ marginBottom: 16 }}
        />

        {/* Resend OTP Row with 30s Cooldown Timer */}
        <View style={styles.resendRow}>
          <Text style={[styles.resendPromptText, { color: colors.textDim }]}>
            Didn't receive the code?{' '}
          </Text>
          {secondsRemaining > 0 ? (
            <Text style={[styles.timerText, { color: colors.accent }]}>
              Resend in {secondsRemaining}s
            </Text>
          ) : (
            <TouchableOpacity
              onPress={handleResend}
              disabled={isResending}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isResending ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={[styles.resendLink, { color: colors.accent }]}>
                  Resend OTP
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Numeric keypad */}
        <View style={styles.keypadGrid}>
          {keypad.map((k, index) => {
            const isEmpty = k === '';
            return (
              <TouchableOpacity
                key={index}
                activeOpacity={isEmpty ? 1 : 0.7}
                disabled={isEmpty}
                onPress={() => handleKeyPress(k)}
                style={[
                  styles.keyButton,
                  {
                    backgroundColor: isEmpty ? 'transparent' : colors.surface,
                    borderColor: isEmpty ? 'transparent' : colors.divider,
                  },
                ]}
              >
                <Text style={[styles.keyText, { color: colors.text }]}>{k}</Text>
              </TouchableOpacity>
            );
          })}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
  },
  heading: {
    fontSize: 24,
    fontWeight: '500',
    marginTop: 22,
    marginBottom: 6,
  },
  subheading: {
    fontSize: 13,
    marginBottom: 22,
  },
  boxesContainer: {
    position: 'relative',
    marginBottom: 14,
  },
  boxesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.01,
  },
  box: {
    flex: 1,
    height: 54,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxText: {
    fontSize: 22,
    fontWeight: '600',
  },
  hintText: {
    fontSize: 12,
    marginBottom: 18,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    height: 24,
  },
  resendPromptText: {
    fontSize: 13,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  resendLink: {
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  keypadGrid: {
    marginTop: 'auto',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  keyButton: {
    width: '31%',
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 19,
    fontWeight: '500',
  },
});
