import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  BackHandler,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { spacing, radii } from '../../theme/spacing';

interface UpdateRequiredModalProps {
  visible: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes?: string;
  storeUrl?: string;
  onUpdate: () => void;
  onCheckAgain?: () => void;
}

export const UpdateRequiredModal: React.FC<UpdateRequiredModalProps> = ({
  visible,
  currentVersion,
  latestVersion,
  releaseNotes,
  onUpdate,
  onCheckAgain,
}) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  // Trap Android hardware back button so the user cannot dismiss this modal
  useEffect(() => {
    if (!visible) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      return true; // Consume event, prevent default back action
    });

    return () => backHandler.remove();
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={() => {
        // Unskippable modal: do not close
      }}
    >
      <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.85)" />
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
          {/* Header Icon / Badge */}
          <View style={[styles.iconCircle, { backgroundColor: `${colors.accent}20`, borderColor: colors.accent }]}>
            <Text style={styles.iconEmoji}>🚀</Text>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{t('updateRequired', 'Update Required')}</Text>
          <Text style={[styles.subtitle, { color: colors.textDim }]}>
            {t(
              'updateRequiredSub',
              'A new version of StyleFleet is required to continue. Please update now to ensure uninterrupted salon operations and data sync.'
            )}
          </Text>

          {/* Version Info Badge */}
          <View style={[styles.versionPill, { backgroundColor: colors.bg }]}>
            <Text style={[styles.versionText, { color: colors.textDim }]}>
              {t('installed', 'Installed')}: <Text style={{ color: colors.text, fontWeight: '700' }}>v{currentVersion}</Text>
              {'  →  '}
              {t('required', 'Required')}: <Text style={{ color: colors.accent, fontWeight: '700' }}>v{latestVersion}</Text>
            </Text>
          </View>

          {/* Release Notes */}
          {releaseNotes ? (
            <View style={[styles.notesContainer, { backgroundColor: colors.bg, borderColor: colors.divider }]}>
              <Text style={[styles.notesHeader, { color: colors.accent }]}>
                {t('whatsNewIn', "What's New in v{version}").replace('{version}', latestVersion)}
              </Text>
              <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false}>
                <Text style={[styles.notesBody, { color: colors.text }]}>{releaseNotes}</Text>
              </ScrollView>
            </View>
          ) : null}

          {/* Update Action Button */}
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.accent }]}
            onPress={onUpdate}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>{t('updateNow', 'Update Now')}</Text>
          </TouchableOpacity>

          {/* Re-check Button */}
          {onCheckAgain && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onCheckAgain}
              activeOpacity={0.7}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.textDim }]}>
                {t('checkAgain', "I've updated already · Check again")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  versionPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  versionText: {
    fontSize: 12,
  },
  notesContainer: {
    width: '100%',
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  notesHeader: {
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  notesBody: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  secondaryButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
