import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radii, shadows, spacing } from '../../theme/spacing';
import { fontFamilies } from '../../theme/typography';
import { SparklesIcon, CheckIcon, ArrowRightIcon } from '../common/SvgIcons';
import { PlanId } from '../../config/planConfig';

interface First30DaysTrialCardProps {
  remainingDays: number;
  completedDays?: number;
  onSelectPlan: (planId: PlanId) => void;
}

export const First30DaysTrialCard: React.FC<First30DaysTrialCardProps> = ({
  remainingDays = 30,
  completedDays = 1,
  onSelectPlan,
}) => {
  const { colors } = useTheme();
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('12_months');

  const plans: Array<{
    id: PlanId;
    duration: string;
    priceDisplay: string;
    badge?: string;
    isStrongestPromo?: boolean;
    discountText?: string;
    perDay: string;
  }> = [
    {
      id: '3_months',
      duration: '3 Months',
      priceDisplay: '₹1,499',
      perDay: '₹16.6/day',
    },
    {
      id: '6_months',
      duration: '6 Months',
      priceDisplay: '₹2,399',
      badge: '20% OFF',
      discountText: 'Save ₹600',
      perDay: '₹13.3/day',
    },
    {
      id: '12_months',
      duration: '1 Year',
      priceDisplay: '₹5,999',
      badge: '50% OFF',
      isStrongestPromo: true,
      discountText: 'Save ₹5,999',
      perDay: '₹16.4/day',
    },
  ];

  return (
    <View style={[styles.container, shadows.md]}>
      {/* Top Subtle Purple & Gold Glow Ambient Bar */}
      <View style={styles.topAccentGlow} />

      {/* Header: Free Trial Status & Remaining Days */}
      <View style={styles.header}>
        <View style={styles.trialPill}>
          <SparklesIcon size={12} color="#D9A441" />
          <Text style={styles.trialPillText}>
            30-Day Free Trial Active • {remainingDays} {remainingDays === 1 ? 'day' : 'days'} left
          </Text>
        </View>

        <Text style={styles.title}>
          Enjoying your Free Trial?
        </Text>
        <Text style={styles.subtitle}>
          30-day free trial • Choose a plan before your trial ends
        </Text>
      </View>

      {/* 3 Interactive Plan Tiles */}
      <View style={styles.plansRow}>
        {plans.map((p) => {
          const isSelected = selectedPlan === p.id;
          const isYearly = p.isStrongestPromo;

          return (
            <TouchableOpacity
              key={p.id}
              activeOpacity={0.85}
              onPress={() => setSelectedPlan(p.id)}
              style={[
                styles.planCard,
                isYearly && styles.yearlyPlanCard,
                isSelected && (isYearly ? styles.yearlyPlanCardSelected : styles.planCardSelected),
              ]}
            >
              {/* Promotional Badge */}
              {p.badge && (
                <View
                  style={[
                    styles.badgeContainer,
                    isYearly ? styles.yearlyBadge : styles.regularBadge,
                  ]}
                >
                  <Text
                    style={isYearly ? styles.yearlyBadgeText : styles.regularBadgeText}
                  >
                    {p.badge}
                  </Text>
                </View>
              )}

              {/* Radio / Selection Indicator */}
              <View style={styles.planCardHeader}>
                <Text
                  style={[
                    styles.durationText,
                    isYearly && { color: '#FFE6A7', fontWeight: '700' },
                  ]}
                  numberOfLines={1}
                >
                  {p.duration}
                </Text>
                <View
                  style={[
                    styles.radioCircle,
                    isSelected && { borderColor: '#D9A441', backgroundColor: '#D9A441' },
                  ]}
                >
                  {isSelected && <CheckIcon size={10} color="#120A1A" strokeWidth={3} />}
                </View>
              </View>

              {/* Price Display */}
              <Text style={[styles.priceText, isYearly && styles.yearlyPriceText]}>
                {p.priceDisplay}
              </Text>

              {/* Subtext: Discount or Per day */}
              <Text style={[styles.perDayText, isYearly && { color: '#E8D5B5' }]} numberOfLines={1}>
                {p.discountText || p.perDay}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Footer CTA: "Choose Plan" with Active Selection Confirmation */}
      <View style={styles.footerRow}>
        <View style={styles.footerInfo}>
          <Text style={styles.selectedPlanLabel}>
            Selected:{' '}
            <Text style={styles.selectedPlanName}>
              {plans.find((p) => p.id === selectedPlan)?.duration} ({plans.find((p) => p.id === selectedPlan)?.priceDisplay})
            </Text>
          </Text>
          <Text style={styles.autoRenewHint}>
            No charge during trial · Starts after trial
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => onSelectPlan(selectedPlan)}
          style={styles.ctaButton}
        >
          <Text style={styles.ctaButtonText}>Choose Plan</Text>
          <ArrowRightIcon size={12} color="#120A1A" strokeWidth={2.8} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E122B', // StyleFleet Luxury Deep Purple
    borderRadius: radii.lg,
    borderWidth: 1.2,
    borderColor: 'rgba(217, 164, 65, 0.45)', // Gold accent border
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  topAccentGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#D9A441', // Gold highlight top rim
  },
  header: {
    marginBottom: 14,
  },
  trialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(217, 164, 65, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(217, 164, 65, 0.35)',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    marginBottom: 8,
  },
  trialPillText: {
    color: '#D9A441',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fontFamilies.semiBold,
    letterSpacing: 0.3,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    fontFamily: fontFamilies.bold,
    letterSpacing: 0.2,
    marginBottom: 3,
  },
  subtitle: {
    color: '#D5C3E5',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontFamilies.regular,
  },
  plansRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  planCard: {
    flex: 1,
    backgroundColor: 'rgba(38, 22, 54, 0.85)',
    borderRadius: radii.md,
    borderWidth: 1.2,
    borderColor: 'rgba(217, 164, 65, 0.22)',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#D9A441',
    backgroundColor: 'rgba(56, 32, 80, 0.95)',
  },
  yearlyPlanCard: {
    borderColor: 'rgba(217, 164, 65, 0.55)',
    backgroundColor: 'rgba(48, 26, 70, 0.95)',
    // Visually prominent
    shadowColor: '#D9A441',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  yearlyPlanCardSelected: {
    borderColor: '#FFE6A7',
    borderWidth: 1.8,
    backgroundColor: 'rgba(64, 34, 94, 1)',
  },
  badgeContainer: {
    position: 'absolute',
    top: -9,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.pill,
    zIndex: 2,
  },
  regularBadge: {
    backgroundColor: '#38A169', // Subtle Green Discount Badge
  },
  regularBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  yearlyBadge: {
    backgroundColor: '#D9A441', // Prominent Golden Badge for 50% OFF
    borderWidth: 1,
    borderColor: '#FFE6A7',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  yearlyBadgeText: {
    color: '#120A1A',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4,
    marginTop: 2,
  },
  durationText: {
    color: '#E2D3F2',
    fontSize: 11.5,
    fontWeight: '600',
    fontFamily: fontFamilies.medium,
  },
  radioCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
    fontFamily: fontFamilies.bold,
    marginVertical: 2,
  },
  yearlyPriceText: {
    color: '#FFE6A7',
    fontSize: 16.5,
  },
  perDayText: {
    color: '#BFA8D8',
    fontSize: 9.5,
    fontFamily: fontFamilies.regular,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(217, 164, 65, 0.2)',
    gap: 10,
  },
  footerInfo: {
    flex: 1,
  },
  selectedPlanLabel: {
    color: '#E2D3F2',
    fontSize: 12,
    fontFamily: fontFamilies.regular,
  },
  selectedPlanName: {
    color: '#FFE6A7',
    fontWeight: '700',
    fontFamily: fontFamilies.semiBold,
  },
  autoRenewHint: {
    color: '#9E88B8',
    fontSize: 10,
    marginTop: 2,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#D9A441', // Gold Button
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    ...shadows.sm,
  },
  ctaButtonText: {
    color: '#120A1A',
    fontSize: 12.5,
    fontWeight: '700',
    fontFamily: fontFamilies.bold,
    letterSpacing: 0.3,
  },
});
