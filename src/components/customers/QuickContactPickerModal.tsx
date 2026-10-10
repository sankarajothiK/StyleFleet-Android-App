import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { Modal } from '../common/KeyboardAwareModal';
import * as Contacts from 'expo-contacts/legacy';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Customer } from '../../types/domain';
import { SearchIcon, CrossIcon, CheckIcon, UsersIcon, ImportContactsIcon } from '../common/SvgIcons';
import { radii } from '../../theme/spacing';

export interface DeviceContactItem {
  id: string;
  name: string;
  phone: string;
  isExisting: boolean;
  existingCustomer?: Customer;
}

interface QuickContactPickerModalProps {
  visible: boolean;
  customers?: Customer[];
  existingPhones?: string[];
  title?: string;
  existingBadgeText?: string;
  onClose: () => void;
  onSelectContact: (contact: { name: string; phone: string; existingCustomer?: Customer }) => Promise<void> | void;
}

export const QuickContactPickerModal: React.FC<QuickContactPickerModalProps> = ({
  visible,
  customers = [],
  existingPhones = [],
  title,
  existingBadgeText,
  onClose,
  onSelectContact,
}) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<DeviceContactItem[]>([]);
  const [filtered, setFiltered] = useState<DeviceContactItem[]>([]);
  const [search, setSearch] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);
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

  // Map existing customers by normalized 10-digit phone
  const existingPhoneMap = React.useMemo(() => {
    const map = new Map<string, Customer>();
    if (customers && customers.length > 0) {
      for (const c of customers) {
        if (c && c.phone) {
          const clean = c.phone.replace(/\D/g, '').slice(-10);
          if (clean.length === 10) {
            map.set(clean, c);
          }
        }
      }
    }
    return map;
  }, [customers]);

  const existingPhoneSet = React.useMemo(() => {
    const set = new Set<string>();
    if (existingPhones && existingPhones.length > 0) {
      for (const p of existingPhones) {
        if (p) {
          const clean = p.replace(/\D/g, '').slice(-10);
          if (clean.length === 10) set.add(clean);
        }
      }
    }
    return set;
  }, [existingPhones]);

  const loadContacts = async () => {
    setLoading(true);
    setPermissionDenied(false);
    setSearch('');

    try {
      let { status } = await Contacts.getPermissionsAsync();
      if (status !== 'granted') {
        const req = await Contacts.requestPermissionsAsync();
        status = req.status;
      }

      if (status !== 'granted') {
        setPermissionDenied(true);
        setLoading(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      });

      if (data && data.length > 0) {
        const formatted: DeviceContactItem[] = [];
        const seenNumbers = new Set<string>();

        for (const item of data) {
          const contactName = (
            item.name ||
            `${item.firstName || ''} ${item.lastName || ''}`.trim() ||
            item.company ||
            ''
          ).trim();

          const phoneList = item.phoneNumbers || [];
          for (const p of phoneList) {
            const rawPhone = p.number || p.digits || '';
            const digits = rawPhone.replace(/\D/g, '');
            if (digits.length >= 10) {
              const clean10 = digits.slice(-10);
              if (!seenNumbers.has(clean10)) {
                seenNumbers.add(clean10);
                const existing = existingPhoneMap.get(clean10);
                const isExisting = Boolean(existing) || existingPhoneSet.has(clean10);
                formatted.push({
                  id: item.id || `contact_${clean10}`,
                  name: contactName || `Client (+91 ${clean10})`,
                  phone: clean10,
                  isExisting,
                  existingCustomer: existing,
                });
              }
              break;
            }
          }
        }

        formatted.sort((a, b) => a.name.localeCompare(b.name));
        setContacts(formatted);
        setFiltered(formatted);
      } else {
        setContacts([]);
        setFiltered([]);
      }
    } catch (err: any) {
      console.warn('QuickContactPickerModal load error:', err);
      Alert.alert('Contacts Access', 'Could not access phone contacts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadContacts();
    }
  }, [visible]);

  const handleSearch = (text: string) => {
    setSearch(text);
    const q = text.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    if (!q) {
      setFiltered(contacts);
    } else {
      setFiltered(
        contacts.filter((c) => {
          const matchName = c.name.toLowerCase().includes(q);
          const matchPhone = c.phone.includes(q) || (qDigits.length >= 3 && c.phone.includes(qDigits));
          return matchName || matchPhone;
        })
      );
    }
  };

  const handlePick = async (item: DeviceContactItem) => {
    await onSelectContact({
      name: item.name,
      phone: item.phone,
      existingCustomer: item.existingCustomer,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.overlay}>
          <View style={[styles.container, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ImportContactsIcon size={20} color={colors.accent} />
              <Text style={[styles.title, { color: colors.text }]}>
                {title || t('importFromContacts', 'Import from Contacts')}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <CrossIcon size={18} color={colors.textDim} />
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View style={[styles.searchRow, { backgroundColor: colors.bg, borderColor: colors.divider }]}>
            <SearchIcon size={16} color={colors.textDim} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search name or 10-digit number..."
              placeholderTextColor={colors.placeholder || colors.textDim}
              value={search}
              onChangeText={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <CrossIcon size={14} color={colors.textDim} />
              </TouchableOpacity>
            )}
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.statusText, { color: colors.textDim, marginTop: 12 }]}>
                Reading phone contacts...
              </Text>
            </View>
          ) : permissionDenied ? (
            <View style={styles.centerBox}>
              <Text style={[styles.statusText, { color: colors.error, textAlign: 'center', marginBottom: 12 }]}>
                Contacts permission was denied. Please allow contacts access in phone settings.
              </Text>
              <TouchableOpacity
                onPress={loadContacts}
                style={[styles.retryBtn, { backgroundColor: colors.accent }]}
              >
                <Text style={{ color: '#000', fontWeight: '600' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={[styles.statusText, { color: colors.textDim }]}>
                {search ? 'No contacts match your search.' : 'No phone contacts found.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={{ paddingBottom: Math.max(30, keyboardHeight + 20) }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handlePick(item)}
                  style={[styles.contactRow, { borderBottomColor: colors.divider }]}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.contactName, { color: colors.text }]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.contactPhone, { color: colors.textDim }]}>
                      +91 {item.phone}
                    </Text>
                  </View>
                  {item.isExisting ? (
                    <View style={styles.existingBadge}>
                      <Text style={styles.existingBadgeText}>
                        {existingBadgeText || (item.existingCustomer ? 'Already in Salon' : 'Already in Team')}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.importPill, { borderColor: colors.accent }]}>
                      <Text style={[styles.importPillText, { color: colors.accent }]}>+ Import</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    maxHeight: '85%',
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
    marginTop: 12,
    marginBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  centerBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 14,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 13,
  },
  existingBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  existingBadgeText: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '600',
  },
  importPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  importPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
