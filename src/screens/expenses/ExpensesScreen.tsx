import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button } from '../../components/common/Button';
import { BackIcon, CrossIcon, EditIcon, TrashIcon } from '../../components/common/SvgIcons';
import { Chip } from '../../components/common/Chip';
import { Expense, Period } from '../../types/domain';
import { inrFromMinor } from '../../utils/format';
import { EXPENSE_CATEGORIES } from '../../repositories/expenseRepository';
import { radii } from '../../theme/spacing';
import { Alert } from 'react-native';

interface ExpensesScreenProps {
  expenses: Expense[];
  onBack: () => void;
  onAddExpense: (category: string, amountRupees: number, note: string) => void;
  onEditExpense?: (expenseId: string, category: string, amountRupees: number, note: string) => void;
  onDeleteExpense?: (expenseId: string) => void;
}

export const ExpensesScreen = ({
  expenses,
  onBack,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
}: ExpensesScreenProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>('Day');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [selectedCat, setSelectedCat] = useState<string>('Products & stock');
  const [amountStr, setAmountStr] = useState('');
  const [noteStr, setNoteStr] = useState('');
  const [selectedPayMode, setSelectedPayMode] = useState<string>('UPI');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const expenseScrollRef = React.useRef<ScrollView>(null);

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

  const totalExpenseMinor = expenses.reduce((acc, e) => acc + e.amount_minor, 0);

  const handleOpenAdd = () => {
    setEditingExpense(null);
    setSelectedCat('Products & stock');
    setAmountStr('');
    setNoteStr('');
    setSelectedPayMode('UPI');
    setSheetOpen(true);
  };

  const handleOpenEdit = (e: Expense) => {
    setEditingExpense(e);
    setSelectedCat(e.category_name);
    setAmountStr(Math.round(e.amount_minor / 100).toString());
    setNoteStr(e.note);
    setSelectedPayMode(e.payment_method || 'UPI');
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
            if (onDeleteExpense) onDeleteExpense(e.id);
          },
        },
      ]
    );
  };

  const handleSave = () => {
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) return;

    const baseNote = noteStr.trim() || selectedCat;
    const finalNote = `${baseNote} (${selectedPayMode})`;

    if (editingExpense) {
      if (onEditExpense) {
        onEditExpense(editingExpense.id, selectedCat, amt, finalNote);
      }
      setEditingExpense(null);
    } else {
      onAddExpense(selectedCat, amt, finalNote);
    }

    setAmountStr('');
    setNoteStr('');
    setSheetOpen(false);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <View style={styles.topBar}>
          <Button variant="icon" onPress={onBack}>
            <BackIcon size={18} color={colors.text} />
          </Button>
          <Text style={[styles.title, { color: colors.text }]}>{t('expenses')}</Text>
        </View>

        <View style={[styles.periodTabsRow, { borderColor: colors.divider }]}>
          {(['Day', 'Week', 'Month'] as const).map((p) => {
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

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Total & entries count */}
        <View style={styles.totalRow}>
          <Text style={[styles.totalAmount, { color: colors.text }]}>
            {inrFromMinor(totalExpenseMinor)}
          </Text>
          <Text style={[styles.entriesCount, { color: colors.textDim }]}>
            {expenses.length} entries
          </Text>
        </View>

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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
          style={{ flex: 1 }}
        >
          <View style={[styles.modalOverlay, { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 0 }]}>
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
                  maxHeight: keyboardHeight > 0 ? Dimensions.get('window').height - keyboardHeight - 30 : '92%',
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
                ref={expenseScrollRef}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                bounces={false}
                automaticallyAdjustKeyboardInsets={true}
                contentContainerStyle={{ paddingBottom: Math.max(50, keyboardHeight + 30) }}
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
                      onChangeText={setAmountStr}
                      onFocus={() => setTimeout(() => expenseScrollRef.current?.scrollToEnd({ animated: true }), 220)}
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
                      onFocus={() => setTimeout(() => expenseScrollRef.current?.scrollToEnd({ animated: true }), 220)}
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

                <Button
                  label={t('save')}
                  block
                  disabled={!amountStr.trim()}
                  onPress={handleSave}
                  style={{ marginTop: 14 }}
                />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
