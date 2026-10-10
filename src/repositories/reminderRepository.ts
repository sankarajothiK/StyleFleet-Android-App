import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReminderItem } from '../types/domain';
import { supabase } from '../lib/supabase';
import { toLocalDateStr } from '../utils/dateUtils';

const STORAGE_KEY_REMINDERS = '@salon_os_reminders_cache';
const STORAGE_KEY_RULES = '@salon_os_reminder_rules_cache';

/** "2026-10-06 10:30 AM" -> { when: "Today · 10:30 AM", isToday: true }; later days read "Tomorrow · ..." or "7 Oct · ..." */
export function describeAppointmentWhen(
  startsAt: string,
  now: Date = new Date(),
  labels: { today: string; tomorrow: string; locale: string } = { today: 'Today', tomorrow: 'Tomorrow', locale: 'en-US' }
): { when: string; time: string; isToday: boolean } {
  const raw = startsAt || '';
  const t12 = raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  const t24 = raw.match(/(?:T|\s)(\d{1,2}):(\d{2})/);
  let time = '';
  if (t12) {
    time = `${t12[1].padStart(2, '0')}:${t12[2]} ${t12[3].toUpperCase()}`;
  } else if (t24) {
    const h = parseInt(t24[1], 10);
    time = `${String(h % 12 === 0 ? 12 : h % 12).padStart(2, '0')}:${t24[2]} ${h >= 12 ? 'PM' : 'AM'}`;
  }

  const dm = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!dm) return { when: time || labels.today, time, isToday: true };

  const todayStr = toLocalDateStr(now);
  const tomorrowStr = toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const dateStr = `${dm[1]}-${dm[2]}-${dm[3]}`;
  const label =
    dateStr === todayStr
      ? labels.today
      : dateStr === tomorrowStr
      ? labels.tomorrow
      : new Date(+dm[1], +dm[2] - 1, +dm[3]).toLocaleDateString(labels.locale, { day: 'numeric', month: 'short' });
  return { when: time ? `${label} · ${time}` : label, time, isToday: dateStr === todayStr };
}

export interface ReminderRule {
  id: string;
  label: string;
  on: boolean;
}

const DEFAULT_RULES: ReminderRule[] = [
  { id: 'rule_1', label: 'Appointment reminder · 3 hours before', on: true },
  { id: 'rule_2', label: 'Payment due follow-up · every 3 days', on: true },
  { id: 'rule_3', label: 'Daily closing summary · 9:00 pm', on: true },
];

export class ReminderRepository {
  /**
   * Dynamically build real reminders from database appointments and customer dues
   */
  async getReminders(shopId: string): Promise<ReminderItem[]> {
    try {
      const reminders: ReminderItem[] = [];

      // 0. Fetch unread replies from StyleFleet Support admin panel
      try {
        const { data: answers } = await supabase
          .from('support_message_answers')
          .select('*')
          .eq('shop_id', shopId)
          .eq('is_read', false)
          .order('created_at', { ascending: false });

        if (answers && answers.length > 0) {
          for (const ans of answers) {
            reminders.push({
              id: `rem_support_${ans.id}`,
              group: 'Today',
              kind: 'support',
              title: `Support: ${ans.admin_name || 'StyleFleet Support'}`,
              sub: ans.answer,
              when: 'Support Reply',
              action: 'View Reply',
            });
          }
        }
      } catch {
        // ignore
      }

      // 1. Fetch upcoming appointments today
      const { data: appts } = await supabase
        .from('appointments')
        .select('*, customers(name)')
        .eq('shop_id', shopId)
        .eq('status', 'Confirmed')
        .limit(5);

      if (appts && appts.length > 0) {
        for (const a of appts) {
          if (typeof a.notes === 'string' && a.notes.includes('"is_deleted":true')) continue;
          const custName = (a.customers as any)?.name || 'Client';
          const when = describeAppointmentWhen(a.starts_at);
          reminders.push({
            id: `rem_appt_${a.id}`,
            group: when.isToday ? 'Today' : 'Upcoming',
            kind: 'appt',
            customer_name: custName,
            starts_at: a.starts_at,
            title: `Remind ${custName} about their appointment`,
            sub: 'Send appointment confirmation and reminder',
            when: when.when,
            action: 'Send now',
          });
        }
      }

      // 2. Fetch pending bills / dues
      const { data: pendingBills } = await supabase
        .from('bills')
        .select('*, customers(id, name, phone)')
        .eq('shop_id', shopId)
        .in('status', ['pending', 'partially_paid'])
        .limit(10);

      if (pendingBills && pendingBills.length > 0) {
        for (const b of pendingBills) {
          const cust = b.customers as any;
          const custName = cust?.name || b.customer_name || 'Customer';
          const custPhone = cust?.phone || null;
          const amt = Math.round((b.total_minor || 0) / 100);
          reminders.push({
            id: `rem_bill_${b.id}`,
            group: 'Today',
            kind: 'money',
            title: `${custName} owes ₹${amt}`,
            sub: `Invoice ${b.invoice_number} pending payment`,
            when: 'Today',
            action: 'Send Reminder',
            customer_id: b.customer_id,
            customer_name: custName,
            customer_phone: custPhone,
            amount_minor: b.total_minor,
          });
        }
      }

      // 3. Fetch customers with outstanding ledger dues
      const { data: dueCusts } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .gt('outstanding_due_minor', 0)
        .limit(15);

      if (dueCusts && dueCusts.length > 0) {
        for (const c of dueCusts) {
          if (!reminders.some((r) => r.customer_id === c.id)) {
            const amt = Math.round((c.outstanding_due_minor || 0) / 100);
            reminders.push({
              id: `rem_due_${c.id}`,
              group: 'Today',
              kind: 'money',
              title: `${c.name} owes ₹${amt}`,
              sub: `Outstanding balance of ₹${amt} pending`,
              when: 'Today',
              action: 'Send Reminder',
              customer_id: c.id,
              customer_name: c.name,
              customer_phone: c.phone,
              amount_minor: c.outstanding_due_minor,
            });
          }
        }
      }

      if (reminders.length > 0) {
        await this.cacheReminders(shopId, reminders);
        return reminders;
      }
    } catch {
      // ignore
    }

    const cached = await this.getCachedReminders(shopId);
    return cached || [];
  }

  async dismissReminder(shopId: string, reminderId: string): Promise<void> {
    if (reminderId.startsWith('rem_support_')) {
      const answerId = reminderId.replace('rem_support_', '');
      try {
        await supabase
          .from('support_message_answers')
          .update({ is_read: true })
          .eq('id', answerId);
      } catch {
        // ignore
      }
    }

    const current = (await this.getCachedReminders(shopId)) || [];
    const updated = current.filter((r) => r.id !== reminderId);
    await this.cacheReminders(shopId, updated);
  }

  async getRules(shopId: string): Promise<ReminderRule[]> {
    try {
      const data = await AsyncStorage.getItem(`${STORAGE_KEY_RULES}_${shopId}`);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    await this.cacheRules(shopId, DEFAULT_RULES);
    return DEFAULT_RULES;
  }

  async toggleRule(shopId: string, ruleId: string): Promise<boolean> {
    const current = await this.getRules(shopId);
    const target = current.find((r) => r.id === ruleId);
    if (!target) return false;
    target.on = !target.on;
    await this.cacheRules(shopId, current);
    return target.on;
  }

  private async cacheReminders(shopId: string, reminders: ReminderItem[]): Promise<void> {
    await AsyncStorage.setItem(`${STORAGE_KEY_REMINDERS}_${shopId}`, JSON.stringify(reminders));
  }

  private async getCachedReminders(shopId: string): Promise<ReminderItem[] | null> {
    try {
      const data = await AsyncStorage.getItem(`${STORAGE_KEY_REMINDERS}_${shopId}`);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    return null;
  }

  private async cacheRules(shopId: string, rules: ReminderRule[]): Promise<void> {
    await AsyncStorage.setItem(`${STORAGE_KEY_RULES}_${shopId}`, JSON.stringify(rules));
  }
}

export const reminderRepository = new ReminderRepository();
