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
import { Button } from '../../components/common/Button';
import { BackIcon, BellIcon, ReceiptIcon, ChartIcon } from '../../components/common/SvgIcons';
import { ReminderItem } from '../../types/domain';
import { ReminderRule } from '../../repositories/reminderRepository';
import { radii } from '../../theme/spacing';

interface RemindersScreenProps {
  reminders: ReminderItem[];
  rules: ReminderRule[];
  onBack: () => void;
  onAction: (reminder: ReminderItem) => void;
  onDismiss: (reminderId: string) => void;
  onToggleRule: (ruleId: string) => void;
}

export const RemindersScreen = ({
  reminders,
  rules,
  onBack,
  onAction,
  onDismiss,
  onToggleRule,
}: RemindersScreenProps) => {
  const { colors } = useTheme();

  const todayReminders = reminders.filter((r) => r.group === 'Today');
  const upcomingReminders = reminders.filter((r) => r.group === 'Upcoming');

  const renderIcon = (kind: string) => {
    switch (kind) {
      case 'money':
        return <ReceiptIcon size={18} color={colors.accent} />;
      case 'close':
        return <ChartIcon size={18} color={colors.accent} />;
      case 'support':
        return <Text style={{ fontSize: 16 }}>💬</Text>;
      default:
        return <BellIcon size={18} color={colors.accent} />;
    }
  };

  const renderGroup = (label: string, items: ReminderItem[]) => {
    if (items.length === 0) return null;
    return (
      <View style={styles.groupContainer}>
        <Text style={[styles.groupLabel, { color: colors.accent }]}>{label}</Text>
        <View style={styles.groupList}>
          {items.map((r) => (
            <View
              key={r.id}
              style={[styles.reminderCard, { backgroundColor: colors.surface }]}
            >
              <View style={styles.iconCol}>{renderIcon(r.kind)}</View>
              <View style={styles.cardContent}>
                <Text style={[styles.reminderTitle, { color: colors.text }]}>
                  {r.title}
                </Text>
                <Text style={[styles.reminderSub, { color: colors.textDim }]}>
                  {r.sub}
                </Text>
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    onPress={() => onAction(r)}
                    activeOpacity={0.7}
                    style={[
                      styles.actionButton,
                      { backgroundColor: colors.bg, borderColor: colors.divider },
                    ]}
                  >
                    <Text style={[styles.actionButtonText, { color: r.kind === 'money' ? colors.accent : colors.text }]}>
                      {r.kind === 'money' ? 'Send Reminder' : r.action}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onDismiss(r.id)}
                    activeOpacity={0.7}
                    style={styles.dismissButton}
                  >
                    <Text style={[styles.dismissButtonText, { color: colors.textDim }]}>
                      Dismiss
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={[styles.whenText, { color: colors.textSubtle }]}>
                {r.when}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <View style={styles.topBar}>
        <Button variant="icon" onPress={onBack}>
          <BackIcon size={18} color={colors.text} />
        </Button>
        <Text style={[styles.title, { color: colors.text }]}>Reminders</Text>
        <Text style={[styles.countText, { color: colors.textDim }]}>
          {reminders.length} open
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderGroup('TODAY', todayReminders)}
        {renderGroup('UPCOMING', upcomingReminders)}

        {reminders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSubtle }]}>
              Everything's cleared for today.
            </Text>
          </View>
        ) : null}

        {/* Automatic Reminders Rules Card */}
        <View style={[styles.rulesCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.rulesHeader, { color: colors.text }]}>
            Automatic reminders
          </Text>
          {rules.map((rule) => (
            <View key={rule.id} style={styles.ruleRow}>
              <Text style={[styles.ruleLabel, { color: colors.textMuted }]}>
                {rule.label}
              </Text>
              <TouchableOpacity
                onPress={() => onToggleRule(rule.id)}
                activeOpacity={0.8}
                style={[
                  styles.toggleTrack,
                  {
                    backgroundColor: rule.on ? colors.accent800 : 'transparent',
                    borderColor: rule.on ? colors.accent : colors.divider,
                  },
                ]}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    {
                      left: rule.on ? 18 : 2,
                      backgroundColor: rule.on ? colors.accent200 : colors.textDim,
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
    fontSize: 18,
    fontWeight: '500',
  },
  countText: {
    marginLeft: 'auto',
    fontSize: 11.5,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  groupContainer: {
    marginBottom: 16,
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  groupList: {
    gap: 8,
  },
  reminderCard: {
    flexDirection: 'row',
    gap: 11,
    padding: 12,
    borderRadius: radii.md,
  },
  iconCol: {
    paddingTop: 1,
  },
  cardContent: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  reminderSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 9,
  },
  actionButton: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dismissButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  dismissButtonText: {
    fontSize: 12,
  },
  whenText: {
    fontSize: 10.5,
  },
  emptyContainer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
  rulesCard: {
    padding: 12,
    borderRadius: radii.md,
    marginTop: 4,
  },
  rulesHeader: {
    fontSize: 12.5,
    fontWeight: '500',
    marginBottom: 9,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  ruleLabel: {
    flex: 1,
    fontSize: 12.5,
  },
  toggleTrack: {
    width: 38,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: 'center',
  },
  toggleKnob: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
});
