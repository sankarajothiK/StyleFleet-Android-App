import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Period, Bill } from '../../types/domain';
import { financialService } from '../../services/financialService';
import { inrFromMinor, shortInrFromMinor } from '../../utils/format';
import { PlusIcon } from '../../components/common/SvgIcons';
import { radii, shadows } from '../../theme/spacing';

interface SalesScreenProps {
  bills: Bill[];
  shopName?: string;
  onOpenInvoice: (bill: Bill) => void;
  onNewBill: () => void;
  onRestoreBill?: (billId: string) => Promise<void>;
}

export const SalesScreen = ({
  bills,
  shopName = 'Salon',
  onOpenInvoice,
  onNewBill,
  onRestoreBill,
}: SalesScreenProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>('Day');
  const [activeTabSub, setActiveTabSub] = useState<'active' | 'deleted'>('active');

  // Separate active bills vs recently deleted bills (30 days)
  const { activeBills, deletedBills } = React.useMemo(() => {
    const seen = new Set<string>();
    const active: Bill[] = [];
    const deleted: Bill[] = [];
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const b of bills) {
      if (!b) continue;
      if (b.id && seen.has(b.id)) continue;
      if (b.invoice_number && seen.has(b.invoice_number)) continue;
      if (b.id) seen.add(b.id);
      if (b.invoice_number) seen.add(b.invoice_number);

      if (b.status === 'deleted') {
        const delTime = b.deleted_at
          ? new Date(b.deleted_at).getTime()
          : b.created_at
          ? new Date(b.created_at).getTime()
          : b.issued_at
          ? new Date(b.issued_at).getTime()
          : now;
        if (now - delTime <= thirtyDaysMs) {
          deleted.push(b);
        }
      } else {
        active.push(b);
      }
    }
    return { activeBills: active, deletedBills: deleted };
  }, [bills]);

  const metrics = financialService.getSalesMetrics(period, activeBills);
  const deltaPct =
    metrics.prev_minor > 0
      ? Math.round((Math.abs(metrics.total_minor - metrics.prev_minor) / metrics.prev_minor) * 100)
      : 0;
  const isUp = metrics.total_minor >= metrics.prev_minor;
  const deltaLabel = metrics.prev_minor > 0
    ? `${isUp ? '▲ ' : '▼ '}${deltaPct}% ${t('vsLast', 'vs last')} ${t(period.toLowerCase(), period)}`
    : '0% change';

  const todayHeaderStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.title, { color: colors.text }]}>{t('sales', 'Sales')}</Text>
          <Text style={[styles.todayLabel, { color: colors.textDim }]}>
            {todayHeaderStr}
          </Text>
        </View>

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
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Total & Delta */}
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

        {/* Bar Chart */}
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
                      height: Math.round((bar.height_pct / 100) * 72) + 4,
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

        {/* 2-Column Info Grid */}
        <View style={styles.metricsGrid}>
          {/* Collected via */}
          <View style={[styles.metricCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.metricCardLabel, { color: colors.textDim }]}>
              COLLECTED VIA
            </Text>
            {metrics.modes.map((m, idx) => (
              <View key={idx} style={styles.modeRow}>
                <Text style={[styles.modeLabel, { color: colors.text }]}>{m.label}</Text>
                <View
                  style={[
                    styles.modeProgressBar,
                    { backgroundColor: colors.trackBg },
                  ]}
                >
                  <View
                    style={[
                      styles.modeProgressFill,
                      { width: `${m.pct}%`, backgroundColor: colors.accent },
                    ]}
                  />
                </View>
                <Text style={[styles.modeAmount, { color: colors.textMuted }]}>
                  {shortInrFromMinor(m.amt_minor)}
                </Text>
              </View>
            ))}
          </View>

          {/* Bills count & Top service */}
          <View style={styles.metricCardColumn}>
            <View style={[styles.metricCardSmall, { backgroundColor: colors.surface }]}>
              <Text style={[styles.metricCardLabel, { color: colors.textDim }]}>
                BILLS
              </Text>
              <Text style={[styles.billsCountText, { color: colors.text }]}>
                {metrics.bills_count}
              </Text>
              <Text style={[styles.avgBillText, { color: colors.textDim }]}>
                avg {inrFromMinor(metrics.avg_bill_minor)}
              </Text>
            </View>

            <View style={[styles.metricCardSmall, { backgroundColor: colors.surface }]}>
              <Text style={[styles.metricCardLabel, { color: colors.textDim }]}>
                TOP SERVICE
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.topServiceText, { color: colors.text }]}
              >
                {metrics.top_service}
              </Text>
            </View>
          </View>
        </View>

        {/* Bills list header with Tabs */}
        <View style={[styles.billsListHeader, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setActiveTabSub('active')}
              activeOpacity={0.8}
              style={{
                paddingVertical: 5,
                paddingHorizontal: 10,
                borderRadius: radii.sm,
                backgroundColor: activeTabSub === 'active' ? colors.accent900 : 'transparent',
                borderWidth: 1,
                borderColor: activeTabSub === 'active' ? colors.accent : 'transparent',
              }}
            >
              <Text style={{ color: activeTabSub === 'active' ? colors.accent200 : colors.textDim, fontWeight: '600', fontSize: 13 }}>
                Recent Bills ({activeBills.length})
              </Text>
            </TouchableOpacity>

            {deletedBills.length > 0 && (
              <TouchableOpacity
                onPress={() => setActiveTabSub('deleted')}
                activeOpacity={0.8}
                style={{
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                  borderRadius: radii.sm,
                  backgroundColor: activeTabSub === 'deleted' ? 'rgba(239,68,68,0.15)' : 'transparent',
                  borderWidth: 1,
                  borderColor: activeTabSub === 'deleted' ? '#EF4444' : 'transparent',
                }}
              >
                <Text style={{ color: activeTabSub === 'deleted' ? '#EF4444' : colors.textDim, fontWeight: '600', fontSize: 13 }}>
                  Recently Deleted ({deletedBills.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={[styles.billsListSub, { color: colors.textSubtle }]}>
            tap to view
          </Text>
        </View>

        <View style={styles.billsList}>
          {activeTabSub === 'deleted' ? (
            deletedBills.length === 0 ? (
              <View style={styles.emptyBillsBox}>
                <Text style={[styles.emptyBillsTitle, { color: colors.text }]}>
                  No recently deleted bills
                </Text>
                <Text style={[styles.emptyBillsSub, { color: colors.textDim }]}>
                  Bills deleted in the last 30 days will appear here.
                </Text>
              </View>
            ) : (
              deletedBills.map((b) => (
                <View
                  key={b.id || b.invoice_number}
                  style={[
                    styles.billRow,
                    { borderBottomColor: colors.divider, opacity: 0.85, alignItems: 'center' },
                  ]}
                >
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                    activeOpacity={0.7}
                    onPress={() => onOpenInvoice(b)}
                  >
                    <Text style={[styles.billTime, { color: colors.textDim }]}>
                      {b.issued_at}
                    </Text>
                    <View style={styles.billMain}>
                      <Text style={[styles.billCust, { color: colors.text, fontWeight: '600' }]}>
                        {b.customer_name}
                      </Text>
                      <Text numberOfLines={1} style={[styles.billWhat, { color: '#EF4444' }]}>
                        Deleted by {b.deleted_by || 'Owner'}{b.deleted_by_role ? ` (${b.deleted_by_role === 'stylist' ? 'Stylist' : 'Owner'})` : ''} · #{b.invoice_number}
                      </Text>
                    </View>
                    <View style={styles.billRight}>
                      <Text style={[styles.billAmt, { color: colors.text, fontWeight: '700' }]}>
                        {inrFromMinor(b.total_minor)}
                      </Text>
                      <Text style={{ fontSize: 10, color: '#EF4444', fontWeight: '600', marginTop: 2 }}>
                        DELETED
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {onRestoreBill && (
                    <TouchableOpacity
                      onPress={() => onRestoreBill(b.id)}
                      activeOpacity={0.8}
                      style={{ marginLeft: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.sm, backgroundColor: '#22C55E' }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '600' }}>Restore</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )
          ) : (
            activeBills.length === 0 ? (
              <View style={styles.emptyBillsBox}>
                <Text style={[styles.emptyBillsTitle, { color: colors.text }]}>
                  {t('noBillsYet', 'No bills recorded yet')}
                </Text>
                <Text style={[styles.emptyBillsSub, { color: colors.textDim }]}>
                  {t('tapNewBill', 'Tap "+ New bill" below to record your first client service and payment.')}
                </Text>
              </View>
            ) : (
              activeBills.map((b) => {
                const isPartiallyPaid = b.status === 'partially_paid';
                const isPending = b.status === 'pending';
                const dueMinor = b.due_amount_minor ?? (isPending ? b.total_minor : 0);
                const paidMinor = b.paid_amount_minor ?? (isPending ? 0 : Math.max(0, b.total_minor - dueMinor));
                const isDueBill = b.notes?.includes('due') || b.invoice_number?.startsWith('DUE');
                const whatText =
                  b.items && b.items.length > 0
                    ? b.items.map((it) => it.service_name_snapshot).join(', ')
                    : isDueBill
                    ? 'Opening Due / Settlement'
                    : 'Salon Service';

                return (
                  <TouchableOpacity
                    key={b.id || b.invoice_number}
                    activeOpacity={0.7}
                    onPress={() => onOpenInvoice(b)}
                    style={[
                      styles.billRow,
                      { borderBottomColor: colors.divider },
                    ]}
                  >
                    <Text style={[styles.billTime, { color: colors.textDim }]}>
                      {b.issued_at}
                    </Text>
                    <View style={styles.billMain}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.billCust, { color: colors.text, fontWeight: '600' }]}>
                          {b.customer_name}
                        </Text>
                        {(b.is_edited || b.notes?.includes('[Edited]')) && (
                          <View style={{ backgroundColor: 'rgba(217, 164, 65, 0.18)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: colors.accent }}>
                            <Text style={{ fontSize: 9, color: colors.accent, fontWeight: '700' }}>
                              {t('edited', 'Edited')}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text
                        numberOfLines={1}
                        style={[styles.billWhat, { color: colors.textDim }]}
                      >
                        {whatText} · {b.staff_name || 'Staff'}
                      </Text>
                    </View>
                    <View style={styles.billRight}>
                      <Text style={[styles.billAmt, { color: colors.text, fontWeight: '700' }]}>
                        {inrFromMinor(b.total_minor)}
                      </Text>
                      {isPartiallyPaid ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Text style={{ fontSize: 10, color: '#16a34a', fontWeight: '600' }}>
                            Paid {inrFromMinor(paidMinor)}
                          </Text>
                          <Text style={{ fontSize: 10, color: '#f59e0b', fontWeight: '600' }}>
                            · Due {inrFromMinor(dueMinor)}
                          </Text>
                          <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 }}>
                            <Text style={{ fontSize: 9, color: '#b45309', fontWeight: '700' }}>PARTIAL</Text>
                          </View>
                        </View>
                      ) : isPending ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Text style={{ fontSize: 10, color: '#ef4444', fontWeight: '600' }}>
                            Due {inrFromMinor(dueMinor)}
                          </Text>
                          <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 }}>
                            <Text style={{ fontSize: 9, color: '#991b1b', fontWeight: '700' }}>DUE</Text>
                          </View>
                        </View>
                      ) : isDueBill ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Text style={{ fontSize: 10, color: '#16a34a', fontWeight: '600' }}>
                            Due Settled
                          </Text>
                          <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 }}>
                            <Text style={{ fontSize: 9, color: '#166534', fontWeight: '700' }}>PAID</Text>
                          </View>
                        </View>
                      ) : (
                        <Text style={[styles.billMode, { color: colors.textDim }]}>
                          {b.payment_method}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onNewBill}
        style={[
          styles.fab,
          {
            backgroundColor: colors.accent800,
            borderColor: colors.accent,
          },
        ]}
      >
        <PlusIcon size={18} color={colors.accent100} />
        <Text style={[styles.fabText, { color: colors.accent100 }]}>
          {t('newBill', 'New bill')}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: -0.4,
  },
  todayLabel: {
    marginLeft: 'auto',
    fontSize: 12,
  },
  periodTabsRow: {
    flexDirection: 'row',
    marginTop: 12,
    borderWidth: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodTabText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 96,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  totalAmount: {
    fontSize: 34,
    fontWeight: '500',
    letterSpacing: -0.6,
  },
  deltaText: {
    fontSize: 12,
    paddingBottom: 4,
  },
  subLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 86,
    marginTop: 18,
    marginBottom: 4,
  },
  barColumn: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
  },
  bar: {
    width: '100%',
    borderRadius: 3,
  },
  barLabel: {
    fontSize: 9.5,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 14,
  },
  metricCard: {
    flex: 1,
    padding: 11,
    borderRadius: radii.md,
  },
  metricCardColumn: {
    flex: 1,
    gap: 8,
  },
  metricCardSmall: {
    padding: 11,
    borderRadius: radii.md,
  },
  metricCardLabel: {
    fontSize: 9.5,
    fontWeight: '500',
    letterSpacing: 0.9,
    marginBottom: 7,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 5,
  },
  modeLabel: {
    flex: 1,
    fontSize: 12,
  },
  modeProgressBar: {
    width: 48,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  modeProgressFill: {
    height: '100%',
  },
  modeAmount: {
    fontSize: 11.5,
    width: 44,
    textAlign: 'right',
  },
  billsCountText: {
    fontSize: 18,
    fontWeight: '500',
    marginTop: 2,
  },
  avgBillText: {
    fontSize: 11,
  },
  topServiceText: {
    fontSize: 13.5,
    marginTop: 3,
  },
  billsListHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  billsListTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  billsListSub: {
    marginLeft: 'auto',
    fontSize: 11,
  },
  billsList: {},
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  billTime: {
    width: 44,
    fontSize: 11,
  },
  billMain: {
    flex: 1,
    minWidth: 0,
  },
  billCust: {
    fontSize: 14,
  },
  billWhat: {
    fontSize: 11.5,
    marginTop: 2,
  },
  billRight: {
    alignItems: 'flex-end',
  },
  billAmt: {
    fontSize: 14,
  },
  billMode: {
    fontSize: 10,
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...shadows.md,
  },
  fabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyBillsBox: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyBillsTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptyBillsSub: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
});
