import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { spacing, radii } from '../../theme/spacing';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  PlanId,
  SubscriptionPlanConfig,
  formatPriceInRupees,
  getSubscriptionPlans,
} from '../../config/planConfig';
import {
  isWithinFirst30DaysOfRegistration,
  getRemainingLaunchOfferDays,
} from '../../utils/subscriptionUtils';
import { shopRepository } from '../../repositories/shopRepository';
import { subscriptionRepository } from '../../repositories/subscriptionRepository';
import { CashfreeCheckoutModal } from './CashfreeCheckoutModal';
import { SparklesIcon } from '../common/SvgIcons';

interface PlanSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  shopId: string;
  ownerName: string;
  phone: string;
  initialPlanId?: PlanId;
  onPlanActivated: (planId: PlanId) => void;
  registrationDateIso?: string | null;
}

export const PlanSelectionModal: React.FC<PlanSelectionModalProps> = ({
  visible,
  onClose,
  shopId,
  ownerName,
  phone,
  initialPlanId,
  onPlanActivated,
  registrationDateIso,
}) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [resolvedRegDate, setResolvedRegDate] = useState<string | null>(registrationDateIso || null);

  useEffect(() => {
    if (registrationDateIso) {
      setResolvedRegDate(registrationDateIso);
    } else {
      shopRepository.getCachedShop().then((shop) => {
        if (shop?.created_at) {
          setResolvedRegDate(shop.created_at);
        }
      }).catch(() => {});
    }
  }, [registrationDateIso, visible]);

  const isLaunchOfferActive = useMemo(() => {
    return isWithinFirst30DaysOfRegistration(resolvedRegDate);
  }, [resolvedRegDate]);

  const remainingLaunchDays = useMemo(() => {
    return getRemainingLaunchOfferDays(resolvedRegDate);
  }, [resolvedRegDate]);

  const activePlans = useMemo(() => {
    return getSubscriptionPlans(isLaunchOfferActive);
  }, [isLaunchOfferActive]);

  // Default to initialPlanId or the 6-Month plan
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>(initialPlanId || '6_months');

  useEffect(() => {
    if (initialPlanId) {
      setSelectedPlanId(initialPlanId);
    }
  }, [initialPlanId, visible]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  // Cashfree in-app checkout modal state
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  const pendingOrderIdRef = useRef<string | null>(null);
  pendingOrderIdRef.current = pendingOrderId;

  const selectedPlan =
    activePlans.find((p) => p.id === selectedPlanId) || activePlans[0];

  const verifyAndActivate = useCallback(
    async (orderIdToVerify: string) => {
      if (isVerifying) return;
      setIsVerifying(true);
      try {
        const verifyRes = await subscriptionRepository.verifyPaymentOrder({
          orderId: orderIdToVerify,
          shopId,
          planId: selectedPlanId,
        });

        if (verifyRes.success) {
          setPendingOrderId(null);
          Alert.alert(
            t('paymentSuccess', 'Payment Successful!'),
            `${selectedPlan.name} Premium is now active for your salon.`
          );
          onPlanActivated(selectedPlanId);
          onClose();
        } else {
          // Strictly do NOT activate plan - inform user payment is pending or incomplete
          Alert.alert(
            'Payment Pending or Incomplete',
            'Your payment was not completed or has not yet been confirmed by the bank. Your Free Trial remains active.'
          );
        }
      } catch (err: any) {
        Alert.alert('Payment Status', err.message || 'Could not verify payment');
      } finally {
        setIsVerifying(false);
      }
    },
    [isVerifying, shopId, selectedPlanId, selectedPlan.name, onPlanActivated, onClose, t]
  );

  // 1. Listen for deep link redirects back to app: stylefleet://payment-callback?order_id=...
  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      if (event.url && event.url.includes('payment-callback')) {
        const urlStr = event.url;
        let linkId = pendingOrderIdRef.current;
        const match = urlStr.match(/[?&](?:order_id|link_id)=([^&]+)/);
        if (match && match[1]) {
          linkId = match[1];
        }
        if (linkId) {
          verifyAndActivate(linkId);
        }
      }
    };

    const sub = Linking.addEventListener('url', handleUrl);

    // Check if app was opened with initial URL
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl && initialUrl.includes('payment-callback')) {
        handleUrl({ url: initialUrl });
      }
    });

    return () => {
      sub.remove();
    };
  }, [verifyAndActivate]);

  // 2. Listen for app returning to foreground (e.g. from UPI apps like PhonePe / GPay)
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active' && pendingOrderIdRef.current) {
        // Automatically verify when returning to the app
        verifyAndActivate(pendingOrderIdRef.current);
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => {
      sub.remove();
    };
  }, [verifyAndActivate]);

  const handleProceedPayment = async () => {
    setIsProcessing(true);
    try {
      // 1. Create order via Cashfree Orders API
      const order = await subscriptionRepository.createPaymentOrder({
        shopId,
        planId: selectedPlanId,
        customerName: ownerName || 'Salon Owner',
        customerPhone: phone || '9999999999',
        isLaunchOffer: isLaunchOfferActive,
        registrationDateIso: resolvedRegDate || undefined,
      });

      if (!order.paymentSessionId) {
        throw new Error('Cashfree did not return a payment session. Please try again.');
      }

      setPendingOrderId(order.orderId);
      setCheckoutSessionId(order.paymentSessionId);
      setCheckoutOrderId(order.orderId);
      setShowCheckoutModal(true);
    } catch (err: any) {
      Alert.alert(
        'Payment Gateway Notice',
        err.message || 'Unable to connect to Cashfree payment gateway. Please check your internet connection and try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentFinished = async (orderId: string) => {
    setShowCheckoutModal(false);
    if (orderId) {
      await verifyAndActivate(orderId);
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: colors.bg,
              borderColor: colors.divider,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>
                {isLaunchOfferActive ? 'First 30 Days Launch Offer' : t('choosePlan', 'Choose a Plan')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {isLaunchOfferActive
                  ? `Offer price for first 30 days • ${remainingLaunchDays} ${remainingLaunchDays === 1 ? 'day' : 'days'} left`
                  : t('selectSubscriptionPlan', 'Select a subscription plan for your salon')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={[styles.closeButton, { backgroundColor: colors.surface }]}
            >
              <Text style={{ color: colors.textMuted, fontSize: 16, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Pending Verification Banner (shown when payment was opened in browser) */}
          {pendingOrderId ? (
            <View
              style={[
                styles.pendingBanner,
                {
                  backgroundColor: 'rgba(217, 164, 65, 0.12)',
                  borderColor: colors.accent,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                {isVerifying ? (
                  <ActivityIndicator color={colors.accent} size="small" />
                ) : (
                  <Text style={{ fontSize: 18 }}>💳</Text>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pendingTitle, { color: colors.text }]}>
                    Payment initiated in Cashfree
                  </Text>
                  <Text style={[styles.pendingSub, { color: colors.textMuted }]}>
                    Completed your payment in the browser?
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                disabled={isVerifying}
                onPress={() => verifyAndActivate(pendingOrderId)}
                style={[styles.verifyButton, { backgroundColor: colors.accent }]}
              >
                <Text style={styles.verifyButtonText}>
                  {isVerifying ? 'Checking...' : 'Verify & Activate ✓'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Plan Cards List */}
          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {isLaunchOfferActive ? (
              <View
                style={[
                  styles.launchBanner,
                  {
                    backgroundColor: 'rgba(217, 164, 65, 0.08)',
                    borderColor: 'rgba(217, 164, 65, 0.35)',
                  },
                ]}
              >
                <View style={styles.launchBannerHeader}>
                  <SparklesIcon size={14} color="#D9A441" />
                  <Text style={styles.launchBannerPillText}>
                    30-DAY LAUNCH OFFER • {remainingLaunchDays} {remainingLaunchDays === 1 ? 'DAY' : 'DAYS'} LEFT
                  </Text>
                </View>
                <Text style={[styles.launchBannerTitle, { color: colors.text }]}>
                  If you register within 30 days, this special offer price is for you!
                </Text>
                <Text style={[styles.launchBannerDesc, { color: colors.textMuted }]}>
                  After your first 30 days from registration, the price will be changed to regular subscription rates. Choose your plan to lock in this offer price now.
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.launchBanner,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.divider,
                  },
                ]}
              >
                <Text style={[styles.launchBannerDesc, { color: colors.textDim }]}>
                  Standard Subscription Plans • The 30-day launch offer has ended for this salon.
                </Text>
              </View>
            )}

            {activePlans.map((plan: SubscriptionPlanConfig) => {
              const isSelected = plan.id === selectedPlanId;
              const hasBadge = !!plan.badge;

              return (
                <TouchableOpacity
                  key={plan.id}
                  activeOpacity={0.85}
                  onPress={() => setSelectedPlanId(plan.id)}
                  style={[
                    styles.planCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: isSelected ? colors.accent : colors.divider,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                >
                  {/* Badge */}
                  {hasBadge && (
                    <View
                      style={[
                        styles.badgeTag,
                        {
                          backgroundColor:
                            plan.id === '12_months' ? '#22C55E' : colors.accent,
                        },
                      ]}
                    >
                      <Text style={styles.badgeText}>{plan.badge}</Text>
                    </View>
                  )}

                  <View style={styles.cardHeader}>
                    {/* Radio Indicator */}
                    <View
                      style={[
                        styles.radioOuter,
                        { borderColor: isSelected ? colors.accent : colors.divider },
                      ]}
                    >
                      {isSelected && (
                        <View
                          style={[styles.radioInner, { backgroundColor: colors.accent }]}
                        />
                      )}
                    </View>

                    {/* Plan Name & Duration */}
                    <View style={styles.planTitleContainer}>
                      <Text style={[styles.planName, { color: colors.text }]}>
                        {plan.name}
                      </Text>
                      <Text style={[styles.planSubMuted, { color: colors.textMuted }]}>
                        {plan.durationDays} days access
                      </Text>
                    </View>

                    {/* Total Price */}
                    <View style={styles.priceContainer}>
                      <Text style={[styles.planPrice, { color: colors.text }]}>
                        {formatPriceInRupees(plan.priceInRupees)}
                      </Text>
                      {plan.discountPercent > 0 && (
                        <View style={styles.savingsPill}>
                          <Text style={styles.savingsPillText}>
                            {t('savePercent', 'Save')} {plan.discountPercent}%
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Bullet features */}
                  <View style={[styles.featuresRow, { borderTopColor: colors.divider }]}>
                    <Text style={[styles.featureBullet, { color: colors.textMuted }]}>
                      ✓ {t('unlimitedBillGen', 'Unlimited Bill Generation')}
                    </Text>
                    <Text style={[styles.featureBullet, { color: colors.textMuted }]}>
                      ✓ {t('unlimitedReports', 'Unlimited Report Downloads (PDF & Excel)')}
                    </Text>
                    <Text style={[styles.featureBullet, { color: colors.textMuted }]}>
                      ✓ {t('teamAndAccounts', 'Team Management & Stylist Commissions')}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer with Checkout CTA */}
          <View
            style={[
              styles.footer,
              {
                backgroundColor: colors.surface,
                borderTopColor: colors.divider,
              },
            ]}
          >
            <View style={styles.summaryRow}>
              <View>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
                  {selectedPlan.name} ({selectedPlan.durationDays} days)
                </Text>
                <Text style={[styles.summaryTotal, { color: colors.text }]}>
                  {formatPriceInRupees(selectedPlan.priceInRupees)}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                disabled={isProcessing || isVerifying}
                onPress={handleProceedPayment}
                style={[
                  styles.payButton,
                  {
                    backgroundColor: colors.accent,
                    opacity: isProcessing || isVerifying ? 0.7 : 1,
                  },
                ]}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#0D0F14" size="small" />
                ) : (
                  <Text style={styles.payButtonText}>
                    {t('proceedToPayment', 'Proceed to Payment')} →
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Cashfree Security Trust Badge */}
            <View style={styles.trustBadgeContainer}>
              <Text style={[styles.trustBadgeText, { color: colors.textDim }]}>
                🔒 {t('securedByCashfree', '100% Secure Checkout powered by Cashfree Payments')}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>

    {showCheckoutModal && !!checkoutSessionId && !!checkoutOrderId && (
      <CashfreeCheckoutModal
        visible={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        paymentSessionId={checkoutSessionId}
        orderId={checkoutOrderId}
        planName={selectedPlan.name}
        amount={selectedPlan.priceInRupees}
        onPaymentFinished={handlePaymentFinished}
      />
    )}
  </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.circle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  pendingTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  pendingSub: {
    fontSize: 11,
    marginTop: 2,
  },
  verifyButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  verifyButtonText: {
    color: '#0D0F14',
    fontSize: 12,
    fontWeight: '800',
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  planCard: {
    borderRadius: radii.md,
    padding: spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  badgeTag: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderBottomLeftRadius: radii.sm,
  },
  badgeText: {
    color: '#0D0F14',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: 4,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  planTitleContainer: {
    flex: 1,
  },
  planName: {
    fontSize: 16,
    fontWeight: '700',
  },
  planSub: {
    fontSize: 12,
    marginTop: 2,
  },
  planSubMuted: {
    fontSize: 11,
    marginTop: 1,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '800',
  },
  savingsPill: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  savingsPillText: {
    color: '#22C55E',
    fontSize: 10,
    fontWeight: '700',
  },
  featuresRow: {
    borderTopWidth: 1,
    paddingTop: spacing.xs,
    marginTop: spacing.xs,
    gap: 3,
  },
  featureBullet: {
    fontSize: 11,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    fontSize: 12,
  },
  summaryTotal: {
    fontSize: 22,
    fontWeight: '800',
  },
  payButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonText: {
    color: '#0D0F14',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  trustBadgeContainer: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  trustBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  launchBanner: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  launchBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  launchBannerPillText: {
    color: '#D9A441',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  launchBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 4,
  },
  launchBannerDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
});
