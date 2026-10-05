import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { BackIcon, CheckIcon, SearchIcon, PlusIcon, UserPlusIcon, UsersIcon } from '../../components/common/SvgIcons';
import { Customer, StaffMember, Service, Appointment } from '../../types/domain';
import { inr, inrFromMinor, getInitials } from '../../utils/format';
import { radii, shadows } from '../../theme/spacing';
import { Button } from '../../components/common/Button';
import { QuickContactPickerModal } from '../../components/customers/QuickContactPickerModal';
import { shopRepository } from '../../repositories/shopRepository';

export function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    const meridian = match12[3].toUpperCase();
    if (meridian === 'PM' && h < 12) h += 12;
    if (meridian === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const h = parseInt(match24[1], 10);
    const m = parseInt(match24[2], 10);
    return h * 60 + m;
  }
  return null;
}

export function formatMinutesToAmPm(totalMinutes: number): string {
  let h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const meridian = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  const hStr = h12 < 10 ? `0${h12}` : `${h12}`;
  const mStr = m < 10 ? `0${m}` : `${m}`;
  return `${hStr}:${mStr} ${meridian}`;
}

export const DEFAULT_ALL_TIME_SLOTS = [
  { label: '09:30 AM', hour: 9, min: 30 },
  { label: '10:00 AM', hour: 10, min: 0 },
  { label: '10:30 AM', hour: 10, min: 30 },
  { label: '11:00 AM', hour: 11, min: 0 },
  { label: '11:30 AM', hour: 11, min: 30 },
  { label: '12:00 PM', hour: 12, min: 0 },
  { label: '12:30 PM', hour: 12, min: 30 },
  { label: '01:00 PM', hour: 13, min: 0 },
  { label: '02:00 PM', hour: 14, min: 0 },
  { label: '02:30 PM', hour: 14, min: 30 },
  { label: '03:00 PM', hour: 15, min: 0 },
  { label: '03:30 PM', hour: 15, min: 30 },
  { label: '04:00 PM', hour: 16, min: 0 },
  { label: '04:30 PM', hour: 16, min: 30 },
  { label: '05:00 PM', hour: 17, min: 0 },
  { label: '05:30 PM', hour: 17, min: 30 },
  { label: '06:00 PM', hour: 18, min: 0 },
  { label: '06:30 PM', hour: 18, min: 30 },
  { label: '07:00 PM', hour: 19, min: 0 },
  { label: '07:30 PM', hour: 19, min: 30 },
  { label: '08:00 PM', hour: 20, min: 0 },
  { label: '08:30 PM', hour: 20, min: 30 },
];

export function generateTimeSlots(
  startStr = '09:30 AM',
  endStr = '08:30 PM'
): { label: string; hour: number; min: number }[] {
  const start = parseTimeToMinutes(startStr) ?? (9 * 60 + 30);
  const end = parseTimeToMinutes(endStr) ?? (20 * 60 + 30);
  if (end <= start) return DEFAULT_ALL_TIME_SLOTS;

  const slots: { label: string; hour: number; min: number }[] = [];
  let current = start;
  while (current <= end) {
    const hour = Math.floor(current / 60);
    const min = current % 60;
    const label = formatMinutesToAmPm(current);
    slots.push({ label, hour, min });
    current += 30;
  }
  return slots.length > 0 ? slots : DEFAULT_ALL_TIME_SLOTS;
}

function getSlotHourMin(timeStr?: string): { hour: number; min: number } | null {
  if (!timeStr) return null;
  const ampmMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2], 10);
    const meridian = ampmMatch[3].toUpperCase();
    if (meridian === 'PM' && h < 12) h += 12;
    if (meridian === 'AM' && h === 12) h = 0;
    return { hour: h, min: m };
  }
  const iso24Match = timeStr.match(/(?:T|\s)(\d{1,2}):(\d{2})/);
  if (iso24Match) {
    return { hour: parseInt(iso24Match[1], 10), min: parseInt(iso24Match[2], 10) };
  }
  const simpleMatch = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (simpleMatch) {
    let h = parseInt(simpleMatch[1], 10);
    const m = parseInt(simpleMatch[2], 10);
    if (h >= 1 && h <= 7) h += 12;
    return { hour: h, min: m };
  }
  return null;
}

function getApptDateStr(appt: Appointment): string {
  if (appt.starts_at) {
    const m = appt.starts_at.match(/\d{4}-\d{2}-\d{2}/);
    if (m) return m[0];
  }
  if (appt.created_at) {
    const m = appt.created_at.match(/\d{4}-\d{2}-\d{2}/);
    if (m) return m[0];
  }
  return '';
}

interface BookingScreenProps {
  customers: Customer[];
  services: Service[];
  staff: StaffMember[];
  appointments?: Appointment[];
  initialCustomerId?: string | null;
  onBack: () => void;
  onAddNewCustomer?: (name: string, phone: string) => Promise<Customer>;
  onConfirmBooking: (booking: {
    customerName: string;
    customerId?: string | null;
    customerPhone?: string | null;
    serviceName: string;
    serviceId?: string | null;
    serviceIds?: string[];
    serviceQuantities?: Record<string, number>;
    stylistName: string;
    stylistId?: string | null;
    stylistIds?: string[];
    slot: string;
    dateStr: string;
    amountRupees: number;
    sendConfirm: boolean;
  }) => void;
  ownerName?: string;
  totalSalesCount?: number;
  isPro?: boolean;
  onUpgradePlan?: () => void;
}

export const BookingScreen = ({
  customers,
  services,
  staff,
  appointments = [],
  initialCustomerId,
  ownerName = 'Owner',
  totalSalesCount = 0,
  isPro = false,
  onBack,
  onAddNewCustomer,
  onConfirmBooking,
  onUpgradePlan,
}: BookingScreenProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  // Customer selection state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    initialCustomerId || null
  );
  const [customerSearch, setCustomerSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
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

  // Dynamic booking hours from shop settings
  const [bookingHours, setBookingHours] = useState<{ startTime: string; endTime: string }>({
    startTime: '09:30 AM',
    endTime: '08:30 PM',
  });

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const hours = await shopRepository.getBookingHours();
        if (isMounted) {
          setBookingHours(hours);
        }
      } catch {
        // default
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const timeSlots = useMemo(() => {
    return generateTimeSlots(bookingHours.startTime, bookingHours.endTime);
  }, [bookingHours.startTime, bookingHours.endTime]);

  // Service multi-selection & Multi-quantity state (no services pre-selected)
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [serviceQuantities, setServiceQuantities] = useState<Record<string, number>>({});
  const [isServicesExpanded, setIsServicesExpanded] = useState(false);

  // Stylist selection: can select 1 or 2 stylists, or "No Stylist (Owner)".
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [isOwnerSelected, setIsOwnerSelected] = useState<boolean>(false);

  // Date selection - strictly Today and future days (no past dates). null means nothing pre-selected.
  const [selectedDayOffset, setSelectedDayOffset] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [sendConfirm, setSendConfirm] = useState(true);

  // Generate next 14 days starting from Today
  const upcomingDays = useMemo(() => {
    const days: { offset: number; dateStr: string; dayLabel: string; dateNum: number; fullDate: Date }[] = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const dayLabel = i === 0 ? t('today') : d.toLocaleDateString('en-US', { weekday: 'short' });
      const dateNum = d.getDate();
      const dateStr = d.toISOString().split('T')[0];
      days.push({ offset: i, dateStr, dayLabel, dateNum, fullDate: d });
    }
    return days;
  }, [t]);

  const selectedDay = selectedDayOffset !== null ? upcomingDays[selectedDayOffset] : null;

  // Check if slot has already passed if today is selected
  const now = new Date();
  const isSelectedDateToday = selectedDayOffset === 0;

  // Filtered customers for search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 5);
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [customers, customerSearch]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;

  const selectedStaffMembers = useMemo(() => {
    return selectedStaffIds
      .map((id) => staff.find((s) => s.id === id))
      .filter((s): s is StaffMember => Boolean(s));
  }, [selectedStaffIds, staff]);

  const combinedStylistName = useMemo(() => {
    const names: string[] = [];
    if (isOwnerSelected) {
      names.push(ownerName || 'Owner');
    }
    selectedStaffMembers.forEach((s) => {
      names.push(s.name);
    });

    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} & ${names[1]}`;
    return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
  }, [isOwnerSelected, selectedStaffMembers, ownerName]);

  const hasStylistSelection = isOwnerSelected || selectedStaffIds.length > 0;

  // Booked slots map for the selected stylist(s) on the selected date (fast, zero lag)
  const bookedSlotsMap = useMemo(() => {
    const map = new Map<string, { appt: Appointment; stylistName: string }>();
    if (!hasStylistSelection || !selectedDay || selectedStaffMembers.length === 0) return map;

    const targetDate = selectedDay.dateStr;

    for (const a of appointments) {
      if (a.status === 'Cancelled' || a.status === 'Done') continue;
      const matchedStylist = selectedStaffMembers.find(
        (s) =>
          a.staff_id === s.id ||
          (a.staff_name && a.staff_name.toLowerCase().includes(s.name.trim().toLowerCase()))
      );
      if (!matchedStylist) continue;

      const apptDate = getApptDateStr(a);
      if (apptDate) {
        if (apptDate !== targetDate) continue;
      } else {
        // If appointment does not have a date, check if created_at matches targetDate
        const createdDate = a.created_at ? a.created_at.slice(0, 10) : '';
        if (createdDate !== targetDate) continue;
      }

      const raw = (a.starts_at || '').toUpperCase();
      const hm = getSlotHourMin(a.starts_at);

      for (const sl of timeSlots) {
        const cleanSlot = sl.label.toUpperCase();
        const noLeadingZero = cleanSlot.replace(/^0/, '');
        if (raw.includes(cleanSlot) || raw.includes(noLeadingZero)) {
          map.set(sl.label, { appt: a, stylistName: matchedStylist.name });
          break;
        } else if (hm && hm.hour === sl.hour && hm.min === sl.min) {
          map.set(sl.label, { appt: a, stylistName: matchedStylist.name });
          break;
        }
      }
    }
    return map;
  }, [hasStylistSelection, isOwnerSelected, selectedDay, selectedStaffMembers, appointments, timeSlots]);

  // Deselect slot if it conflicts with a booked slot
  React.useEffect(() => {
    if (selectedSlot && bookedSlotsMap.has(selectedSlot)) {
      setSelectedSlot(null);
    }
  }, [selectedSlot, bookedSlotsMap]);

  // Selected services list & totals with multi-quantity
  const selectedServices = useMemo(() => {
    return services.filter((s) => selectedServiceIds.includes(s.id));
  }, [services, selectedServiceIds]);

  const totalBookingRupees = useMemo(() => {
    return selectedServices.reduce((acc, s) => {
      const qty = serviceQuantities[s.id] || 1;
      return acc + Math.round(s.price_minor / 100) * qty;
    }, 0);
  }, [selectedServices, serviceQuantities]);

  const combinedServiceName = useMemo(() => {
    return selectedServices
      .map((s) => {
        const qty = serviceQuantities[s.id] || 1;
        return qty > 1 ? `${s.name} × ${qty}` : s.name;
      })
      .join(' + ') || '';
  }, [selectedServices, serviceQuantities]);

  const totalSelectedCount = useMemo(() => {
    return selectedServiceIds.reduce((sum, id) => sum + (serviceQuantities[id] || 1), 0);
  }, [selectedServiceIds, serviceQuantities]);

  // Repeated tapping increments quantity (1 -> 2 -> 3...)
  const handleServicePress = (svcId: string) => {
    setSelectedServiceIds((prev) => {
      if (!prev.includes(svcId)) {
        return [...prev, svcId];
      }
      return prev;
    });
    setServiceQuantities((prev) => ({
      ...prev,
      [svcId]: (prev[svcId] || 0) + 1,
    }));
  };

  const handleDecrementOrRemoveService = (svcId: string) => {
    setServiceQuantities((prev) => {
      const currentQty = prev[svcId] || 1;
      if (currentQty > 1) {
        return { ...prev, [svcId]: currentQty - 1 };
      }
      const next = { ...prev };
      delete next[svcId];
      return next;
    });
    setSelectedServiceIds((prev) => {
      const currentQty = serviceQuantities[svcId] || 1;
      if (currentQty > 1) {
        return prev;
      }
      return prev.filter((id) => id !== svcId);
    });
  };

  const toggleService = handleServicePress;

  // Categorised service groups
  const categoryGroups = useMemo(() => {
    const categories = ['Hair', 'Beard', 'Colour', 'Care', 'Packages'] as const;
    const groups: { category: string; services: Service[] }[] = [];

    for (const cat of categories) {
      const catServices = services.filter((s) => s.category_name === cat);
      if (catServices.length > 0) {
        groups.push({ category: cat, services: catServices });
      }
    }

    const otherServices = services.filter(
      (s) => !categories.includes(s.category_name as any)
    );
    if (otherServices.length > 0) {
      groups.push({ category: 'Other Services', services: otherServices });
    }

    return groups;
  }, [services]);

  // Popular services sorted at top
  const popularServices = useMemo(() => {
    return services.slice(0, 6);
  }, [services]);

  const handleQuickAddClient = async () => {
    if (!newClientName.trim()) {
      Alert.alert('Name Required', 'Please enter customer name');
      return;
    }
    const cleanPhone = newClientPhone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Mobile', 'Please enter a valid 10-digit mobile number');
      return;
    }

    // Check if phone already belongs to an existing customer
    const existing = customers.find((c) => c.phone.replace(/\D/g, '').slice(-10) === cleanPhone);
    if (existing) {
      Alert.alert(
        'Customer Already Exists',
        `A customer with mobile +91 ${cleanPhone} already exists (${existing.name}). Selected existing customer.`
      );
      setSelectedCustomerId(existing.id);
      setIsAddClientModalOpen(false);
      setNewClientName('');
      setNewClientPhone('');
      setCustomerSearch('');
      return;
    }

    try {
      if (onAddNewCustomer) {
        const created = await onAddNewCustomer(newClientName.trim(), cleanPhone);
        setSelectedCustomerId(created.id);
      }
      setIsAddClientModalOpen(false);
      setNewClientName('');
      setNewClientPhone('');
      setCustomerSearch('');
    } catch (e: any) {
      Alert.alert('Notice', e.message || 'Could not save customer');
    }
  };

  const isSelectedSlotLocked = Boolean(selectedSlot && bookedSlotsMap.has(selectedSlot));

  const bookIncomplete =
    !selectedCustomer ||
    selectedServices.length === 0 ||
    !hasStylistSelection ||
    selectedDayOffset === null ||
    !selectedDay ||
    !selectedSlot ||
    isSelectedSlotLocked;

  const handleConfirm = () => {
    // 100-sales free limit check: appointments and billing require Pro after 100 sales
    if (totalSalesCount >= 100 && !isPro) {
      Alert.alert(
        '100-Sales Limit Reached',
        'You have completed the free limit of 100 sales on this salon account.\n\nPlease upgrade to Pro to continue booking appointments and creating bills.',
        [
          { text: 'Upgrade to Pro', onPress: () => onUpgradePlan?.() },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    if (!selectedCustomer) {
      Alert.alert(
        'Client Required',
        'Please select or add a client for this appointment. Walk-in bookings are disabled.',
        [
          { text: '+ Add Client', onPress: () => setIsAddClientModalOpen(true) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    if (bookIncomplete || !selectedDay) return;

    const custName = selectedCustomer.name;
    const custPhone = selectedCustomer.phone;
    const stylistName = combinedStylistName || (ownerName || 'Owner');

    onConfirmBooking({
      customerName: custName,
      customerId: selectedCustomer.id,
      customerPhone: custPhone,
      serviceName: combinedServiceName,
      serviceId: selectedServiceIds[0] || null,
      serviceIds: selectedServiceIds,
      serviceQuantities: serviceQuantities,
      stylistName: stylistName,
      stylistId: selectedStaffIds[0] || null,
      stylistIds: selectedStaffIds,
      slot: selectedSlot!,
      dateStr: selectedDay.dateStr,
      amountRupees: totalBookingRupees,
      sendConfirm,
    });
  };

  const ctaText = !selectedCustomer
    ? 'Select Client'
    : selectedServices.length === 0
    ? t('selectServices')
    : !hasStylistSelection
    ? 'Select Stylist'
    : selectedDayOffset === null || !selectedDay
    ? 'Select Date'
    : !selectedSlot
    ? 'Select Time Slot'
    : isSelectedSlotLocked
    ? 'Slot Locked · Pick Another Slot'
    : `${t('confirmBooking')} · ${selectedDay.dayLabel} ${selectedSlot}`;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <View style={styles.topBar}>
        <Button variant="icon" onPress={onBack}>
          <BackIcon size={18} color={colors.text} />
        </Button>
        <Text style={[styles.title, { color: colors.text }]}>{t('newAppointment')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(140, keyboardHeight + 80) },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        showsVerticalScrollIndicator={false}
      >
        {/* ======================================================== */}
        {/* 1. CUSTOMER SELECTION (Exact match to NewBillScreen UX) */}
        {/* ======================================================== */}
        <Text style={[styles.sectionLabel, { color: colors.textDim }]}>{t('client')}</Text>
        <View style={styles.customerActionRow}>
          {/* Customer Search Box */}
          <View
            style={[
              styles.customerSearchBox,
              {
                backgroundColor: colors.surface,
                borderColor: isSearchFocused ? colors.accent : colors.divider,
                flex: 1,
              },
            ]}
          >
            <SearchIcon size={15} color={colors.textDim} />
            <TextInput
              style={[styles.customerSearchInput, { color: colors.text }]}
              placeholder="Search client name or phone..."
              placeholderTextColor={colors.placeholder || colors.textDim}
              value={customerSearch}
              onChangeText={(txt) => {
                setCustomerSearch(txt);
                setIsSearchFocused(true);
              }}
              onFocus={() => setIsSearchFocused(true)}
            />
            {customerSearch.length > 0 && (
              <TouchableOpacity onPress={() => setCustomerSearch('')}>
                <Text style={{ color: colors.textDim, paddingHorizontal: 4 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Add Client Button (Icon Only) */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIsAddClientModalOpen(true)}
            accessibilityLabel={t('addClient', 'Add Client')}
            style={[
              styles.addClientBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.divider,
              },
            ]}
          >
            <UserPlusIcon size={18} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {/* Selected Customer Highlight Card */}
        {selectedCustomer && (
          <View
            style={[
              styles.selectedCustomerCard,
              {
                backgroundColor: colors.accent900,
                borderColor: colors.accent,
              },
            ]}
          >
            <View
              style={[
                styles.smallAvatar,
                { backgroundColor: selectedCustomer.is_starred ? colors.accent : colors.accent800 },
              ]}
            >
              <Text style={{ color: colors.bg, fontSize: 11, fontWeight: '700' }}>
                {getInitials(selectedCustomer.name)}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.selectedCustName, { color: colors.accent100 }]}>
                  {selectedCustomer.name}
                </Text>
                {selectedCustomer.is_starred && (
                  <Text style={{ color: colors.accent, fontSize: 11, fontWeight: 'bold' }}>★ MVP</Text>
                )}
              </View>
              <Text style={{ color: colors.accent200, fontSize: 11 }}>+91 {selectedCustomer.phone}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedCustomerId(null)}
              style={styles.removeSelectedCustBtn}
            >
              <Text style={{ color: colors.accent200, fontSize: 12 }}>✕ Deselect</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Customer Search Dropdown */}
        {isSearchFocused && !selectedCustomer && (
          <View
            style={[
              styles.searchDropdown,
              {
                backgroundColor: colors.surface,
                borderColor: colors.divider,
              },
            ]}
          >
            {customerSearch.trim().length === 0 && (
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.divider,
                  backgroundColor: colors.accent + '15',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.accent }}>
                  Select Client ({customers.length} on file)
                </Text>
                <TouchableOpacity onPress={() => setIsSearchFocused(false)}>
                  <Text style={{ fontSize: 11, color: colors.textDim }}>Close ✕</Text>
                </TouchableOpacity>
              </View>
            )}
            {filteredCustomers.length === 0 ? (
              <View style={{ padding: 14, alignItems: 'center' }}>
                <Text style={{ color: colors.textDim, fontSize: 12.5 }}>
                  {customerSearch.trim().length > 0
                    ? `No customer matching "${customerSearch}"`
                    : 'No customers on file yet'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setNewClientName(customerSearch);
                    setIsAddClientModalOpen(true);
                    setIsSearchFocused(false);
                  }}
                  style={{ marginTop: 8 }}
                >
                  <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: '600' }}>
                    {customerSearch.trim().length > 0
                      ? `+ Create "${customerSearch}"`
                      : '+ Add new client'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                style={{ maxHeight: 220 }}
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={true}
              >
                {filteredCustomers.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedCustomerId(c.id);
                      setCustomerSearch('');
                      setIsSearchFocused(false);
                      Keyboard.dismiss();
                    }}
                    style={[styles.dropdownItem, { borderBottomColor: colors.divider }]}
                  >
                    <Text style={[styles.dropdownName, { color: colors.text }]}>{c.name}</Text>
                    <Text style={[styles.dropdownPhone, { color: colors.textDim }]}>+91 {c.phone}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* ======================================================== */}
        {/* 2. SERVICES (Expandable Multi-Choice)                   */}
        {/* ======================================================== */}
        {/* ======================================================== */}
        {/* 2. CHOOSE SERVICES TRIGGER BOX                           */}
        {/* ======================================================== */}
        <Text style={[styles.sectionLabel, { color: colors.textDim, marginTop: 18 }]}>
          {t('services')} ({totalSelectedCount} {t('selected', 'selected')})
        </Text>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setIsServicesExpanded((prev) => !prev)}
          style={[
            styles.chooseServicesBox,
            {
              backgroundColor: colors.surface,
              borderColor: isServicesExpanded || selectedServiceIds.length > 0 ? colors.accent : colors.divider,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
            <Text style={{ fontSize: 16 }}>✨</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.chooseServicesTitle, { color: colors.text }]}>
                {t('chooseServices', 'Choose Services')}
              </Text>
              <Text
                style={[
                  styles.chooseServicesSub,
                  { color: selectedServiceIds.length > 0 ? colors.accent : colors.textDim },
                ]}
              >
                {totalSelectedCount === 0
                  ? 'Tap to select salon services'
                  : `${totalSelectedCount} service${totalSelectedCount > 1 ? 's' : ''} selected`}
              </Text>
            </View>
          </View>
          <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>
            {isServicesExpanded ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>

        {/* Selected Services Preview Bar */}
        {selectedServices.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
            {selectedServices.map((s) => {
              const qty = serviceQuantities[s.id] || 1;
              return (
                <View
                  key={`sel_${s.id}`}
                  style={[styles.selectedServiceTag, { backgroundColor: colors.accent900, borderColor: colors.accent }]}
                >
                  <Text style={{ color: colors.accent100, fontSize: 12, fontWeight: '600' }}>
                    {s.name} × {qty}
                  </Text>
                  <Text style={{ color: colors.accent200, fontSize: 11, marginLeft: 6 }}>
                    {inrFromMinor(s.price_minor * qty)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleDecrementOrRemoveService(s.id)}
                    style={{ marginLeft: 6, padding: 2 }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={{ color: colors.accent200, fontSize: 12, fontWeight: 'bold' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* 3-COLUMN SQUARE GRID CONTAINER (Shown when expanded) */}
        {isServicesExpanded && (
          <View style={[styles.servicesGridContainer, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
            {services.length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: colors.textDim, fontSize: 13 }}>No services found. Add services in Prices & Offers.</Text>
              </View>
            ) : (
              <View style={styles.threeColumnGrid}>
                {services.map((s) => {
                  const isSelected = selectedServiceIds.includes(s.id);
                  const qty = serviceQuantities[s.id] || 0;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      activeOpacity={0.75}
                      onPress={() => handleServicePress(s.id)}
                      style={[
                        styles.squareServiceCard,
                        {
                          backgroundColor: isSelected ? colors.accent900 : colors.bg,
                          borderColor: isSelected ? colors.accent : colors.divider,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.cardCheckBadge,
                          {
                            backgroundColor: isSelected ? colors.accent : 'transparent',
                            borderColor: isSelected ? colors.accent : colors.divider,
                          },
                        ]}
                      >
                        {isSelected && (
                          <Text style={{ color: '#000', fontSize: 10, fontWeight: 'bold' }}>
                            ×{qty}
                          </Text>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.squareServiceName,
                          { color: isSelected ? colors.accent100 : colors.text },
                        ]}
                        numberOfLines={2}
                      >
                        {s.name} {qty > 1 ? `× ${qty}` : ''}
                      </Text>
                      <Text
                        style={[
                          styles.squareServicePrice,
                          { color: isSelected ? colors.accent : colors.textDim },
                        ]}
                      >
                        {inrFromMinor(s.price_minor)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ======================================================== */}
        {/* 3. STYLIST (Single or Multiple Stylists)                 */}
        {/* ======================================================== */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }}>
          <Text style={[styles.sectionLabel, { color: colors.textDim }]}>
            {t('staff')}
          </Text>
          <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '500' }}>
            ({t('selectStylists', 'Single or multiple')})
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
          {/* Any Stylist / No Stylist Option */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => {
              setIsOwnerSelected((prev) => !prev);
            }}
            style={[
              styles.chip,
              {
                borderColor: isOwnerSelected ? colors.accent : colors.divider,
                backgroundColor: isOwnerSelected ? colors.accent900 : 'transparent',
              },
            ]}
          >
            {isOwnerSelected && (
              <View style={{ marginRight: 4 }}>
                <CheckIcon size={12} color={colors.accent} />
              </View>
            )}
            <Text
              style={[
                styles.chipText,
                { color: isOwnerSelected ? colors.accent200 : colors.textMuted },
              ]}
            >
              {ownerName || 'Owner'} (Owner)
            </Text>
          </TouchableOpacity>

          {/* Named Stylists */}
          {staff.map((s) => {
            const isSelected = selectedStaffIds.includes(s.id);
            return (
              <TouchableOpacity
                key={s.id}
                activeOpacity={0.75}
                onPress={() => {
                  setSelectedStaffIds((prev) => {
                    if (prev.includes(s.id)) {
                      return prev.filter((id) => id !== s.id);
                    }
                    return [...prev, s.id];
                  });
                }}
                style={[
                  styles.chip,
                  {
                    borderColor: isSelected ? colors.accent : colors.divider,
                    backgroundColor: isSelected ? colors.accent900 : 'transparent',
                  },
                ]}
              >
                {isSelected && (
                  <View style={{ marginRight: 4 }}>
                    <CheckIcon size={12} color={colors.accent} />
                  </View>
                )}
                <Text
                  style={[
                    styles.chipText,
                    { color: isSelected ? colors.accent200 : colors.textMuted },
                  ]}
                >
                  {s.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ======================================================== */}
        {/* 4. DATE SELECTION (No past dates! Starts from Today)     */}
        {/* ======================================================== */}
        <Text style={[styles.sectionLabel, { color: colors.textDim, marginTop: 18 }]}>
          DATE · STRICTLY TODAY & FUTURE
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
          {upcomingDays.map((d) => {
            const isSelected = selectedDayOffset === d.offset;
            return (
              <TouchableOpacity
                key={d.offset}
                activeOpacity={0.75}
                onPress={() => {
                  setSelectedDayOffset(d.offset);
                  setSelectedSlot(null); // Reset slot on date change
                }}
                style={[
                  styles.dayChip,
                  {
                    borderColor: isSelected ? colors.accent : colors.divider,
                    backgroundColor: isSelected ? colors.accent900 : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dowText,
                    { color: isSelected ? colors.accent200 : colors.textDim },
                  ]}
                >
                  {d.dayLabel}
                </Text>
                <Text
                  style={[
                    styles.dateNumText,
                    { color: isSelected ? colors.accent100 : colors.text },
                  ]}
                >
                  {d.dateNum}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ======================================================== */}
        {/* 5. TIME SLOTS (Conflict detection and locked styling)   */}
        {/* ======================================================== */}
        <Text style={[styles.sectionLabel, { color: colors.textDim, marginTop: 18 }]}>
          {selectedDay ? `SLOT · ${selectedDay.dayLabel.toUpperCase()} ${selectedDay.dateNum}` : 'SLOT · SELECT DATE ABOVE'}
        </Text>

        {!selectedDay ? (
          <View style={{ padding: 18, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.divider, marginVertical: 8 }}>
            <Text style={{ color: colors.textDim, fontSize: 13 }}>
              Please select an appointment date above to view time slots.
            </Text>
          </View>
        ) : (
          <>
            {/* Stylist Active Booking Notice */}
            {bookedSlotsMap.size > 0 && selectedStaffMembers.length > 0 && (
              <View
                style={{
                  padding: 10,
                  borderRadius: radii.md,
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  marginTop: 6,
                  marginBottom: 10,
                }}
              >
                <Text style={{ color: '#F87171', fontSize: 12.5, fontWeight: '700' }}>
                  🔒 {combinedStylistName} booked at: {Array.from(bookedSlotsMap.keys()).join(', ')}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 11.5, marginTop: 2 }}>
                  Booked slots are striked out. Please choose an open slot.
                </Text>
              </View>
            )}

            <View style={styles.slotsGrid}>
          {timeSlots.map((sl) => {
            const bookedAppt = bookedSlotsMap.get(sl.label);
            const isBooked = Boolean(bookedAppt);
            const isSelected = selectedSlot === sl.label;

            // Check if slot has already passed for today
            let isPast = false;
            if (isSelectedDateToday) {
              const currentHour = now.getHours();
              const currentMin = now.getMinutes();
              if (sl.hour < currentHour || (sl.hour === currentHour && sl.min <= currentMin)) {
                isPast = true;
              }
            }

            const isSlotDisabled = isPast || isBooked;

            const handleSlotPress = () => {
              if (isPast) return;
              if (isBooked) {
                const bookedItem = bookedSlotsMap.get(sl.label);
                Alert.alert(
                  'Stylist Already Booked',
                  `${bookedItem?.stylistName || combinedStylistName || 'Stylist'} is already booked at ${sl.label} on this date. Please choose another time slot or another stylist.`,
                  [{ text: 'OK' }]
                );
                return;
              }
              setSelectedSlot(sl.label);
            };

            return (
              <TouchableOpacity
                key={sl.label}
                disabled={isSlotDisabled}
                activeOpacity={isSlotDisabled ? 1 : 0.75}
                onPress={handleSlotPress}
                style={[
                  styles.slotBox,
                  {
                    borderColor: isSelected
                      ? colors.accent
                      : isBooked
                      ? 'rgba(239, 68, 68, 0.6)'
                      : colors.divider,
                    backgroundColor: isSelected
                      ? colors.accent900
                      : isBooked
                      ? 'rgba(239, 68, 68, 0.12)'
                      : isPast
                      ? colors.trackBg
                      : colors.surface,
                    opacity: isPast ? 0.35 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.slotText,
                    {
                      color: isSelected
                        ? colors.accent
                        : isBooked
                        ? '#EF4444'
                        : isPast
                        ? colors.textDim
                        : colors.text,
                      textDecorationLine: isBooked || isPast ? 'line-through' : 'none',
                    },
                  ]}
                >
                  {sl.label}
                </Text>
                {isBooked && (
                  <Text
                    style={{
                      fontSize: 9.5,
                      color: '#EF4444',
                      fontWeight: '700',
                      marginTop: 2,
                    }}
                  >
                    Booked
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </>
    )}

        {/* WhatsApp confirmation checkbox */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setSendConfirm(!sendConfirm)}
          style={styles.checkboxRow}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: sendConfirm ? colors.accent : colors.divider,
                backgroundColor: sendConfirm ? colors.accent : 'transparent',
              },
            ]}
          >
            {sendConfirm ? <CheckIcon size={12} color="#161826" strokeWidth={3} /> : null}
          </View>
          <Text style={[styles.checkboxLabel, { color: colors.textMuted }]}>
            Send WhatsApp reminder to client with direct chat link
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom CTA Bar */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.divider,
          },
        ]}
      >
        <Button
          label={ctaText}
          block
          disabled={bookIncomplete}
          onPress={handleConfirm}
        />
      </View>

      {/* ======================================================== */}
      {/* QUICK ADD CLIENT MODAL                                   */}
      {/* ======================================================== */}
      <Modal
        visible={isAddClientModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsAddClientModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setIsAddClientModalOpen(false)}
            />
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>{t('addNewCustomer')}</Text>
                  <TouchableOpacity onPress={() => setIsAddClientModalOpen(false)}>
                    <Text style={{ color: colors.textDim, fontSize: 16 }}>{t('cancel')}</Text>
                  </TouchableOpacity>
                </View>

                {/* Import from Phone Contacts Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setIsContactPickerOpen(true)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    paddingVertical: 11,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: colors.accent,
                    backgroundColor: colors.accent + '15',
                    marginTop: 10,
                    marginBottom: 12,
                  }}
                >
                  <UsersIcon size={16} color={colors.accent} />
                  <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>
                    {t('importFromContacts', 'Import from Phone Contacts')}
                  </Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
                  <Text style={{ marginHorizontal: 8, color: colors.textDim, fontSize: 11, fontWeight: '600' }}>
                    OR ENTER MANUALLY
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
                </View>

                <TextInput
                  style={[
                    styles.modalInput,
                    { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text },
                  ]}
                  placeholder={t('fullName')}
                  placeholderTextColor={colors.placeholder || colors.textDim}
                  value={newClientName}
                  onChangeText={setNewClientName}
                />

                <TextInput
                  style={[
                    styles.modalInput,
                    { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text, marginTop: 10 },
                  ]}
                  placeholder={t('mobileNumber')}
                  placeholderTextColor={colors.placeholder || colors.textDim}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={newClientPhone}
                  onChangeText={(txt) => setNewClientPhone(txt.replace(/\D/g, '').slice(0, 10))}
                />

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleQuickAddClient}
                  style={[styles.modalAddBtn, { backgroundColor: colors.accent }]}
                >
                  <Text style={{ color: '#000', fontWeight: '600', fontSize: 14 }}>{t('save')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* QUICK CONTACT PICKER MODAL */}
      <QuickContactPickerModal
        visible={isContactPickerOpen}
        customers={customers}
        onClose={() => setIsContactPickerOpen(false)}
        onSelectContact={async ({ name, phone, existingCustomer }) => {
          if (existingCustomer) {
            Alert.alert(
              'Customer Already Exists',
              `"${existingCustomer.name}" is already registered with mobile number +91 ${phone}. Selected existing customer.`
            );
            setSelectedCustomerId(existingCustomer.id);
            setIsContactPickerOpen(false);
            setIsAddClientModalOpen(false);
            setCustomerSearch('');
            return;
          }

          try {
            if (onAddNewCustomer) {
              const created = await onAddNewCustomer(name, phone);
              setSelectedCustomerId(created.id);
            }
            setIsContactPickerOpen(false);
            setIsAddClientModalOpen(false);
            setCustomerSearch('');
            Alert.alert('Customer Imported', `${name} registered and selected!`);
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Could not import contact');
          }
        }}
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
    paddingVertical: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 140,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 7,
  },
  customerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    gap: 6,
  },
  customerSearchInput: {
    flex: 1,
    fontSize: 13,
  },
  walkInBtn: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkInBtnText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  addClientBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  selectedCustomerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: 8,
  },
  smallAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCustName: {
    fontSize: 13,
    fontWeight: '600',
  },
  removeSelectedCustBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  searchDropdown: {
    marginTop: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    maxHeight: 240,
    overflow: 'hidden',
    zIndex: 1000,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dropdownName: {
    fontSize: 13,
    fontWeight: '500',
  },
  dropdownPhone: {
    fontSize: 12,
  },
  scrollRow: {
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginRight: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dayChip: {
    width: 50,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  dowText: {
    fontSize: 11,
  },
  dateNumText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  serviceChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  serviceChipName: {
    fontSize: 12.5,
  },
  serviceChipPrice: {
    fontSize: 12,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  slotBox: {
    width: '23.5%',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 18,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
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
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  modalAddBtn: {
    marginTop: 14,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  chooseServicesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 8,
  },
  chooseServicesTitle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  chooseServicesSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  servicesGridContainer: {
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: 12,
  },
  threeColumnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  squareServiceCard: {
    width: '31.3%',
    aspectRatio: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
  },
  cardCheckBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareServiceName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 15,
  },
  squareServicePrice: {
    fontSize: 11.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  selectedServiceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginRight: 6,
  },
  expandedServicesBlock: {
    gap: 12,
    marginTop: 8,
  },
  categoryBlock: {
    marginBottom: 10,
  },
  categoryHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  expandedGrid: {
    gap: 6,
  },
  serviceRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
