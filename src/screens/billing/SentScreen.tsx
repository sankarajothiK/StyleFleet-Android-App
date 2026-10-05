import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../components/common/Button';
import { CheckIcon } from '../../components/common/SvgIcons';
import { Bill } from '../../types/domain';
import { inrFromMinor } from '../../utils/format';
import { radii } from '../../theme/spacing';

interface SentScreenProps {
  bill: Bill;
  shopName: string;
  onNextBill: () => void;
  onDone: () => void;
  onUpdateStatus?: (
    billId: string,
    updates: { reminder_status?: 'Not Sent' | 'Sent' | 'Pending'; confirmation_status?: 'Pending' | 'Confirmed' }
  ) => Promise<void>;
}

export const SentScreen = ({
  bill,
  shopName,
  onNextBill,
  onDone,
  onUpdateStatus,
}: SentScreenProps) => {
  const { colors } = useTheme();
  const [reminderStatus, setReminderStatus] = useState<string>(bill.reminder_status || 'Not Sent');
  const [confirmationStatus, setConfirmationStatus] = useState<string>(
    bill.confirmation_status || 'Pending'
  );

  const handleSetReminder = (status: 'Not Sent' | 'Sent' | 'Pending') => {
    setReminderStatus(status);
    onUpdateStatus?.(bill.id, { reminder_status: status });
  };

  const handleSetConfirmation = (status: 'Pending' | 'Confirmed') => {
    setConfirmationStatus(status);
    onUpdateStatus?.(bill.id, { confirmation_status: status });
  };

  const previewText = `${shopName}: Thanks, ${bill.customer_name}! Invoice ${
    bill.invoice_number
  } for ${inrFromMinor(bill.total_minor)} is attached. Paid by ${
    bill.payment_method
  }. See you in 4 weeks — reply BOOK to hold your chair.`;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Accent check circle */}
        <View
          style={[
            styles.checkCircle,
            { borderColor: colors.accent },
          ]}
        >
          <CheckIcon size={22} color={colors.accent} />
        </View>

        <Text style={[styles.heading, { color: colors.text }]}>
          Bill Sent ✓
        </Text>
        <Text style={[styles.subheading, { color: colors.textDim }]}>
          Invoice {bill.invoice_number} · {inrFromMinor(bill.total_minor)} · delivered to {bill.customer_name}
        </Text>

        {/* Status Card: Reminder Status & Confirmation Status */}
        <View
          style={[
            styles.statusCard,
            { backgroundColor: colors.surface, borderColor: colors.divider },
          ]}
        >
          {/* Reminder Status */}
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={[styles.statusLabel, { color: colors.textDim }]}>REMINDER STATUS</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent }}>{reminderStatus}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['Not Sent', 'Sent', 'Pending'] as const).map((st) => {
                const isSelected = reminderStatus === st;
                return (
                  <TouchableOpacity
                    key={st}
                    activeOpacity={0.75}
                    onPress={() => handleSetReminder(st)}
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor: isSelected ? colors.accent900 : colors.bg,
                        borderColor: isSelected ? colors.accent : colors.divider,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        {
                          color: isSelected ? colors.accent100 : colors.textDim,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {st}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Confirmation Status */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={[styles.statusLabel, { color: colors.textDim }]}>CONFIRMATION STATUS</Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: confirmationStatus === 'Confirmed' ? '#10B981' : colors.accent,
                }}
              >
                {confirmationStatus}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['Pending', 'Confirmed'] as const).map((st) => {
                const isSelected = confirmationStatus === st;
                return (
                  <TouchableOpacity
                    key={st}
                    activeOpacity={0.75}
                    onPress={() => handleSetConfirmation(st)}
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor: isSelected ? (st === 'Confirmed' ? '#064e3b' : colors.accent900) : colors.bg,
                        borderColor: isSelected ? (st === 'Confirmed' ? '#10B981' : colors.accent) : colors.divider,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        {
                          color: isSelected ? (st === 'Confirmed' ? '#6ee7b7' : colors.accent100) : colors.textDim,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {st}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* WhatsApp chat bubble */}
        <View
          style={[
            styles.chatBubble,
            { backgroundColor: colors.accent900 },
          ]}
        >
          <Text style={[styles.chatText, { color: colors.accent100 }]}>
            {previewText}
          </Text>
        </View>
        <Text style={[styles.deliveryTimestamp, { color: colors.textSubtle }]}>
          delivered · just now
        </Text>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <Button
            label="Next bill"
            variant="secondary"
            onPress={onNextBill}
            style={{ flex: 1 }}
          />
          <Button
            label="Done"
            variant="primary"
            onPress={onDone}
            style={{ flex: 1 }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
  },
  checkCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 23,
    fontWeight: '500',
    marginTop: 18,
    marginBottom: 6,
  },
  subheading: {
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  chatBubble: {
    alignSelf: 'flex-end',
    maxWidth: 270,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderBottomRightRadius: 4,
  },
  chatText: {
    fontSize: 12.5,
    lineHeight: 19,
  },
  deliveryTimestamp: {
    alignSelf: 'flex-end',
    fontSize: 10,
    marginTop: 5,
  },
  actionsRow: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 20,
  },
  statusCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusChip: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusChipText: {
    fontSize: 11.5,
  },
});
