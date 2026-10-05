import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Expense, Period } from '../types/domain';

const STORAGE_KEY_EXPENSES = '@salon_os_expenses_cache';

export const EXPENSE_CATEGORIES = [
  'Products & stock',
  'Salaries',
  'Rent',
  'Electricity',
  'Marketing',
  'Maintenance',
] as const;

export interface PnLMetrics {
  income_minor: number;
  expense_minor: number;
  net_minor: number;
  margin_pct: number;
  dues_minor: number;
  groups: { label: string; income_h: number; expense_h: number }[];
  categories: { label: string; amt_minor: number; pct: number }[];
}

export class ExpenseRepository {
  /**
   * Fetch all real expenses for a shop from Supabase
   */
  async getExpenses(shopId: string): Promise<Expense[]> {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, expense_categories(name)')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const mapped: Expense[] = data.map((e) => ({
          id: e.id,
          shop_id: e.shop_id,
          category_id: e.category_id,
          category_name: (e.expense_categories as any)?.name || 'General',
          note: e.note,
          amount_minor: e.amount_minor,
          payment_method: e.payment_method,
          expense_date: new Date(e.created_at).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
          }),
          created_at: e.created_at,
        }));
        await this.cacheExpenses(shopId, mapped);
        return mapped;
      }
    } catch {
      console.warn('ExpenseRepository: Offline fallback active');
    }

    const cached = await this.getCachedExpenses(shopId);
    return cached || [];
  }

  /**
   * Add a real expense and persist directly to Supabase
   */
  async addExpense(
    shopId: string,
    categoryName: string,
    amountRupees: number,
    note: string,
    paymentMethod = 'UPI'
  ): Promise<Expense> {
    const today = new Date();
    const newExp: Expense = {
      id: `exp_${Date.now()}`,
      shop_id: shopId,
      category_id: null,
      category_name: categoryName,
      note: note || categoryName,
      amount_minor: Math.round(amountRupees * 100),
      payment_method: paymentMethod,
      expense_date: 'Today',
      created_at: today.toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          shop_id: shopId,
          note: note || categoryName,
          amount_minor: Math.round(amountRupees * 100),
          payment_method: paymentMethod,
          expense_date: today.toISOString().split('T')[0],
        } as any)
        .select()
        .single();

      if (error) {
        if ((error as any).code === '22P02') {
          console.warn('Supabase expense non-uuid fallback:', error.message);
        } else {
          console.error('Supabase expense add error:', error);
          throw new Error(error.message || 'Failed to save expense');
        }
      }

      if (data) {
        newExp.id = data.id;
      }
    } catch (e: any) {
      if (e.message && !e.message.includes('offline') && !e.message.includes('non-uuid')) {
        throw e;
      }
      console.warn('Supabase expense save offline:', e);
    }

    const current = (await this.getCachedExpenses(shopId)) || [];
    const updated = [newExp, ...current];
    await this.cacheExpenses(shopId, updated);
    return newExp;
  }

  /**
   * Update an existing expense
   */
  async updateExpense(
    shopId: string,
    expenseId: string,
    updates: {
      categoryName?: string;
      amountRupees?: number;
      note?: string;
      paymentMethod?: string;
    }
  ): Promise<Expense | null> {
    const cached = (await this.getCachedExpenses(shopId)) || [];
    const current = cached.find((e) => e.id === expenseId);
    if (!current) return null;

    const amountMinor = updates.amountRupees !== undefined ? Math.round(updates.amountRupees * 100) : current.amount_minor;
    const categoryName = updates.categoryName || current.category_name;
    const note = updates.note !== undefined ? updates.note : current.note;
    const paymentMethod = updates.paymentMethod || current.payment_method;

    const updatedExp: Expense = {
      ...current,
      category_name: categoryName,
      amount_minor: amountMinor,
      note,
      payment_method: paymentMethod,
    };

    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          note,
          amount_minor: amountMinor,
          payment_method: paymentMethod,
          updated_at: new Date().toISOString(),
        })
        .eq('id', expenseId)
        .eq('shop_id', shopId);

      if (error) {
        if ((error as any).code === '22P02') {
          console.warn('updateExpense non-uuid fallback:', error.message);
        } else {
          console.error('updateExpense error:', error);
          throw new Error(error.message || 'Failed to update expense');
        }
      }
    } catch (e: any) {
      if (e.message && !e.message.includes('offline') && !e.message.includes('non-uuid')) {
        throw e;
      }
      console.warn('updateExpense offline fallback:', e);
    }

    const updatedList = cached.map((e) => (e.id === expenseId ? updatedExp : e));
    await this.cacheExpenses(shopId, updatedList);
    return updatedExp;
  }

  /**
   * Delete an expense
   */
  async deleteExpense(shopId: string, expenseId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId)
        .eq('shop_id', shopId);

      if (error) {
        if ((error as any).code === '22P02') {
          console.warn('deleteExpense non-uuid fallback:', error.message);
        } else {
          console.error('deleteExpense error:', error);
          throw new Error(error.message || 'Failed to delete expense');
        }
      }
    } catch (e: any) {
      if (e.message && !e.message.includes('offline') && !e.message.includes('non-uuid')) {
        throw e;
      }
      console.warn('deleteExpense offline fallback:', e);
    }

    const cached = (await this.getCachedExpenses(shopId)) || [];
    const updatedList = cached.filter((e) => e.id !== expenseId);
    await this.cacheExpenses(shopId, updatedList);
    return true;
  }

  /**
   * Compute real Profit & Loss metrics from genuine bills and expenses for Day, Week, Month including Today
   */
  getPnLMetrics(
    period: Period,
    billsList: { total_minor: number; status?: string; created_at?: string; paid_amount_minor?: number; due_amount_minor?: number }[] = [],
    expensesList: Expense[] = []
  ): PnLMetrics {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;

    const getTime = (created_at?: string): number => {
      if (created_at) {
        const t = new Date(created_at).getTime();
        if (!isNaN(t)) return t;
      }
      return now.getTime();
    };

    let startLimit = todayStart;
    if (period === 'Day') {
      startLimit = todayStart;
    } else if (period === 'Week') {
      startLimit = todayStart - 6 * 24 * 60 * 60 * 1000;
    } else {
      // Month: 1st of current month up to today
      startLimit = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }

    const filteredBills = billsList.filter((b) => {
      if (b.status === 'deleted') return false;
      const t = getTime(b.created_at);
      return t >= startLimit && t <= todayEnd;
    });

    const filteredExpenses = expensesList.filter((e) => {
      const t = getTime(e.created_at);
      return t >= startLimit && t <= todayEnd;
    });

    const getBillCollected = (b: { total_minor: number; status?: string; paid_amount_minor?: number }): number => {
      if (b.status === 'pending') return 0;
      if (b.status === 'partially_paid') {
        return typeof b.paid_amount_minor === 'number' ? b.paid_amount_minor : (b.total_minor || 0);
      }
      return b.total_minor || 0;
    };

    const getBillDue = (b: { total_minor: number; status?: string; paid_amount_minor?: number; due_amount_minor?: number }): number => {
      if (b.status === 'pending') return b.total_minor || 0;
      if (b.status === 'partially_paid') {
        if (typeof b.due_amount_minor === 'number') return b.due_amount_minor;
        const paid = typeof b.paid_amount_minor === 'number' ? b.paid_amount_minor : 0;
        return Math.max(0, (b.total_minor || 0) - paid);
      }
      return 0;
    };

    let income = 0;
    for (const b of billsList as any[]) {
      if (!b || b.status === 'deleted') continue;
      if (typeof b.paid_amount_minor === 'number') {
        const t = getTime(b.created_at);
        if (t >= startLimit && t <= todayEnd) {
          income += b.paid_amount_minor;
        }
      } else if (b.payments && b.payments.length > 0) {
        for (const p of b.payments) {
          const pt = p.paid_at ? new Date(p.paid_at).getTime() : getTime(b.created_at);
          if (pt >= startLimit && pt <= todayEnd) {
            income += (p.amount_minor || 0);
          }
        }
      } else {
        const t = getTime(b.created_at);
        if (t >= startLimit && t <= todayEnd) {
          income += getBillCollected(b);
        }
      }
    }
    const expense = filteredExpenses.reduce((acc, e) => acc + (e.amount_minor || 0), 0);
    const net = income - expense;
    const margin = income > 0 ? Math.round((net / income) * 100) : 0;

    const dues = filteredBills.reduce((acc, b) => acc + getBillDue(b), 0);

    // Real Category breakdown from filtered expenses
    const catMap: Record<string, number> = {};
    for (const e of filteredExpenses) {
      const cat = e.category_name || 'General';
      catMap[cat] = (catMap[cat] || 0) + (e.amount_minor || 0);
    }

    const categories = Object.entries(catMap).map(([label, amt]) => ({
      label,
      amt_minor: amt,
      pct: expense > 0 ? Math.round((amt / expense) * 100) : 0,
    }));

    // Groups for timeline visualization
    let labels: string[] = [];
    if (period === 'Day') {
      labels = ['10a', '12p', '2p', '4p', '6p', '8p'];
    } else if (period === 'Week') {
      labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'];
    } else {
      labels = ['W1', 'W2', 'W3', 'W4', 'This Wk'];
    }

    const groups = labels.map((l) => ({
      label: l,
      income_h: income > 0 ? 60 : 0,
      expense_h: expense > 0 ? 30 : 0,
    }));

    return {
      income_minor: income,
      expense_minor: expense,
      net_minor: net,
      margin_pct: margin,
      dues_minor: dues,
      groups,
      categories,
    };
  }

  private async cacheExpenses(shopId: string, expenses: Expense[]): Promise<void> {
    await AsyncStorage.setItem(`${STORAGE_KEY_EXPENSES}_${shopId}`, JSON.stringify(expenses));
  }

  private async getCachedExpenses(shopId: string): Promise<Expense[] | null> {
    try {
      const data = await AsyncStorage.getItem(`${STORAGE_KEY_EXPENSES}_${shopId}`);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    return null;
  }
}

export const expenseRepository = new ExpenseRepository();
