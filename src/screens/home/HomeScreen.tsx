import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  Platform,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { LanguageCode } from '../../i18n/translations';
import {
  BellIcon,
  SunIcon,
  MoonIcon,
  CalendarIcon,
  ClockIcon,
  ArrowRightIcon,
  SparklesIcon,
  CheckIcon,
  PlusIcon,
  UsersIcon,
  ChevronDownIcon,
} from '../../components/common/SvgIcons';
import { Appointment, Bill, Customer, Period, Service, StaffMember } from '../../types/domain';
import { financialService } from '../../services/financialService';
import { inr, inrFromMinor, getInitials } from '../../utils/format';
import { radii, shadows } from '../../theme/spacing';
import { fontFamilies } from '../../theme/typography';
import { useQuickBook } from '../../hooks/useQuickBook';
import { QuickBookSuggestion } from '../../services/quickBookService';
import { getGlass } from '../../theme/glass';
import { GlassBackdrop } from '../../components/common/GlassBackdrop';
import { usePullRefresh } from '../../hooks/usePullRefresh';

interface HomeScreenProps {
  onRefresh?: () => Promise<void>;
  shopId?: string;
  shopName?: string;
  logoUrl?: string | null;
  remindersCount?: number;
  bills?: Bill[];
  totalSalesCount?: number;
  customers?: Customer[];
  appointments?: Appointment[];
  services?: Service[];
  staff?: StaffMember[];
  ownerName?: string;
  shopCreatedAt?: string;
  isPro?: boolean;
  onBookSlot: () => void;
  /** Owners only. When missing, the warning shows without an Upgrade button. */
  onUpgradePlan?: () => void;
  /** Save the suggested booking. Resolves true when saved; must show its own error otherwise. */
  onQuickConfirm: (suggestion: QuickBookSuggestion) => Promise<boolean>;
  /** Open the full booking screen for a customer, prefilled from the suggestion when there is one. */
  onBookForCustomer: (customer: Customer, suggestion: QuickBookSuggestion | null) => void;
  onNavigateAppointments?: () => void;
  onNavigateReminders: () => void;
  onNavigateProfile: () => void;
  onOpenInvoice: (bill: Bill) => void;
  /** The logged-in stylist's id (stylist sessions only): "Book again" books for them. */
  preferredStaffId?: string | null;
}

// Text colour on the gold and green buttons (dark on bright, for contrast)
const ON_ACCENT = '#0D0E11';
const ON_SUCCESS = '#04200F';

// Quick language switch on Home (all languages stay available in settings)
const LANG_OPTIONS: { code: LanguageCode; label: string; name: string }[] = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'hi', label: 'हिं', name: 'Hindi' },
  { code: 'ta', label: 'தமிழ்', name: 'Tamil' },
];

// Soft tints for customer initials circles
const FACE_TINTS = ['#E0C068', '#9FE1CB', '#F5C4B3', '#B5D4F4', '#CECBF6'];
const faceTint = (name: string): string => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997;
  return FACE_TINTS[h % FACE_TINTS.length];
};

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
  onRefresh,
  shopId,
  shopName = 'StyleFleet',
  logoUrl = null,
  remindersCount = 0,
  bills = [],
  customers = [],
  appointments = [],
  services = [],
  staff = [],
  ownerName = 'Owner',
  shopCreatedAt,
  onBookSlot,
  onQuickConfirm,
  onBookForCustomer,
  onNavigateAppointments,
  onNavigateReminders,
  onNavigateProfile,
  onOpenInvoice,
  preferredStaffId = null,
}: HomeScreenProps) => {
  const pullRefresh = usePullRefresh(onRefresh);
  const { colors, setThemeMode } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const narrow = screenWidth < 350;
  const themeKnob = useRef(new Animated.Value(colors.isDark ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(themeKnob, { toValue: colors.isDark ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [colors.isDark, themeKnob]);
  const { t, language, setLanguage } = useLanguage();
  const [period, setPeriod] = useState<Period>('Day');
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [billsOpen, setBillsOpen] = useState(false);

  const quick = useQuickBook({
    shopId,
    customers,
    appointments,
    bills,
    services,
    staff,
    ownerName,
    preferredStaffId,
    onConfirm: onQuickConfirm,
  });

  const glass = getGlass(colors.isDark);
  const periodLabel =
    period === 'Day'
      ? t('today', 'Today')
      : period === 'Week'
      ? t('thisWeek', 'This week')
      : t('thisMonth', 'This month');

  const slotText = (s: QuickBookSuggestion): string => {
    const day =
      s.dayOffset === 0
        ? t('today', 'Today')
        : s.dayOffset === 1
        ? t('tomorrow', 'Tomorrow')
        : s.weekdayLabel;
    return `${day} ${s.slot.replace(/^0/, '')}`;
  };

  const handleFacePress = (c: Customer) => {
    if (quick.isSubmitting) return;
    if (quick.suggestion?.customer.id === c.id) {
      quick.clear();
      return;
    }
    const next = quick.select(c);
    // Nothing reliable to suggest (no past service, service removed, no free slot): open the full screen
    if (!next) onBookForCustomer(c, null);
  };


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
      <GlassBackdrop isDark={colors.isDark} />
      {/* ======================================================== */}
      {/* 1. SIMPLE HEADER: logo, shop name, language, bell, settings */}
      {/* ======================================================== */}
      <SafeAreaView edges={['top']}>
        <View style={styles.simpleHeader}>
          <View style={styles.headerTopRow}>
          <View style={styles.headerLeftGroup}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setThemeMode(colors.isDark ? 'light' : 'dark')}
            accessibilityRole="switch"
            accessibilityState={{ checked: colors.isDark }}
            accessibilityLabel={t('theme', 'Theme')}
            style={[styles.themeSwitch, glass.pill, { borderColor: colors.accent }]}
          >
            <Animated.View
              style={[
                styles.themeKnob,
                {
                  backgroundColor: colors.accent,
                  transform: [{ translateX: themeKnob.interpolate({ inputRange: [0, 1], outputRange: [0, 28] }) }],
                },
              ]}
            />
            <View style={styles.themeSlot}>
              <SunIcon size={15} color={colors.isDark ? colors.textDim : ON_ACCENT} />
            </View>
            <View style={styles.themeSlot}>
              <MoonIcon size={15} color={colors.isDark ? ON_ACCENT : colors.textDim} />
            </View>
          </TouchableOpacity>
          </View>

          <View style={[styles.headerRightGroup, narrow && { gap: 6 }]}>
          <View style={[styles.langPill, glass.pill, { borderColor: colors.accent }]}>
            {LANG_OPTIONS.map((opt) => {
              const active = language === opt.code;
              return (
                <TouchableOpacity
                  key={opt.code}
                  activeOpacity={0.8}
                  onPress={() => setLanguage(opt.code)}
                  accessibilityLabel={opt.name}
                  accessibilityState={{ selected: active }}
                  style={active ? { backgroundColor: colors.accent } : undefined}
                >
                  <Text
                    style={[
                      styles.langSeg,
                      narrow && { paddingHorizontal: 6, fontSize: 12 },
                      { color: active ? ON_ACCENT : colors.accent },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={onNavigateReminders}
              accessibilityLabel={t('reminders', 'Reminders')}
              style={[styles.circleActionBtn, glass.pill, { borderColor: colors.accent }]}
            >
              <BellIcon size={18} color={colors.accent} />
              {remindersCount > 0 && <View style={styles.notifBadge} />}
            </TouchableOpacity>
          </View>
          </View>
          </View>
          <View style={[styles.storeInfoRow, { flex: 0, paddingRight: 0 }]}>
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
                    color: colors.text,
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

        </View>
      </SafeAreaView>

      {/* ======================================================== */}
      {/* SCROLLABLE CONTENT BELOW THE 35% PICTURE                 */}
      {/* ======================================================== */}
      <ScrollView
        refreshControl={pullRefresh}
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* QUICK BOOKING: big button, then "Book again" faces */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={onBookSlot}
          accessibilityRole="button"
          accessibilityLabel={t('newBooking', 'New booking')}
          style={[styles.newBookingBtn, { backgroundColor: colors.accent }]}
        >
          <CalendarIcon size={19} color={ON_ACCENT} strokeWidth={2.2} />
          <Text style={styles.newBookingText}>{t('newBooking', 'New booking')}</Text>
        </TouchableOpacity>

        {onNavigateAppointments && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onNavigateAppointments}
            accessibilityLabel={t('myAppointments', 'My Appointments')}
            style={styles.myApptLink}
          >
            <ClockIcon size={16} color={colors.accent} strokeWidth={2} />
            <Text style={[styles.myApptText, { color: colors.accent }]}>
              {t('myAppointments', 'My Appointments')}
            </Text>
            <ArrowRightIcon size={12} color={colors.accent} strokeWidth={2.5} />
          </TouchableOpacity>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('bookAgain', 'Book again')}
        </Text>
        {quick.recentCustomers.length === 0 ? (
          <Text style={[styles.emptyFaces, { color: colors.textDim }]}>
            {t('noBookAgainYet', 'Past customers will show here')}
          </Text>
        ) : (
          <View style={styles.facesRow}>
            {quick.recentCustomers.map((c) => {
              const isSelected = quick.suggestion?.customer.id === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  activeOpacity={0.8}
                  onPress={() => handleFacePress(c)}
                  accessibilityLabel={c.name}
                  style={styles.face}
                >
                  <View
                    style={[
                      styles.faceAvatar,
                      {
                        backgroundColor: faceTint(c.name),
                        borderColor: isSelected ? colors.success : 'transparent',
                      },
                    ]}
                  >
                    <Text style={styles.faceInitials}>{getInitials(c.name)}</Text>
                  </View>
                  <Text numberOfLines={2} style={[styles.faceName, { color: colors.text }]}>
                    {c.name.trim()}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onBookSlot}
              accessibilityLabel={t('moreCustomers', 'More')}
              style={styles.face}
            >
              <View
                style={[
                  styles.faceAvatar,
                  glass.raised,
                ]}
              >
                <PlusIcon size={18} color={colors.textMuted} />
              </View>
              <Text numberOfLines={1} style={[styles.faceName, { color: colors.text }]}>
                {t('moreCustomers', 'More')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {quick.suggestion && (
          <View
            style={[
              styles.suggestCard,
              glass.raised,
            ]}
          >
            <Text style={[styles.suggestHint, { color: colors.textMuted }]}>
              {t('sameAsLast', 'Same as last time?')}
            </Text>
            <View style={styles.suggestRow}>
              <UsersIcon size={22} color={colors.accent} />
              <Text numberOfLines={2} style={[styles.suggestMain, { color: colors.text }]}>
                {quick.suggestion.customer.name}
              </Text>
            </View>
            <View style={styles.suggestRow}>
              <SparklesIcon size={22} color={colors.accent} />
              <Text numberOfLines={1} style={[styles.suggestMain, { color: colors.text }]}>
                {quick.suggestion.services.map((s) => s.name).join(' + ')}
              </Text>
              <Text style={[styles.suggestSide, { color: colors.textMuted }]}>
                {inr(quick.suggestion.amountRupees)}
              </Text>
            </View>
            <View style={styles.suggestRow}>
              <ClockIcon size={22} color={colors.accent} />
              <Text numberOfLines={1} style={[styles.suggestMain, { color: colors.text }]}>
                {slotText(quick.suggestion)}
              </Text>
              <Text style={[styles.suggestSide, { color: colors.textMuted }]}>
                {quick.suggestion.stylist.name}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.88}
              disabled={quick.isSubmitting}
              onPress={quick.confirm}
              accessibilityRole="button"
              style={[
                styles.confirmBtn,
                { backgroundColor: colors.success, opacity: quick.isSubmitting ? 0.7 : 1 },
              ]}
            >
              {quick.isSubmitting ? (
                <ActivityIndicator color={ON_SUCCESS} />
              ) : (
                <CheckIcon size={26} color={ON_SUCCESS} />
              )}
              <Text style={styles.confirmText}>
                {quick.isSubmitting ? t('booking', 'Booking…') : t('yesBook', 'Yes, book')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              disabled={quick.isSubmitting}
              onPress={() => onBookForCustomer(quick.suggestion!.customer, quick.suggestion)}
              style={styles.changeLink}
            >
              <Text style={[styles.changeText, { color: colors.textMuted }]}>
                {t('changeBooking', 'Change')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 3. SALES: one big number, switch Day / Week / Month */}
        <View
          style={[
            styles.salesCard,
            glass.raised,
          ]}
        >
          <Text style={[styles.salesLabel, { color: colors.textMuted }]}>{periodLabel}</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.salesAmount, { color: colors.text }]}
          >
            {inrFromMinor(metrics.total_minor)}
          </Text>
          <Text style={[styles.salesDelta, { color: isUp ? colors.accent : colors.neutral400 }]}>
            {deltaLabel}
          </Text>

          <View style={[styles.periodRow, glass.inset, { borderWidth: 1, borderRadius: 16, padding: 3 }]}>
            {(['Day', 'Week', 'Month'] as const).map((p) => {
              const isSelected = period === p;
              return (
                <TouchableOpacity
                  key={p}
                  activeOpacity={0.8}
                  onPress={() => setPeriod(p)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.periodBtn,
                    {
                      backgroundColor: isSelected ? colors.accent : 'transparent',
                      borderColor: isSelected ? colors.accent : 'transparent',
                      ...(isSelected
                        ? { shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 4 }
                        : null),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.periodBtnText,
                      { color: isSelected ? ON_ACCENT : colors.text },
                    ]}
                  >
                    {p === 'Day' ? t('today', 'Today') : t(p.toLowerCase(), p)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 4. RECENT BILLS */}
        <View style={styles.billsSection}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setBillsOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: billsOpen }}
            style={[
              styles.billsListHeader,
              glass.raised,
            ]}
          >
            <Text style={[styles.billsListTitle, { color: colors.text }]}>
              {t('recentBills', 'Recent Bills')} ({recentBills.length})
            </Text>
            <View style={billsOpen ? styles.arrowUp : undefined}>
              <ChevronDownIcon size={26} color={colors.accent} />
            </View>
          </TouchableOpacity>

          {billsOpen && (recentBills.length === 0 ? (
            <View
              style={[
                styles.emptyBillsBox,
                glass.raised,
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
                glass.raised,
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
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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


  simpleHeader: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
    gap: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  themeSwitch: {
    width: 62,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.2,
    padding: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeKnob: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 28,
    height: 26,
    borderRadius: 13,
  },
  themeSlot: {
    width: 28,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  langPill: {
    flexDirection: 'row',
    borderWidth: 1.2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  langSeg: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fontFamilies.bold,
  },
  newBookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: 14,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  newBookingText: {
    color: ON_ACCENT,
    fontSize: 15.5,
    fontWeight: '700',
    fontFamily: fontFamilies.bold,
  },
  myApptLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  myApptText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fontFamilies.semiBold,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: fontFamilies.bold,
    marginTop: 4,
    marginBottom: 10,
  },
  emptyFaces: {
    fontSize: 14,
    marginBottom: 14,
  },
  facesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  face: {
    width: 72,
    alignItems: 'center',
  },
  faceAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  faceInitials: {
    color: ON_ACCENT,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fontFamilies.bold,
  },
  faceName: {
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
    fontWeight: '500',
    fontFamily: fontFamilies.medium,
  },
  suggestCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  suggestHint: {
    fontSize: 14,
    marginBottom: 12,
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  suggestMain: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    fontFamily: fontFamilies.semiBold,
  },
  suggestSide: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: fontFamilies.medium,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 58,
    borderRadius: 16,
    marginTop: 8,
  },
  confirmText: {
    color: ON_SUCCESS,
    fontSize: 19,
    fontWeight: '700',
    fontFamily: fontFamilies.bold,
  },
  changeLink: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 2,
  },
  changeText: {
    fontSize: 15,
    fontWeight: '500',
    fontFamily: fontFamilies.medium,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  billsSection: {
    marginTop: 2,
  },
  salesCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  salesLabel: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fontFamilies.semiBold,
  },
  salesAmount: {
    fontSize: 30,
    fontWeight: '800',
    fontFamily: fontFamilies.extraBold,
    marginTop: 2,
    maxWidth: '100%',
  },
  salesDelta: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fontFamilies.semiBold,
    marginTop: 2,
    marginBottom: 10,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'stretch',
  },
  periodBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodBtnText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fontFamilies.bold,
  },
  billsListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  arrowUp: {
    transform: [{ rotate: '180deg' }],
  },
  billsListTitle: {
    fontSize: 14,
    fontWeight: '700',
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
