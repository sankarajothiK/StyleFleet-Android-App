import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Keyboard,
} from 'react-native';
import { Modal } from '../../components/common/KeyboardAwareModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../theme/ThemeContext';
import { GlassBackdrop } from '../../components/common/GlassBackdrop';
import { getGlass } from '../../theme/glass';
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
import { FREE_SALES_LIMIT } from '../../utils/subscriptionUtils';

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
  /** Free-plan sales limit for this salon */
  freeSalesLimit?: number;
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
  freeSalesLimit = FREE_SALES_LIMIT,
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
    const previousMode = numberingMode;
    setNumberingMode(mode);
    try {
      await shopRepository.setInvoiceNumberingMode(shopId, mode);
    } catch (e: any) {
      setNumberingMode(previousMode);
      Alert.alert('Error', e?.message || 'Could not change invoice numbering');
      return;
    }
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
        const previousLogo = currentLogo;
        setCurrentLogo(newUri);
        if (onUpdateLogo) {
          try {
            await onUpdateLogo(newUri);
          } catch (e) {
            setCurrentLogo(previousLogo);
            throw e;
          }
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
      try {
        await onUpdateGstRate(rateToSave);
      } catch (e: any) {
        setIsGstEnabled(!nextState);
        Alert.alert('Error', e?.message || 'Could not change GST');
      }
    }
  };

  const handleSaveGstRate = async () => {
    const rate = parseFloat(gstRateInput);
    if (isNaN(rate) || rate < 0) {
      Alert.alert('Invalid Rate', 'Please enter a valid GST percentage (e.g. 5, 12, 18)');
      return;
    }

    setIsUpdatingGst(true);
    try {
      if (onUpdateGstRate) {
        await onUpdateGstRate(isGstEnabled ? rate : 0);
      }
      Alert.alert('GST Updated', `GST on services set to ${isGstEnabled ? rate : 0}%.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save GST');
    } finally {
      setIsUpdatingGst(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <GlassBackdrop isDark={colors.isDark} />
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
        {/* SHOP + PLAN (one compact block) */}
        <View style={[styles.cCard, { ...getGlass(colors.isDark).raised, borderWidth: 1 }]}>
          <View style={styles.cHero}>
            <TouchableOpacity
              onPress={() => setShowEditModal(true)}
              activeOpacity={0.8}
              style={[styles.cHeroEdit, getGlass(colors.isDark).inset, { borderWidth: 1 }]}
            >
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>{t('edit', 'Edit')}</Text>
            </TouchableOpacity>

            {/* Floating logo orb: glow ring + raised disc */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handlePickLogo}
              accessibilityLabel={t('changeLogo', 'Change Logo')}
              style={[styles.cOrbGlow, { borderColor: colors.accent + '55', shadowColor: colors.accent }]}
            >
              <View style={[styles.cOrb, getGlass(colors.isDark).raised, { borderWidth: 1.5, borderColor: colors.accent }]}>
                {currentLogo && (currentLogo.startsWith('http') || currentLogo.startsWith('data:') || currentLogo.startsWith('file:') || currentLogo.startsWith('content:')) ? (
                  <Image source={{ uri: currentLogo.trim() }} style={styles.logoImage} onError={() => setCurrentLogo(null)} />
                ) : (
                  <Text style={{ color: colors.accent, fontSize: 20, fontWeight: '800' }}>
                    {shopName ? shopName.slice(0, 2).toUpperCase() : 'SO'}
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            <Text numberOfLines={2} style={[styles.cHeroName, { color: colors.text }]}>{shopName}</Text>
            <Text numberOfLines={2} style={[styles.cHeroAddr, { color: colors.textDim }]}>
              {address}, {city} {pinCode}
            </Text>

            <View style={styles.cChipRow}>
              {[
                { label: t('owner', 'Owner'), value: ownerName },
                { label: t('teamLabel', 'Team'), value: `${teamCount}` },
                { label: 'GST', value: isGstEnabled ? `${gstRateInput || 0}%` : '0%' },
              ].map((c) => (
                <View key={c.label} style={[styles.cChip, getGlass(colors.isDark).raised, { borderWidth: 1 }]}>
                  <Text numberOfLines={1} style={{ color: colors.textDim, fontSize: 10, fontWeight: '600' }}>{c.label}</Text>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 0 }}>{c.value}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.cDivider, { backgroundColor: colors.divider }]} />

          <View style={styles.cRow}>
            <Text style={[styles.cLabel, { color: colors.text, flex: 1 }]}>
              {isPro ? 'Pro plan active' : `${totalSalesCount}/${freeSalesLimit} sales`}
            </Text>
            {onUpgradePlan && (
              <TouchableOpacity
                style={[styles.cPrimaryBtn, { backgroundColor: colors.accent }]}
                activeOpacity={0.85}
                onPress={onUpgradePlan}
              >
                <Text style={styles.cPrimaryBtnText}>{isPro ? 'Manage' : 'Upgrade'}</Text>
              </TouchableOpacity>
            )}
          </View>
          {!isPro && (
            <View style={[styles.planTrack, { backgroundColor: colors.trackBg, marginTop: 6 }]}>
              <View
                style={[
                  styles.planFill,
                  {
                    width: `${Math.min(Math.round((totalSalesCount / freeSalesLimit) * 100), 100)}%`,
                    backgroundColor: colors.accent,
                  },
                ]}
              />
            </View>
          )}
        </View>

        {/* BILLING SETTINGS: GST + invoice + booking hours in one card */}
        <Text style={[styles.cSection, { color: colors.accent }]}>{t('invoiceSettings', 'INVOICE SETTINGS')}</Text>
        <View style={[styles.cCard, { ...getGlass(colors.isDark).raised, borderWidth: 1 }]}>
          {/* GST */}
          <View style={styles.cRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.cLabel, { color: colors.text }]}>{t('applyGst', 'Apply GST on Invoices')}</Text>
              <Text numberOfLines={1} style={[styles.cMeta, { color: colors.textDim }]}>
                {isGstEnabled
                  ? t('gstActive', 'Active at {rate}% GST rate').replace('{rate}', gstRateInput || 'custom')
                  : t('gstTurnedOff', 'Turned off (0% GST on all bills)')}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleToggleGst}
              accessibilityRole="switch"
              accessibilityState={{ checked: isGstEnabled }}
              style={[
                styles.toggleTrack,
                isGstEnabled
                  ? { backgroundColor: colors.accent, borderColor: colors.accent }
                  : { ...getGlass(colors.isDark).inset, borderWidth: 1 },
              ]}
            >
              <View
                style={[
                  styles.toggleKnob,
                  { left: isGstEnabled ? 18 : 2, backgroundColor: isGstEnabled ? '#161826' : colors.textDim },
                ]}
              />
            </TouchableOpacity>
          </View>
          {isGstEnabled && (
            <View style={[styles.cRow, { marginTop: 8, gap: 8 }]}>
              <Text style={{ color: colors.textDim, fontSize: 12 }}>{t('gstRate', 'Custom Rate %:')}</Text>
              <TextInput
                style={[styles.gstTextInput, getGlass(colors.isDark).inset, { borderWidth: 1, color: colors.text }]}
                keyboardType="numeric"
                value={gstRateInput}
                onChangeText={setGstRateInput}
                placeholder="0"
                placeholderTextColor={colors.textDim}
              />
              <TouchableOpacity onPress={handleSaveGstRate} style={[styles.cPrimaryBtn, { backgroundColor: colors.accent }]}>
                <Text style={styles.cPrimaryBtnText}>{t('apply', 'Apply')}</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.cDivider, { backgroundColor: colors.divider }]} />

          {/* Invoice prefix */}
          <View style={styles.cRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.cLabel, { color: colors.text }]}>{t('invoicePrefix', 'Invoice Prefix')}</Text>
              <Text numberOfLines={1} style={[styles.cMeta, { color: colors.textDim }]}>
                {currentPrefix} · {numberingMode === 'monthly' ? monthlyPreview : yearlyPreview}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setEditPrefixInput(currentPrefix);
                setShowPrefixModal(true);
              }}
              style={[styles.cPillBtn, { borderColor: colors.accent }]}
            >
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>{t('edit', 'Edit')}</Text>
            </TouchableOpacity>
          </View>

          {/* Numbering mode */}
          <View style={styles.cSegment}>
            {([
              { id: 'monthly' as const, title: 'Monthly Reset', sub: monthlyPreview },
              { id: 'yearly' as const, title: 'Yearly Sequence', sub: yearlyPreview },
            ]).map((opt) => {
              const on = numberingMode === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.8}
                  onPress={() => handleSelectNumberingMode(opt.id)}
                  style={[
                    styles.cSegmentTab,
                    on
                      ? { borderColor: colors.accent, backgroundColor: colors.accent + '1F' }
                      : { ...getGlass(colors.isDark).inset, borderWidth: 1.5 },
                  ]}
                >
                  <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '700', color: on ? colors.accent : colors.text }}>
                    {opt.title}
                  </Text>
                  <Text numberOfLines={1} style={{ fontSize: 11, color: colors.textDim, marginTop: 1 }}>
                    {opt.sub}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.cDivider, { backgroundColor: colors.divider }]} />

          {/* Booking hours */}
          <View style={styles.cRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.cLabel, { color: colors.text }]}>{t('appointmentHours', 'APPOINTMENT BOOKING HOURS')}</Text>
              <Text numberOfLines={1} style={[styles.cMeta, { color: colors.textDim }]}>
                {bookingStartTime} — {bookingEndTime}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setTempStartTime(bookingStartTime);
                setTempEndTime(bookingEndTime);
                setShowHoursModal(true);
              }}
              style={[styles.cPillBtn, { borderColor: colors.accent }]}
            >
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>{t('edit', 'Edit')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SALON DETAILS: one card, thin rows */}
        <Text style={[styles.cSection, { color: colors.accent }]}>{t('shopProfile', 'Shop Profile').toUpperCase()}</Text>
        <View style={[styles.cCard, { ...getGlass(colors.isDark).raised, borderWidth: 1, paddingVertical: 4 }]}>
          {[
            { label: t('owner', 'Owner'), value: ownerName, color: colors.text },
            { label: t('loginNumber', 'Login number'), value: `+91 ${phone}`, color: colors.text },
            { label: t('gstinLabel', 'GSTIN'), value: gstin || 'None', color: colors.text },
            { label: 'UPI ID', value: currentUpiId || t('notSpecified', 'Not specified'), color: currentUpiId ? colors.accent : colors.textDim },
            { label: t('teamLabel', 'Team'), value: `${teamCount} ${t('stylistsCountLabel', 'stylists')}`, color: colors.text },
          ].map((row, idx) => (
            <View
              key={row.label}
              style={[styles.cDetailRow, idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }]}
            >
              <Text style={[styles.cMeta, { color: colors.textMuted, flexShrink: 0 }]}>{row.label}</Text>
              <Text numberOfLines={1} style={[styles.cDetailValue, { color: row.color }]}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* SUBSCRIPTION & BILLING */}
        <Text style={[styles.cSection, { color: colors.accent }]}>{t('subscriptionAndBilling', 'SUBSCRIPTION & BILLING')}</Text>
        <View style={[styles.cCard, { ...getGlass(colors.isDark).raised, borderWidth: 1 }]}>
          <View style={styles.cRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[styles.cLabel, { color: colors.text }]}>
                {isPro ? 'StyleFleet Pro' : '30-Day Free Trial'}
              </Text>
              <Text numberOfLines={2} style={[styles.cMeta, { color: colors.textDim }]}>
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
              <Text style={{ color: isPro ? '#22C55E' : colors.accent, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
                {isPro ? 'ACTIVE' : 'TRIAL'}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowSubscriptionHistoryModal(true)}
              style={[styles.cGhostBtn, { borderColor: colors.divider }]}
            >
              <Text numberOfLines={1} style={{ color: colors.text, fontSize: 12.5, fontWeight: '600' }}>Billing History</Text>
            </TouchableOpacity>
            {onUpgradePlan && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onUpgradePlan}
                style={[styles.cGhostBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
              >
                <Text numberOfLines={1} style={{ color: '#0D0F14', fontSize: 12.5, fontWeight: '700' }}>
                  {isPro ? 'Manage Plan' : 'Upgrade Plan'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={{ height: 16 }} />
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
                    <Text style={{ color: '#000', fontWeight: '700', fontSize: 14 }}>{t('saveChanges', 'Save Changes')}</Text>
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
      freeSalesLimit={freeSalesLimit}
      onClose={() => setShowSubscriptionHistoryModal(false)}
      onUpgradePlan={onUpgradePlan}
    />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  cCard: { padding: 10, borderRadius: radii.md, marginBottom: 8 },
  cSection: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1, marginTop: 4, marginBottom: 6 },
  cHero: { alignItems: 'center', paddingTop: 0 },
  cHeroEdit: { position: 'absolute', right: 0, top: 0, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, zIndex: 2 },
  cOrbGlow: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  cOrb: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cHeroName: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3, marginTop: 6, textAlign: 'center' },
  cHeroAddr: { fontSize: 11.5, marginTop: 1, textAlign: 'center', paddingHorizontal: 10 },
  cChipRow: { flexDirection: 'row', gap: 6, marginTop: 8, alignSelf: 'stretch' },
  cChip: { flex: 1, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 8, alignItems: 'center' },
  cShopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cShopName: { fontSize: 15, fontWeight: '700' },
  cMeta: { fontSize: 11.5, marginTop: 1 },
  cLabel: { fontSize: 13.5, fontWeight: '600' },
  cRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cDivider: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
  cPillBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  cPrimaryBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  cPrimaryBtnText: { color: '#0D0F14', fontSize: 12, fontWeight: '700' },
  cSegment: { flexDirection: 'row', gap: 8, marginTop: 10 },
  cSegmentTab: { flex: 1, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radii.sm, borderWidth: 1.5 },
  cDetailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 9 },
  cDetailValue: { flex: 1, textAlign: 'right', fontSize: 13, fontWeight: '600' },
  cGhostBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  planCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  planHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planCountText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  planBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radii.sm,
  },
  planBtnText: {
    color: '#0D0F14',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  planTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  planFill: {
    height: '100%',
    borderRadius: 4,
  },
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
    minHeight: 36,
    borderWidth: 1,
    borderRadius: radii.sm,
    textAlign: 'center',
    fontSize: 13,
  },
  saveGstBtn: {
    paddingHorizontal: 12,
    minHeight: 36,
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
    minHeight: 44,
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
