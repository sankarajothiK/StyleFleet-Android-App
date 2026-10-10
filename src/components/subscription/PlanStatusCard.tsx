import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { getGlass } from '../../theme/glass';
import { fmt } from '../../i18n/format';
import { getPlanStatus } from '../../utils/subscriptionUtils';

interface PlanStatusCardProps {
  isPro: boolean;
  totalSalesCount: number;
  /** Free-plan sales limit for this salon */
  freeSalesLimit?: number;
  /** Opens the plan chooser */
  onUpgrade: () => void;
}

/** Compact "Your plan" card: free sales used, or Pro active, with one button to the plans. */
export const PlanStatusCard = ({ isPro, totalSalesCount, freeSalesLimit, onUpgrade }: PlanStatusCardProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const glass = getGlass(colors.isDark);
  const status = getPlanStatus(totalSalesCount, isPro, freeSalesLimit);

  const isLimit = status.state === 'limit';
  const barColor = status.state === 'pro' ? '#22C55E' : isLimit ? colors.error : colors.accent;
  const title =
    status.state === 'pro' ? t('plProActive', 'Pro plan active') : t('plFreePlan', 'Free plan');
  const caption =
    status.state === 'pro'
      ? t('plProHint', 'Unlimited bills and report downloads')
      : isLimit
      ? t('plLimitReached', 'Free limit reached')
      : fmt(t('plSalesUsed', '{n} of {total} free sales used'), { n: status.used, total: status.total });

  return (
    <View style={[styles.card, glass.card, { borderWidth: 1, borderColor: isLimit ? colors.error : undefined }]}>
      <View style={styles.topRow}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={[styles.label, { color: colors.textDim }]}>{t('plYourPlan', 'Your plan')}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        </View>
        {status.state === 'pro' ? (
          <TouchableOpacity onPress={onUpgrade} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.link, { color: colors.accent }]}>{t('plViewPlans', 'View plans')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onUpgrade}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={[styles.button, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.buttonText}>{t('plUpgrade', 'Upgrade')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.track, { backgroundColor: colors.divider }]}>
        <View style={[styles.fill, { width: `${Math.round(status.progress * 100)}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[styles.caption, { color: isLimit ? colors.error : colors.textMuted }]}>{caption}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 14, marginBottom: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  title: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  link: { fontSize: 13, fontWeight: '700' },
  button: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12 },
  buttonText: { color: '#0D0E11', fontSize: 13, fontWeight: '800' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 12 },
  fill: { height: 6, borderRadius: 3 },
  caption: { fontSize: 12.5, marginTop: 6 },
});
