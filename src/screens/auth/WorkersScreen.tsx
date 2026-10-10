import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { GlassBackdrop } from '../../components/common/GlassBackdrop';
import { getGlass } from '../../theme/glass';
import { Button } from '../../components/common/Button';
import { BackIcon, CrossIcon, UsersIcon } from '../../components/common/SvgIcons';
import { getInitials } from '../../utils/format';
import { radii } from '../../theme/spacing';
import { QuickContactPickerModal } from '../../components/customers/QuickContactPickerModal';

export interface StaffDraftItem {
  name: string;
  role: string;
  phone?: string;
}

interface WorkersScreenProps {
  initialStaff?: StaffDraftItem[];
  onFinish: (staff: StaffDraftItem[]) => void;
  onBack: () => void;
}

export const WorkersScreen = ({
  initialStaff,
  onFinish,
  onBack,
}: WorkersScreenProps) => {
  const { colors } = useTheme();

  const [staffDraft, setStaffDraft] = useState<StaffDraftItem[]>(
    initialStaff || []
  );

  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [error, setError] = useState('');
  const [isContactPickerOpen, setIsContactPickerOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleAddStaff = () => {
    const trimmed = newStaffName.trim();
    if (!trimmed) {
      setError('Please enter stylist or worker name');
      return;
    }
    const cleanPhone = newStaffPhone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number for the stylist');
      return;
    }
    if (staffDraft.some((s) => (s.phone || '').replace(/\D/g, '').slice(-10) === cleanPhone)) {
      setError('A team member with this mobile number is already in the list');
      return;
    }
    if (staffDraft.length >= 3) {
      setError('Maximum 3 stylists allowed per salon account');
      return;
    }

    setStaffDraft((prev) => [
      ...prev,
      { name: trimmed, role: 'Stylist', phone: cleanPhone },
    ]);
    setNewStaffName('');
    setNewStaffPhone('');
    setError('');
  };

  const handleSelectContact = (contact: { name: string; phone: string }) => {
    const cleanPhone = contact.phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      Alert.alert('Invalid Contact', 'Selected contact does not have a valid 10-digit mobile number.');
      return;
    }
    if (staffDraft.some((s) => (s.phone || '').replace(/\D/g, '').slice(-10) === cleanPhone)) {
      Alert.alert('Already Added', `${contact.name} (+91 ${cleanPhone}) is already in your team.`);
      return;
    }
    if (staffDraft.length >= 3) {
      Alert.alert('Stylist Limit', 'Maximum 3 stylists allowed per salon account.');
      return;
    }

    setStaffDraft((prev) => [
      ...prev,
      { name: contact.name, role: 'Stylist', phone: cleanPhone },
    ]);
    setError('');
    setIsContactPickerOpen(false);
  };

  const handleFinish = () => {
    let finalStaff = [...staffDraft];
    const trimmed = newStaffName.trim();
    const cleanPhone = newStaffPhone.replace(/\D/g, '').slice(-10);

    // Auto-commit if user filled name/phone but didn't tap "+ Add to Team"
    if (trimmed || cleanPhone) {
      if (!trimmed) {
        setError('Please enter stylist or worker name');
        return;
      }
      if (!cleanPhone || cleanPhone.length !== 10) {
        setError('Please enter a valid 10-digit mobile number for the stylist');
        return;
      }
      if (finalStaff.some((s) => (s.phone || '').replace(/\D/g, '').slice(-10) === cleanPhone)) {
        setError('A team member with this mobile number is already in the list');
        return;
      }
      if (finalStaff.length >= 3) {
        setError('Maximum 3 stylists allowed per salon account');
        return;
      }
      finalStaff.push({ name: trimmed, role: 'Stylist', phone: cleanPhone });
    }

    onFinish(finalStaff);
  };

  const handleRemove = (index: number) => {
    setStaffDraft((prev) => prev.filter((_, idx) => idx !== index));
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <GlassBackdrop isDark={colors.isDark} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(36, keyboardHeight + 40) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <Button variant="icon" onPress={onBack}>
              <BackIcon size={18} color={colors.text} />
            </Button>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onFinish([])}
              style={[
                styles.skipTopBtn,
                {
                  borderColor: colors.divider,
                  backgroundColor: colors.surface,
                },
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.skipTopText, { color: colors.textDim }]}>
                Skip for now
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.heading, { color: colors.text }]}>Who works here?</Text>
          <Text style={[styles.subheading, { color: colors.textDim }]}>
            Step 2 of 2 · every bill gets tagged to a stylist, and stylists can log in with their registered mobile number.
          </Text>

          <View style={styles.list}>
            {staffDraft.length === 0 ? (
              <View style={[styles.emptyPrompt, { ...getGlass(colors.isDark).card, borderWidth: 1 }]}>
                <Text style={[styles.emptyPromptTitle, { color: colors.text }]}>No team members added yet</Text>
                <Text style={[styles.emptyPromptSub, { color: colors.textDim }]}>
                  Type a stylist name and 10-digit mobile number below, then tap "+ Add to Team".
                </Text>
              </View>
            ) : (
              staffDraft.map((s, idx) => (
                <View
                  key={idx}
                  style={[styles.memberCard, { ...getGlass(colors.isDark).card, borderWidth: 1 }]}
                >
                  <View
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: colors.accent800,
                      },
                    ]}
                  >
                    <Text style={[styles.avatarText, { color: colors.accent100 }]}>
                      {getInitials(s.name)}
                    </Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: colors.text }]}>{s.name}</Text>
                    <Text style={[styles.memberRole, { color: colors.textDim }]}>
                      {s.role}{s.phone ? ` · +91 ${s.phone}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemove(idx)}
                    style={styles.removeButton}
                    activeOpacity={0.7}
                  >
                    <CrossIcon size={16} color={colors.textDim} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          {/* Add Member Card */}
          {staffDraft.length >= 3 ? (
            <View style={[styles.limitNoticeCard, { ...getGlass(colors.isDark).card, borderWidth: 1 }]}>
              <Text style={[styles.limitNoticeText, { color: colors.accent }]}>
                ★ Stylist limit reached (3 stylists maximum per salon)
              </Text>
            </View>
          ) : (
            <View style={[styles.addSectionCard, { ...getGlass(colors.isDark).card, borderWidth: 1 }]}>
              <Text style={[styles.addSectionLabel, { color: colors.text }]}>Add Stylist / Team Member</Text>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setIsContactPickerOpen(true)}
                style={[
                  styles.importContactBtn,
                  {
                    borderColor: colors.accent,
                    backgroundColor: colors.accent + '15',
                  },
                ]}
              >
                <UsersIcon size={16} color={colors.accent} />
                <Text style={[styles.importContactBtnText, { color: colors.accent }]}>
                  Import Stylist from Contacts
                </Text>
              </TouchableOpacity>
              
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: colors.divider,
                    backgroundColor: colors.bg,
                    color: colors.text,
                    marginBottom: 8,
                  },
                ]}
                placeholder="Stylist or worker full name"
                placeholderTextColor={colors.placeholder || colors.textDim}
                value={newStaffName}
                onChangeText={(val) => {
                  setNewStaffName(val);
                  if (error) setError('');
                }}
              />

              <View style={styles.phoneInputRow}>
                <View
                  style={[
                    styles.countryCodeBadge,
                    {
                      borderColor: colors.divider,
                      backgroundColor: colors.bg,
                    },
                  ]}
                >
                  <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>+91</Text>
                </View>
                <TextInput
                  style={[
                    styles.phoneInput,
                    {
                      borderColor: colors.divider,
                      backgroundColor: colors.bg,
                      color: colors.text,
                    },
                  ]}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={colors.placeholder || colors.textDim}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={newStaffPhone}
                  onChangeText={(val) => {
                    const clean = val.replace(/\D/g, '').slice(0, 10);
                    setNewStaffPhone(clean);
                    if (error) setError('');
                  }}
                />
              </View>

              {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

              <Button
                label="+ Add to Team"
                variant="secondary"
                onPress={handleAddStaff}
                style={{ marginTop: 12 }}
              />
            </View>
          )}

          <Button
            label={
              staffDraft.length > 0
                ? `Finish setup · ${staffDraft.length} on the team`
                : 'Continue to Setup'
            }
            block
            onPress={handleFinish}
            style={{ marginTop: 16 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <QuickContactPickerModal
        visible={isContactPickerOpen}
        existingPhones={staffDraft.map((s) => (s.phone || '').replace(/\D/g, '').slice(-10)).filter(Boolean)}
        existingBadgeText="Already in Team"
        title="Import Stylist from Contacts"
        onClose={() => setIsContactPickerOpen(false)}
        onSelectContact={handleSelectContact}
      />
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
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  skipTopBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  skipTopText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  skipBottomBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  skipBottomText: {
    fontSize: 13,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 26,
  },
  heading: {
    fontSize: 24,
    fontWeight: '500',
    marginTop: 20,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 12.5,
    marginBottom: 18,
    lineHeight: 18,
  },
  list: {
    gap: 8,
    marginBottom: 14,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.md,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
  },
  memberRole: {
    fontSize: 11.5,
  },
  removeButton: {
    padding: 6,
  },
  addSectionCard: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 14,
  },
  addSectionLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    marginBottom: 10,
  },
  importContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: 12,
    gap: 8,
  },
  importContactBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  countryCodeBadge: {
    minHeight: 42,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneInput: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  limitNoticeCard: {
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 14,
  },
  limitNoticeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 11.5,
    marginTop: 6,
  },
  emptyPrompt: {
    padding: 16,
    borderWidth: 1,
    borderRadius: radii.md,
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyPromptTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyPromptSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});
