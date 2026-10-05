import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Customer } from '../../types/domain';
import { inrFromMinor, getInitials } from '../../utils/format';
import { radii } from '../../theme/spacing';
import { CashIcon, UpiIcon } from '../common/SvgIcons';

interface SettleDueModalProps {
  visible: boolean;
  customer: Customer | null;
  onClose: () => void;
  onConfirm: (customerId: string, method: 'cash' | 'upi', amountMinor: number) => Promise<void> | void;
}

export const SettleDueModal = ({
  visible,
  customer,
  onClose,
  onConfirm,
}: SettleDueModalProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [settleAmount, setSettleAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'upi'>('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible && customer) {
      // Pre-fill with the full due amount as default, but user can freely edit to partial
      const totalDueRupees = Math.round(customer.outstanding_due_minor / 100);
      setSettleAmount(totalDueRupees > 0 ? String(totalDueRupees) : '');
      setMethod('cash');
      setIsSubmitting(false);
    }
  }, [visible, customer]);

  if (!customer) return null;

  const totalDueMinor = customer.outstanding_due_minor || 0;
  const totalDueRupees = Math.round(totalDueMinor / 100);

  const parsedAmountRupees = parseInt(settleAmount.replace(/\D/g, ''), 10) || 0;
  const parsedAmountMinor =
    totalDueRupees > 0 && parsedAmountRupees === totalDueRupees ? totalDueMinor : parsedAmountRupees * 100;

  const isValidAmount = parsedAmountMinor > 0 && parsedAmountMinor <= totalDueMinor;
  const remainingDueMinor = Math.max(0, totalDueMinor - parsedAmountMinor);
  const isFullSettlement = parsedAmountMinor === totalDueMinor;

  const handleFullDuePress = () => {
    setSettleAmount(String(totalDueRupees));
  };

  const handleSubmit = async () => {
    if (!isValidAmount || isSubmitting) return;
    try {
      setIsSubmitting(true);
      await onConfirm(customer.id, method, parsedAmountMinor);
      onClose();
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalBox, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t('settleCustomerDue', 'Settle Customer Due')}
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textDim }]}>
                {customer.name} · +91 {customer.phone}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ fontSize: 20, color: colors.textDim }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Current Outstanding Box */}
          <View style={[styles.dueInfoBox, { backgroundColor: colors.accent900, borderColor: colors.accent }]}>
            <Text style={[styles.dueInfoLabel, { color: colors.accent200 }]}>
              {t('currentTotalDue', 'Current Total Due')}
            </Text>
            <Text style={[styles.dueInfoAmount, { color: colors.accent }]}>
              {inrFromMinor(totalDueMinor)}
            </Text>
            {customer.due_start_date ? (
              <Text style={[styles.dueDateLabel, { color: colors.accent200 }]}>
                Pending since {customer.due_start_date}
              </Text>
            ) : null}
          </View>

          {/* Amount to Settle Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                {t('amountPayingNow', 'Amount Paying Now (₹)')}
              </Text>
              <TouchableOpacity onPress={handleFullDuePress} style={styles.fullChip}>
                <Text style={[styles.fullChipText, { color: colors.accent }]}>
                  {t('payFull', 'Pay Full')} (₹{totalDueRupees.toLocaleString('en-IN')})
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.inputContainer, { borderColor: colors.divider, backgroundColor: colors.bg }]}>
              <Text style={[styles.currencyPrefix, { color: colors.textDim }]}>₹</Text>
              <TextInput
                style={[styles.amountInput, { color: colors.text }]}
                keyboardType="numeric"
                placeholder={`Max ₹${totalDueRupees}`}
                placeholderTextColor={colors.textSubtle}
                value={settleAmount}
                onChangeText={(val) => setSettleAmount(val.replace(/\D/g, ''))}
                autoFocus
              />
            </View>

            {/* Validation & Balance Calculation */}
            {parsedAmountMinor > totalDueMinor ? (
              <Text style={styles.errorText}>
                Amount cannot exceed total due ({inrFromMinor(totalDueMinor)})
              </Text>
            ) : parsedAmountMinor > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryText, { color: colors.textDim }]}>
                  {isFullSettlement ? '✓ Clearing all outstanding dues' : `Remaining due after payment: `}
                  {!isFullSettlement && (
                    <Text style={{ color: '#f59e0b', fontWeight: '700' }}>
                      {inrFromMinor(remainingDueMinor)}
                    </Text>
                  )}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Payment Method Selector */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textMuted, marginBottom: 8 }]}>
              {t('paymentMethod', 'Payment Method')}
            </Text>
            <View style={styles.methodRow}>
              <TouchableOpacity
                style={[
                  styles.methodBtn,
                  {
                    borderColor: method === 'cash' ? colors.accent : colors.divider,
                    backgroundColor: method === 'cash' ? colors.accent900 : colors.bg,
                  },
                ]}
                onPress={() => setMethod('cash')}
                activeOpacity={0.8}
              >
                <View style={{ marginRight: 6 }}>
                  <CashIcon size={16} color={method === 'cash' ? colors.accent : colors.textDim} />
                </View>
                <Text
                  style={[
                    styles.methodBtnText,
                    { color: method === 'cash' ? colors.accent : colors.text },
                  ]}
                >
                  Cash
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.methodBtn,
                  {
                    borderColor: method === 'upi' ? colors.accent : colors.divider,
                    backgroundColor: method === 'upi' ? colors.accent900 : colors.bg,
                  },
                ]}
                onPress={() => setMethod('upi')}
                activeOpacity={0.8}
              >
                <View style={{ marginRight: 6 }}>
                  <UpiIcon size={16} color={method === 'upi' ? colors.accent : colors.textDim} />
                </View>
                <Text
                  style={[
                    styles.methodBtnText,
                    { color: method === 'upi' ? colors.accent : colors.text },
                  ]}
                >
                  UPI
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.divider }]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={[styles.cancelBtnText, { color: colors.textDim }]}>
                {t('cancel', 'Cancel')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                {
                  backgroundColor: isValidAmount ? colors.accent : colors.neutral800,
                  opacity: isValidAmount && !isSubmitting ? 1 : 0.6,
                },
              ]}
              onPress={handleSubmit}
              disabled={!isValidAmount || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={[styles.confirmBtnText, { color: '#000000' }]}>
                  {isFullSettlement
                    ? `Settle Full (₹${parsedAmountRupees.toLocaleString('en-IN')})`
                    : `Record Payment (₹${parsedAmountRupees.toLocaleString('en-IN')})`}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radii.lg || 16,
    padding: 22,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  dueInfoBox: {
    padding: 14,
    borderRadius: radii.md || 10,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 18,
  },
  dueInfoLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dueInfoAmount: {
    fontSize: 26,
    fontWeight: '900',
    marginTop: 2,
  },
  dueDateLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  fullChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
  },
  fullChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.md || 8,
    paddingHorizontal: 12,
    height: 48,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  summaryRow: {
    marginTop: 6,
  },
  summaryText: {
    fontSize: 12,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 10,
  },
  methodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: radii.md || 8,
    borderWidth: 1,
  },
  methodBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md || 8,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 2,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md || 8,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
