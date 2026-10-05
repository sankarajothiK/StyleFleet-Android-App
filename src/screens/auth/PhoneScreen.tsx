import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../components/common/Button';
import { radii, spacing } from '../../theme/spacing';
import { staffRepository } from '../../repositories/staffRepository';

interface PhoneScreenProps {
  onSendOtp: (phone: string, mode?: 'owner' | 'stylist') => void;
  onRegisterShop?: () => void;
  stylistInviteContext?: { phone?: string; valid: boolean } | null;
}

export const PhoneScreen = ({ onSendOtp, onRegisterShop, stylistInviteContext }: PhoneScreenProps) => {
  const { colors } = useTheme();
  const hasStylistInvite = Boolean(stylistInviteContext?.valid);
  const [phone, setPhone] = useState(stylistInviteContext?.phone || '');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'owner' | 'stylist'>(
    hasStylistInvite && stylistInviteContext?.phone ? 'stylist' : 'owner'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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

  useEffect(() => {
    if (stylistInviteContext?.valid) {
      if (stylistInviteContext.phone) {
        setPhone(stylistInviteContext.phone);
        setMode('stylist');
      }
    } else {
      setMode('owner');
    }
  }, [stylistInviteContext]);

  const handleSend = async () => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!agreeToTerms) {
      setError('Please agree to the terms and policy of StyleFleet');
      return;
    }

    if (mode === 'stylist') {
      setIsLoading(true);
      setError('');
      try {
        const stylist = await staffRepository.getStylistByPhone(clean);
        if (!stylist || !stylist.is_active) {
          setError('This phone number is not registered as an active stylist. Please contact your salon owner.');
          setIsLoading(false);
          return;
        }
      } catch (err) {
        setError('This phone number is not registered as an active stylist. Please contact your salon owner.');
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    }

    setError('');
    onSendOtp(clean, mode);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingBottom: Math.max(30, keyboardHeight + 30),
          }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Text style={[styles.heading, { color: colors.text }]}>
              {mode === 'stylist' ? 'Stylist Login' : 'Sign in'}
            </Text>
            <Text style={[styles.subheading, { color: colors.textDim }]}>
              {mode === 'stylist'
                ? 'A 6-digit code will be sent to your registered mobile number.'
                : "A 6-digit code goes to your shop's registered number."}
            </Text>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textMuted }]}>
                {mode === 'stylist' ? 'Stylist mobile number' : 'Mobile number'}
              </Text>
              <View style={styles.phoneInputRow}>
                <View
                  style={[
                    styles.countryCodeBadge,
                    {
                      borderColor: colors.divider,
                      backgroundColor: colors.surface,
                    },
                  ]}
                >
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>+91</Text>
                </View>
                <TextInput
                  style={[
                    styles.phoneInput,
                    {
                      borderColor: colors.divider,
                      backgroundColor: colors.surface,
                      color: colors.text,
                    },
                  ]}
                  value={phone}
                  onChangeText={(text) => {
                    const digits = text.replace(/\D/g, '');
                    const clean = digits.length > 10 ? digits.slice(-10) : digits;
                    setPhone(clean);
                    if (error) setError('');
                  }}
                  keyboardType="phone-pad"
                  maxLength={14}
                  placeholder="9845062110"
                  placeholderTextColor={colors.placeholder || colors.textDim}
                />
              </View>

            {/* Terms and Policy Checkbox */}
            <TouchableOpacity
              style={styles.termsRow}
              activeOpacity={0.75}
              onPress={() => {
                setAgreeToTerms(!agreeToTerms);
                if (error) setError('');
              }}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: agreeToTerms ? colors.accent : colors.divider,
                    backgroundColor: agreeToTerms ? colors.accent : colors.surface,
                  },
                ]}
              >
                {agreeToTerms && (
                  <Text style={{ color: colors.isDark ? '#0B1F44' : '#1F2937', fontSize: 12, fontWeight: '700' }}>✓</Text>
                )}
              </View>
              <Text style={[styles.termsText, { color: colors.textMuted }]}>
                I agree to the <Text style={{ color: colors.accent, fontWeight: '600' }}>Terms and Policy</Text> of StyleFleet
              </Text>
            </TouchableOpacity>

            {/* Login as Stylist Checkbox (Only visible when arriving via stylist invitation) */}
            {hasStylistInvite && (
              <TouchableOpacity
                style={[styles.termsRow, { marginTop: 10 }]}
                activeOpacity={0.75}
                onPress={() => {
                  const nextMode = mode === 'owner' ? 'stylist' : 'owner';
                  setMode(nextMode);
                  if (error) setError('');
                }}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: mode === 'stylist' ? colors.accent : colors.divider,
                      backgroundColor: mode === 'stylist' ? colors.accent : colors.surface,
                    },
                  ]}
                >
                  {mode === 'stylist' && (
                    <Text style={{ color: colors.isDark ? '#0B1F44' : '#1F2937', fontSize: 12, fontWeight: '700' }}>✓</Text>
                  )}
                </View>
                <Text style={[styles.termsText, { color: colors.textMuted }]}>
                  Login as Stylist
                </Text>
              </TouchableOpacity>
            )}

            {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}
          </View>

          <Button
            label={isLoading ? "Checking stylist..." : "Send OTP"}
            block
            onPress={handleSend}
            disabled={!agreeToTerms || phone.replace(/\D/g, '').length !== 10 || isLoading}
            style={{ marginTop: 14 }}
          />

          {mode === 'stylist' && (
            <Text style={{ textAlign: 'center', color: colors.textDim, fontSize: 12, marginTop: 16 }}>
              Stylists must be registered by their salon owner in the Team section.
            </Text>
          )}
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
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 34,
    paddingBottom: 24,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  heading: {
    fontSize: 27,
    fontWeight: '500',
    letterSpacing: -0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  subheading: {
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 26,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '500',
    marginBottom: 6,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  countryCodeBadge: {
    minHeight: 42,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneInput: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  errorText: {
    fontSize: 11,
    marginTop: 4,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
});
