import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { GlassBackdrop } from '../../components/common/GlassBackdrop';
import { getGlass } from '../../theme/glass';
import { Button } from '../../components/common/Button';
import { BackIcon, BellIcon, ReceiptIcon, ChartIcon } from '../../components/common/SvgIcons';
import { ReminderItem } from '../../types/domain';
import { ReminderRule, describeAppointmentWhen } from '../../repositories/reminderRepository';
import { useLanguage } from '../../i18n/LanguageContext';
import { fmt, localeFor } from '../../i18n/format';
import { usePullRefresh } from '../../hooks/usePullRefresh';

interface RemindersScreenProps {
  onRefresh?: () => Promise<void>;
  reminders: ReminderItem[];
  rules: ReminderRule[];
  onBack: () => void;
  onAction: (reminder: ReminderItem) => void;
  onDismiss: (reminderId: string) => void;
  onToggleRule: (ruleId: string) => void;
}

export const RemindersScreen = ({
  onRefresh,
  reminders,
  rules,
  onBack,
  onAction,
  onDismiss,
  onToggleRule,
}: RemindersScreenProps) => {
  const pullRefresh = usePullRefresh(onRefresh);
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const tf = (key: string, fallback: string, vars: Record<string, string | number> = {}) =>
    fmt(t(key, fallback), vars);
  const glass = getGlass(colors.isDark);

  // Titles, descriptions and times are built here so they follow the selected language
  const reminderTitle = (r: ReminderItem): string => {
    if (r.kind === 'money' && r.customer_name) {
      return tf('rmOwes', '{name} owes ₹{amt}', { name: r.customer_name, amt: Math.round((r.amount_minor || 0) / 100) });
    }
    if (r.kind === 'appt' && r.customer_name) {
      return tf('rmApptTitle', 'Remind {name} about their appointment', { name: r.customer_name });
    }
    return r.title;
  };
  const reminderSub = (r: ReminderItem): string => {
    if (r.kind === 'appt') return t('rmApptSub', 'Send appointment confirmation and reminder');
    if (r.kind === 'money') {
      const inv = r.sub.match(/^Invoice (\S+) pending payment$/);
      if (inv) return tf('rmInvoicePending', 'Invoice {inv} pending payment', { inv: inv[1] });
      const bal = r.sub.match(/₹(\d+)/);
      if (bal && /Outstanding balance/.test(r.sub)) return tf('rmBalancePending', 'Outstanding balance of ₹{amt} pending', { amt: bal[1] });
    }
    return r.sub;
  };
  const reminderWhen = (r: ReminderItem): string => {
    if (r.kind === 'appt' && r.starts_at) {
      return describeAppointmentWhen(r.starts_at, new Date(), {
        today: t('today', 'Today'),
        tomorrow: t('tomorrow', 'Tomorrow'),
        locale: localeFor(language),
      }).when;
    }
    if (r.when === 'Today') return t('today', 'Today');
    if (r.when === 'Support Reply') return t('rmSupportReply', 'Support Reply');
    return r.when;
  };
  const ruleLabel = (rule: ReminderRule): string => {
    const map: Record<string, [string, string]> = {
      rule_1: ['rmRule1', 'Appointment reminder · 3 hours before'],
      rule_2: ['rmRule2', 'Payment due follow-up · every 3 days'],
      rule_3: ['rmRule3', 'Daily closing summary · 9:00 pm'],
    };
    const hit = map[rule.id];
    return hit ? t(hit[0], hit[1]) : rule.label;
  };

  const todayReminders = reminders.filter((r) => r.group === 'Today');
  const upcomingReminders = reminders.filter((r) => r.group === 'Upcoming');

  // Each reminder kind gets its own tint so the list can be scanned quickly
  const kindTint = (kind: string): string => {
    switch (kind) {
      case 'money':
        return colors.accent;
      case 'close':
        return '#4F7CFF';
      case 'support':
        return '#25D366';
      default:
        return colors.accent;
    }
  };

  const renderIcon = (kind: string) => {
    const tint = kindTint(kind);
    switch (kind) {
      case 'money':
        return <ReceiptIcon size={18} color={tint} />;
      case 'close':
        return <ChartIcon size={18} color={tint} />;
      case 'support':
        return <Text style={{ fontSize: 16 }}>💬</Text>;
      default:
        return <BellIcon size={18} color={tint} />;
    }
  };

  const renderGroup = (label: string, items: ReminderItem[]) => {
    if (items.length === 0) return null;
    return (
      <View style={styles.groupContainer}>
        <View style={styles.groupHeader}>
          <Text style={[styles.groupLabel, { color: colors.accent }]}>{label}</Text>
          <View style={[styles.groupCount, { backgroundColor: colors.accent + '22' }]}>
            <Text style={{ color: colors.accent, fontSize: 10.5, fontWeight: '700' }}>{items.length}</Text>
          </View>
          <View style={[styles.groupLine, { backgroundColor: colors.divider }]} />
        </View>
        <View style={styles.groupList}>
          {items.map((r) => {
            const tint = kindTint(r.kind);
            return (
              <View
                key={r.id}
                style={[
                  styles.reminderCard,
                  { backgroundColor: glass.card.backgroundColor, borderColor: glass.card.borderColor },
                ]}
              >
                <View style={[styles.iconCircle, { backgroundColor: tint + '1F', borderColor: tint + '55' }]}>
                  {renderIcon(r.kind)}
                </View>

                <View style={styles.cardContent}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.reminderTitle, { color: colors.text }]}>
                      {reminderTitle(r)}
                    </Text>
                    {reminderWhen(r) ? (
                      <View style={[styles.whenPill, { backgroundColor: glass.pill.backgroundColor, borderColor: glass.card.borderColor }]}>
                        <Text style={[styles.whenText, { color: colors.textDim }]}>{reminderWhen(r)}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.reminderSub, { color: colors.textDim }]}>
                    {reminderSub(r)}
                  </Text>

                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity
                      onPress={() => onAction(r)}
                      activeOpacity={0.8}
                      style={[styles.actionButton, { backgroundColor: colors.accent }]}
                    >
                      <Text style={[styles.actionButtonText, { color: '#161826' }]}>
                        {r.kind === 'money' ? t('rmSendReminder', 'Send Reminder') : r.action === 'Send now' ? t('rmSendNow', 'Send now') : r.action}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onDismiss(r.id)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.dismissButton}
                    >
                      <Text style={[styles.dismissButtonText, { color: colors.textDim }]}>{t('rmDismiss', 'Dismiss')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <GlassBackdrop isDark={colors.isDark} />
      <View style={styles.topBar}>
        <Button variant="icon" onPress={onBack}>
          <BackIcon size={18} color={colors.text} />
        </Button>
        <Text style={[styles.title, { color: colors.text }]}>{t('reminders', 'Reminders')}</Text>
        <View
          style={[
            styles.openPill,
            {
              backgroundColor: reminders.length > 0 ? colors.accent + '22' : glass.pill.backgroundColor,
              borderColor: reminders.length > 0 ? colors.accent + '66' : glass.card.borderColor,
            },
          ]}
        >
          <Text style={{ color: reminders.length > 0 ? colors.accent : colors.textDim, fontSize: 11.5, fontWeight: '700' }}>
            {tf('rmOpen', '{n} open', { n: reminders.length })}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={pullRefresh}>
        {renderGroup(t('today', 'Today').toUpperCase(), todayReminders)}
        {renderGroup(t('rmUpcoming', 'UPCOMING'), upcomingReminders)}

        {reminders.length === 0 ? (
          <View
            style={[
              styles.emptyContainer,
              { backgroundColor: glass.card.backgroundColor, borderColor: glass.card.borderColor },
            ]}
          >
            <View style={[styles.emptyIcon, { backgroundColor: colors.accent + '1F', borderColor: colors.accent + '55' }]}>
              <BellIcon size={22} color={colors.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('rmAllCaught', 'All caught up')}</Text>
            <Text style={[styles.emptyText, { color: colors.textDim }]}>
              {t('rmCleared', "Everything's cleared for today.")}
            </Text>
          </View>
        ) : null}

        {/* Automatic reminders */}
        <View style={styles.groupHeader}>
          <Text style={[styles.groupLabel, { color: colors.accent }]}>{t('rmAuto', 'AUTOMATIC REMINDERS')}</Text>
          <View style={[styles.groupLine, { backgroundColor: colors.divider }]} />
        </View>
        <View
          style={[
            styles.rulesCard,
            { backgroundColor: glass.card.backgroundColor, borderColor: glass.card.borderColor },
          ]}
        >
          {rules.map((rule, idx) => (
            <View
              key={rule.id}
              style={[
                styles.ruleRow,
                idx > 0 ? { borderTopWidth: 1, borderTopColor: colors.divider } : null,
              ]}
            >
              <Text style={[styles.ruleLabel, { color: colors.text }]}>{ruleLabel(rule)}</Text>
              <TouchableOpacity
                onPress={() => onToggleRule(rule.id)}
                activeOpacity={0.8}
                accessibilityRole="switch"
                accessibilityState={{ checked: rule.on }}
                accessibilityLabel={ruleLabel(rule)}
                style={[
                  styles.toggleTrack,
                  {
                    backgroundColor: rule.on ? colors.accent : glass.pill.backgroundColor,
                    borderColor: rule.on ? colors.accent : glass.card.borderColor,
                  },
                ]}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    {
                      left: rule.on ? 21 : 2,
                      backgroundColor: rule.on ? '#161826' : colors.textDim,
                    },
                  ]}
                />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  openPill: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 32,
  },
  groupContainer: {
    marginBottom: 18,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  groupCount: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  groupLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  groupList: {
    gap: 8,
  },
  reminderCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  reminderTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  whenPill: {
    marginTop: 1,
    flexShrink: 0,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  whenText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  reminderSub: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dismissButton: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  dismissButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 28,
    borderWidth: 1,
    borderRadius: 18,
    marginBottom: 18,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 12.5,
    marginTop: 3,
  },
  rulesCard: {
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  ruleLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
  },
  toggleKnob: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});
