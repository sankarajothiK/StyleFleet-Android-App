import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Keyboard,
  Dimensions,
} from 'react-native';
import { Modal } from '../../components/common/KeyboardAwareModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { GlassBackdrop } from '../../components/common/GlassBackdrop';
import { getGlass } from '../../theme/glass';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button } from '../../components/common/Button';
import { BackIcon, CrossIcon, EditIcon, TrashIcon } from '../../components/common/SvgIcons';
import { Chip } from '../../components/common/Chip';
import { Expense, Period, StaffMember } from '../../types/domain';
import { inrFromMinor } from '../../utils/format';
import { cleanAmountInput } from '../../utils/amountInput';
import { countsInProfit, splitExpenseTotals } from '../../utils/expenseProfit';
import { fmt } from '../../i18n/format';
import { stylistNameFor, stylistOptions } from '../../utils/expenseStylist';
import { EXPENSE_CATEGORIES } from '../../repositories/expenseRepository';
import { radii } from '../../theme/spacing';
import { Alert } from 'react-native';
import { usePullRefresh } from '../../hooks/usePullRefresh';

interface ExpensesScreenProps {
  onRefresh?: () => Promise<void>;
  expenses: Expense[];
  /** Stylist limited to today: no Week / Month tabs. */
  todayOnly?: boolean;
  /** Owner only: may decide whether an expense counts in profit. */
  canChooseProfit?: boolean;
  /** Team members the owner can link an expense to. */
  staff?: StaffMember[];
  /** Owner only: may link an expense to a team member. */
  canTagStylist?: boolean;
  onBack: () => void;
  onAddExpense: (
    category: string,
    amountRupees: number,
    note: string,
    includeInProfit: boolean,
    staffId: string | null
  ) => void | Promise<void>;
  onEditExpense?: (
    expenseId: string,
    category: string,
    amountRupees: number,
    note: string,
    includeInProfit: boolean,
    staffId: string | null
  ) => void | Promise<void>;
  onDeleteExpense?: (expenseId: string) => void | Promise<void>;
}

export const ExpensesScreen = ({
  onRefresh,
  expenses,
  todayOnly = false,
  canChooseProfit = true,
  staff = [],
  canTagStylist = true,
  onBack,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
}: ExpensesScreenProps) => {
  const pullRefresh = usePullRefresh(onRefresh);
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>('Day');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [selectedCat, setSelectedCat] = useState<string>('Products & stock');
  const [amountStr, setAmountStr] = useState('');
  const [noteStr, setNoteStr] = useState('');
  const [selectedPayMode, setSelectedPayMode] = useState<string>('UPI');
  const [includeInProfit, setIncludeInProfit] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [stylistListOpen, setStylistListOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  // Android already shrinks the window for the keyboard (softwareKeyboardLayoutMode: resize), so only iOS
  // needs a manual inset. Adding it on Android pushes the sheet up twice and it jumps to the top.
  const keyboardInset = Platform.OS === 'ios' ? keyboardHeight : 0;

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

  const stylistLabel = (id: string): string => {
    const member = staff.find((m) => m.id === id);
    if (!member) return '';
    return member.is_active === false
      ? fmt(t('exStylistInactive', '{name} (inactive)'), { name: member.name })
      : member.name;
  };

  const totalExpenseMinor = expenses.reduce((acc, e) => acc + e.amount_minor, 0);
  const excludedMinor = splitExpenseTotals(expenses).excludedMinor;

  const handleOpenAdd = () => {
    setEditingExpense(null);
    setSelectedCat('Products & stock');
    setAmountStr('');
    setNoteStr('');
    setSelectedPayMode('UPI');
    setIncludeInProfit(true);
    setSelectedStaffId(null);
    setStylistListOpen(false);
    setSheetOpen(true);
  };

  const handleOpenEdit = (e: Expense) => {
    setEditingExpense(e);
    setSelectedCat(e.category_name);
    // exact amount, so editing never rounds away the paise
    setAmountStr((e.amount_minor / 100).toFixed(2).replace(/.?0+$/, ''));
    setNoteStr(e.note);
    setSelectedPayMode(e.payment_method || 'UPI');
    setIncludeInProfit(countsInProfit(e));
    setSelectedStaffId(e.staff_id ?? null);
    setStylistListOpen(false);
    setSheetOpen(true);
  };

  const handleDelete = (e: Expense) => {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete "${e.note}" (${inrFromMinor(e.amount_minor)})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // the navigator shows the error if the delete fails
            if (onDeleteExpense) Promise.resolve(onDeleteExpense(e.id)).catch(() => {});
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (isSaving) return;
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) return;

    const baseNote = noteStr.trim() || selectedCat;
    const finalNote = `${baseNote} (${selectedPayMode})`;

    setIsSaving(true);
    try {
      if (editingExpense) {
        if (onEditExpense) {
          await onEditExpense(editingExpense.id, selectedCat, amt, finalNote, includeInProfit, selectedStaffId);
        }
        setEditingExpense(null);
      } else {
        await onAddExpense(selectedCat, amt, finalNote, includeInProfit, selectedStaffId);
      }

      setAmountStr('');
      setNoteStr('');
      setSheetOpen(false);
    } catch {
      // The navigator already showed why it failed. Keep the sheet open so nothing typed is lost.
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <GlassBackdrop isDark={colors.isDark} />
      <View style={styles.header}>
        <View style={styles.topBar}>
          <Button variant="icon" onPress={onBack}>
            <BackIcon size={18} color={colors.text} />
          </Button>
          <Text style={[styles.title, { color: colors.text }]}>{t('expenses')}</Text>
        </View>

        <View style={[styles.periodTabsRow, { borderColor: colors.divider }]}>
          {(todayOnly ? (['Day'] as const) : (['Day', 'Week', 'Month'] as const)).map((p) => {
            const isSelected = period === p;
            return (
              <TouchableOpacity
                key={p}
                activeOpacity={0.8}
                onPress={() => setPeriod(p)}
                style={[
                  styles.periodTab,
                  {
                    backgroundColor: isSelected ? colors.accent900 : 'transparent',
                    borderWidth: isSelected ? 1 : 0,
                    borderColor: isSelected ? colors.accent : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.periodTabText,
                    {
                      color: isSelected ? colors.accent : colors.textMuted,
                    },
                  ]}
                >
                  {p === 'Day' ? t('day') : p === 'Week' ? t('week') : t('month')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={pullRefresh}>
        {/* Total & entries count */}
        <View style={styles.totalRow}>
          <Text style={[styles.totalAmount, { color: colors.text }]}>
            {inrFromMinor(totalExpenseMinor)}
          </Text>
          <Text style={[styles.entriesCount, { color: colors.textDim }]}>
            {expenses.length} entries
          </Text>
        </View>
        {excludedMinor > 0 && (
          <Text style={[styles.entriesCount, { color: colors.textDim, marginBottom: 8 }]}>
            {fmt(t('exNotCounted', '{amt} not counted in profit'), { amt: inrFromMinor(excludedMinor) })}
          </Text>
        )}

        {/* Expenses List */}
        <View style={styles.list}>
          {expenses.map((e) => (
            <View
              key={e.id}
              style={[
                styles.expenseItem,
                { backgroundColor: colors.surface },
              ]}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.expenseNote, { color: colors.text }]}>
                  {e.note}
                </Text>
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.catBadge,
                      { backgroundColor: colors.bg, borderColor: colors.divider },
                    ]}
                  >
                    <Text style={[styles.catBadgeText, { color: colors.textMuted }]}>
                      {e.category_name}
                    </Text>
                  </View>
                  <Text style={[styles.metaTime, { color: colors.textDim }]}>
                    {e.expense_date} · {e.payment_method}
                  </Text>
                  {stylistNameFor(staff, e.staff_id) && (
                    <View style={[styles.stylistTag, { backgroundColor: colors.accent + '24' }]}>
                      <Text style={[styles.stylistTagText, { color: colors.accent }]} numberOfLines={1}>
                        {stylistNameFor(staff, e.staff_id)}
                      </Text>
                    </View>
                  )}
                  {!countsInProfit(e) && (
                    <View style={styles.notInProfitBadge}>
                      <Text style={styles.notInProfitText}>{t('exNotInProfit', 'Not in profit')}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', justifyContent: 'space-between', paddingVertical: 2 }}>
                <Text style={[styles.expenseAmt, { color: colors.text }]}>
                  {inrFromMinor(e.amount_minor)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 }}>
                  <TouchableOpacity onPress={() => handleOpenEdit(e)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <EditIcon size={15} color={colors.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(e)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <TrashIcon size={15} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Bottom bar with Add expense button */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.divider,
          },
        ]}
      >
        <Button label={t('addExpense')} block onPress={handleOpenAdd} />
      </View>

      {/* Add Expense Bottom Sheet Modal */}
      <Modal
        visible={sheetOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSheetOpen(false)}
      >
        <View style={{ flex: 1 }}>
          <View style={[styles.modalOverlay, { paddingBottom: keyboardInset }]}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setSheetOpen(false)}
            />
            <View
              style={[
                styles.sheetContainer,
                {
                  backgroundColor: colors.surface,
                  maxHeight: keyboardInset > 0 ? Dimensions.get('window').height - keyboardInset - 30 : '92%',
                },
              ]}
            >
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>
                  {editingExpense ? 'Edit Expense' : t('addExpense')}
                </Text>
                <TouchableOpacity
                  onPress={() => setSheetOpen(false)}
                  activeOpacity={0.7}
                  style={{ padding: 4 }}
                >
                  <CrossIcon size={18} color={colors.textDim} />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bounces={false}
                contentContainerStyle={{ paddingBottom: 24 }}
              >
                {/* Category Chips */}
                <Text style={[styles.sheetInputLabel, { color: colors.textDim }]}>
                  Category
                </Text>
                <View style={styles.sheetChipsRow}>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <Chip
                      key={cat}
                      label={cat}
                      active={selectedCat === cat}
                      onPress={() => setSelectedCat(cat)}
                      size="sm"
                    />
                  ))}
                </View>

                {/* Amount & Note Inputs */}
                <View style={styles.sheetInputsRow}>
                  <View style={{ width: 120 }}>
                    <Text style={[styles.sheetInputLabel, { color: colors.textDim }]}>
                      {t('amount')} ₹
                    </Text>
                    <TextInput
                      style={[
                        styles.sheetTextInput,
                        {
                          backgroundColor: colors.bg,
                          borderColor: colors.divider,
                          color: colors.text,
                        },
                      ]}
                      placeholder="0"
                      placeholderTextColor={colors.placeholder || colors.textDim}
                      keyboardType="numeric"
                      value={amountStr}
                      onChangeText={(v) => setAmountStr(cleanAmountInput(v))}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetInputLabel, { color: colors.textDim }]}>
                      {t('notes')}
                    </Text>
                    <TextInput
                      style={[
                        styles.sheetTextInput,
                        {
                          backgroundColor: colors.bg,
                          borderColor: colors.divider,
                          color: colors.text,
                        },
                      ]}
                      placeholder="e.g. Products restock"
                      placeholderTextColor={colors.placeholder || colors.textDim}
                      value={noteStr}
                      onChangeText={setNoteStr}
                    />
                  </View>
                </View>

                {/* Payment Mode Selector */}
                <Text style={[styles.sheetInputLabel, { color: colors.textDim, marginTop: 10 }]}>
                  Payment Mode
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  {(['UPI', 'Cash', 'Card'] as const).map((mode) => {
                    const isSelected = selectedPayMode === mode;
                    return (
                      <TouchableOpacity
                        key={mode}
                        activeOpacity={0.75}
                        onPress={() => setSelectedPayMode(mode)}
                        style={[
                          styles.payModeChip,
                          {
                            borderColor: isSelected ? colors.accent : colors.divider,
                            backgroundColor: isSelected ? colors.accent900 : colors.bg,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.payModeText,
                            { color: isSelected ? colors.accent200 : colors.text },
                          ]}
                        >
                          {mode}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {canTagStylist && (
                  <View style={{ marginTop: 6 }}>
                    <Text style={[styles.sheetInputLabel, { color: colors.textDim }]}>
                      {t('exStylist', 'Stylist (optional)')}
                    </Text>
                    {stylistOptions(staff, selectedStaffId).length === 0 ? (
                      <Text style={[styles.profitSub, { color: colors.textDim }]}>
                        {t('exStylistHint', 'Add stylists in Team to link expenses to them')}
                      </Text>
                    ) : (
                      <>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => setStylistListOpen((v) => !v)}
                          accessibilityRole="button"
                          accessibilityLabel={t('exStylist', 'Stylist (optional)')}
                          style={[
                            styles.dropdownField,
                            {
                              backgroundColor: colors.bg,
                              borderColor: stylistListOpen ? colors.accent : colors.divider,
                            },
                          ]}
                        >
                          <Text style={{ flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                            {selectedStaffId
                              ? stylistLabel(selectedStaffId)
                              : t('exStylistNone', 'None · shop expense')}
                          </Text>
                          <Text style={{ color: colors.textDim }}>{stylistListOpen ? '\u25B2' : '\u25BC'}</Text>
                        </TouchableOpacity>
                        {stylistListOpen && (
                          <View style={[styles.dropdownList, { backgroundColor: colors.bg, borderColor: colors.divider }]}>
                            {[null, ...stylistOptions(staff, selectedStaffId).map((m) => m.id)].map((id) => {
                              const active = id === selectedStaffId;
                              return (
                                <TouchableOpacity
                                  key={id ?? 'none'}
                                  activeOpacity={0.8}
                                  onPress={() => {
                                    setSelectedStaffId(id);
                                    setStylistListOpen(false);
                                  }}
                                  style={[styles.dropdownItem, { borderBottomColor: colors.divider }]}
                                >
                                  <Text
                                    style={{
                                      flex: 1,
                                      color: active ? colors.accent : colors.text,
                                      fontWeight: active ? '800' : '500',
                                      fontSize: 14,
                                    }}
                                    numberOfLines={1}
                                  >
                                    {id ? stylistLabel(id) : t('exStylistNone', 'None · shop expense')}
                                  </Text>
                                  {active && <Text style={{ color: colors.accent, fontWeight: '800' }}>{'\u2713'}</Text>}
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </>
                    )}
                  </View>
                )}

                {canChooseProfit && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setIncludeInProfit((v) => !v)}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: includeInProfit }}
                    accessibilityLabel={t('exCountProfit', 'Count in profit')}
                    style={[
                      styles.profitRow,
                      { backgroundColor: colors.bg, borderColor: includeInProfit ? colors.accent + '88' : colors.divider },
                    ]}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={[styles.profitLabel, { color: colors.text }]}>
                        {t('exCountProfit', 'Count in profit')}
                      </Text>
                      <Text style={[styles.profitSub, { color: colors.textDim }]}>
                        {includeInProfit
                          ? t('exCountProfitOn', 'Subtracted when profit is calculated')
                          : t('exCountProfitOff', 'Saved in the list, but profit ignores it (for example personal spending)')}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.profitTrack,
                        { borderColor: includeInProfit ? colors.accent : colors.divider },
                        includeInProfit && { backgroundColor: colors.accent },
                      ]}
                    >
                      <View
                        style={[
                          styles.profitKnob,
                          { backgroundColor: includeInProfit ? '#0D0E11' : colors.textDim },
                          { alignSelf: includeInProfit ? 'flex-end' : 'flex-start' },
                        ]}
                      />
                    </View>
                  </TouchableOpacity>
                )}

                <Button
                  label={t('save')}
                  block
                  disabled={!amountStr.trim()}
                  loading={isSaving}
                  onPress={handleSave}
                  style={{ marginTop: 14 }}
                />
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  stylistTag: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 8, maxWidth: 130 },
  stylistTagText: { fontSize: 10.5, fontWeight: '800' },
  dropdownField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  dropdownList: { borderWidth: 1, borderRadius: 12, marginTop: 6, overflow: 'hidden' },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  notInProfitBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
  },
  notInProfitText: { fontSize: 10, fontWeight: '800', color: '#F59E0B' },
  profitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  profitLabel: { fontSize: 14, fontWeight: '700' },
  profitSub: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  profitTrack: { width: 46, height: 26, borderRadius: 13, borderWidth: 1, padding: 2, justifyContent: 'center' },
  profitKnob: { width: 20, height: 20, borderRadius: 10 },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
  },
  periodTabsRow: {
    flexDirection: 'row',
    marginTop: 12,
    borderWidth: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodTabText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 14,
  },
  totalAmount: {
    fontSize: 30,
    fontWeight: '500',
    letterSpacing: -0.5,
  },
  entriesCount: {
    fontSize: 12,
    paddingBottom: 3,
  },
  list: {
    gap: 8,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: radii.md,
  },
  expenseNote: {
    fontSize: 13.5,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  catBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  catBadgeText: {
    fontSize: 11,
  },
  metaTime: {
    fontSize: 11,
  },
  expenseAmt: {
    fontSize: 14,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: 16,
    paddingBottom: 30,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
  },
  sheetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  sheetInputsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  sheetInputLabel: {
    fontSize: 11.5,
    marginBottom: 6,
  },
  sheetTextInput: {
    height: 42,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  payModeChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payModeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
