import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { spacing, radii } from '../../theme/spacing';
import { useLanguage } from '../../i18n/LanguageContext';
import { subscriptionRepository, SubscriptionInfo } from '../../repositories/subscriptionRepository';
import { billingRepository } from '../../repositories/billingRepository';
import { PlanSelectionModal } from './PlanSelectionModal';
import { PlanId } from '../../config/planConfig';

interface ManagePlansCardProps {
  shopId: string;
  ownerName: string;
  phone: string;
  userId?: string;
}

export const ManagePlansCard: React.FC<ManagePlansCardProps> = ({
  shopId,
  ownerName,
  phone,
  userId,
}) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null);
  const [totalSales, setTotalSales] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const loadSubscriptionInfo = useCallback(async () => {
    try {
      setLoading(true);
      const [info, salesCount] = await Promise.all([
        subscriptionRepository.getSubscriptionInfo(shopId, userId),
        billingRepository.getTotalSalesCreatedCount(shopId),
      ]);
      setSubInfo(info);
      setTotalSales(salesCount);
    } catch {
      // Handled inside repository
    } finally {
      setLoading(false);
    }
  }, [shopId, userId]);

  useEffect(() => {
    loadSubscriptionInfo();
  }, [loadSubscriptionInfo]);

  const handlePlanActivated = (_planId: PlanId) => {
    loadSubscriptionInfo();
  };

  if (loading && !subInfo) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.surface,
            borderColor: colors.divider,
            justifyContent: 'center',
            alignItems: 'center',
            paddingVertical: spacing.xl,
          },
        ]}
      >
        <ActivityIndicator color={colors.accent} size="small" />
      </View>
    );
  }

  // Derive display values based on active subscription vs 100-sales free tier
  const isPaid = subInfo?.type === 'subscription' && subInfo.subscription && !subInfo.subscription.isExpired;
  const sub = subInfo?.subscription;
  const isLimitReached = !isPaid && totalSales >= 100;

  // Card theme styling
  let badgeText = 'Free Plan';
  let badgeBg = 'rgba(217, 164, 65, 0.15)';
  let badgeColor = colors.accent;
  let cardBorderColor = colors.divider;
  let progressBarColor = colors.accent;
  let title = `${totalSales} / 100 Sales`;
  let subtitle = `${Math.max(0, 100 - totalSales)} free sales remaining · Unlimited clients`;
  let buttonLabel = t('upgradePlan', 'Upgrade Plan');
  let planHint = 'Unlimited Bill Generation & Report Downloads on Pro';
  let progress = Math.min(1, Math.max(0, totalSales / 100));

  if (isPaid && sub) {
    badgeText = t('activePlan', 'Pro Active');
    badgeBg = 'rgba(34, 197, 94, 0.15)';
    badgeColor = '#22C55E';
    cardBorderColor = colors.divider;
    title = sub.planName || 'StyleFleet Pro';
    subtitle = `${t('validTill', 'Valid till')} ${sub.endDateFormatted} · ${sub.remainingDays} ${t('daysRemaining', 'days remaining')}`;
    progressBarColor = '#22C55E';
    progress = 1.0;
    buttonLabel = t('upgradePlan', 'Upgrade Plan');
    planHint = 'Unlimited Bills, Reports & Stylists unlocked';
  } else if (isLimitReached) {
    badgeText = 'Limit Reached';
    badgeBg = 'rgba(239, 68, 68, 0.15)';
    badgeColor = '#EF4444';
    cardBorderColor = '#EF4444';
    progressBarColor = '#EF4444';
    title = '100 / 100 Sales';
    subtitle = 'Free limit reached. Upgrade to Pro for unlimited bill generation & reports.';
    buttonLabel = 'Upgrade to Pro';
    planHint = 'Upgrade for unlimited bills & report downloads';
    progress = 1.0;
  }

  return (
    <>
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.surface,
            borderColor: cardBorderColor,
          },
        ]}
      >
        {/* Top Header Row */}
        <View style={styles.topRow}>
          <View style={styles.titleArea}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 16 }}>👑</Text>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            </View>
          </View>

          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeLabel, { color: badgeColor }]}>{badgeText}</Text>
          </View>
        </View>

        {/* Subtitle / Description */}
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>

        {/* Progress Bar Container */}
        <View style={[styles.progressTrack, { backgroundColor: colors.bg }]}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${Math.min(100, Math.max(4, Math.round(progress * 100)))}%`,
                backgroundColor: progressBarColor,
              },
            ]}
          />
        </View>

        {/* Action Button Row */}
        <View style={styles.actionsRow}>
          <Text style={[styles.planHint, { color: colors.textDim }]}>
            {planHint}
          </Text>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowModal(true)}
            style={[
              styles.actionButton,
              {
                backgroundColor: isLimitReached ? colors.accent : 'transparent',
                borderColor: colors.accent,
                borderWidth: 1,
              },
            ]}
          >
            <Text
              style={[
                styles.actionButtonText,
                {
                  color: isLimitReached ? '#0D0F14' : colors.accent,
                  fontWeight: isLimitReached ? '800' : '700',
                },
              ]}
            >
              {buttonLabel} →
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Plan Selection Modal */}
      <PlanSelectionModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        shopId={shopId}
        ownerName={ownerName}
        phone={phone}
        registrationDateIso={subInfo?.registrationDateIso || null}
        onPlanActivated={handlePlanActivated}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  titleArea: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: spacing.sm,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planHint: {
    fontSize: 11,
    flex: 1,
    marginRight: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  actionButtonText: {
    fontSize: 12,
  },
});
