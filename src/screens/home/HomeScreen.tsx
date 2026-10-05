import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ImageBackground,
  Image,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  BellIcon,
  SettingsIcon,
  CalendarIcon,
  ClockIcon,
  ArrowRightIcon,
  SparklesIcon,
} from '../../components/common/SvgIcons';
import { Bill, Period } from '../../types/domain';
import { financialService } from '../../services/financialService';
import { inrFromMinor, getInitials } from '../../utils/format';
import { radii, shadows } from '../../theme/spacing';
import { fontFamilies } from '../../theme/typography';
import { PlanId } from '../../config/planConfig';

interface HomeScreenProps {
  shopName?: string;
  logoUrl?: string | null;
  remindersCount?: number;
  bills?: Bill[];
  totalSalesCount?: number;
  shopCreatedAt?: string;
  isPro?: boolean;
  onBookSlot: () => void;
  onNavigateAppointments?: () => void;
  onNavigateReminders: () => void;
  onNavigateProfile: () => void;
  onUpgradePlan: () => void;
  onSelectPlan?: (planId: PlanId) => void;
  onOpenInvoice: (bill: Bill) => void;
}

const { height } = Dimensions.get('window');
const heroHeight = Math.round(height * 0.35); // Picture covers exactly 35% of the screen area

const isValidLogoUri = (uri?: string | null): boolean => {
  if (!uri || typeof uri !== 'string') return false;
  const trimmed = uri.trim();
  if (trimmed.length < 5) return false;
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://')
  );
};

export const HomeScreen = ({
  shopName = 'StyleFleet',
  logoUrl = null,
  remindersCount = 0,
  bills = [],
  totalSalesCount = 0,
  shopCreatedAt,
  isPro = false,
  onBookSlot,
  onNavigateAppointments,
  onNavigateReminders,
  onNavigateProfile,
  onUpgradePlan,
  onSelectPlan,
  onOpenInvoice,
}: HomeScreenProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>('Day');
  const [logoLoadError, setLogoLoadError] = useState(false);


  useEffect(() => {
    setLogoLoadError(false);
  }, [logoUrl]);

  const canShowLogo = useMemo(() => {
    return isValidLogoUri(logoUrl) && !logoLoadError;
  }, [logoUrl, logoLoadError]);

  // Dynamic greeting based on current time
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return t('goodMorning', 'Good Morning');
    } else if (hour >= 12 && hour < 17) {
      return t('goodAfternoon', 'Good Afternoon');
    } else {
      return t('goodEvening', 'Good Evening');
    }
  }, [t]);

  // Filter active bills for sales metrics & recent bills
  const activeBills = useMemo(() => {
    return bills.filter((b) => b && b.status !== 'deleted');
  }, [bills]);

  // Sales metrics for histogram
  const metrics = useMemo(() => {
    return financialService.getSalesMetrics(period, activeBills);
  }, [period, activeBills]);

  const deltaPct =
    metrics.prev_minor > 0
      ? Math.round((Math.abs(metrics.total_minor - metrics.prev_minor) / metrics.prev_minor) * 100)
      : 0;
  const isUp = metrics.total_minor >= metrics.prev_minor;
  const deltaLabel =
    metrics.prev_minor > 0
      ? `${isUp ? '▲ ' : '▼ '}${deltaPct}% ${t('vsLast', 'vs last')} ${t(period.toLowerCase(), period)}`
      : '0% change';

  // Recent bills sorted latest first
  const recentBills = useMemo(() => {
    return [...activeBills]
      .sort((a, b) => {
        const tA = new Date(a.issued_at || a.created_at || '').getTime();
        const tB = new Date(b.issued_at || b.created_at || '').getTime();
        return tB - tA;
      })
      .slice(0, 15);
  }, [activeBills]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* ======================================================== */}
      {/* 1. HERO PICTURE: COVERS 35% OF SCREEN AREA               */}
      {/* ======================================================== */}
      <View style={[styles.heroContainer, { height: heroHeight }]}>
        <ImageBackground
          source={require('../../assets/home_hero_bg.jpg')}
          style={styles.heroBgImage}
          imageStyle={styles.heroBgImageStyle}
          resizeMode="cover"
        >
          <View style={styles.darkOverlay} />

          <SafeAreaView edges={['top']} style={styles.heroSafeArea}>
          {/* Top Store Info Bar: Logo, Store Name, Greeting, Bell, Settings */}
          <View style={styles.header}>
            <View style={styles.storeInfoRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onNavigateProfile}
                style={[styles.logoCircle, { borderColor: colors.accent }]}
              >
                {canShowLogo ? (
                  <Image
                    source={{ uri: logoUrl!.trim() }}
                    style={styles.logoImg}
                    resizeMode="cover"
                    onError={() => setLogoLoadError(true)}
                  />
                ) : (
                  <View style={[styles.logoPlaceholder, { backgroundColor: colors.accent900 }]}>
                    <Text style={[styles.logoInitials, { color: colors.accent100 }]}>
                      {getInitials(shopName || 'StyleFleet')}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.storeTextCol}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  ellipsizeMode="tail"
                  style={[
                    styles.storeTitle,
                    {
                      fontSize:
                        (shopName || 'StyleFleet').length <= 14
                          ? 19
                          : (shopName || 'StyleFleet').length <= 22
                          ? 16
                          : 14,
                    },
                  ]}
                >
                  {shopName || 'StyleFleet'}
                </Text>
                <Text numberOfLines={1} style={[styles.greetingSub, { color: colors.accent }]}>
                  {greeting.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={onNavigateReminders}
                style={[styles.circleActionBtn, { borderColor: 'rgba(217, 164, 65, 0.4)' }]}
              >
                <BellIcon size={18} color={colors.accent} />
                {remindersCount > 0 && <View style={styles.notifBadge} />}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={onNavigateProfile}
                style={[styles.circleActionBtn, { borderColor: 'rgba(217, 164, 65, 0.4)' }]}
              >
                <SettingsIcon size={18} color={colors.accent} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Hero Subtitle / Book Slot & Appointments Column */}
          <View style={styles.heroBottomRow}>
            <View style={{ flex: 1, marginRight: 10, justifyContent: 'center' }}>
              <Text style={[styles.taglineSmall, { color: colors.accent }]}>
                {t('lookGoodFeelGood', 'LOOK GOOD  •  FEEL GOOD')}
              </Text>
              <Text style={styles.heroLine2Cursive} numberOfLines={1}>
                {t('youDeserve', 'You Deserve the Best')}
              </Text>
            </View>

            <View style={styles.heroButtonsCol}>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={onBookSlot}
                style={[styles.bookSlotButton, { backgroundColor: colors.accent }]}
              >
                <CalendarIcon size={13} color="#120E06" strokeWidth={2.2} />
                <Text style={styles.bookSlotText}>{t('bookSlot', 'Book Slot')}</Text>
                <ArrowRightIcon size={10} color="#120E06" strokeWidth={3} />
              </TouchableOpacity>

              {onNavigateAppointments && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={onNavigateAppointments}
                  style={[
                    styles.myAppointmentsButton,
                    {
                      backgroundColor: 'rgba(18, 14, 6, 0.75)',
                      borderColor: colors.accent,
                    },
                  ]}
                  accessibilityLabel={t('myAppointments', 'My Appointments')}
                >
                  <ClockIcon size={12} color={colors.accent} strokeWidth={2} />
                  <Text style={[styles.myAppointmentsText, { color: colors.accent }]}>
                    {t('myAppointments', 'My Appointments')}
                  </Text>
                  <ArrowRightIcon size={9} color={colors.accent} strokeWidth={2.5} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          </SafeAreaView>
        </ImageBackground>
      </View>

      {/* ======================================================== */}
      {/* SCROLLABLE CONTENT BELOW THE 35% PICTURE                 */}
      {/* ======================================================== */}
      <ScrollView
        style={[styles.scrollArea, { backgroundColor: colors.bg }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. SALES PROGRESS BAR CONTAINER */}
        <View
          style={[
            styles.progressCard,
            { backgroundColor: colors.surface, borderColor: colors.divider },
          ]}
        >
          <View style={styles.progressHeaderRow}>
            <Text style={[styles.salesCountText, { color: colors.text }]}>
              {totalSalesCount}/100 sales
            </Text>

            <TouchableOpacity
              style={[styles.upgradeBtn, { backgroundColor: colors.accent }]}
              activeOpacity={0.85}
              onPress={onUpgradePlan}
            >
              <Text style={styles.upgradeBtnText}>Upgrade</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: colors.trackBg }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(Math.round((totalSalesCount / 100) * 100), 100)}%`,
                  backgroundColor: colors.accent,
                },
              ]}
            />
          </View>
        </View>


        {/* 3. SALES HISTOGRAM (VISIBLE BELOW PROGRESS BAR CONTAINER) */}
        <View
          style={[
            styles.histogramCard,
            { backgroundColor: colors.surface, borderColor: colors.divider },
          ]}
        >
          {/* Period Selector Tabs */}
          <View style={[styles.periodTabsRow, { borderColor: colors.divider }]}>
            {(['Day', 'Week', 'Month'] as const).map((p) => {
              const isSelected = period === p;
              return (
                <TouchableOpacity
                  key={p}
                  activeOpacity={0.8}
                  onPress={() => setPeriod(p)}
                  style={[
                    styles.periodTab,
                    {
                      backgroundColor: isSelected ? colors.accent900 : 'transparent',
                      borderWidth: isSelected ? 1 : 0,
                      borderColor: isSelected ? colors.accent : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.periodTabText,
                      {
                        color: isSelected ? colors.accent : colors.textMuted,
                      },
                    ]}
                  >
                    {t(p.toLowerCase(), p)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Total Sales & Delta */}
          <View style={styles.totalRow}>
            <Text style={[styles.totalAmount, { color: colors.text }]}>
              {inrFromMinor(metrics.total_minor)}
            </Text>
            <Text
              style={[
                styles.deltaText,
                { color: isUp ? colors.accent : colors.neutral400 },
              ]}
            >
              {deltaLabel}
            </Text>
          </View>
          <Text style={[styles.subLabel, { color: colors.textDim }]}>
            {metrics.sub_label}
          </Text>

          {/* Histogram Bars */}
          <View style={styles.chartContainer}>
            {metrics.bars.map((bar, i) => {
              const isTodayOrNow = bar.label === 'Today' || bar.label.includes('Now');
              const hasSales = bar.amt_minor > 0;
              return (
                <View key={i} style={styles.barColumn}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.round((bar.height_pct / 100) * 64) + 4,
                        backgroundColor: hasSales
                          ? colors.accent
                          : isTodayOrNow
                          ? colors.accent800
                          : colors.trackBg,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.barLabel,
                      {
                        color: isTodayOrNow ? colors.accent : colors.textDim,
                        fontWeight: isTodayOrNow ? '700' : '400',
                      },
                    ]}
                  >
                    {bar.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* 4. RECENT BILLS */}
        <View style={styles.billsSection}>
          <View style={styles.billsListHeader}>
            <Text style={[styles.billsListTitle, { color: colors.text }]}>
              {t('recentBills', 'Recent Bills')} ({recentBills.length})
            </Text>
            <Text style={[styles.billsListSub, { color: colors.textSubtle }]}>
              {t('tapToView', 'tap to view')}
            </Text>
          </View>

          {recentBills.length === 0 ? (
            <View
              style={[
                styles.emptyBillsBox,
                { backgroundColor: colors.surface, borderColor: colors.divider },
              ]}
            >
              <Text style={[styles.emptyBillsTitle, { color: colors.text }]}>
                {t('noBillsYet', 'No bills recorded yet')}
              </Text>
              <Text style={[styles.emptyBillsSub, { color: colors.textDim }]}>
                {t('billsRecordedHere', 'Your recent customer bills and sales will appear here.')}
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.billsCard,
                { backgroundColor: colors.surface, borderColor: colors.divider },
              ]}
            >
              {recentBills.map((b, idx) => {
                const isPartiallyPaid = b.status === 'partially_paid';
                const isPending = b.status === 'pending';
                const dueMinor = b.due_amount_minor ?? (isPending ? b.total_minor : 0);
                const paidMinor =
                  b.paid_amount_minor ?? (isPending ? 0 : Math.max(0, b.total_minor - dueMinor));
                const isDueBill = b.notes?.includes('due') || b.invoice_number?.startsWith('DUE');
                const whatText =
                  b.items && b.items.length > 0
                    ? b.items.map((it) => it.service_name_snapshot).join(', ')
                    : isDueBill
                    ? 'Opening Due / Settlement'
                    : 'Salon Service';

                const formattedDate =
                  b.issued_at ||
                  (b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN') : '');

                return (
                  <TouchableOpacity
                    key={b.id || b.invoice_number}
                    activeOpacity={0.7}
                    onPress={() => onOpenInvoice(b)}
                    style={[
                      styles.billRow,
                      {
                        borderBottomColor:
                          idx < recentBills.length - 1 ? colors.divider : 'transparent',
                      },
                    ]}
                  >
                    <Text style={[styles.billTime, { color: colors.textDim }]}>
                      {formattedDate}
                    </Text>
                    <View style={styles.billMain}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.billCust, { color: colors.text }]}>
                          {b.customer_name}
                        </Text>
                        {(b.is_edited || b.notes?.includes('[Edited]')) && (
                          <View
                            style={{
                              backgroundColor: 'rgba(217, 164, 65, 0.18)',
                              paddingHorizontal: 5,
                              paddingVertical: 1,
                              borderRadius: 4,
                              borderWidth: 1,
                              borderColor: colors.accent,
                            }}
                          >
                            <Text style={{ fontSize: 9, color: colors.accent, fontWeight: '700' }}>
                              Edited
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text numberOfLines={1} style={[styles.billWhat, { color: colors.textDim }]}>
                        {whatText} · {b.staff_name || 'Staff'}
                      </Text>
                    </View>
                    <View style={styles.billRight}>
                      <Text style={[styles.billAmt, { color: colors.text }]}>
                        {inrFromMinor(b.total_minor)}
                      </Text>
                      {isPartiallyPaid ? (
                        <View style={styles.statusRow}>
                          <Text style={{ fontSize: 10, color: '#16a34a', fontWeight: '600' }}>
                            Paid {inrFromMinor(paidMinor)}
                          </Text>
                          <Text style={{ fontSize: 10, color: '#f59e0b', fontWeight: '600' }}>
                            · Due {inrFromMinor(dueMinor)}
                          </Text>
                        </View>
                      ) : isPending ? (
                        <View style={styles.dueBadge}>
                          <Text style={styles.dueBadgeText}>DUE</Text>
                        </View>
                      ) : (
                        <View style={styles.paidBadge}>
                          <Text style={styles.paidBadgeText}>PAID</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },


  heroContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  heroBgImage: {
    width: '100%',
    height: '100%',
  },
  heroBgImageStyle: {
    resizeMode: 'cover',
    opacity: 0.88,
  },
  darkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8, 9, 13, 0.45)',
  },
  heroSafeArea: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  storeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 15, 20, 0.7)',
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInitials: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  storeTextCol: {
    marginLeft: 10,
    flex: 1,
    minWidth: 0,
  },
  storeTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: fontFamilies.bold,
  },
  greetingSub: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginTop: 2,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  circleActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.2,
    backgroundColor: 'rgba(12, 13, 18, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF3B30',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },


  heroBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 2,
  },
  taglineSmall: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  heroLine2Cursive: {
    color: '#FFFFFF',
    fontSize: 15,
    fontStyle: 'italic',
    fontFamily: fontFamilies.semiBold,
    marginTop: 2,
  },
  heroButtonsCol: {
    alignItems: 'stretch',
    gap: 6,
    minWidth: 126,
  },
  bookSlotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    gap: 6,
    ...shadows.sm,
  },
  bookSlotText: {
    color: '#120E06',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  myAppointmentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    gap: 5,
    ...shadows.sm,
  },
  myAppointmentsText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  progressCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  salesCountText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  upgradeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radii.sm,
  },
  upgradeBtnText: {
    color: '#0D0F14',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  histogramCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  periodTabsRow: {
    flexDirection: 'row',
    borderRadius: radii.sm,
    overflow: 'hidden',
    marginBottom: 12,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: radii.sm,
  },
  periodTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  deltaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  subLabel: {
    fontSize: 11,
    marginTop: 2,
    marginBottom: 10,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 86,
    gap: 8,
    paddingTop: 8,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 10,
    marginTop: 4,
  },
  billsSection: {
    marginTop: 2,
  },
  billsListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  billsListTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  billsListSub: {
    fontSize: 11,
  },
  billsCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  billTime: {
    fontSize: 10.5,
    width: 68,
  },
  billMain: {
    flex: 1,
    marginRight: 8,
  },
  billCust: {
    fontSize: 13,
    fontWeight: '600',
  },
  billWhat: {
    fontSize: 11,
    marginTop: 1,
  },
  billRight: {
    alignItems: 'flex-end',
  },
  billAmt: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  dueBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  dueBadgeText: {
    fontSize: 9,
    color: '#991b1b',
    fontWeight: '700',
  },
  paidBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  paidBadgeText: {
    fontSize: 9,
    color: '#22c55e',
    fontWeight: '700',
  },
  emptyBillsBox: {
    padding: 20,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyBillsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyBillsSub: {
    fontSize: 12,
    textAlign: 'center',
  },
});
