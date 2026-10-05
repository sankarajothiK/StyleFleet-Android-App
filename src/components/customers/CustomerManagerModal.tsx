import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Dimensions,
} from 'react-native';
import * as Contacts from 'expo-contacts/legacy';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Customer } from '../../types/domain';
import { inrFromMinor, getInitials } from '../../utils/format';
import { customerRepository } from '../../repositories/customerRepository';
import { deviceContactsService } from '../../services/deviceContactsService';
import { supabase } from '../../lib/supabase';
import { ImportContactsIcon, EditIcon } from '../common/SvgIcons';

interface ContactItem {
  id: string;
  name: string;
  phone: string;
  initialDue?: number;
}

interface CustomerManagerModalProps {
  visible: boolean;
  shopId: string;
  customerToEdit?: Customer | null;
  existingCustomers?: Customer[];
  onClose: () => void;
  onAddSuccess: (customer: Customer) => void;
  onBatchSuccess: (customers: Customer[]) => void;
  onEditSuccess: (customer: Customer) => void;
}

export const CustomerManagerModal = ({
  visible,
  shopId,
  customerToEdit,
  existingCustomers = [],
  onClose,
  onAddSuccess,
  onBatchSuccess,
  onEditSuccess,
}: CustomerManagerModalProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  // 'choice' | 'contacts' | 'manual' | 'edit_contact'
  const [viewMode, setViewMode] = useState<'choice' | 'contacts' | 'manual' | 'edit_contact'>('choice');

  // Manual & Edit Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [initialDue, setInitialDue] = useState('');
  const [notes, setNotes] = useState('');
  const [isStarred, setIsStarred] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Phone Contacts state
  const [deviceContacts, setDeviceContacts] = useState<ContactItem[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ContactItem[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<Record<string, boolean>>({});
  const [editingContact, setEditingContact] = useState<ContactItem | null>(null);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const manualScrollRef = React.useRef<ScrollView>(null);

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

  // Map of 10-digit normalized phone -> customer for instant duplicate checks
  const existingPhoneMap = React.useMemo(() => {
    const map = new Map<string, Customer>();
    for (const c of existingCustomers) {
      if (c && c.phone) {
        const clean = c.phone.replace(/\D/g, '').slice(-10);
        if (clean.length === 10) {
          map.set(clean, c);
        }
      }
    }
    return map;
  }, [existingCustomers]);

  // Synchronize modal mode and fields when opened or customerToEdit changes
  useEffect(() => {
    if (visible) {
      if (customerToEdit) {
        setViewMode('manual');
        setName(customerToEdit.name || '');
        setPhone(customerToEdit.phone || '');
        setInitialDue(
          customerToEdit.outstanding_due_minor && customerToEdit.outstanding_due_minor > 0
            ? String(Math.round(customerToEdit.outstanding_due_minor / 100))
            : ''
        );
        setNotes(customerToEdit.notes || '');
        setIsStarred(Boolean(customerToEdit.is_starred));
      } else {
        setViewMode('choice');
        setName('');
        setPhone('');
        setInitialDue('');
        setNotes('');
        setIsStarred(false);
      }
    }
  }, [visible, customerToEdit]);

  // Load Real Device Contacts
  const handleOpenContacts = async () => {
    setIsLoadingContacts(true);
    setPermissionError(null);
    setViewMode('contacts');
    setContactSearch('');
    setSelectedContactIds({});

    try {
      let { status } = await Contacts.getPermissionsAsync();
      if (status !== 'granted') {
        const req = await Contacts.requestPermissionsAsync();
        status = req.status;
      }

      if (status !== 'granted') {
        const msg = 'Permission to access contacts was denied. Please allow contacts access in your device settings.';
        setPermissionError(msg);
        setDeviceContacts([]);
        setFilteredContacts([]);
        setIsLoadingContacts(false);
        Alert.alert('Contacts Permission Required', msg);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      });

      if (data && data.length > 0) {
        const formatted: ContactItem[] = [];
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
            if (digits.length >= 7) {
              const clean10 = digits.length > 10 ? digits.slice(-10) : digits;
              if (!seenNumbers.has(clean10)) {
                seenNumbers.add(clean10);
                formatted.push({
                  id: item.id || `contact_${clean10}`,
                  name: contactName || `Client (+91 ${clean10})`,
                  phone: clean10,
                });
              }
              break;
            }
          }
        }

        // Sort alphabetically by name
        formatted.sort((a, b) => a.name.localeCompare(b.name));

        setDeviceContacts(formatted);
        setFilteredContacts(formatted);
        setIsLoadingContacts(false);
        return;
      } else {
        setDeviceContacts([]);
        setFilteredContacts([]);
        setIsLoadingContacts(false);
      }
    } catch (e: any) {
      console.warn('Error loading contacts:', e);
      setPermissionError(e?.message || 'Failed to load device contacts.');
      setDeviceContacts([]);
      setFilteredContacts([]);
      setIsLoadingContacts(false);
      Alert.alert(
        'Contacts Access',
        'Could not access phone contacts. Please ensure permission is granted in device settings.'
      );
    }
  };

  // Search contacts
  const handleSearchContacts = (text: string) => {
    setContactSearch(text);
    const q = text.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    if (!q) {
      setFilteredContacts(deviceContacts);
    } else {
      setFilteredContacts(
        deviceContacts.filter((c) => {
          const matchName = c.name.toLowerCase().includes(q);
          const matchPhone = c.phone.includes(q) || (qDigits.length >= 3 && c.phone.includes(qDigits));
          return matchName || matchPhone;
        })
      );
    }
  };

  // Toggle single selection
  const toggleContactSelection = (contact: ContactItem) => {
    if (existingPhoneMap.has(contact.phone)) {
      const existing = existingPhoneMap.get(contact.phone);
      Alert.alert(
        'Customer Already Exists',
        `+91 ${contact.phone} is already registered on file (${existing?.name || 'Client'}). No need to import duplicate.`
      );
      return;
    }
    setSelectedContactIds((prev) => ({
      ...prev,
      [contact.id]: !prev[contact.id],
    }));
  };

  // Select / Deselect All
  const handleSelectAll = () => {
    const available = filteredContacts.filter((c) => !existingPhoneMap.has(c.phone));
    if (available.length === 0) {
      Alert.alert(
        'All Contacts Registered',
        'All contacts in this list are already registered in your customer database.'
      );
      return;
    }
    const allSelected = available.every((c) => selectedContactIds[c.id]);
    const updated: Record<string, boolean> = { ...selectedContactIds };
    for (const c of filteredContacts) {
      if (existingPhoneMap.has(c.phone)) {
        updated[c.id] = false;
      } else {
        updated[c.id] = !allSelected;
      }
    }
    setSelectedContactIds(updated);
  };

  // Open single contact editor
  const handleEditContact = (contact: ContactItem) => {
    setEditingContact(contact);
    setName(contact.name);
    setPhone(contact.phone);
    setInitialDue(contact.initialDue ? String(contact.initialDue) : '');
    setViewMode('edit_contact');
  };

  // Save single contact after edit
  const handleSaveEditedContact = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter customer name');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number');
      return;
    }

    if (existingPhoneMap.has(cleanPhone)) {
      const existing = existingPhoneMap.get(cleanPhone);
      Alert.alert(
        'Customer Already Exists',
        `Mobile +91 ${cleanPhone} is already registered on file (${existing?.name || 'Client'}).`
      );
      return;
    }

    const dueAmt = parseFloat(initialDue) || 0;
    const dueMinor = Math.round(dueAmt * 100);

    // Update in deviceContacts
    if (editingContact) {
      const updated = deviceContacts.map((c) =>
        c.id === editingContact.id
          ? { ...c, name: name.trim(), phone: cleanPhone, initialDue: dueAmt }
          : c
      );
      setDeviceContacts(updated);
      setFilteredContacts(
        contactSearch
          ? updated.filter(
              (c) =>
                c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                c.phone.includes(contactSearch)
            )
          : updated
      );
      // Auto-select this contact
      setSelectedContactIds((prev) => ({ ...prev, [editingContact.id]: true }));
    }

    setViewMode('contacts');
  };

  // Batch import selected contacts
  const handleImportSelected = async () => {
    const selected = deviceContacts.filter((c) => selectedContactIds[c.id]);
    if (selected.length === 0) {
      Alert.alert('No Selection', 'Please select at least one contact to import.');
      return;
    }

    // Separate duplicates and unique contacts
    const duplicates: ContactItem[] = [];
    const uniqueToImport: ContactItem[] = [];

    for (const c of selected) {
      if (existingPhoneMap.has(c.phone)) {
        duplicates.push(c);
      } else {
        uniqueToImport.push(c);
      }
    }

    if (uniqueToImport.length === 0) {
      Alert.alert(
        'Already Registered',
        duplicates.length === 1
          ? `+91 ${duplicates[0].phone} is already present in your customer database (${existingPhoneMap.get(duplicates[0].phone)?.name}). No duplicate was added.`
          : `All ${duplicates.length} selected contacts are already registered in your customer database. No duplicates were added.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = uniqueToImport.map((c) => ({
        name: c.name,
        phone: c.phone,
        initialDueMinor: c.initialDue ? Math.round(c.initialDue * 100) : 0,
      }));

      const created = await customerRepository.importContacts(shopId, payload);
      onBatchSuccess(created);
      onClose();

      if (duplicates.length > 0) {
        Alert.alert(
          'Import Complete',
          `Added ${created.length} new customer(s).\n\n${duplicates.length} contact(s) were skipped because their mobile number is already registered in your salon.`
        );
      } else {
        Alert.alert('Success', `Imported ${created.length} new customer(s) into database!`);
      }
    } catch (e: any) {
      Alert.alert('Import Failed', e.message || 'Error saving contacts to database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save Manual Add or Edit Customer
  const handleSaveManual = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter customer name');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Mobile', 'Please enter a valid 10-digit mobile number');
      return;
    }

    // Check if customer with this mobile number already exists on file
    if (!customerToEdit) {
      const alreadyExists = existingPhoneMap.get(cleanPhone);
      if (alreadyExists) {
        Alert.alert(
          'Customer Already Exists',
          `A customer with mobile +91 ${cleanPhone} is already present on file (${alreadyExists.name}).\n\nNo duplicate customer was created.`
        );
        return;
      }
    } else {
      const phoneConflict = existingPhoneMap.get(cleanPhone);
      if (phoneConflict && phoneConflict.id !== customerToEdit.id) {
        Alert.alert(
          'Phone Already In Use',
          `Mobile +91 ${cleanPhone} is already registered to another customer (${phoneConflict.name}).`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (customerToEdit) {
        // Edit existing customer
        const dueAmt = parseFloat(initialDue) || 0;
        const dueMinor = Math.round(dueAmt * 100);

        const updated = await customerRepository.updateCustomer(shopId, customerToEdit.id, {
          name: name.trim(),
          phone: cleanPhone,
          notes: notes.trim() || undefined,
          is_starred: isStarred,
          dueMinor: dueMinor,
        });
        if (updated) {
          onEditSuccess(updated);
          onClose();
          Alert.alert('Updated', 'Customer details saved successfully!');
        }
      } else {
        // Double check directly with Supabase in case local state had a delay
        if (shopId) {
          try {
            const { data: dbCustomers } = await supabase
              .from('customers')
              .select('id, name, phone')
              .eq('shop_id', shopId);

            if (dbCustomers && dbCustomers.length > 0) {
              const dbMatch = dbCustomers.find(
                (c: any) => (c.phone || '').replace(/\D/g, '').slice(-10) === cleanPhone
              );
              if (dbMatch) {
                Alert.alert(
                  'Customer Already Exists',
                  `A customer with mobile +91 ${cleanPhone} is already present on file (${dbMatch.name}).\n\nNo duplicate customer was created.`
                );
                setIsSubmitting(false);
                return;
              }
            }
          } catch (dbErr) {
            // continue to addCustomer which has error handling
          }
        }

        // Add new customer
        const dueAmt = parseFloat(initialDue) || 0;
        const dueMinor = Math.round(dueAmt * 100);

        const newCust = await customerRepository.addCustomer(
          shopId,
          name.trim(),
          cleanPhone,
          dueMinor,
          isStarred,
          notes.trim() || undefined
        );

        onAddSuccess(newCust);
        // Safely persist to device native contacts if user permitted, with zero duplicates
        deviceContactsService.saveCustomerToDevice(newCust.name, newCust.phone).catch(() => {});
        onClose();
        Alert.alert('Customer Saved', `${newCust.name} added to your client list!`);
      }
    } catch (e: any) {
      Alert.alert(
        e?.message?.includes('already exists') ? 'Customer Already Exists' : 'Save Failed',
        e.message || 'Error saving customer.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!visible) return null;

  const selectedCount = Object.values(selectedContactIds).filter(Boolean).length;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={[styles.modalOverlay, { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 0 }]}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: colors.surface, borderColor: colors.divider },
            keyboardHeight > 0
              ? {
                  maxHeight: Dimensions.get('window').height - keyboardHeight - 20,
                  paddingBottom: 10,
                }
              : null,
          ]}
        >
          {/* VIEW: OPTION CHOICE SHEET */}
          {viewMode === 'choice' && (
            <View style={styles.choiceContainer}>
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>
                  {t('addNewCustomer', 'Add New Customer')}
                </Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Text style={[styles.closeBtnText, { color: colors.textDim }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.sheetSubtitle, { color: colors.textDim }]}>
                Choose how you would like to register your salon clients:
              </Text>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleOpenContacts}
                style={[
                  styles.optionCard,
                  { backgroundColor: colors.bg, borderColor: colors.divider },
                ]}
              >
                <View style={[styles.optionIconBox, { backgroundColor: 'rgba(217, 164, 65, 0.15)' }]}>
                  <ImportContactsIcon size={22} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>
                    {t('importFromContacts', 'Import from Contacts')}
                  </Text>
                  <Text style={[styles.optionDesc, { color: colors.textDim }]}>
                    {t('importContactsDesc', 'Select one or multiple contacts directly from your phone directory.')}
                  </Text>
                </View>
                <Text style={[styles.optionArrow, { color: colors.accent }]}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setName('');
                  setPhone('');
                  setInitialDue('');
                  setNotes('');
                  setIsStarred(false);
                  setViewMode('manual');
                }}
                style={[
                  styles.optionCard,
                  { backgroundColor: colors.bg, borderColor: colors.divider },
                ]}
              >
                <View style={[styles.optionIconBox, { backgroundColor: 'rgba(217, 164, 65, 0.15)' }]}>
                  <EditIcon size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>
                    {t('addCustomerManually', 'Add Client Manually')}
                  </Text>
                  <Text style={[styles.optionDesc, { color: colors.textDim }]}>
                    {t('addCustomerManuallyDesc', 'Type name, phone number, and optional opening due balance.')}
                  </Text>
                </View>
                <Text style={[styles.optionArrow, { color: colors.accent }]}>→</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* VIEW: CONTACTS DIRECTORY PICKER */}
          {viewMode === 'contacts' && (
            <View
              style={[
                styles.contactsContainer,
                keyboardHeight > 0 ? { maxHeight: Math.max(280, 520 - Math.min(keyboardHeight, 220)) } : null,
              ]}
            >
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={() => setViewMode('choice')}>
                  <Text style={[styles.backNavText, { color: colors.accent }]}>← Back</Text>
                </TouchableOpacity>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>
                  {t('selectContacts', 'Phone Contacts')}
                </Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Text style={[styles.closeBtnText, { color: colors.textDim }]}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Search & Select All row */}
              <TextInput
                style={[
                  styles.searchInput,
                  { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text },
                ]}
                placeholder={t('searchDeviceContacts', 'Search name or number...')}
                placeholderTextColor={colors.placeholder || colors.textDim}
                value={contactSearch}
                onChangeText={handleSearchContacts}
              />

              <View style={styles.selectionBar}>
                <TouchableOpacity onPress={handleSelectAll} style={styles.selectAllBtn}>
                  <Text style={[styles.selectAllText, { color: colors.accent }]}>
                    {filteredContacts.every((c) => selectedContactIds[c.id]) && filteredContacts.length > 0
                      ? t('deselectAll', 'Deselect All')
                      : t('selectAll', 'Select All')}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.selectionCount, { color: colors.textDim }]}>
                  {selectedCount} selected
                </Text>
              </View>

              {isLoadingContacts ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color={colors.accent} size="large" />
                  <Text style={[styles.loadingText, { color: colors.textDim }]}>Loading contacts...</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredContacts}
                  keyExtractor={(item) => item.id}
                  style={[
                    styles.contactsList,
                    keyboardHeight > 0 ? { maxHeight: Math.max(160, 380 - Math.min(keyboardHeight, 200)) } : null,
                  ]}
                  keyboardShouldPersistTaps="handled"
                  initialNumToRender={25}
                  maxToRenderPerBatch={35}
                  windowSize={7}
                  removeClippedSubviews={Platform.OS === 'android'}
                  ListEmptyComponent={
                    <View style={{ paddingVertical: 40, paddingHorizontal: 24, alignItems: 'center' }}>
                      <Text style={[styles.emptyContactsText, { color: colors.textDim, textAlign: 'center', lineHeight: 20 }]}>
                        {permissionError
                          ? permissionError
                          : contactSearch
                          ? 'No contacts found matching your search.'
                          : 'No contacts with valid phone numbers found on your device.'}
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleOpenContacts}
                        style={{
                          marginTop: 16,
                          paddingVertical: 10,
                          paddingHorizontal: 20,
                          backgroundColor: colors.surface,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: colors.divider,
                        }}
                      >
                        <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>
                          🔄 Refresh Contacts
                        </Text>
                      </TouchableOpacity>
                    </View>
                  }
                  renderItem={({ item: c }) => {
                    const isAlreadyRegistered = existingPhoneMap.has(c.phone);
                    const existingCustomer = existingPhoneMap.get(c.phone);
                    const isSelected = !!selectedContactIds[c.id];
                    return (
                      <View
                        style={[
                          styles.contactRow,
                          {
                            backgroundColor: isSelected ? 'rgba(217,164,65,0.1)' : 'transparent',
                            borderBottomColor: colors.divider,
                            opacity: isAlreadyRegistered ? 0.6 : 1,
                          },
                        ]}
                      >
                        {/* Checkbox */}
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => toggleContactSelection(c)}
                          style={[
                            styles.checkbox,
                            {
                              borderColor: isAlreadyRegistered ? colors.divider : isSelected ? colors.accent : colors.divider,
                              backgroundColor: isAlreadyRegistered ? colors.trackBg : isSelected ? colors.accent : 'transparent',
                            },
                          ]}
                        >
                          {isAlreadyRegistered ? (
                            <Text style={{ fontSize: 10, color: colors.textDim }}>✕</Text>
                          ) : isSelected ? (
                            <Text style={styles.checkMark}>✓</Text>
                          ) : null}
                        </TouchableOpacity>

                        {/* Contact Info (Tapping opens edit modal if new, or shows alert if already registered) */}
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => {
                            if (isAlreadyRegistered) {
                              Alert.alert(
                                'Customer Already Exists',
                                `+91 ${c.phone} is already registered in your salon as "${existingCustomer?.name}". No duplicate will be added.`
                              );
                            } else {
                              handleEditContact(c);
                            }
                          }}
                          style={styles.contactInfo}
                        >
                          <Text style={[styles.contactName, { color: colors.text }]}>{c.name}</Text>
                          <Text style={[styles.contactPhone, { color: isAlreadyRegistered ? colors.accent : colors.textDim }]}>
                            +91 {c.phone} {isAlreadyRegistered ? `· Already in salon (${existingCustomer?.name})` : c.initialDue ? `· Due: ₹${c.initialDue}` : ''}
                          </Text>
                        </TouchableOpacity>

                        {/* Edit Details Action / Status Pill */}
                        {!isAlreadyRegistered ? (
                          <TouchableOpacity
                            onPress={() => handleEditContact(c)}
                            style={[styles.editPill, { borderColor: colors.divider }]}
                          >
                            <Text style={[styles.editPillText, { color: colors.accent }]}>Edit / Due</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={[styles.editPill, { borderColor: 'transparent', backgroundColor: 'rgba(217,164,65,0.1)' }]}>
                            <Text style={[styles.editPillText, { color: colors.accent, fontSize: 11 }]}>On File</Text>
                          </View>
                        )}
                      </View>
                    );
                  }}
                />
              )}

              {/* Import Action Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={isSubmitting || selectedCount === 0}
                onPress={handleImportSelected}
                style={[
                  styles.saveBtn,
                  {
                    backgroundColor: selectedCount > 0 ? colors.accent : colors.divider,
                    opacity: isSubmitting ? 0.7 : 1,
                  },
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#0D0E11" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {t('importSelected')} {selectedCount > 0 ? `(${selectedCount})` : ''}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* VIEW: EDIT CONTACT BEFORE IMPORT */}
          {viewMode === 'edit_contact' && (
            <View style={styles.manualContainer}>
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={() => setViewMode('contacts')}>
                  <Text style={[styles.backNavText, { color: colors.accent }]}>← {t('back')}</Text>
                </TouchableOpacity>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('editProfile')}</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Text style={[styles.closeBtnText, { color: colors.textDim }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                ref={manualScrollRef}
                style={{ maxHeight: keyboardHeight > 0 ? Math.min(420, Dimensions.get('window').height - keyboardHeight - 120) : undefined }}
                contentContainerStyle={{ paddingBottom: keyboardHeight > 0 ? 80 : 25 }}
                keyboardShouldPersistTaps="always"
                automaticallyAdjustKeyboardInsets={true}
                showsVerticalScrollIndicator={true}
              >
                <Text style={[styles.inputLabel, { color: colors.textDim }]}>{t('fullName')}</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text }]}
                  placeholder="e.g. Rahul Verma"
                  placeholderTextColor={colors.placeholder || colors.textDim}
                  value={name}
                  onChangeText={setName}
                />

                <Text style={[styles.inputLabel, { color: colors.textDim }]}>{t('mobileNumber')}</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text }]}
                  placeholder="10-digit mobile"
                  placeholderTextColor={colors.placeholder || colors.textDim}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={(val) => setPhone(val.replace(/\D/g, '').slice(0, 10))}
                />

                <Text style={[styles.inputLabel, { color: colors.textDim }]}>{t('initialDue')}</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text }]}
                  placeholder="0 (leave empty if none)"
                  placeholderTextColor={colors.placeholder || colors.textDim}
                  keyboardType="numeric"
                  value={initialDue}
                  onChangeText={setInitialDue}
                  onFocus={() => {
                    setTimeout(() => {
                      manualScrollRef.current?.scrollToEnd({ animated: true });
                    }, 180);
                  }}
                />

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSaveEditedContact}
                  style={[styles.saveBtn, { backgroundColor: colors.accent, marginTop: 18 }]}
                >
                  <Text style={styles.saveBtnText}>{t('saveChanges')}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {/* VIEW: MANUAL ADD OR EDIT */}
          {viewMode === 'manual' && (
            <View style={styles.manualContainer}>
              <View style={styles.sheetHeader}>
                {!customerToEdit && (
                  <TouchableOpacity onPress={() => setViewMode('choice')}>
                    <Text style={[styles.backNavText, { color: colors.accent }]}>← {t('back')}</Text>
                  </TouchableOpacity>
                )}
                <Text style={[styles.sheetTitle, { color: colors.text }]}>
                  {customerToEdit ? t('editProfile') : t('addCustomerManually')}
                </Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Text style={[styles.closeBtnText, { color: colors.textDim }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                ref={manualScrollRef}
                style={{ maxHeight: keyboardHeight > 0 ? Math.min(420, Dimensions.get('window').height - keyboardHeight - 120) : undefined }}
                contentContainerStyle={{ paddingBottom: keyboardHeight > 0 ? 80 : 25 }}
                keyboardShouldPersistTaps="always"
                automaticallyAdjustKeyboardInsets={true}
                showsVerticalScrollIndicator={true}
              >
                <Text style={[styles.inputLabel, { color: colors.textDim }]}>{t('fullName')}</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text }]}
                  placeholder="e.g. Sameer Khan"
                  placeholderTextColor={colors.placeholder || colors.textDim}
                  value={name}
                  onChangeText={setName}
                />

                <Text style={[styles.inputLabel, { color: colors.textDim }]}>{t('mobileNumber')}</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text }]}
                  placeholder="10-digit mobile"
                  placeholderTextColor={colors.placeholder || colors.textDim}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={(val) => setPhone(val.replace(/\D/g, '').slice(0, 10))}
                />

                <Text style={[styles.inputLabel, { color: colors.textDim }]}>
                  {customerToEdit ? t('outstandingDue') : t('initialDue')}
                </Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.placeholder || colors.textDim}
                  keyboardType="numeric"
                  value={initialDue}
                  onChangeText={setInitialDue}
                  onFocus={() => {
                    setTimeout(() => {
                      manualScrollRef.current?.scrollToEnd({ animated: true });
                    }, 180);
                  }}
                />

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setIsStarred(!isStarred)}
                  style={[styles.starToggleRow, { borderColor: colors.divider }]}
                >
                  <View style={[styles.starBox, { backgroundColor: isStarred ? colors.accent : 'transparent' }]}>
                    <Text style={{ fontSize: 13, color: isStarred ? '#0D0E11' : colors.textDim }}>★</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.starTitle, { color: colors.text }]}>{t('markMvp')}</Text>
                    <Text style={[styles.starDesc, { color: colors.textDim }]}>
                      {t('mvp')}
                    </Text>
                  </View>
                </TouchableOpacity>

                <Text style={[styles.inputLabel, { color: colors.textDim }]}>{t('notes')}</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text, height: 75 },
                  ]}
                  placeholder="e.g. Prefers scissor cut, skin fade regular"
                  placeholderTextColor={colors.placeholder || colors.textDim}
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                  onFocus={() => {
                    setTimeout(() => {
                      manualScrollRef.current?.scrollToEnd({ animated: true });
                    }, 180);
                  }}
                />

                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={isSubmitting}
                  onPress={handleSaveManual}
                  style={[styles.saveBtn, { backgroundColor: colors.accent, marginTop: 18 }]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#0D0E11" />
                  ) : (
                    <Text style={styles.saveBtnText}>
                      {customerToEdit ? t('saveChanges') : t('createCustomer')}
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1.5,
    maxHeight: '90%',
    padding: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sheetSubtitle: {
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '700',
  },
  backNavText: {
    fontSize: 14,
    fontWeight: '600',
  },
  choiceContainer: {
    paddingBottom: 20,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    gap: 14,
  },
  optionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionEmoji: {
    fontSize: 22,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  optionArrow: {
    fontSize: 18,
    fontWeight: '700',
  },
  contactsContainer: {
    maxHeight: 520,
  },
  searchInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 10,
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  selectAllBtn: {
    paddingVertical: 4,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '700',
  },
  selectionCount: {
    fontSize: 12,
  },
  contactsList: {
    maxHeight: 380,
    marginBottom: 14,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#0D0E11',
    fontSize: 13,
    fontWeight: '800',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 12,
  },
  editPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  editPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyContactsText: {
    textAlign: 'center',
    paddingVertical: 32,
    fontSize: 13,
  },
  manualContainer: {
    paddingBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 12,
    marginBottom: 6,
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  starToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
    gap: 12,
  },
  starBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9A441',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starTitle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  starDesc: {
    fontSize: 11.5,
  },
  saveBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  saveBtnText: {
    color: '#0D0E11',
    fontSize: 14.5,
    fontWeight: '700',
  },
});
