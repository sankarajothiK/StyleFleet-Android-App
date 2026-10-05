import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Platform,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Chip } from '../../components/common/Chip';
import { StarIcon, EditIcon, PhoneCallIcon, WhatsAppIcon } from '../../components/common/SvgIcons';
import { Customer } from '../../types/domain';
import { inr, inrFromMinor, getInitials } from '../../utils/format';
import { CustomerManagerModal } from '../../components/customers/CustomerManagerModal';
import { SettleDueModal } from '../../components/customers/SettleDueModal';
import { customerRepository } from '../../repositories/customerRepository';

interface CustomersScreenProps {
  customers: Customer[];
  shopId?: string;
  onSelectCustomer: (customer: Customer) => void;
  onToggleStar: (customerId: string) => void;
  onAddCustomer?: (customer: Customer) => void;
  onBatchAddCustomers?: (customers: Customer[]) => void;
  onUpdateCustomer?: (customer: Customer) => void;
  onSettleDue?: (customerId: string, method?: 'cash' | 'upi', amountMinor?: number) => void;
}

export const CustomersScreen = ({
  customers,
  shopId,
  onSelectCustomer,
  onToggleStar,
  onAddCustomer,
  onBatchAddCustomers,
  onUpdateCustomer,
  onSettleDue,
}: CustomersScreenProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'MVP ★' | 'Dues' | 'Inactive'>('All');
  const [modalVisible, setModalVisible] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [customerToSettle, setCustomerToSettle] = useState<Customer | null>(null);

  // Deduplicate customers by normalized 10-digit mobile number so duplicate records are never displayed
  const uniqueCustomers = React.useMemo(() => {
    const map = new Map<string, Customer>();
    for (const c of customers) {
      const cleanPhone = (c.phone || '').replace(/\D/g, '').slice(-10);
      const key = cleanPhone.length === 10 ? cleanPhone : c.id;
      if (!map.has(key)) {
        map.set(key, { ...c, phone: cleanPhone.length === 10 ? cleanPhone : c.phone });
      } else {
        // Merge visits, spend, dues and flags
        const existing = map.get(key)!;
        existing.visits_count = Math.max(existing.visits_count || 0, c.visits_count || 0);
        existing.lifetime_spend_minor = Math.max(existing.lifetime_spend_minor || 0, c.lifetime_spend_minor || 0);
        existing.outstanding_due_minor = Math.max(existing.outstanding_due_minor || 0, c.outstanding_due_minor || 0);
        if (c.is_starred) existing.is_starred = true;
        if (c.notes && !existing.notes) existing.notes = c.notes;
        if (!existing.last_visit_date && c.last_visit_date) existing.last_visit_date = c.last_visit_date;
        if (!existing.due_start_date && c.due_start_date) existing.due_start_date = c.due_start_date;
      }
    }
    return Array.from(map.values());
  }, [customers]);

  // Frequent customers sorted by visits count
  const sortedCustomers = React.useMemo(() => {
    return [...uniqueCustomers].sort((a, b) => (b.visits_count || 0) - (a.visits_count || 0));
  }, [uniqueCustomers]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    const sourceList = q ? uniqueCustomers : sortedCustomers;

    return sourceList.filter((c) => {
      const isCustInactive = c.is_active === false;
      if (q) {
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesPhone = c.phone.includes(q) || (qDigits.length >= 3 && c.phone.includes(qDigits));
        if (!matchesName && !matchesPhone) return false;
      }
      if (activeFilter === 'Inactive') return isCustInactive;
      if (isCustInactive) return false;
      if (activeFilter === 'MVP ★') return c.is_starred;
      if (activeFilter === 'Dues') return c.outstanding_due_minor > 0;
      return true;
    });
  }, [uniqueCustomers, sortedCustomers, query, activeFilter]);

  const handleHoldCustomer = (c: Customer) => {
    const isCurrentlyInactive = c.is_active === false;
    Alert.alert(
      isCurrentlyInactive ? 'Reactivate Customer' : 'Move Customer to Inactive',
      isCurrentlyInactive
        ? `Reactivate "${c.name}" so they appear in your active customer list and can be selected for new bills?`
        : `Move "${c.name}" to Inactive?\n\nTheir past visits, spend, dues, bills, and report history will remain 100% safely preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isCurrentlyInactive ? 'Reactivate' : 'Move to Inactive',
          style: isCurrentlyInactive ? 'default' : 'destructive',
          onPress: async () => {
            try {
              if (shopId) {
                await customerRepository.setCustomerInactive(shopId, c.id, !isCurrentlyInactive);
              }
              if (onUpdateCustomer) {
                onUpdateCustomer({ ...c, is_active: isCurrentlyInactive });
              }
              Alert.alert(
                isCurrentlyInactive ? 'Customer Reactivated' : 'Customer Inactive',
                isCurrentlyInactive
                  ? `${c.name} is now active.`
                  : `${c.name} has been moved to Inactive. All historical data is preserved.`
              );
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not update customer status');
            }
          },
        },
      ]
    );
  };

  const handleOpenAddModal = () => {
    setCustomerToEdit(null);
    setModalVisible(true);
  };

  const handleOpenEditModal = (c: Customer) => {
    setCustomerToEdit(c);
    setModalVisible(true);
  };

  const handleCallCustomer = (rawPhone?: string) => {
    const clean = (rawPhone || '').replace(/\D/g, '').slice(-10);
    if (!clean || clean.length < 10) {
      Alert.alert(
        'Invalid Phone Number',
        'No valid 10-digit mobile number is registered for this customer.'
      );
      return;
    }
    const telUrl = `tel:${clean}`;
    Linking.openURL(telUrl).catch((err) => {
      console.warn('Could not open phone dialer:', err);
      Alert.alert(
        'Dialer Unavailable',
        `Unable to open phone dialer for +91 ${clean}.`
      );
    });
  };

  const handleWhatsAppCustomer = (rawPhone?: string, customerName?: string) => {
    const clean = (rawPhone || '').replace(/\D/g, '').slice(-10);
    if (!clean || clean.length < 10) {
      Alert.alert(
        'Invalid Phone Number',
        'No valid 10-digit mobile number is registered for this customer.'
      );
      return;
    }
    const fullPhone = `91${clean}`;
    const greeting = customerName ? `Hello ${customerName}!` : 'Hello!';
    const appUrl = `whatsapp://send?phone=${fullPhone}&text=${encodeURIComponent(greeting)}`;
    const webUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(greeting)}`;

    Linking.canOpenURL(appUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(appUrl);
        } else {
          return Linking.openURL(webUrl);
        }
      })
      .catch(() => {
        Linking.openURL(webUrl).catch(() => {
          Alert.alert(
            'WhatsApp Unavailable',
            'Could not open WhatsApp. Please ensure WhatsApp is installed on your device.'
          );
        });
      });
  };

  const renderCustomerItem = ({ item: c }: { item: Customer }) => {
    const hasDue = c.outstanding_due_minor > 0;
    const dueLabel = hasDue
      ? `${t('due', 'due')} ${inrFromMinor(c.outstanding_due_minor)}`
      : t('settled', 'settled');

    const cleanPhone = (c.phone || '').replace(/\D/g, '').slice(-10);
    const formattedPhone = cleanPhone.length === 10
      ? `+91 ${cleanPhone.replace(/(\d{5})(\d{5})/, '$1 $2')}`
      : c.phone || 'No phone';

    return (
      <View
        style={[
          styles.customerRow,
          { borderBottomColor: colors.divider },
        ]}
      >
        <TouchableOpacity
          style={styles.customerRowMain}
          activeOpacity={0.7}
          onPress={() => onSelectCustomer(c)}
          onLongPress={() => handleHoldCustomer(c)}
          delayLongPress={400}
        >
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: c.is_starred
                  ? colors.accent800
                  : colors.neutral800,
              },
            ]}
          >
            <Text
              style={[
                styles.avatarText,
                {
                  color: c.is_starred
                    ? colors.accent100
                    : colors.neutral200,
                },
              ]}
            >
              {getInitials(c.name)}
            </Text>
          </View>

          <View style={styles.customerDetails}>
            <View style={styles.nameRow}>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[styles.customerName, { color: colors.text }]}
              >
                {c.name}
              </Text>
              {c.is_starred ? (
                <Text style={[styles.badge, { color: colors.accent }]}>
                  ★ MVP
                </Text>
              ) : null}
              {c.is_active === false ? (
                <Text style={[styles.badge, { color: '#9CA3AF', borderColor: '#4B5563', borderWidth: 1, paddingHorizontal: 5, borderRadius: 4 }]}>
                  Inactive
                </Text>
              ) : null}
            </View>

            {/* Stored Customer Phone Number */}
            <Text
              numberOfLines={1}
              style={[styles.phoneText, { color: colors.textDim }]}
            >
              {formattedPhone}
            </Text>

            <Text
              numberOfLines={1}
              style={[styles.metaText, { color: colors.textSubtle }]}
            >
              {`${c.visits_count} visits${
                c.last_visit_date && !c.last_visit_date.includes('Invalid') && !c.last_visit_date.includes('NaN')
                  ? ` · last ${c.last_visit_date}`
                  : ''
              } · ${c.preferred_stylist_name || 'Stylist'}`}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Right Section: Spend and Actions */}
        <View style={styles.rightSection}>
          <View style={styles.spendColumn}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onSelectCustomer(c)}
              style={{ alignItems: 'flex-end' }}
            >
              <Text style={[styles.spendText, { color: colors.text }]}>
                {inrFromMinor(c.lifetime_spend_minor)}
              </Text>
            </TouchableOpacity>
            {hasDue ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setCustomerToSettle(c)}
                style={[
                  styles.settlePill,
                  { backgroundColor: colors.accent900, borderColor: colors.accent },
                ]}
              >
                <Text style={[styles.settlePillText, { color: colors.accent }]}>
                  Settle {inrFromMinor(c.outstanding_due_minor)}
                  {c.due_start_date && !c.due_start_date.includes('Invalid') && !c.due_start_date.includes('NaN')
                    ? ` (${c.due_start_date})`
                    : ''}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text
                style={[styles.dueText, { color: colors.textSubtle }]}
              >
                {dueLabel}
              </Text>
            )}
          </View>

          {/* Quick Actions: Call, WhatsApp, Star, Edit */}
          <View style={styles.actionsColumn}>
            {/* Call Action Icon Button */}
            <TouchableOpacity
              onPress={() => handleCallCustomer(c.phone)}
              style={[
                styles.actionIconBtn,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.divider,
                },
              ]}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityLabel={`Call ${c.name}`}
            >
              <PhoneCallIcon size={14} color="#10B981" />
            </TouchableOpacity>

            {/* WhatsApp Action Icon Button */}
            <TouchableOpacity
              onPress={() => handleWhatsAppCustomer(c.phone, c.name)}
              style={[
                styles.actionIconBtn,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.divider,
                },
              ]}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityLabel={`WhatsApp ${c.name}`}
            >
              <WhatsAppIcon size={15} color="#25D366" />
            </TouchableOpacity>

            {/* Existing Star Icon */}
            <TouchableOpacity
              onPress={() => onToggleStar(c.id)}
              style={styles.starButton}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityLabel={c.is_starred ? 'Unstar customer' : 'Star customer'}
            >
              <StarIcon
                size={17}
                color={c.is_starred ? colors.accent : colors.textSubtle}
                fill={c.is_starred ? colors.accent : 'none'}
              />
            </TouchableOpacity>

          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.title, { color: colors.text }]}>{t('customers', 'Customers')}</Text>
          <Text style={[styles.countText, { color: colors.textDim }]}>
            {uniqueCustomers.length} {t('onFile', 'on file')}
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleOpenAddModal}
            activeOpacity={0.7}
          >
            <Text style={[styles.addButtonText, { color: colors.accent }]}>{t('add', '+ Add')}</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.card,
              borderColor: colors.divider,
              color: colors.text,
            },
          ]}
          placeholder={t('searchNameOrNumber', 'Search name or number')}
          placeholderTextColor={colors.placeholder || colors.textDim}
          value={query}
          onChangeText={setQuery}
        />

        <View style={styles.filtersRow}>
          {(['All', 'MVP ★', 'Dues', 'Inactive'] as const).map((filter) => (
            <Chip
              key={filter}
              label={
                filter === 'All'
                  ? t('all', 'All')
                  : filter === 'MVP ★'
                  ? t('mvp', 'MVP ★')
                  : filter === 'Dues'
                  ? t('dues', 'Dues')
                  : 'Inactive'
              }
              active={activeFilter === filter}
              onPress={() => setActiveFilter(filter)}
            />
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderCustomerItem}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        maxToRenderPerBatch={25}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {query ? t('noCustomersFound', 'No customers matching search') : t('noCustomersOnFile', 'No customers on file')}
            </Text>
            <Text style={[styles.emptySub, { color: colors.textDim }]}>
              {query
                ? 'Try searching with a different name or phone number.'
                : t('tapAddHint', "Tap '+ Add' in the top right to register your salon clients.")}
            </Text>
          </View>
        }
        ListFooterComponent={
          <Text style={[styles.bottomHint, { color: colors.textSubtle }]}>
            {t('starredHint', 'Starred customers are your MVPs. They feed the WhatsApp segment of the same name.')}
          </Text>
        }
      />

      <CustomerManagerModal
        visible={modalVisible}
        shopId={shopId || ''}
        customerToEdit={customerToEdit}
        existingCustomers={uniqueCustomers}
        onClose={() => setModalVisible(false)}
        onAddSuccess={(newCust) => onAddCustomer?.(newCust)}
        onBatchSuccess={(newCusts) => onBatchAddCustomers?.(newCusts)}
        onEditSuccess={(updated) => onUpdateCustomer?.(updated)}
      />

      <SettleDueModal
        visible={!!customerToSettle}
        customer={customerToSettle}
        onClose={() => setCustomerToSettle(null)}
        onConfirm={async (customerId, method, amountMinor) => {
          await onSettleDue?.(customerId, method, amountMinor);
          setCustomerToSettle(null);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  title: {
    fontSize: 23,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  countText: {
    fontSize: 13,
  },
  addButton: {
    marginLeft: 'auto',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  searchInput: {
    marginTop: 12,
    height: 42,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14.5,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  customerRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  customerDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '500',
    flexShrink: 1,
  },
  badge: {
    fontSize: 11,
    fontWeight: '600',
  },
  phoneText: {
    fontSize: 12.5,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  metaText: {
    fontSize: 12.5,
    marginTop: 2,
  },
  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 6,
  },
  spendColumn: {
    alignItems: 'flex-end',
    paddingRight: 6,
  },
  spendText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dueText: {
    fontSize: 11.5,
    marginTop: 2,
  },
  starButton: {
    padding: 6,
  },
  actionsColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  actionIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    padding: 6,
  },
  settlePill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
  },
  settlePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bottomHint: {
    paddingTop: 18,
    fontSize: 12,
    lineHeight: 17,
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 19,
  },
});
