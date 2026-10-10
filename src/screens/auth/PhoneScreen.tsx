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
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../components/common/Button';
import { radii } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { LoginHeroArt } from '../../components/auth/LoginHeroArt';
import { staffRepository } from '../../repositories/staffRepository';


interface PhoneScreenProps {
  onSendOtp: (phone: string, mode?: 'owner' | 'stylist') => void;
  onRegisterShop?: () => void;
  stylistInviteContext?: { phone?: string; valid: boolean } | null;
}

export const PhoneScreen = ({ onSendOtp, onRegisterShop, stylistInviteContext }: PhoneScreenProps) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
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

  const heroHeight = Math.round(windowHeight * 0.3);
  const onAccent = '#0D0E11';

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: Math.max(0, keyboardHeight),
          }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          showsVerticalScrollIndicator={false}
        >
          {/* Premium salon hero */}
          <View style={{ width: windowWidth, height: heroHeight, overflow: 'hidden' }}>
            <LoginHeroArt width={windowWidth} height={heroHeight} />
            <Svg style={StyleSheet.absoluteFill} width={windowWidth} height={heroHeight}>
              <Defs>
                <LinearGradient id="loginFade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#000000" stopOpacity="0.4" />
                  <Stop offset="0.4" stopColor={colors.bg} stopOpacity="0" />
                  <Stop offset="0.75" stopColor={colors.bg} stopOpacity="0.6" />
                  <Stop offset="1" stopColor={colors.bg} stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width={windowWidth} height={heroHeight} fill="url(#loginFade)" />
            </Svg>
            <Text style={[styles.brand, { top: insets.top + 14 }]}>STYLEFLEET</Text>
          </View>

          <View style={styles.content}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>
              {mode === 'stylist' ? 'STYLIST ACCESS' : 'WELCOME BACK'}
            </Text>
            <Text style={[styles.heading, { color: colors.text }]}>
              {mode === 'stylist' ? 'Stylist Login' : 'Sign in'}
            </Text>
            <View style={[styles.rule, { backgroundColor: colors.accent }]} />
            <Text style={[styles.subheading, { color: colors.textMuted }]}>
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
                    { borderColor: colors.divider, backgroundColor: colors.card },
                  ]}
                >
                  <Text style={[styles.countryCodeText, { color: colors.text }]}>+91</Text>
                </View>
                <TextInput
                  style={[
                    styles.phoneInput,
                    {
                      borderColor: phone ? colors.accent : colors.divider,
                      backgroundColor: colors.card,
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
                      backgroundColor: agreeToTerms ? colors.accent : colors.card,
                    },
                  ]}
                >
                  {agreeToTerms && <Text style={[styles.checkMark, { color: onAccent }]}>✓</Text>}
                </View>
                <Text style={[styles.termsText, { color: colors.textMuted }]}>
                  I agree to the <Text style={{ color: colors.accent, fontWeight: '600' }}>Terms and Policy</Text> of StyleFleet
                </Text>
              </TouchableOpacity>

              {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}
            </View>

            <Button
              label={isLoading ? 'Checking stylist...' : 'Send OTP'}
              block
              onPress={handleSend}
              disabled={!agreeToTerms || phone.replace(/\D/g, '').length !== 10 || isLoading}
              style={{ marginTop: 6 }}
            />

            {mode === 'stylist' && (
              <Text style={[styles.stylistNote, { color: colors.textDim }]}>
                Stylists must be registered by their salon owner in the Team section.
              </Text>
            )}
          </View>

          {/* Login as Stylist, pinned to the bottom */}
            <View
              style={[
                styles.bottomBar,
                { paddingBottom: insets.bottom + 16, borderTopColor: colors.divider },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.stylistToggle,
                  {
                    borderColor: mode === 'stylist' ? colors.accent : colors.divider,
                    backgroundColor: colors.card,
                  },
                ]}
                activeOpacity={0.75}
                onPress={() => {
                  setMode(mode === 'owner' ? 'stylist' : 'owner');
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
                  {mode === 'stylist' && <Text style={[styles.checkMark, { color: onAccent }]}>✓</Text>}
                </View>
                <Text style={[styles.stylistToggleText, { color: colors.text }]}>Login as Stylist</Text>
              </TouchableOpacity>
            </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  brand: {
    ...typography.presets.label,
    position: 'absolute',
    left: 24,
    color: '#FFFFFF',
    letterSpacing: 3,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    marginTop: -14,
    paddingBottom: 24,
  },
  eyebrow: {
    ...typography.presets.label,
    letterSpacing: 2.2,
    marginBottom: 6,
  },
  heading: {
    ...typography.presets.heading1,
    fontSize: 30,
    lineHeight: 36,
  },
  rule: {
    width: 40,
    height: 2,
    borderRadius: 1,
    marginTop: 12,
    marginBottom: 12,
  },
  subheading: {
    ...typography.presets.body,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 26,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    ...typography.presets.label,
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  countryCodeBadge: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryCodeText: {
    ...typography.presets.bodyMedium,
    fontSize: 15,
  },
  phoneInput: {
    ...typography.presets.bodyMedium,
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  errorText: {
    ...typography.presets.caption,
    fontSize: 12,
    marginTop: 10,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    fontSize: 12,
    fontWeight: '700',
  },
  termsText: {
    ...typography.presets.body,
    fontSize: 12.5,
    flex: 1,
    lineHeight: 18,
  },
  stylistNote: {
    ...typography.presets.caption,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stylistToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 50,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  stylistToggleText: {
    ...typography.presets.button,
    fontSize: 14.5,
  },
});
