import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { GlassBackdrop } from '../../components/common/GlassBackdrop';
import { getGlass } from '../../theme/glass';
import { Button } from '../../components/common/Button';
import { CheckIcon } from '../../components/common/SvgIcons';
import { WhatsAppAudience } from '../../repositories/whatsappRepository';
import { radii } from '../../theme/spacing';

interface BulkSentScreenProps {
  audience: WhatsAppAudience;
  onNewCampaign: () => void;
  onDone: () => void;
}

export const BulkSentScreen = ({
  audience,
  onNewCampaign,
  onDone,
}: BulkSentScreenProps) => {
  const { colors } = useTheme();

  const delivered = Math.round(audience.count * 0.62);
  const replied = Math.round(audience.count * 0.11);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <GlassBackdrop isDark={colors.isDark} />
      <View style={styles.container}>
        <View
          style={[
            styles.checkCircle,
            { borderColor: colors.accent },
          ]}
        >
          <CheckIcon size={22} color={colors.accent} />
        </View>

        <Text style={[styles.heading, { color: colors.text }]}>
          Queued for {audience.count}
        </Text>
        <Text style={[styles.subheading, { color: colors.textDim }]}>
          {audience.label} · sending now. You'll see delivery counts here as they land.
        </Text>

        {/* 3 Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { ...getGlass(colors.isDark).card, borderWidth: 1 }]}>
            <Text style={[styles.statLabel, { color: colors.textDim }]}>QUEUED</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {audience.count}
            </Text>
          </View>
          <View style={[styles.statBox, { ...getGlass(colors.isDark).card, borderWidth: 1 }]}>
            <Text style={[styles.statLabel, { color: colors.textDim }]}>DELIVERED</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {delivered}
            </Text>
          </View>
          <View style={[styles.statBox, { ...getGlass(colors.isDark).card, borderWidth: 1 }]}>
            <Text style={[styles.statLabel, { color: colors.textDim }]}>REPLIED</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {replied}
            </Text>
          </View>
        </View>

        {/* Bottom Actions */}
        <View style={styles.actionsRow}>
          <Button
            label="New campaign"
            variant="secondary"
            onPress={onNewCampaign}
            style={{ flex: 1 }}
          />
          <Button
            label="Done"
            variant="primary"
            onPress={onDone}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
  },
  checkCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 23,
    fontWeight: '500',
    marginTop: 18,
    marginBottom: 6,
  },
  subheading: {
    fontSize: 13,
    marginBottom: 18,
    lineHeight: 18,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    padding: 11,
    borderRadius: radii.md,
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '500',
    letterSpacing: 0.9,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '500',
    marginTop: 3,
  },
  actionsRow: {
    marginTop: 'auto',
    flexDirection: 'row',
    gap: 8,
  },
});
