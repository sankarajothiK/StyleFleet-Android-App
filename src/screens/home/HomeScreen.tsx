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
} from '../../components/common/SvgIcons';
import { Appointment, Bill, Customer, Period, Service, StaffMember } from '../../types/domain';
import { financialService } from '../../services/financialService';
import { inr, inrFromMinor, getInitials, formatTimeDisplay } from '../../utils/format';
import { fontFamilies } from '../../theme/typography';
import { useQuickBook } from '../../hooks/useQuickBook';
import { QuickBookSuggestion } from '../../services/quickBookService';
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

  const todayAppointments = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const end = start + 24 * 60 * 60 * 1000;
    return appointments
      .filter((a) => {
        if (!a || a.is_deleted) return false;
        const ts = new Date(a.starts_at).getTime();
        return !isNaN(ts) && ts >= start && ts < end;
      })
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [appointments]);

  const todayActiveCount = useMemo(
    () => todayAppointments.filter((a) => a.status !== 'Cancelled').length,
    [todayAppointments]
  );

  // Money still owed on open bills (same due rule as the bill rows below)
  const pendingDuesMinor = useMemo(() => {
    return activeBills.reduce((sum, b) => {
      const isPending = b.status === 'pending';
      const due = b.due_amount_minor ?? (isPending ? b.total_minor : 0);
      return sum + (due > 0 ? due : 0);
    }, 0);
  }, [activeBills]);

  const statusLabel = (s: Appointment['status']): string => {
    switch (s) {
      case 'Confirmed':
        return t('statusConfirmed', s);
      case 'Not confirmed':
        return t('statusNotConfirmed', s);
      case 'In chair':
        return t('statusInChair', s);
      case 'Done':
        return t('statusDone', s);
      default:
        return t('statusCancelled', s);
    }
  };
  const statusColor = (s: Appointment['status']): string =>
    s === 'Done' || s === 'Confirmed'
      ? colors.success
      : s === 'Cancelled'
      ? colors.textDim
      : s === 'In chair'
      ? colors.accent
      : colors.textMuted;

  const border = { borderColor: colors.border };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* HEADER: theme, language, reminders, shop name */}
      <SafeAreaView edges={['top']}>
        <View style={styles.simpleHeader}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setThemeMode(colors.isDark ? 'light' : 'dark')}
              accessibilityRole="switch"
              accessibilityState={{ checked: colors.isDark }}
              accessibilityLabel={t('theme', 'Theme')}
              style={[styles.themeSwitch, border]}
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

            <View style={[styles.headerRightGroup, narrow && { gap: 6 }]}>
              <View style={[styles.langPill, border]}>
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
                          { color: active ? ON_ACCENT : colors.textMuted },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={onNavigateReminders}
                accessibilityLabel={t('reminders', 'Reminders')}
                style={[styles.circleActionBtn, border]}
              >
                <BellIcon size={18} color={colors.text} />
                {remindersCount > 0 && <View style={styles.notifBadge} />}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.storeInfoRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onNavigateProfile}
              style={[styles.logoCircle, border]}
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
                style={[styles.storeTitle, { color: colors.text }]}
              >
                {shopName || 'StyleFleet'}
              </Text>
              <Text numberOfLines={1} style={[styles.pageTitle, { color: colors.textMuted }]}>
                {t('dashTitle', 'Dashboard')}
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        refreshControl={pullRefresh}
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* SUMMARY: period switch + four figures */}
        <View style={styles.periodRow}>
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
                  { borderColor: isSelected ? colors.accent : colors.border },
                  isSelected && { backgroundColor: colors.accent },
                ]}
              >
                <Text style={[styles.periodBtnText, { color: isSelected ? ON_ACCENT : colors.textMuted }]}>
                  {p === 'Day' ? t('today', 'Today') : t(p.toLowerCase(), p)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.metricsGrid, { borderColor: colors.divider }]}>
          <View style={[styles.metric, styles.metricRight, { borderColor: colors.divider }]}>
            <Text numberOfLines={1} style={[styles.metricLabel, { color: colors.textMuted }]}>
              {t('dashRevenue', 'Revenue')} · {periodLabel}
            </Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.metricValue, { color: colors.text }]}>
              {inrFromMinor(metrics.total_minor)}
            </Text>
            <Text numberOfLines={1} style={[styles.metricSub, { color: isUp ? colors.accent : colors.neutral400 }]}>
              {deltaLabel}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text numberOfLines={1} style={[styles.metricLabel, { color: colors.textMuted }]}>
              {t('appointments', 'Appointments')} · {t('today', 'Today')}
            </Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>{todayActiveCount}</Text>
          </View>
          <View style={[styles.metric, styles.metricRight, styles.metricBottom, { borderColor: colors.divider }]}>
            <Text numberOfLines={1} style={[styles.metricLabel, { color: colors.textMuted }]}>
              {t('dashBills', 'Bills')} · {periodLabel}
            </Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>{metrics.bills_count}</Text>
          </View>
          <View style={[styles.metric, styles.metricBottom, { borderColor: colors.divider }]}>
            <Text numberOfLines={1} style={[styles.metricLabel, { color: colors.textMuted }]}>
              {t('dashPending', 'Pending dues')}
            </Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.metricValue, { color: colors.text }]}>
              {inrFromMinor(pendingDuesMinor)}
            </Text>
          </View>
        </View>

        {/* PRIMARY ACTION */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={onBookSlot}
          accessibilityRole="button"
          accessibilityLabel={t('newBooking', 'New booking')}
          style={[styles.newBookingBtn, { backgroundColor: colors.accent }]}
        >
          <CalendarIcon size={18} color={ON_ACCENT} strokeWidth={2.2} />
          <Text style={styles.newBookingText}>{t('newBooking', 'New booking')}</Text>
        </TouchableOpacity>

        {/* TODAY'S APPOINTMENTS */}
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('dashTodayAppts', "Today's appointments")}
          </Text>
          {onNavigateAppointments && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onNavigateAppointments}
              accessibilityLabel={t('myAppointments', 'My Appointments')}
              style={styles.viewAll}
            >
              <Text style={[styles.viewAllText, { color: colors.accent }]}>{t('dashViewAll', 'View all')}</Text>
              <ArrowRightIcon size={12} color={colors.accent} strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>
        {todayAppointments.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textDim }]}>
            {t('dashNoApptsToday', 'No appointments today')}
          </Text>
        ) : (
          <View style={[styles.list, { borderColor: colors.divider }]}>
            {todayAppointments.map((a) => (
              <TouchableOpacity
                key={a.id}
                activeOpacity={onNavigateAppointments ? 0.7 : 1}
                onPress={onNavigateAppointments}
                disabled={!onNavigateAppointments}
                style={[styles.row, { borderBottomColor: colors.divider }]}
              >
                <Text style={[styles.rowTime, { color: colors.textMuted }]}>{formatTimeDisplay(a.starts_at)}</Text>
                <View style={styles.rowMain}>
                  <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.text }]}>
                    {a.customer_name}
                  </Text>
                  <Text numberOfLines={1} style={[styles.rowSub, { color: colors.textDim }]}>
                    {a.service_name} · {a.staff_name}
                  </Text>
                </View>
                <Text numberOfLines={1} style={[styles.rowStatus, { color: statusColor(a.status) }]}>
                  {statusLabel(a.status)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* BOOK AGAIN */}
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('bookAgain', 'Book again')}</Text>
        </View>
        {quick.recentCustomers.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textDim }]}>
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
              <View style={[styles.faceAvatar, { borderColor: colors.border }]}>
                <PlusIcon size={18} color={colors.textMuted} />
              </View>
              <Text numberOfLines={1} style={[styles.faceName, { color: colors.text }]}>
                {t('moreCustomers', 'More')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {quick.suggestion && (
          <View style={[styles.suggestCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[styles.suggestHint, { color: colors.textMuted }]}>
              {t('sameAsLast', 'Same as last time?')}
            </Text>
            <View style={styles.suggestRow}>
              <UsersIcon size={18} color={colors.textMuted} />
              <Text numberOfLines={2} style={[styles.suggestMain, { color: colors.text }]}>
                {quick.suggestion.customer.name}
              </Text>
            </View>
            <View style={styles.suggestRow}>
              <SparklesIcon size={18} color={colors.textMuted} />
              <Text numberOfLines={1} style={[styles.suggestMain, { color: colors.text }]}>
                {quick.suggestion.services.map((s) => s.name).join(' + ')}
              </Text>
              <Text style={[styles.suggestSide, { color: colors.textMuted }]}>
                {inr(quick.suggestion.amountRupees)}
              </Text>
            </View>
            <View style={styles.suggestRow}>
              <ClockIcon size={18} color={colors.textMuted} />
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
                <CheckIcon size={20} color={ON_SUCCESS} />
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

        {/* RECENT BILLS */}
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('recentBills', 'Recent Bills')}
          </Text>
        </View>
        {recentBills.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textDim }]}>
            {t('noBillsYet', 'No bills recorded yet')}
          </Text>
        ) : (
          <View style={[styles.list, { borderColor: colors.divider }]}>
            {recentBills.map((b) => {
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
                  style={[styles.row, { borderBottomColor: colors.divider }]}
                >
                  <Text style={[styles.billTime, { color: colors.textDim }]}>{formattedDate}</Text>
                  <View style={styles.rowMain}>
                    <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.text }]}>
                      {b.customer_name}
                      {(b.is_edited || b.notes?.includes('[Edited]')) && (
                        <Text style={[styles.editedTag, { color: colors.accent }]}> · Edited</Text>
                      )}
                    </Text>
                    <Text numberOfLines={1} style={[styles.rowSub, { color: colors.textDim }]}>
                      {whatText} · {b.staff_name || 'Staff'}
                    </Text>
                  </View>
                  <View style={styles.billRight}>
                    <Text style={[styles.billAmt, { color: colors.text }]}>{inrFromMinor(b.total_minor)}</Text>
                    {isPartiallyPaid ? (
                      <Text style={[styles.billState, { color: '#f59e0b' }]}>
                        Paid {inrFromMinor(paidMinor)} · Due {inrFromMinor(dueMinor)}
                      </Text>
                    ) : isPending ? (
                      <Text style={[styles.billState, { color: '#ef4444' }]}>DUE</Text>
                    ) : (
                      <Text style={[styles.billState, { color: colors.success }]}>PAID</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  simpleHeader: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, gap: 10 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  themeSwitch: {
    width: 62,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    padding: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeKnob: { position: 'absolute', top: 3, left: 3, width: 28, height: 26, borderRadius: 13 },
  themeSlot: { width: 28, height: 26, alignItems: 'center', justifyContent: 'center' },
  headerRightGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  langPill: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  langSeg: { paddingHorizontal: 9, paddingVertical: 6, fontSize: 13, fontWeight: '700', fontFamily: fontFamilies.bold },
  circleActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF3B30',
  },
  storeInfoRow: { flexDirection: 'row', alignItems: 'center' },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImg: { width: '100%', height: '100%' },
  logoPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  logoInitials: { fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  storeTextCol: { marginLeft: 10, flex: 1, minWidth: 0 },
  storeTitle: { fontSize: 17, fontWeight: '700', fontFamily: fontFamilies.bold },
  pageTitle: { fontSize: 12, fontWeight: '500', fontFamily: fontFamilies.medium, marginTop: 1 },
  scrollArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 36 },

  periodRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  periodBtn: {
    paddingHorizontal: 12,
    minHeight: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodBtnText: { fontSize: 12.5, fontWeight: '600', fontFamily: fontFamilies.semiBold },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderBottomWidth: 1 },
  metric: { width: '50%', paddingVertical: 12, paddingHorizontal: 12 },
  metricRight: { borderRightWidth: 1 },
  metricBottom: { borderTopWidth: 1 },
  metricLabel: { fontSize: 11.5, fontWeight: '500', fontFamily: fontFamilies.medium },
  metricValue: { fontSize: 22, fontWeight: '700', fontFamily: fontFamilies.bold, marginTop: 3 },
  metricSub: { fontSize: 11, fontWeight: '600', fontFamily: fontFamilies.semiBold, marginTop: 2 },

  newBookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: 10,
    marginTop: 14,
  },
  newBookingText: { color: ON_ACCENT, fontSize: 15, fontWeight: '700', fontFamily: fontFamilies.bold },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', fontFamily: fontFamilies.bold },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewAllText: { fontSize: 13, fontWeight: '600', fontFamily: fontFamilies.semiBold },
  emptyText: { fontSize: 13, paddingVertical: 4 },

  list: { borderTopWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, gap: 10 },
  rowTime: { width: 64, fontSize: 12, fontWeight: '600', fontFamily: fontFamilies.semiBold },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 13.5, fontWeight: '600', fontFamily: fontFamilies.semiBold },
  rowSub: { fontSize: 11.5, marginTop: 1 },
  rowStatus: { fontSize: 11.5, fontWeight: '600', fontFamily: fontFamilies.semiBold, maxWidth: 96, textAlign: 'right' },
  billTime: { fontSize: 10.5, width: 64 },
  billRight: { alignItems: 'flex-end', maxWidth: 150 },
  billAmt: { fontSize: 13.5, fontWeight: '700', fontFamily: fontFamilies.bold },
  billState: { fontSize: 10.5, fontWeight: '700', marginTop: 2, textAlign: 'right' },
  editedTag: { fontSize: 11, fontWeight: '600' },

  facesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  face: { width: 72, alignItems: 'center' },
  faceAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  faceInitials: { color: ON_ACCENT, fontSize: 13.5, fontWeight: '700', fontFamily: fontFamilies.bold },
  faceName: { fontSize: 12, lineHeight: 15, textAlign: 'center', fontWeight: '500', fontFamily: fontFamilies.medium },

  suggestCard: { borderRadius: 10, borderWidth: 1, padding: 14, marginTop: 8 },
  suggestHint: { fontSize: 13, marginBottom: 10 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  suggestMain: { flex: 1, fontSize: 15, fontWeight: '600', fontFamily: fontFamilies.semiBold },
  suggestSide: { fontSize: 13, fontWeight: '500', fontFamily: fontFamilies.medium },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 10,
    marginTop: 6,
  },
  confirmText: { color: ON_SUCCESS, fontSize: 16, fontWeight: '700', fontFamily: fontFamilies.bold },
  changeLink: { alignItems: 'center', paddingTop: 12, paddingBottom: 2 },
  changeText: { fontSize: 14, fontWeight: '500', fontFamily: fontFamilies.medium },
});
