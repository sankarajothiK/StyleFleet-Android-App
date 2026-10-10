import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Modal } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { getGlass } from '../../theme/glass';
import { radii } from '../../theme/spacing';
import { InstalledWhatsAppApp } from '../../services/whatsappLauncher';

interface WhatsAppAppPickerModalProps {
  visible: boolean;
  apps: InstalledWhatsAppApp[];
  onSelect: (app: InstalledWhatsAppApp) => void;
  onCancel: () => void;
}

/** Shown only when WhatsApp and WhatsApp Business are both installed. */
export const WhatsAppAppPickerModal = ({ visible, apps, onSelect, onCancel }: WhatsAppAppPickerModalProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const glass = getGlass(colors.isDark);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCancel} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
          <View style={[styles.grabber, { backgroundColor: colors.divider }]} />
          <Text style={[styles.title, { color: colors.text }]}>{t('waPickTitle', 'Send bill with')}</Text>
          <Text style={[styles.sub, { color: colors.textDim }]}>
            {t('waPickSub', 'WhatsApp and WhatsApp Business are both installed. Choose which one to use.')}
          </Text>

          {apps.map((app) => (
            <TouchableOpacity
              key={app.id}
              activeOpacity={0.85}
              onPress={() => onSelect(app)}
              accessibilityRole="button"
              accessibilityLabel={app.label}
              style={[styles.row, glass.card, { borderWidth: 1 }]}
            >
              {app.iconBase64 ? (
                <Image source={{ uri: `data:image/png;base64,${app.iconBase64}` }} style={styles.icon} />
              ) : (
                <View style={[styles.icon, styles.iconFallback, { backgroundColor: colors.accent + '24' }]}>
                  <Text style={{ color: colors.accent, fontWeight: '800' }}>{app.label.charAt(0)}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>{app.label}</Text>
                <Text style={[styles.rowSub, { color: colors.textDim }]}>
                  {app.id === 'business'
                    ? t('waBusinessSub', 'Business account')
                    : t('waPersonalSub', 'Personal account')}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            onPress={onCancel}
            activeOpacity={0.8}
            style={[styles.cancel, { borderColor: colors.divider }]}
          >
            <Text style={{ color: colors.textDim, fontWeight: '600' }}>{t('cancel', 'Cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 22,
  },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '800' },
  sub: { fontSize: 12.5, lineHeight: 18, marginTop: 4, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 12, marginBottom: 10 },
  icon: { width: 44, height: 44, borderRadius: 12 },
  iconFallback: { alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '700' },
  rowSub: { fontSize: 12, marginTop: 1 },
  cancel: { height: 46, borderRadius: radii.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
});
