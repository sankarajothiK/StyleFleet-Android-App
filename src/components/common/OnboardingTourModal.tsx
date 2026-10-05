import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { MainTab } from '../../types/domain';

const { width } = Dimensions.get('window');

interface OnboardingTourModalProps {
  visible: boolean;
  shopName?: string;
  onFinish: () => void;
  onTabChange?: (tab: MainTab) => void;
}

export const OnboardingTourModal = ({
  visible,
  shopName,
  onFinish,
  onTabChange,
}: OnboardingTourModalProps) => {
  const { colors } = useTheme();
  // 0: Greeting popup, 1: Customers tour, 2: Sales tour, 3: Accounts tour
  const [step, setStep] = useState<number>(0);

  if (!visible) return null;

  // Determine dynamic time-of-day greeting
  const currentHour = new Date().getHours();
  let greeting = 'Good morning';
  let greetingIcon = '☀️';
  if (currentHour >= 12 && currentHour < 17) {
    greeting = 'Good afternoon';
    greetingIcon = '🌤️';
  } else if (currentHour >= 17 && currentHour < 21) {
    greeting = 'Good evening';
    greetingIcon = '🌙';
  } else if (currentHour >= 21 || currentHour < 5) {
    greeting = 'Good night';
    greetingIcon = '🌟';
  }

  const handleNext = () => {
    const nextStep = step + 1;
    if (nextStep > 3) {
      onFinish();
      return;
    }
    setStep(nextStep);
    if (nextStep === 1) {
      onTabChange?.('customers');
    } else if (nextStep === 2) {
      onTabChange?.('sales');
    } else if (nextStep === 3) {
      onTabChange?.('accounts');
    }
  };

  const handleBack = () => {
    const prevStep = Math.max(0, step - 1);
    setStep(prevStep);
    if (prevStep === 1) {
      onTabChange?.('customers');
    } else if (prevStep === 2) {
      onTabChange?.('sales');
    } else if (prevStep === 3) {
      onTabChange?.('accounts');
    }
  };

  // Step 0: Greeting Dialog Pop-up
  if (step === 0) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.greetingCard,
              { backgroundColor: colors.surface, borderColor: colors.divider },
            ]}
          >
            <View style={styles.iconCircle}>
              <Text style={styles.greetingEmoji}>{greetingIcon}</Text>
            </View>

            <Text style={[styles.greetingHeadline, { color: colors.text }]}>
              {greeting}, {shopName || 'Partner'}!
            </Text>

            <Text style={[styles.greetingBody, { color: colors.textDim }]}>
              Your salon registration & stylist setup are complete! Welcome to Salon OS. Let's take a quick 3-step walkthrough to get you familiar with your dashboard.
            </Text>

            <View style={styles.greetingBtnRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onFinish}
                style={[styles.skipBtn, { borderColor: colors.divider }]}
              >
                <Text style={[styles.skipBtnText, { color: colors.textMuted }]}>
                  Skip Tour
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleNext}
                style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
              >
                <Text style={styles.primaryBtnText}>Start Quick Tour →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // Steps 1, 2, 3: Guided Callout with Downward Arrow pointing to Bottom Tabs
  // Tab positions: 
  // Customers = Left (16.6%)
  // Sales = Center (50%)
  // Accounts = Right (83.3%)
  let arrowLeft = '16.6%';
  let title = 'Customers Section';
  let badge = 'STEP 1 OF 3';
  let icon = '👥';
  let desc =
    'Manage all your client relationships in one place:\n• View and search customer profiles & phone numbers\n• Track visit frequencies, preferred stylists & dues\n• Star VIP clients & send bulk WhatsApp notices';

  if (step === 2) {
    arrowLeft = '50%';
    title = 'Sales & Billing Section';
    badge = 'STEP 2 OF 3';
    icon = '📊';
    desc =
      'Your real-time salon revenue engine:\n• Real-time gross turnover (Day, Week, Month)\n• Payment breakdown by UPI, Cash & Card\n• Generate GST-ready digital invoices with "+ New Bill"';
  } else if (step === 3) {
    arrowLeft = '83.3%';
    title = 'Accounts & Settings Section';
    badge = 'STEP 3 OF 3';
    icon = '💼';
    desc =
      'Your salon back-office operations:\n• Record shop expenses and track net profitability\n• Monitor staff performance & target achievements\n• Manage service prices, offers, and access 24/7 Help Desk';
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.tourOverlay}>
        {/* Semi-transparent dark background dismissing on outside tap */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onFinish}
        />

        {/* Floating Tooltip Card positioned just above bottom tab bar */}
        <View style={styles.tooltipWrapper}>
          <View
            style={[
              styles.tooltipCard,
              { backgroundColor: colors.surface, borderColor: colors.divider },
            ]}
          >
            {/* Header */}
            <View style={styles.tooltipHeader}>
              <View style={styles.titleRow}>
                <Text style={styles.stepIcon}>{icon}</Text>
                <Text style={[styles.tooltipTitle, { color: colors.text }]}>
                  {title}
                </Text>
              </View>
              <View
                style={[
                  styles.badgePill,
                  { backgroundColor: colors.accent900, borderColor: colors.accent },
                ]}
              >
                <Text style={[styles.badgePillText, { color: colors.accent }]}>
                  {badge}
                </Text>
              </View>
            </View>

            {/* Description Body */}
            <Text style={[styles.tooltipDesc, { color: colors.textDim }]}>
              {desc}
            </Text>

            {/* Progress Dots */}
            <View style={styles.dotsRow}>
              {[1, 2, 3].map((dot) => (
                <View
                  key={dot}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        step === dot ? colors.accent : colors.divider,
                      width: step === dot ? 18 : 6,
                    },
                  ]}
                />
              ))}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleBack}
                style={[styles.backBtn, { borderColor: colors.divider }]}
              >
                <Text style={[styles.backBtnText, { color: colors.textMuted }]}>
                  ← Back
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleNext}
                style={[styles.nextBtn, { backgroundColor: colors.accent }]}
              >
                <Text style={styles.nextBtnText}>
                  {step === 3 ? 'Finish Tour 🎉' : 'Next Step →'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Downward Pointing Arrow Indicator */}
          <View
            style={[
              styles.arrowContainer,
              {
                left: arrowLeft as any,
                transform: [{ translateX: -14 }],
              },
            ]}
          >
            <View
              style={[
                styles.arrowDown,
                { borderTopColor: colors.surface },
              ]}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  greetingCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 24,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(217, 164, 65, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  greetingEmoji: {
    fontSize: 34,
  },
  greetingHeadline: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  greetingBody: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  greetingBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  skipBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  primaryBtn: {
    flex: 1.6,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#0D0E11',
    fontSize: 14,
    fontWeight: '700',
  },
  tourOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  tooltipWrapper: {
    paddingHorizontal: 16,
    marginBottom: 72, // Position right above the BottomTabBar
  },
  tooltipCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 18,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepIcon: {
    fontSize: 20,
  },
  tooltipTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.5,
  },
  badgePillText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tooltipDesc: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  backBtn: {
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  nextBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    color: '#0D0E11',
    fontSize: 13.5,
    fontWeight: '700',
  },
  arrowContainer: {
    position: 'absolute',
    bottom: -13,
  },
  arrowDown: {
    width: 0,
    height: 0,
    borderLeftWidth: 14,
    borderRightWidth: 14,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
