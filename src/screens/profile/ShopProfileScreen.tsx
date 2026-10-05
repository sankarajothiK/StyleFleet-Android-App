import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button } from '../../components/common/Button';
import { BackIcon, StoreIcon, EditIcon, ChevronDownIcon, ChevronRightIcon, TrashIcon } from '../../components/common/SvgIcons';
import { radii, shadows } from '../../theme/spacing';
import { supportRepository } from '../../repositories/supportRepository';
import { shopRepository } from '../../repositories/shopRepository';
import { supabase } from '../../lib/supabase';
import { generateInvoicePrefixFromShopName, sanitizeInvoicePrefix } from '../../utils/invoicePrefix';
import { ChangePhoneModal } from '../../components/accounts/ChangePhoneModal';
import { SubscriptionHistoryModal } from '../../components/subscription/SubscriptionHistoryModal';

interface ShopProfileScreenProps {
  shopId?: string;
  shopName: string;
  ownerName: string;
  phone: string;
  userId?: string;
  address: string;
  city: string;
  pinCode: string;
  gstin?: string;
  logoUrl?: string | null;
  currentGstRate?: number;
  teamCount: number;
  upiId?: string | null;
  invoicePrefix?: string | null;
  shopCreatedAt?: string | null;
  isPro?: boolean;
  totalSalesCount?: number;
  onBack: () => void;
  onUpgradePlan?: () => void;
  onUpdateLogo?: (logoPath: string) => Promise<void>;
  onUpdateGstRate?: (rate: number) => Promise<void>;
  onUpdateUpiId?: (upiId: string) => Promise<void>;
  onUpdateInvoicePrefix?: (prefix: string) => Promise<void>;
  onUpdateShop?: (updated: any) => void;
  onAccountDeleted?: () => void;
  onSignOut?: () => void;
  onPhoneUpdated?: (newPhone: string) => void;
}

export const ShopProfileScreen = ({
  shopId = '',
  shopName,
  ownerName,
  phone,
  userId,
  address,
  city,
  pinCode,
  gstin = 'Not specified',
  logoUrl,
  currentGstRate = 0,
  teamCount,
  upiId,
  invoicePrefix,
  shopCreatedAt,
  isPro = false,
  totalSalesCount = 0,
  onBack,
  onUpgradePlan,
  onUpdateLogo,
  onUpdateGstRate,
  onUpdateUpiId,
  onUpdateInvoicePrefix,
  onUpdateShop,
  onAccountDeleted,
  onSignOut,
  onPhoneUpdated,
}: ShopProfileScreenProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [currentLogo, setCurrentLogo] = useState<string | null>(logoUrl || null);
  const [isUpdatingLogo, setIsUpdatingLogo] = useState(false);
  const [showChangePhoneModal, setShowChangePhoneModal] = useState(false);
  const [showSubscriptionHistoryModal, setShowSubscriptionHistoryModal] = useState(false);
  const [activePhone, setActivePhone] = useState(phone);

  useEffect(() => {
    setActivePhone(phone);
  }, [phone]);

  // UPI ID for balance collection & WhatsApp bills
  const [currentUpiId, setCurrentUpiId] = useState<string>(upiId || '');
  const [editUpiId, setEditUpiId] = useState<string>(upiId || '');

  // Invoice Prefix Settings
  const initialPrefix = invoicePrefix || generateInvoicePrefixFromShopName(shopName);
  const [currentPrefix, setCurrentPrefix] = useState<string>(initialPrefix);
  const [showPrefixModal, setShowPrefixModal] = useState(false);
  const [editPrefixInput, setEditPrefixInput] = useState<string>(initialPrefix);
  const [isSavingPrefix, setIsSavingPrefix] = useState(false);

  // GST Settings (No 18% prefill)
  const isCustomRateConfigured = currentGstRate > 0 && currentGstRate !== 18;
  const [isGstEnabled, setIsGstEnabled] = useState(isCustomRateConfigured);
  const [gstRateInput, setGstRateInput] = useState(isCustomRateConfigured ? String(currentGstRate) : '');
  const [isUpdatingGst, setIsUpdatingGst] = useState(false);

  // Edit Salon Profile Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(shopName);
  const [editOwner, setEditOwner] = useState(ownerName);
  const [editAddress, setEditAddress] = useState(address);
  const [editCity, setEditCity] = useState(city);
  const [editPin, setEditPin] = useState(pinCode);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // In-app Privacy Policy Modal
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Appointment Booking Hours
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [bookingStartTime, setBookingStartTime] = useState('09:30 AM');
  const [bookingEndTime, setBookingEndTime] = useState('08:30 PM');
  const [tempStartTime, setTempStartTime] = useState('09:30 AM');
  const [tempEndTime, setTempEndTime] = useState('08:30 PM');
  const [isSavingHours, setIsSavingHours] = useState(false);
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

  // Invoice Numbering Mode ('monthly' | 'yearly')
  const [numberingMode, setNumberingMode] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const mode = await shopRepository.getInvoiceNumberingMode(shopId);
        if (isMounted) {
          setNumberingMode(mode);
        }
      } catch {}

      try {
        const pref = await shopRepository.getInvoicePrefix(shopId, shopName);
        if (isMounted && pref) {
          setCurrentPrefix(pref);
          setEditPrefixInput(pref);
        }
      } catch {}
    })();
    return () => {
      isMounted = false;
    };
  }, [shopId, shopName]);

  const handleSaveInvoicePrefix = async () => {
    try {
      setIsSavingPrefix(true);
      const clean = sanitizeInvoicePrefix(editPrefixInput, shopName);
      await shopRepository.setInvoicePrefix(shopId, clean);
      if (onUpdateInvoicePrefix) {
        await onUpdateInvoicePrefix(clean);
      }
      setCurrentPrefix(clean);
      setShowPrefixModal(false);
      Alert.alert(
        'Invoice Prefix Updated',
        `Invoice prefix set to "${clean}".\n\nFuture invoices will begin with "${clean}". Existing invoices remain unchanged.`
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save invoice prefix.');
    } finally {
      setIsSavingPrefix(false);
    }
  };

  const handleSelectNumberingMode = async (mode: 'monthly' | 'yearly') => {
    setNumberingMode(mode);
    await shopRepository.setInvoiceNumberingMode(shopId, mode);
    Alert.alert(
      'Invoice Numbering Updated',
      `Invoice numbering set to ${
        mode === 'monthly' ? `Monthly reset (e.g. ${currentPrefix}-${currentYear}-${currentMonthAbbr}-0001)` : `Yearly sequence (e.g. ${currentPrefix}-${currentYear}-0001)`
      }.\n\nExisting invoices remain unchanged.`
    );
  };

  const now = new Date();
  const currentYear = now.getFullYear();
  const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const currentMonthAbbr = MONTH_NAMES[now.getMonth()];
  const monthlyPreview = `${currentPrefix}-${currentYear}-${currentMonthAbbr}-0001`;
  const yearlyPreview = `${currentPrefix}-${currentYear}-0001`;

  useEffect(() => {
    setEditName(shopName);
    setEditOwner(ownerName);
    setEditAddress(address);
    setEditCity(city);
    setEditPin(pinCode);
  }, [shopName, ownerName, address, city, pinCode]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const hours = await shopRepository.getBookingHours(shopId);
        if (isMounted) {
          setBookingStartTime(hours.startTime);
          setBookingEndTime(hours.endTime);
          setTempStartTime(hours.startTime);
          setTempEndTime(hours.endTime);
        }
      } catch {
        // default
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [shopId]);

  const handleSaveBookingHours = async () => {
    if (!tempStartTime.trim() || !tempEndTime.trim()) {
      Alert.alert('Required', 'Please enter both start time and end time.');
      return;
    }
    setIsSavingHours(true);
    try {
      await shopRepository.saveBookingHours(shopId, tempStartTime.trim(), tempEndTime.trim());
      setBookingStartTime(tempStartTime.trim());
      setBookingEndTime(tempEndTime.trim());
      setShowHoursModal(false);
      Alert.alert(
        'Booking Hours Saved',
        `Appointment booking hours updated to ${tempStartTime.trim()} - ${tempEndTime.trim()}.`
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save booking hours');
    } finally {
      setIsSavingHours(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Required', 'Please enter salon name');
      return;
    }
    setIsSavingProfile(true);
    try {
      const updated = await shopRepository.updateShop(shopId, {
        name: editName.trim(),
        address: editAddress.trim(),
        city: editCity.trim(),
        pin_code: editPin.trim(),
        owner_name: editOwner.trim() || undefined,
        upi_id: editUpiId.trim() || null,
      });

      if (!updated) {
        Alert.alert('Error', 'Could not update salon profile.');
        return;
      }

      setCurrentUpiId(editUpiId.trim());

      if (onUpdateUpiId) {
        await onUpdateUpiId(editUpiId.trim());
      }

      if (editOwner.trim()) {
        const cached = await shopRepository.getShopById(shopId);
        const ownerProfileId = cached?.owner_profile_id || null;
        if (ownerProfileId) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ full_name: editOwner.trim() } as any)
            .eq('id', ownerProfileId);

          if (profileError) {
            Alert.alert('Error', profileError.message || 'Could not update owner profile');
            return;
          }
        }
        await shopRepository.saveOwnerName(editOwner.trim(), ownerProfileId);
      }

      if (onUpdateShop) {
        onUpdateShop({ ...updated, name: editName.trim(), owner_name: editOwner.trim(), upi_id: editUpiId.trim() || null });
      }
      setShowEditModal(false);
      Alert.alert('Profile Saved', 'Salon profile details updated in database successfully!');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePickLogo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery permission is required to change logo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newUri = result.assets[0].uri;
        setIsUpdatingLogo(true);
        setCurrentLogo(newUri);
        if (onUpdateLogo) {
          await onUpdateLogo(newUri);
        }
        setIsUpdatingLogo(false);
        Alert.alert('Logo Updated', 'Your salon logo has been saved.');
      }
    } catch (e: any) {
      setIsUpdatingLogo(false);
      Alert.alert('Notice', e.message || 'Could not change logo');
    }
  };

  const handleToggleGst = async () => {
    const nextState = !isGstEnabled;
    setIsGstEnabled(nextState);
    const rateToSave = nextState ? (parseFloat(gstRateInput) || 0) : 0;
    if (onUpdateGstRate) {
      await onUpdateGstRate(rateToSave);
    }
  };

  const handleSaveGstRate = async () => {
    const rate = parseFloat(gstRateInput);
    if (isNaN(rate) || rate < 0) {
      Alert.alert('Invalid Rate', 'Please enter a valid GST percentage (e.g. 5, 12, 18)');
      return;
    }

    setIsUpdatingGst(true);
    if (onUpdateGstRate) {
      await onUpdateGstRate(isGstEnabled ? rate : 0);
    }
    setIsUpdatingGst(false);
    Alert.alert('GST Updated', `GST on services set to ${isGstEnabled ? rate : 0}%.`);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <View style={styles.topBar}>
        <Button variant="icon" onPress={onBack}>
          <BackIcon size={18} color={colors.text} />
        </Button>
        <Text style={[styles.title, { color: colors.text }]}>{t('shopProfile', 'Shop Profile')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(80, keyboardHeight + 40) },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        showsVerticalScrollIndicator={false}
      >
        {/* Shop Info Card with Change Logo */}
        <View style={[styles.shopCard, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handlePickLogo}
            style={[
              styles.logoBox,
              {
                backgroundColor: colors.accent800,
                borderColor: 'rgba(217, 164, 65, 0.35)',
              },
            ]}
          >
            {currentLogo && (currentLogo.startsWith('http') || currentLogo.startsWith('data:') || currentLogo.startsWith('file:') || currentLogo.startsWith('content:')) ? (
              <Image source={{ uri: currentLogo.trim() }} style={styles.logoImage} onError={() => setCurrentLogo(null)} />
            ) : (
              <Text style={{ color: colors.accent100, fontSize: 16, fontWeight: '700' }}>
                {shopName ? shopName.slice(0, 2).toUpperCase() : 'SO'}
              </Text>
            )}
            <View style={[styles.logoEditBadge, { backgroundColor: colors.accent }]}>
              <EditIcon size={10} color="#000" />
            </View>
          </TouchableOpacity>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.shopName, { color: colors.text }]}>{shopName}</Text>
            <Text style={[styles.shopAddress, { color: colors.textDim }]}>
              {address}, {city} {pinCode}
            </Text>
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
              <TouchableOpacity onPress={handlePickLogo}>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>
                  📷 {t('changeLogo', 'Change Logo')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowEditModal(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <EditIcon size={13} color={colors.accent} />
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>
                  {t('editProfile', 'Edit Profile')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* GST ON SERVICES SECTION */}
        <Text style={[styles.sectionTitle, { color: colors.accent }]}>
          {t('gstOnServices', 'GST ON SERVICES')}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.gstRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{t('applyGst', 'Apply GST on Invoices')}</Text>
              <Text style={[styles.rowSub, { color: colors.textDim }]}>
                {isGstEnabled
                  ? (gstRateInput ? t('gstActive', 'Active at {rate}% GST rate').replace('{rate}', gstRateInput) : t('gstActive', 'Active at {rate}% GST rate').replace('{rate}', 'custom'))
                  : t('gstTurnedOff', 'Turned off (0% GST on all bills)')}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleToggleGst}
              style={[
                styles.toggleTrack,
                {
                  backgroundColor: isGstEnabled ? colors.accent800 : 'transparent',
                  borderColor: isGstEnabled ? colors.accent : colors.divider,
                },
              ]}
            >
              <View
                style={[
                  styles.toggleKnob,
                  {
                    left: isGstEnabled ? 18 : 2,
                    backgroundColor: isGstEnabled ? colors.accent200 : colors.textDim,
                  },
                ]}
              />
            </TouchableOpacity>
          </View>

          {isGstEnabled && (
            <View style={[styles.gstInputRow, { borderTopColor: colors.divider }]}>
              <Text style={{ color: colors.textDim, fontSize: 12 }}>{t('gstRate', 'Custom Rate %:')}</Text>
              <TextInput
                style={[
                  styles.gstTextInput,
                  { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text },
                ]}
                keyboardType="numeric"
                value={gstRateInput}
                onChangeText={setGstRateInput}
                placeholder="0"
                placeholderTextColor={colors.textDim}
              />
              <TouchableOpacity
                onPress={handleSaveGstRate}
                style={[styles.saveGstBtn, { backgroundColor: colors.accent }]}
              >
                <Text style={{ color: '#000', fontWeight: '600', fontSize: 12 }}>{t('apply', 'Apply')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* INVOICE SETTINGS */}
        <Text style={[styles.sectionTitle, { color: colors.accent }]}>
          {t('invoiceSettings', 'INVOICE SETTINGS')}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {/* Prefix Row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 14,
              borderBottomWidth: 1,
              borderBottomColor: colors.divider,
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                {t('invoicePrefix', 'Invoice Prefix')}
              </Text>
              <Text style={[styles.rowSub, { color: colors.textDim }]}>
                {t('invoicePrefixSub', 'Configured prefix for newly generated bills and invoices')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
                <View
                  style={{
                    backgroundColor: colors.bg,
                    borderWidth: 1,
                    borderColor: colors.accent,
                    borderRadius: radii.sm,
                    paddingVertical: 5,
                    paddingHorizontal: 12,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '800', color: colors.accent, letterSpacing: 1 }}>
                    [ {currentPrefix} ]
                  </Text>
                </View>
                <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                  Sample: {numberingMode === 'monthly' ? monthlyPreview : yearlyPreview}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setEditPrefixInput(currentPrefix);
                setShowPrefixModal(true);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.accent,
                paddingVertical: 7,
                paddingHorizontal: 13,
                borderRadius: radii.sm,
                gap: 5,
              }}
            >
              <EditIcon size={13} color="#000" />
              <Text style={{ color: '#000', fontWeight: '700', fontSize: 12 }}>{t('edit', 'Edit')}</Text>
            </TouchableOpacity>
          </View>

          {/* Numbering Sequence Mode */}
          <View style={{ paddingTop: 14 }}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              {t('numberingMode', 'Numbering Sequence Mode')}
            </Text>
            <Text style={[styles.rowSub, { color: colors.textDim, marginBottom: 12 }]}>
              {t('numberingSub', 'Choose whether invoice numbers reset each month or maintain a continuous yearly sequence.')}
            </Text>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* Monthly Option */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleSelectNumberingMode('monthly')}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: radii.md,
                  borderWidth: 1.5,
                  borderColor: numberingMode === 'monthly' ? colors.accent : colors.divider,
                  backgroundColor: numberingMode === 'monthly' ? colors.accent900 : colors.bg,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: numberingMode === 'monthly' ? colors.accent : colors.text }}>
                    Monthly Reset
                  </Text>
                  {numberingMode === 'monthly' && (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
                  )}
                </View>
                <Text style={{ fontSize: 11, color: colors.textDim }}>
                  Resets to 0001 each month
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: numberingMode === 'monthly' ? colors.accent : colors.textMuted, marginTop: 6 }}>
                  e.g. {monthlyPreview}
                </Text>
              </TouchableOpacity>

              {/* Yearly Option */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleSelectNumberingMode('yearly')}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: radii.md,
                  borderWidth: 1.5,
                  borderColor: numberingMode === 'yearly' ? colors.accent : colors.divider,
                  backgroundColor: numberingMode === 'yearly' ? colors.accent900 : colors.bg,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: numberingMode === 'yearly' ? colors.accent : colors.text }}>
                    Yearly Sequence
                  </Text>
                  {numberingMode === 'yearly' && (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
                  )}
                </View>
                <Text style={{ fontSize: 11, color: colors.textDim }}>
                  Continues through year
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: numberingMode === 'yearly' ? colors.accent : colors.textMuted, marginTop: 6 }}>
                  e.g. {yearlyPreview}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.divider }}>
            <Text style={{ fontSize: 11.5, color: colors.textSubtle }}>
              ⓘ Existing invoice numbers will never change. Only newly created bills follow the selected format.
            </Text>
          </View>
        </View>

        {/* APPOINTMENT BOOKING HOURS */}
        <Text style={[styles.sectionTitle, { color: colors.accent }]}>
          {t('appointmentHours', 'APPOINTMENT BOOKING HOURS')}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.gstRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                {bookingStartTime} — {bookingEndTime}
              </Text>
              <Text style={[styles.rowSub, { color: colors.textDim }]}>
                {t('appointmentHoursSub', 'Default daily appointment booking slot range')}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setTempStartTime(bookingStartTime);
                setTempEndTime(bookingEndTime);
                setShowHoursModal(true);
              }}
              style={{
                backgroundColor: colors.accent,
                paddingVertical: 7,
                paddingHorizontal: 14,
                borderRadius: radii.sm,
              }}
            >
              <Text style={{ color: '#000', fontWeight: '700', fontSize: 12 }}>
                {t('edit', 'Edit')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Details Rows */}
        <View style={styles.detailsList}>
          <View style={[styles.detailRow, { backgroundColor: colors.surface }]}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{t('owner', 'Owner')}</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{ownerName}</Text>
          </View>
          <View style={[styles.detailRow, { backgroundColor: colors.surface }]}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{t('loginNumber', 'Login number')}</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>+91 {phone}</Text>
          </View>
          <View style={[styles.detailRow, { backgroundColor: colors.surface }]}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{t('gstinLabel', 'GSTIN')}</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{gstin || 'None'}</Text>
          </View>
          <View style={[styles.detailRow, { backgroundColor: colors.surface }]}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>UPI ID</Text>
            <Text style={[styles.detailValue, { color: currentUpiId ? colors.accent : colors.textDim, fontWeight: currentUpiId ? '700' : '400' }]}>
              {currentUpiId || t('notSpecified', 'Not specified')}
            </Text>
          </View>
          <View style={[styles.detailRow, { backgroundColor: colors.surface }]}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{t('teamLabel', 'Team')}</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{teamCount} {t('stylistsCountLabel', 'stylists')}</Text>
          </View>
          <View style={[styles.detailRow, { backgroundColor: colors.surface }]}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{t('invoicePrefixLabel', 'Invoice prefix')}</Text>
            <Text style={[styles.detailValue, { color: colors.accent, fontWeight: '700' }]}>{currentPrefix}</Text>
          </View>
        </View>

        {/* EDIT PROFILE */}
        <View style={{ marginTop: 12, marginBottom: 16 }}>
          <Button
            label={t('editProfile', 'Edit Salon Profile')}
            icon={<EditIcon size={16} color="#000" />}
            variant="primary"
            block
            onPress={() => setShowEditModal(true)}
          />
        </View>

        {/* SUBSCRIPTION & BILLING */}
        <Text style={[styles.sectionTitle, { color: colors.accent }]}>
          {t('subscriptionAndBilling', 'SUBSCRIPTION & BILLING')}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface, marginBottom: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                {isPro ? 'StyleFleet Pro' : '30-Day Free Trial'}
              </Text>
              <Text style={[styles.rowSub, { color: colors.textDim }]}>
                {isPro
                  ? 'Unlimited bills, advanced reports & VIP salon features'
                  : 'Enjoying full-featured 30-day salon management trial'}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: isPro ? 'rgba(34, 197, 94, 0.15)' : 'rgba(217, 164, 65, 0.15)',
                borderColor: isPro ? '#22C55E' : colors.accent,
                borderWidth: 1,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: radii.sm,
              }}
            >
              <Text
                style={{
                  color: isPro ? '#22C55E' : colors.accent,
                  fontSize: 10,
                  fontWeight: '700',
                  letterSpacing: 0.5,
                }}
              >
                {isPro ? '✓ ACTIVE' : '👑 TRIAL'}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            {/* View Billing History Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowSubscriptionHistoryModal(true)}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.bg,
                borderColor: colors.divider,
                borderWidth: 1,
                paddingVertical: 10,
                borderRadius: radii.sm,
                gap: 6,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: '600' }}>
                📜 Billing History
              </Text>
            </TouchableOpacity>

            {/* Upgrade / Manage Button */}
            {onUpgradePlan && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onUpgradePlan}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.accent,
                  paddingVertical: 10,
                  borderRadius: radii.sm,
                }}
              >
                <Text style={{ color: '#0D0F14', fontSize: 12.5, fontWeight: '700' }}>
                  {isPro ? 'Manage Plan →' : 'Upgrade Plan →'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>


        <View style={{ height: 32 }} />
      </ScrollView>

        {/* EDIT SALON PROFILE MODAL (Saves directly to Supabase) */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setShowEditModal(false)}
            />
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'center',
                paddingBottom: Math.max(20, keyboardHeight + 20),
              }}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={true}
            >
              <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Salon Profile</Text>
                  <TouchableOpacity onPress={() => setShowEditModal(false)}>
                    <Text style={{ color: colors.textDim, fontSize: 16 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>

                <Text style={{ fontSize: 11, color: colors.textDim, marginBottom: 4 }}>Salon Name *</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text, marginBottom: 10 }]}
                  placeholder="Salon Name"
                  placeholderTextColor={colors.textDim}
                  value={editName}
                  onChangeText={setEditName}
                />

                <Text style={{ fontSize: 11, color: colors.textDim, marginBottom: 4 }}>Owner Name</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text, marginBottom: 10 }]}
                  placeholder="Owner Name"
                  placeholderTextColor={colors.textDim}
                  value={editOwner}
                  onChangeText={setEditOwner}
                />

                <Text style={{ fontSize: 11, color: colors.textDim, marginBottom: 4 }}>Address</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text, marginBottom: 10 }]}
                  placeholder="Street / Area Address"
                  placeholderTextColor={colors.textDim}
                  value={editAddress}
                  onChangeText={setEditAddress}
                />

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: colors.textDim, marginBottom: 4 }}>City</Text>
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text }]}
                      placeholder="City"
                      placeholderTextColor={colors.textDim}
                      value={editCity}
                      onChangeText={setEditCity}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: colors.textDim, marginBottom: 4 }}>Pincode</Text>
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text }]}
                      placeholder="6-digit PIN"
                      placeholderTextColor={colors.textDim}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={editPin}
                      onChangeText={(txt) => setEditPin(txt.replace(/\D/g, '').slice(0, 6))}
                    />
                  </View>
                </View>

                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 11, color: colors.textDim, marginBottom: 4 }}>
                    Salon UPI ID (for WhatsApp bills & partial payments)
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      {
                        backgroundColor: colors.bg,
                        borderColor: colors.divider,
                        color: colors.text,
                      },
                    ]}
                    placeholder="e.g. yoursalon@okaxis or 9876543210@paytm"
                    placeholderTextColor={colors.textDim}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={editUpiId}
                    onChangeText={setEditUpiId}
                  />
                </View>

                <TouchableOpacity
                  onPress={handleSaveProfile}
                  disabled={isSavingProfile}
                  style={[styles.modalAddBtn, { backgroundColor: colors.accent }]}
                >
                  {isSavingProfile ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={{ color: '#000', fontWeight: '700', fontSize: 14 }}>Save Changes to Database</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* 2. BOOKING HOURS MODAL                               */}
      {/* ---------------------------------------------------- */}
      <Modal visible={showHoursModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setShowHoursModal(false)}
            />
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'center',
                paddingBottom: Math.max(20, keyboardHeight + 20),
              }}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={true}
            >
              <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Salon Booking Hours</Text>
                  <TouchableOpacity onPress={() => setShowHoursModal(false)}>
                    <Text style={{ color: colors.textDim, fontSize: 16 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>

                <Text style={{ color: colors.textDim, fontSize: 12, lineHeight: 18, marginBottom: 12 }}>
                  Configure daily operating hours for appointment bookings. This updates the available time slots in your booking calendar.
                </Text>

                {/* Start Time Section */}
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, marginTop: 4, marginBottom: 6 }}>
                  Start Time
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {['08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM'].map((tStr) => {
                    const isSel = tempStartTime === tStr;
                    return (
                      <TouchableOpacity
                        key={tStr}
                        onPress={() => setTempStartTime(tStr)}
                        style={{
                          paddingVertical: 5,
                          paddingHorizontal: 9,
                          borderRadius: radii.sm,
                          borderWidth: 1,
                          borderColor: isSel ? colors.accent : colors.divider,
                          backgroundColor: isSel ? colors.accent800 : colors.bg,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '600', color: isSel ? colors.accent100 : colors.text }}>
                          {tStr}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text, marginBottom: 14 }]}
                  placeholder="e.g. 09:30 AM"
                  placeholderTextColor={colors.textDim}
                  value={tempStartTime}
                  onChangeText={setTempStartTime}
                />

                {/* End Time Section */}
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
                  End Time
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {['06:00 PM', '07:00 PM', '07:30 PM', '08:00 PM', '08:30 PM', '09:00 PM', '09:30 PM', '10:00 PM'].map((tStr) => {
                    const isSel = tempEndTime === tStr;
                    return (
                      <TouchableOpacity
                        key={tStr}
                        onPress={() => setTempEndTime(tStr)}
                        style={{
                          paddingVertical: 5,
                          paddingHorizontal: 9,
                          borderRadius: radii.sm,
                          borderWidth: 1,
                          borderColor: isSel ? colors.accent : colors.divider,
                          backgroundColor: isSel ? colors.accent800 : colors.bg,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '600', color: isSel ? colors.accent100 : colors.text }}>
                          {tStr}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text, marginBottom: 18 }]}
                  placeholder="e.g. 08:30 PM"
                  placeholderTextColor={colors.textDim}
                  value={tempEndTime}
                  onChangeText={setTempEndTime}
                />

                <TouchableOpacity
                  onPress={handleSaveBookingHours}
                  disabled={isSavingHours}
                  style={[styles.modalAddBtn, { backgroundColor: colors.accent }]}
                >
                  {isSavingHours ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={{ color: '#000', fontWeight: '700', fontSize: 14 }}>Save Booking Hours</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* 3. PRIVACY POLICY MODAL                              */}
      {/* ---------------------------------------------------- */}
      <Modal visible={showPrivacyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Privacy Policy</Text>
              <TouchableOpacity onPress={() => setShowPrivacyModal(false)}>
                <Text style={{ color: colors.accent, fontSize: 16 }}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400, marginTop: 12 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20 }}>
                Salon OS is committed to protecting the confidentiality and privacy of salon owners and
                their clients. All customer records, phone numbers, visit histories, and financial transactions
                are stored exclusively in dedicated, Row-Level-Security (RLS) protected Supabase PostgreSQL databases.
                {'\n\n'}
                1. Data Ownership: You retain 100% ownership of your business and customer data. We never sell,
                rent, or share customer contact lists with third parties.
                {'\n\n'}
                2. Security & Encryption: Data in transit is protected using TLS 1.3 encryption. Passwords and
                session tokens are managed via secure Supabase authentication.
                {'\n\n'}
                3. Permanent Erasure: At any time, salon owners may exercise their right to be forgotten and
                permanently delete their account and associated data.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* 4. EDIT INVOICE PREFIX MODAL                         */}
      {/* ---------------------------------------------------- */}
      <Modal
        visible={showPrefixModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPrefixModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.65)',
          }}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              padding: 20,
              paddingBottom: Math.max(20, keyboardHeight + 20),
            }}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={true}
          >
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radii.lg,
              padding: 22,
              borderWidth: 1,
              borderColor: colors.divider,
              maxWidth: 420,
              width: '100%',
              alignSelf: 'center',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 6 }}>
              Edit Invoice Prefix
            </Text>
            <Text style={{ fontSize: 12.5, color: colors.textDim, marginBottom: 18, lineHeight: 18 }}>
              Configure the prefix for newly generated bills and invoices. Existing invoices will retain their original numbers permanently.
            </Text>

            <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>
              Prefix Code (Max 8 Chars)
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.bg,
                borderWidth: 1.5,
                borderColor: colors.accent,
                borderRadius: radii.md,
                paddingHorizontal: 14,
                paddingVertical: 10,
                color: colors.text,
                fontSize: 16,
                fontWeight: '700',
                letterSpacing: 1.5,
                marginBottom: 10,
              }}
              value={editPrefixInput}
              onChangeText={(val) => setEditPrefixInput(val.toUpperCase())}
              autoCapitalize="characters"
              maxLength={8}
              placeholder="e.g. CS, CAP, RC"
              placeholderTextColor={colors.textDim}
            />

            <View style={{ backgroundColor: colors.bg, padding: 12, borderRadius: radii.sm, marginBottom: 20 }}>
              <Text style={{ fontSize: 11, color: colors.textDim }}>Format Preview:</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent, marginTop: 2 }}>
                {sanitizeInvoicePrefix(editPrefixInput || currentPrefix, shopName)}-{numberingMode === 'monthly' ? `${currentYear}-${currentMonthAbbr}-0001` : `${currentYear}-0001`}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowPrefixModal(false)}
                disabled={isSavingPrefix}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: radii.md,
                  borderWidth: 1,
                  borderColor: colors.divider,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.textMuted, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveInvoicePrefix}
                disabled={isSavingPrefix}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: radii.md,
                  backgroundColor: colors.accent,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {isSavingPrefix ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={{ color: '#000', fontWeight: '700' }}>Save Prefix</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>

    <ChangePhoneModal
      visible={showChangePhoneModal}
      currentPhone={activePhone}
      shopId={shopId}
      userId={userId}
      onClose={() => setShowChangePhoneModal(false)}
      onSuccess={(newPhone) => {
        setActivePhone(newPhone);
        onPhoneUpdated?.(newPhone);
        onUpdateShop?.({ phone: newPhone });
      }}
    />

    <SubscriptionHistoryModal
      visible={showSubscriptionHistoryModal}
      shopId={shopId}
      shopName={shopName}
      registrationDateIso={shopCreatedAt}
      totalSalesCount={totalSalesCount}
      onClose={() => setShowSubscriptionHistoryModal(false)}
      onUpgradePlan={onUpgradePlan}
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
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radii.md,
    marginBottom: 14,
  },
  logoBox: {
    width: 60,
    height: 60,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  logoEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopName: {
    fontSize: 16,
    fontWeight: '600',
  },
  shopAddress: {
    fontSize: 11.5,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 6,
  },
  card: {
    padding: 12,
    borderRadius: radii.md,
    marginBottom: 14,
  },
  rowTitle: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  rowSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  gstRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gstInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  gstTextInput: {
    width: 60,
    height: 36,
    borderWidth: 1,
    borderRadius: radii.sm,
    textAlign: 'center',
    fontSize: 13,
  },
  saveGstBtn: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
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
  themeCard: {
    padding: 12,
    borderRadius: radii.md,
    marginBottom: 14,
  },
  themeDescription: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  swatchesRow: {
    flexDirection: 'row',
    gap: 9,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 11,
    borderWidth: 2,
  },
  detailsList: {
    gap: 8,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: radii.md,
  },
  detailLabel: {
    flex: 1,
    fontSize: 13,
  },
  detailValue: {
    fontSize: 13,
  },
  outlineBtn: {
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalInput: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  modalAddBtn: {
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: 8,
  },
  accountMgmtCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 6,
  },
  accountMgmtHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  accountMgmtTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  accountMgmtSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  nestedAccountBox: {
    borderTopWidth: 1,
    paddingLeft: 12,
  },
  accountItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  accountItemTitle: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  accountItemSub: {
    fontSize: 11,
    marginTop: 1,
  },
});
