import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
} from 'react-native';
import { Modal } from '../common/KeyboardAwareModal';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { authService } from '../../services/authService';
import { authRepository } from '../../repositories/authRepository';
import { shopRepository } from '../../repositories/shopRepository';
import { supabase } from '../../lib/supabase';
import { CrossIcon, CheckIcon } from '../common/SvgIcons';
import { radii } from '../../theme/spacing';

interface ChangePhoneModalProps {
  visible: boolean;
  currentPhone: string;
  shopId?: string;
  userId?: string;
  onClose: () => void;
  onSuccess: (newPhone: string) => void;
}

export const ChangePhoneModal: React.FC<ChangePhoneModalProps> = ({
  visible,
  currentPhone,
  shopId,
  userId,
  onClose,
  onSuccess,
}) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const cleanCurrentPhone = (currentPhone || '').replace(/\D/g, '').slice(-10);

  // Flow step: 'verify_current' | 'verify_new' | 'completed'
  const [step, setStep] = useState<'verify_current' | 'verify_new' | 'completed'>('verify_current');

  // Step 1 states (Current Phone)
  const [otpCurrent, setOtpCurrent] = useState('');
  const [sessionCurrent, setSessionCurrent] = useState<string | undefined>(undefined);
  const [isSendingOtpCurrent, setIsSendingOtpCurrent] = useState(false);
  const [isVerifyingCurrent, setIsVerifyingCurrent] = useState(false);
  const [otpSentCurrent, setOtpSentCurrent] = useState(false);
  const [timerCurrent, setTimerCurrent] = useState(0);

  // Step 2 states (New Phone)
  const [newPhone, setNewPhone] = useState('');
  const [otpNew, setOtpNew] = useState('');
  const [sessionNew, setSessionNew] = useState<string | undefined>(undefined);
  const [isSendingOtpNew, setIsSendingOtpNew] = useState(false);
  const [isVerifyingNew, setIsVerifyingNew] = useState(false);
  const [otpSentNew, setOtpSentNew] = useState(false);
  const [timerNew, setTimerNew] = useState(0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset when modal opens/closes
  useEffect(() => {
    if (visible) {
      setStep('verify_current');
      setOtpCurrent('');
      setSessionCurrent(undefined);
      setIsSendingOtpCurrent(false);
      setIsVerifyingCurrent(false);
      setOtpSentCurrent(false);
      setTimerCurrent(0);

      setNewPhone('');
      setOtpNew('');
      setSessionNew(undefined);
      setIsSendingOtpNew(false);
      setIsVerifyingNew(false);
      setOtpSentNew(false);
      setTimerNew(0);
      setErrorMessage(null);
    }
  }, [visible]);

  // Timer for Step 1 OTP
  useEffect(() => {
    if (timerCurrent <= 0) return;
    const interval = setInterval(() => {
      setTimerCurrent((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerCurrent]);

  // Timer for Step 2 OTP
  useEffect(() => {
    if (timerNew <= 0) return;
    const interval = setInterval(() => {
      setTimerNew((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerNew]);

  // Step 1: Send OTP to Current Phone
  const handleSendCurrentOtp = async () => {
    if (!cleanCurrentPhone || cleanCurrentPhone.length !== 10) {
      setErrorMessage('Current phone number on file is invalid.');
      return;
    }
    setErrorMessage(null);
    setIsSendingOtpCurrent(true);
    try {
      const res = await authService.sendOtp(cleanCurrentPhone);
      if (res.success) {
        setSessionCurrent(res.sessionId);
        setOtpSentCurrent(true);
        setTimerCurrent(30);
      } else {
        setErrorMessage(res.error || 'Failed to dispatch verification code to current phone.');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Error sending verification code.');
    } finally {
      setIsSendingOtpCurrent(false);
    }
  };

  // Step 1: Verify OTP for Current Phone
  const handleVerifyCurrentOtp = async () => {
    const cleanOtp = otpCurrent.trim();
    if (cleanOtp.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit OTP');
      return;
    }
    setErrorMessage(null);
    setIsVerifyingCurrent(true);
    try {
      const res = await authService.verifyOtpCodeOnly(cleanCurrentPhone, cleanOtp, sessionCurrent);
      if (res.success) {
        setStep('verify_new');
      } else {
        setErrorMessage(res.error || 'Invalid OTP entered. Please try again.');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Verification failed. Please try again.');
    } finally {
      setIsVerifyingCurrent(false);
    }
  };

  // Step 2: Send OTP to New Phone
  const handleSendNewOtp = async () => {
    const cleanNew = newPhone.replace(/\D/g, '').slice(-10);
    if (cleanNew.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number');
      return;
    }
    if (cleanNew === cleanCurrentPhone) {
      setErrorMessage('New phone number cannot be the same as your current phone number.');
      return;
    }

    setErrorMessage(null);
    setIsSendingOtpNew(true);

    try {
      // Check if already registered by another salon
      const existingShop = await shopRepository.getShopByPhone(cleanNew);
      if (existingShop && existingShop.id !== shopId) {
        setErrorMessage('This mobile number is already registered to another salon account.');
        setIsSendingOtpNew(false);
        return;
      }

      const res = await authService.sendOtp(cleanNew);
      if (res.success) {
        setSessionNew(res.sessionId);
        setOtpSentNew(true);
        setTimerNew(30);
      } else {
        setErrorMessage(res.error || 'Failed to send OTP to new mobile number.');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Error sending OTP to new mobile.');
    } finally {
      setIsSendingOtpNew(false);
    }
  };

  // Step 2: Verify OTP and Update Phone in Supabase
  const handleVerifyAndUpdatePhone = async () => {
    const cleanNew = newPhone.replace(/\D/g, '').slice(-10);
    const cleanOtp = otpNew.trim();

    if (cleanNew.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number');
      return;
    }
    if (cleanOtp.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit OTP sent to new number');
      return;
    }

    setErrorMessage(null);
    setIsVerifyingNew(true);

    try {
      const verifyRes = await authService.verifyOtpCodeOnly(cleanNew, cleanOtp, sessionNew);
      if (!verifyRes.success) {
        setErrorMessage(verifyRes.error || 'Invalid OTP code for new mobile number');
        setIsVerifyingNew(false);
        return;
      }

      // Update in Supabase
      // 1. Update profiles table
      if (userId) {
        const { error: profileErr } = await supabase
          .from('profiles')
          .update({ phone: cleanNew })
          .eq('id', userId);
        if (profileErr) {
          console.warn('Profile phone update notice:', profileErr.message);
        }
      }

      // 2. Update shops table
      if (shopId) {
        const { error: shopErr } = await supabase
          .from('shops')
          .update({ phone: cleanNew })
          .eq('id', shopId);
        if (shopErr) {
          throw new Error(shopErr.message || 'Failed to update phone number in shop database.');
        }
      }

      // 3. Update local caches
      await shopRepository.saveLastPhone(cleanNew);
      const cached = await shopRepository.getCachedShop();
      if (cached) {
        await shopRepository.cacheShop({ ...cached, phone: cleanNew });
      }

      // 4. Update session
      const currentSession = await authRepository.getSession();
      if (currentSession) {
        await authRepository.saveSession({ ...currentSession, phone: cleanNew });
      }

      Keyboard.dismiss();
      setStep('completed');
      onSuccess(cleanNew);
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to update phone number. Please try again.');
    } finally {
      setIsVerifyingNew(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.divider }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t('changePhoneNumber', 'Change Phone Number')}
              </Text>
              <Text style={[styles.modalSub, { color: colors.textDim }]}>
                {step === 'verify_current'
                  ? 'Step 1 of 2: Verify Current Phone'
                  : step === 'verify_new'
                  ? 'Step 2 of 2: Verify New Phone'
                  : 'Phone Number Updated'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <CrossIcon size={20} color={colors.textDim} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="always">
            {/* Step Progress Bar */}
            <View style={styles.progressContainer}>
              <View
                style={[
                  styles.progressBar,
                  {
                    backgroundColor: colors.accent,
                    width: step === 'verify_current' ? '50%' : '100%',
                  },
                ]}
              />
            </View>

            {/* ERROR BANNER */}
            {errorMessage ? (
              <View style={[styles.errorBox, { backgroundColor: 'rgba(255, 59, 48, 0.1)', borderColor: colors.error }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* STEP 1: VERIFY CURRENT NUMBER */}
            {step === 'verify_current' && (
              <View style={styles.stepContent}>
                <Text style={[styles.infoText, { color: colors.text }]}>
                  To protect your salon account and keep all your bills, sales, and clients safe, please verify your current registered mobile number first.
                </Text>

                <View style={[styles.phoneBadgeBox, { backgroundColor: colors.bg, borderColor: colors.divider }]}>
                  <Text style={[styles.phoneBadgeLabel, { color: colors.textDim }]}>
                    Current Registered Mobile
                  </Text>
                  <Text style={[styles.phoneBadgeVal, { color: colors.text }]}>
                    +91 {cleanCurrentPhone.replace(/(\d{5})(\d{5})/, '$1 $2')}
                  </Text>
                </View>

                {!otpSentCurrent ? (
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
                    onPress={handleSendCurrentOtp}
                    disabled={isSendingOtpCurrent}
                    activeOpacity={0.8}
                  >
                    {isSendingOtpCurrent ? (
                      <ActivityIndicator color="#000" size="small" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Send Verification Code</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.otpSection}>
                    <Text style={[styles.inputLabel, { color: colors.textDim }]}>
                      Enter 6-Digit OTP sent to +91 {cleanCurrentPhone}
                    </Text>
                    <TextInput
                      style={[
                        styles.otpInput,
                        {
                          backgroundColor: colors.bg,
                          borderColor: otpCurrent.length === 6 ? colors.accent : colors.divider,
                          color: colors.text,
                        },
                      ]}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={otpCurrent}
                      onChangeText={(t) => setOtpCurrent(t.replace(/\D/g, '').slice(0, 6))}
                      placeholder="• • • • • •"
                      placeholderTextColor={colors.textDim}
                      autoFocus
                    />

                    <View style={styles.resendRow}>
                      {timerCurrent > 0 ? (
                        <Text style={[styles.resendTimer, { color: colors.textDim }]}>
                          Resend code in {timerCurrent}s
                        </Text>
                      ) : (
                        <TouchableOpacity onPress={handleSendCurrentOtp} disabled={isSendingOtpCurrent}>
                          <Text style={[styles.resendAction, { color: colors.accent }]}>
                            Resend Verification Code
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.primaryBtn,
                        {
                          backgroundColor: otpCurrent.length === 6 ? colors.accent : colors.neutral800,
                          opacity: otpCurrent.length === 6 ? 1 : 0.6,
                        },
                      ]}
                      onPress={handleVerifyCurrentOtp}
                      disabled={otpCurrent.length !== 6 || isVerifyingCurrent}
                      activeOpacity={0.8}
                    >
                      {isVerifyingCurrent ? (
                        <ActivityIndicator color="#000" size="small" />
                      ) : (
                        <Text style={[styles.primaryBtnText, { color: otpCurrent.length === 6 ? '#000' : colors.textDim }]}>
                          Verify Current Number
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* STEP 2: ENTER & VERIFY NEW NUMBER */}
            {step === 'verify_new' && (
              <View style={styles.stepContent}>
                <View style={[styles.successPill, { backgroundColor: 'rgba(52, 199, 89, 0.12)' }]}>
                  <CheckIcon size={14} color="#34C759" />
                  <Text style={[styles.successPillText, { color: '#34C759' }]}>
                    Current Number Verified
                  </Text>
                </View>

                <Text style={[styles.infoText, { color: colors.text, marginTop: 10 }]}>
                  Enter the new mobile number you want to link to your salon. All your existing data, bills, sales, staff, and history will remain completely untouched.
                </Text>

                <Text style={[styles.inputLabel, { color: colors.textDim, marginTop: 12 }]}>
                  New 10-Digit Mobile Number
                </Text>
                <View style={[styles.phoneInputRow, { backgroundColor: colors.bg, borderColor: colors.divider }]}>
                  <Text style={[styles.prefixText, { color: colors.accent }]}>+91</Text>
                  <TextInput
                    style={[styles.phoneInput, { color: colors.text }]}
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={newPhone}
                    onChangeText={(val) => {
                      setNewPhone(val.replace(/\D/g, '').slice(0, 10));
                      setOtpSentNew(false);
                      setOtpNew('');
                      setErrorMessage(null);
                    }}
                    placeholder="Enter new 10-digit number"
                    placeholderTextColor={colors.textDim}
                    editable={!otpSentNew}
                  />
                </View>

                {!otpSentNew ? (
                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      {
                        backgroundColor: newPhone.length === 10 ? colors.accent : colors.neutral800,
                        opacity: newPhone.length === 10 ? 1 : 0.6,
                      },
                    ]}
                    onPress={handleSendNewOtp}
                    disabled={newPhone.length !== 10 || isSendingOtpNew}
                    activeOpacity={0.8}
                  >
                    {isSendingOtpNew ? (
                      <ActivityIndicator color="#000" size="small" />
                    ) : (
                      <Text style={[styles.primaryBtnText, { color: newPhone.length === 10 ? '#000' : colors.textDim }]}>
                        Send OTP to New Number
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.otpSection}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.inputLabel, { color: colors.textDim }]}>
                        Enter 6-Digit OTP sent to +91 {newPhone}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setOtpSentNew(false);
                          setOtpNew('');
                        }}
                      >
                        <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>Change</Text>
                      </TouchableOpacity>
                    </View>

                    <TextInput
                      style={[
                        styles.otpInput,
                        {
                          backgroundColor: colors.bg,
                          borderColor: otpNew.length === 6 ? colors.accent : colors.divider,
                          color: colors.text,
                        },
                      ]}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={otpNew}
                      onChangeText={(t) => setOtpNew(t.replace(/\D/g, '').slice(0, 6))}
                      placeholder="• • • • • •"
                      placeholderTextColor={colors.textDim}
                      autoFocus
                    />

                    <View style={styles.resendRow}>
                      {timerNew > 0 ? (
                        <Text style={[styles.resendTimer, { color: colors.textDim }]}>
                          Resend code in {timerNew}s
                        </Text>
                      ) : (
                        <TouchableOpacity onPress={handleSendNewOtp} disabled={isSendingOtpNew}>
                          <Text style={[styles.resendAction, { color: colors.accent }]}>
                            Resend Code
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.primaryBtn,
                        {
                          backgroundColor: otpNew.length === 6 ? colors.accent : colors.neutral800,
                          opacity: otpNew.length === 6 ? 1 : 0.6,
                        },
                      ]}
                      onPress={handleVerifyAndUpdatePhone}
                      disabled={otpNew.length !== 6 || isVerifyingNew}
                      activeOpacity={0.8}
                    >
                      {isVerifyingNew ? (
                        <ActivityIndicator color="#000" size="small" />
                      ) : (
                        <Text style={[styles.primaryBtnText, { color: otpNew.length === 6 ? '#000' : colors.textDim }]}>
                          Verify & Update Phone Number
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* STEP 3: COMPLETED SUCCESS */}
            {step === 'completed' && (
              <View style={styles.completedContent}>
                <View style={[styles.successBigCircle, { backgroundColor: colors.accent }]}>
                  <CheckIcon size={32} color="#000" />
                </View>
                <Text style={[styles.completedTitle, { color: colors.text }]}>
                  Phone Number Updated!
                </Text>
                <Text style={[styles.completedDesc, { color: colors.textDim }]}>
                  Your registered salon phone number has been updated to{' '}
                  <Text style={{ color: colors.accent, fontWeight: '700' }}>+91 {newPhone}</Text>.
                </Text>
                <Text style={[styles.completedSub, { color: colors.textDim }]}>
                  All your sales, bills, customers, team members, and accounting records remain completely preserved. You can now use your new phone number to log in.
                </Text>

                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor: colors.accent,
                      marginTop: 24,
                      width: '100%',
                    },
                  ]}
                  onPress={() => {
                    Keyboard.dismiss();
                    onClose();
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={[styles.primaryBtnText, { fontWeight: '800' }]}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSub: {
    fontSize: 12.5,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  progressContainer: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
    marginBottom: 16,
  },
  progressBar: {
    height: 3,
  },
  modalBody: {
    padding: 20,
  },
  errorBox: {
    padding: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
  },
  stepContent: {
    width: '100%',
  },
  infoText: {
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: 14,
  },
  phoneBadgeBox: {
    padding: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: 16,
  },
  phoneBadgeLabel: {
    fontSize: 11.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  phoneBadgeVal: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  primaryBtnText: {
    color: '#000000',
    fontSize: 14.5,
    fontWeight: '700',
  },
  otpSection: {
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  otpInput: {
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1.5,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 10,
    marginBottom: 10,
  },
  resendRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  resendTimer: {
    fontSize: 12,
  },
  resendAction: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  successPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    marginBottom: 6,
  },
  successPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 12,
  },
  prefixText: {
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  completedContent: {
    alignItems: 'center',
    paddingVertical: 16,
    width: '100%',
  },
  successBigCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  completedTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  completedDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  completedSub: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
});
