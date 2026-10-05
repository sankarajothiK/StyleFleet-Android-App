import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { StarIcon, CrossIcon } from './SvgIcons';
import { radii, shadows } from '../../theme/spacing';

interface AppReviewModalProps {
  visible: boolean;
  onRate: () => void;
  onRemindLater: () => void;
}

export const AppReviewModal = ({
  visible,
  onRate,
  onRemindLater,
}: AppReviewModalProps) => {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRemindLater}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.divider,
            },
          ]}
        >
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onRemindLater}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <CrossIcon size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Milestone Badge */}
          <View style={[styles.milestoneBadge, { backgroundColor: colors.accent900, borderColor: colors.accent }]}>
            <Text style={[styles.milestoneText, { color: colors.accent }]}>
              🎉 10 Bills Completed!
            </Text>
          </View>

          {/* Golden Stars */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <StarIcon
                key={i}
                size={26}
                color={colors.accent}
                fill={colors.accent}
                strokeWidth={1}
              />
            ))}
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            Please rate our app!
          </Text>

          {/* Message */}
          <Text style={[styles.message, { color: colors.textDim }]}>
            You have successfully generated 10 bills! Please give a review on the Google Play Store, it will be really helpful for our app.
          </Text>

          {/* Actions */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onRate}
            style={[styles.rateBtn, { backgroundColor: colors.accent }]}
          >
            <StarIcon size={18} color="#000" fill="#000" />
            <Text style={styles.rateBtnText}>Rate on Google Play Store</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onRemindLater}
            style={styles.laterBtn}
          >
            <Text style={[styles.laterBtnText, { color: colors.textMuted }]}>
              Maybe Later
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radii.lg,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    position: 'relative',
    ...shadows.lg,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 10,
  },
  milestoneBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginBottom: 14,
  },
  milestoneText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 6,
  },
  rateBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radii.md,
    marginBottom: 10,
  },
  rateBtnText: {
    color: '#000000',
    fontSize: 14.5,
    fontWeight: '700',
  },
  laterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  laterBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
