import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bill, BillItem, Period } from '../types/domain';
import { subscriptionRepository } from './subscriptionRepository';
import { shopRepository } from './shopRepository';
import { generateUuid, isValidUuid } from '../utils/uuid';
import { assertSaved, isRemoteShop } from '../utils/persist';
import { resolveFreeSalesLimit } from '../utils/subscriptionUtils';

export { isValidUuid };

const STORAGE_KEY_BILLS = '@salon_os_bills_cache';

export interface SalesMetrics {
  total_minor: number;
  prev_minor: number;
  bills_count: number;
  avg_bill_minor: number;
  top_service: string;
  sub_label: string;
  modes: { label: string; amt_minor: number; pct: number }[];
  bars: { label: string; amt_minor: number; height_pct: number }[];
}

export function dedupeBills(billsList: Bill[]): Bill[] {
  const seenIds = new Set<string>();
  const seenInvoices = new Set<string>();
  const result: Bill[] = [];
  for (const b of billsList) {
    if (!b) continue;
    if (b.id && seenIds.has(b.id)) continue;
    if (b.invoice_number && seenInvoices.has(b.invoice_number)) continue;
    if (b.id) seenIds.add(b.id);
    if (b.invoice_number) seenInvoices.add(b.invoice_number);
    result.push(b);
  }
  return result;
}

export class BillingRepository {
  /**
   * Fetch all real bills for a shop from Supabase
   */
  async getBills(shopId: string): Promise<Bill[]> {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select(`
          *,
          customers(name),
          staff(name),
          bill_items(*),
          payments(*)
        `)
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        let custMap = new Map<string, string>();
        try {
          const raw = await AsyncStorage.getItem(`@salon_os_customers_cache_${shopId}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            custMap = new Map((parsed as any[]).map((c: any) => [c.id, c.name]));
          }
        } catch {}

        const mapped: Bill[] = data.map((b) => {
          const payments = (b.payments as any[]) || [];
          const primaryPayment = payments[0]?.method || (b.status === 'pending' ? 'Pending' : 'UPI');

          // Extract any tagged amounts in notes
          let notePaid: number | null = null;
          let noteDue: number | null = null;
          let noteTip: number | null = null;
          if (b.notes) {
            const mPaid = b.notes.match(/paid:(\d+)/);
            if (mPaid) notePaid = parseInt(mPaid[1], 10);
            const mDue = b.notes.match(/due:(\d+)/);
            if (mDue) noteDue = parseInt(mDue[1], 10);
            const mTip = b.notes.match(/tip:(\d+)/);
            if (mTip) noteTip = parseInt(mTip[1], 10);
          }
          const tipMinor = typeof (b as any).tip_minor === 'number' ? (b as any).tip_minor : (noteTip || 0);

          const sumPayments = payments.reduce((acc: number, p: any) => acc + (p.amount_minor || 0), 0);

          let paidMinor = 0;
          let dueMinor = 0;

          if (sumPayments > 0) {
            paidMinor = sumPayments;
            dueMinor = noteDue !== null ? noteDue : Math.max(0, b.total_minor - paidMinor);
          } else if (notePaid !== null || noteDue !== null) {
            paidMinor = notePaid !== null ? notePaid : (noteDue !== null ? Math.max(0, b.total_minor - noteDue) : 0);
            dueMinor = noteDue !== null ? noteDue : Math.max(0, b.total_minor - paidMinor);
          } else if (typeof (b as any).due_amount_minor === 'number' || typeof (b as any).paid_amount_minor === 'number') {
            dueMinor = typeof (b as any).due_amount_minor === 'number' ? (b as any).due_amount_minor : 0;
            paidMinor = typeof (b as any).paid_amount_minor === 'number' ? (b as any).paid_amount_minor : Math.max(0, b.total_minor - dueMinor);
          } else if (b.status === 'paid') {
            paidMinor = b.total_minor;
            dueMinor = 0;
          } else if (b.status === 'pending') {
            paidMinor = 0;
            dueMinor = b.total_minor;
          } else if (b.status === 'partially_paid') {
            paidMinor = 0;
            dueMinor = b.total_minor;
          } else {
            paidMinor = b.total_minor;
            dueMinor = 0;
          }

          // Bound checks
          paidMinor = Math.max(0, Math.min(b.total_minor, paidMinor));
          dueMinor = Math.max(0, dueMinor);
          if (b.status === 'paid') {
            dueMinor = 0;
          }

          let resolvedStatus = b.status;
          if (b.status !== 'deleted') {
            if (dueMinor === 0 && paidMinor >= b.total_minor) {
              resolvedStatus = 'paid';
            } else if (dueMinor > 0 && paidMinor > 0) {
              resolvedStatus = 'partially_paid';
            } else if (paidMinor === 0 && dueMinor > 0) {
              resolvedStatus = 'pending';
            }
          }

          const rawItems = ((b.bill_items as any[]) || []).map((i) => ({
            id: i.id,
            service_id: i.service_id,
            service_name_snapshot: i.service_name_snapshot,
            quantity: i.quantity,
            unit_price_minor: i.unit_price_minor,
            discount_minor: i.discount_minor,
            tax_minor: i.tax_minor,
            line_total_minor: i.line_total_minor,
            staff_id: i.staff_id,
          }));

          const items =
            rawItems.length > 0
              ? rawItems
              : [
                  {
                    id: undefined,
                    service_id: null,
                    service_name_snapshot:
                      b.notes?.includes('due') || b.invoice_number?.startsWith('DUE')
                        ? 'Opening Due / Settlement'
                        : 'Salon Service',
                    quantity: 1,
                    unit_price_minor: b.total_minor,
                    discount_minor: 0,
                    tax_minor: 0,
                    line_total_minor: b.total_minor,
                    staff_id: b.staff_id,
                  },
                ];

          const resolvedCustName =
            (b.customers as any)?.name || (b.customer_id ? custMap.get(b.customer_id) : null) || 'Walk-in';

          const isDeleted = b.status === 'deleted';
          let deletedAt: string | null = null;
          let deletedBy: string | undefined = undefined;
          let deletedByRole: 'owner' | 'stylist' | undefined = undefined;
          if (isDeleted) {
            const match = b.notes?.match(/deleted_at:([^;]+)/);
            deletedAt = match ? match[1] : b.updated_at || b.created_at;
            const byMatch = b.notes?.match(/deleted_by:([^;]+)/);
            if (byMatch) deletedBy = byMatch[1];
            const roleMatch = b.notes?.match(/deleted_by_role:([^;]+)/);
            if (roleMatch && (roleMatch[1] === 'owner' || roleMatch[1] === 'stylist')) {
              deletedByRole = roleMatch[1] as 'owner' | 'stylist';
            }
          }

          return {
            id: b.id,
            shop_id: b.shop_id,
            customer_id: b.customer_id,
            customer_name: resolvedCustName,
            staff_id: b.staff_id,
            staff_name: b.notes?.match(/staff_name:([^;]+)/)?.[1] || (b.staff as any)?.name || 'Reception',
            invoice_number: b.invoice_number,
            status: resolvedStatus || b.status,
            subtotal_minor: b.subtotal_minor,
            discount_minor: b.discount_minor,
            tax_minor: b.tax_minor,
            tip_minor: tipMinor,
            total_minor: b.total_minor,
            paid_amount_minor: paidMinor,
            due_amount_minor: dueMinor,
            notes: b.notes,
            issued_at: new Date(b.created_at).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            }).toLowerCase(),
            created_at: b.created_at,
            deleted_at: deletedAt,
            deleted_by: deletedBy,
            deleted_by_role: deletedByRole,
            payment_method: primaryPayment,
            items,
            is_edited: !!(b.notes?.includes('[Edited]') || (b.updated_at && b.created_at && new Date(b.updated_at).getTime() - new Date(b.created_at).getTime() > 2000)),
            reminder_status: (b as any).reminder_status || 'Not Sent',
            confirmation_status: (b as any).confirmation_status || 'Pending',
            payments: payments.map((p: any) => ({
              id: p.id,
              amount_minor: b.status === 'paid' && payments.length === 1 ? b.total_minor : (p.amount_minor || 0),
              method: p.method || primaryPayment,
              paid_at: p.paid_at || b.created_at,
            })),
          };
        });

        const deduped = dedupeBills(mapped);
        await this.cacheBills(shopId, deduped);
        return deduped;
      }
    } catch (e) {
      console.warn('BillingRepository: Offline fallback active');
    }

    const cached = await this.getCachedBills(shopId);
    return dedupeBills(cached || []);
  }

  /**
   * Total sales created count (including active + deleted bills).
   * Monotonically non-decreasing for free usage limit tracking.
   */
  async getTotalSalesCreatedCount(shopId: string): Promise<number> {
    let remoteCount: number | null = null;
    try {
      const { count, error } = await supabase
        .from('bills')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', shopId);
      if (!error && count !== null) {
        remoteCount = count;
      }
    } catch {}

    let localCount = 0;
    try {
      const cached = await AsyncStorage.getItem(`@salon_os_total_sales_count_${shopId}`);
      if (cached) localCount = parseInt(cached, 10) || 0;
    } catch {}

    const total = Math.max(remoteCount !== null ? remoteCount : 0, localCount);
    try {
      await AsyncStorage.setItem(`@salon_os_total_sales_count_${shopId}`, total.toString());
    } catch {}
    return total;
  }

  /**
   * Generates the next sequential invoice number based on salon settings:
   * - Monthly: resets sequence to 0001 each month, e.g. 2026-OCT-0001
   * - Yearly: continuous sequence through the year, e.g. 2026-0001
   */
  async generateNextInvoiceNumber(shopId: string, customDate?: Date): Promise<string> {
    const d = customDate || new Date();
    const year = d.getFullYear();
    const MONTH_ABBRS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const monthAbbr = MONTH_ABBRS[d.getMonth()];

    let mode: 'monthly' | 'yearly' = 'monthly';
    try {
      mode = await shopRepository.getInvoiceNumberingMode(shopId);
    } catch {}

    let shopPrefix = 'CS';
    try {
      shopPrefix = await shopRepository.getInvoicePrefix(shopId);
    } catch {}

    // Inspect existing bills in Supabase + local cache
    let allInvoiceNumbers: string[] = [];
    try {
      const { data } = await supabase
        .from('bills')
        .select('invoice_number, created_at, issued_at')
        .eq('shop_id', shopId);
      if (data && data.length > 0) {
        allInvoiceNumbers = data.map((b) => b.invoice_number).filter(Boolean);
      }
    } catch {}

    try {
      const cached = await this.getCachedBills(shopId);
      if (cached && cached.length > 0) {
        for (const c of cached) {
          if (c.invoice_number && !allInvoiceNumbers.includes(c.invoice_number)) {
            allInvoiceNumbers.push(c.invoice_number);
          }
        }
      }
    } catch {}

    if (mode === 'monthly') {
      // Monthly pattern: [PREFIX-]YYYY-MONTH-0001 e.g. CS-2026-OCT-0001 or 2026-OCT-0001
      const regex = new RegExp(`(?:.*[-_\\s])?${year}[-_\\s]+${monthAbbr}[-_\\s]+(\\d+)`, 'i');
      let maxSeq = 0;

      for (const inv of allInvoiceNumbers) {
        const m = inv.match(regex);
        if (m) {
          const num = parseInt(m[1], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }

      const nextSeq = maxSeq + 1;
      return `${shopPrefix}-${year}-${monthAbbr}-${String(nextSeq).padStart(4, '0')}`;
    } else {
      // Yearly pattern: [PREFIX-]YYYY-0001 e.g. CS-2026-0001 or K7-2026-0001 or 2026-0001
      const regex = new RegExp(`(?:.*[-_\\s])?${year}[-_\\s]+(\\d{4})$`, 'i');
      let maxSeq = 0;

      for (const inv of allInvoiceNumbers) {
        const m = inv.match(regex);
        if (m) {
          const num = parseInt(m[1], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }

      const nextSeq = maxSeq + 1;
      return `${shopPrefix}-${year}-${String(nextSeq).padStart(4, '0')}`;
    }
  }

  /** Remove a bill whose items, payment or dues could not be saved (items and payments go with it). */
  private async discardBill(billId: string): Promise<void> {
    try {
      await supabase.from('bills').delete().eq('id', billId);
    } catch (e) {
      console.warn('Could not remove the unfinished bill', billId, e);
    }
  }

  /**
   * Create a new real bill in Supabase
   */
  async createBill(
    shopId: string,
    customerName: string,
    customerId: string | null,
    staffName: string,
    staffId: string | null,
    items: { name: string; priceMinor: number; isColour?: boolean }[],
    paymentMethod: string,
    customDiscountMinor = 0,
    paidAmountMinor?: number,
    dueAmountMinor?: number,
    tipMinor = 0,
    staffIds?: string[],
    billDate?: string | Date
  ): Promise<Bill> {
    // Free-sales limit check (counts active + deleted bills); a salon may have its own limit
    const totalSalesCreated = await this.getTotalSalesCreatedCount(shopId);
    let freeSalesLimit = resolveFreeSalesLimit(null);
    try {
      const { data: limitRow } = await supabase
        .from('shops')
        .select('free_sales_limit')
        .eq('id', shopId)
        .maybeSingle();
      freeSalesLimit = resolveFreeSalesLimit(limitRow?.free_sales_limit);
    } catch {}
    let isPro = false;
    try {
      const subInfo = await subscriptionRepository.getSubscriptionInfo(shopId);
      isPro = subInfo.type === 'subscription' && !subInfo.subscription?.isExpired;
    } catch {}

    if (totalSalesCreated >= freeSalesLimit && !isPro) {
      throw new Error(`SALES_LIMIT_REACHED: Free limit of ${freeSalesLimit} sales reached. Please upgrade to Pro.`);
    }

    const subtotalMinor = items.reduce((acc, it) => acc + it.priceMinor, 0);
    const discountMinor = Math.min(subtotalMinor, Math.max(0, customDiscountMinor));
    const safeTipMinor = Math.max(0, tipMinor || 0);
    const taxMinor = 0; // GST is disabled as per salon configuration
    const totalMinor = Math.max(0, subtotalMinor - discountMinor + safeTipMinor);

    let status = 'paid';
    let finalPaidMinor = totalMinor;
    let finalDueMinor = 0;

    if (paymentMethod === 'Fully Pending') {
      status = 'pending';
      finalPaidMinor = 0;
      finalDueMinor = totalMinor;
    } else if (paymentMethod === 'Partial Pay' || paymentMethod.startsWith('Partial Pay')) {
      finalPaidMinor = typeof paidAmountMinor === 'number' ? paidAmountMinor : 0;
      finalDueMinor = typeof dueAmountMinor === 'number' ? dueAmountMinor : Math.max(0, totalMinor - finalPaidMinor);
      if (finalDueMinor === 0 && finalPaidMinor >= totalMinor) {
        status = 'paid';
      } else if (finalPaidMinor === 0) {
        status = 'pending';
      } else {
        status = 'partially_paid';
      }
    }

    const billDateTime = billDate ? new Date(billDate) : new Date();
    const invoiceNumber = await this.generateNextInvoiceNumber(shopId, billDateTime);

    const noteParts: string[] = [];
    if (finalDueMinor > 0) noteParts.push(`due:${finalDueMinor}`);
    if (finalPaidMinor > 0) noteParts.push(`paid:${finalPaidMinor}`);
    if (safeTipMinor > 0) noteParts.push(`tip:${safeTipMinor}`);
    if (staffName) noteParts.push(`staff_name:${staffName}`);
    if (staffIds && staffIds.length > 0) noteParts.push(`staff_ids:${staffIds.join(',')}`);
    const notes = noteParts.length > 0 ? noteParts.join(';') : null;

    const resolvedPaymentMethod = paymentMethod.includes('Cash')
      ? 'Cash'
      : paymentMethod.includes('Card')
      ? 'Card'
      : 'UPI';

    const safeCustomerId = isValidUuid(customerId) ? customerId : null;
    const safeStaffId = isValidUuid(staffId) ? staffId : null;

    const newBill: Bill = {
      id: generateUuid(),
      shop_id: shopId,
      customer_id: customerId,
      customer_name: customerName,
      staff_id: staffId,
      staff_name: staffName,
      invoice_number: invoiceNumber,
      status,
      subtotal_minor: subtotalMinor,
      discount_minor: discountMinor,
      tax_minor: taxMinor,
      tip_minor: safeTipMinor,
      total_minor: totalMinor,
      paid_amount_minor: finalPaidMinor,
      due_amount_minor: finalDueMinor,
      notes,
      issued_at: billDateTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).toLowerCase(),
      created_at: billDateTime.toISOString(),
      reminder_status: 'Not Sent',
      confirmation_status: 'Pending',
      payment_method: paymentMethod,
      items: items.map((it) => {
        const qty = (it as any).quantity || 1;
        const unitPrice = (it as any).unitPriceMinor || Math.round(it.priceMinor / qty);
        return {
          service_id: null,
          service_name_snapshot: it.name,
          quantity: qty,
          unit_price_minor: unitPrice,
          discount_minor: 0,
          tax_minor: 0,
          line_total_minor: it.priceMinor,
          staff_id: staffId,
        };
      }),
      payments: finalPaidMinor > 0 ? [
        {
          amount_minor: finalPaidMinor,
          method: resolvedPaymentMethod,
          paid_at: billDateTime.toISOString(),
        }
      ] : [],
    };

    if (isRemoteShop(shopId)) {
      const billRow: Record<string, unknown> = {
        shop_id: shopId,
        customer_id: safeCustomerId,
        staff_id: safeStaffId,
        invoice_number: invoiceNumber,
        subtotal_minor: subtotalMinor,
        discount_minor: discountMinor,
        tax_minor: taxMinor,
        tip_minor: safeTipMinor,
        total_minor: totalMinor,
        status,
        notes,
        created_at: billDateTime.toISOString(),
        reminder_status: 'Not Sent',
        confirmation_status: 'Pending',
      };

      let saved = await supabase.from('bills').insert(billRow as any).select().single();
      if (
        saved.error &&
        (saved.error.code === 'PGRST204' ||
          saved.error.message?.includes('tip_minor') ||
          saved.error.message?.includes('reminder_status'))
      ) {
        // Database not yet migrated with the tip / reminder columns: save without them
        const { tip_minor: _tip, reminder_status: _reminder, confirmation_status: _confirmation, ...legacyRow } = billRow;
        saved = await supabase.from('bills').insert(legacyRow as any).select().single();
      }
      assertSaved(saved, 'the bill');
      if (!saved.data) throw new Error('The bill could not be saved. Please try again.');

      const savedBillId: string = saved.data.id;
      newBill.id = savedBillId;

      try {
        const itemRows = items.map((it) => {
          const qty = (it as any).quantity || 1;
          const unitPrice = (it as any).unitPriceMinor || Math.round(it.priceMinor / qty);
          return {
            bill_id: savedBillId,
            service_name_snapshot: it.name,
            quantity: qty,
            unit_price_minor: unitPrice,
            line_total_minor: it.priceMinor,
            // Same check as the bill's own stylist: one invalid id must not make the whole items insert fail
            staff_id: safeStaffId,
          };
        });

        const [itemsResult, paymentResult] = await Promise.all([
          supabase.from('bill_items').insert(itemRows as any),
          finalPaidMinor > 0
            ? supabase.from('payments').insert({
                bill_id: savedBillId,
                shop_id: shopId,
                amount_minor: finalPaidMinor,
                method: resolvedPaymentMethod,
                status: 'completed',
                reference: paymentMethod.startsWith('Partial Pay')
                  ? `Partial upfront payment (${resolvedPaymentMethod})`
                  : 'Salon billing invoice payment',
                paid_at: billDateTime.toISOString(),
              } as any)
            : Promise.resolve({ error: null }),
        ]);
        assertSaved(itemsResult, 'the bill items');
        assertSaved(paymentResult, 'the payment');

        // Last, so a failure above never leaves the customer's dues changed for a bill that was not kept
        if (finalDueMinor > 0 && safeCustomerId) {
          const { data: custRow, error: custReadError } = await supabase
            .from('customers')
            .select('outstanding_due_minor')
            .eq('id', safeCustomerId)
            .maybeSingle();
          assertSaved({ error: custReadError }, "the customer's dues");
          const dueUpdate = await supabase
            .from('customers')
            .update({ outstanding_due_minor: (custRow?.outstanding_due_minor || 0) + finalDueMinor })
            .eq('id', safeCustomerId);
          assertSaved(dueUpdate, "the customer's dues");
        }
      } catch (e) {
        await this.discardBill(savedBillId);
        throw e;
      }
    }

    const current = (await this.getCachedBills(shopId)) || [];
    const updated = dedupeBills([newBill, ...current]);
    await this.cacheBills(shopId, updated);

    try {
      const nextCount = totalSalesCreated + 1;
      await AsyncStorage.setItem(`@salon_os_total_sales_count_${shopId}`, nextCount.toString());
    } catch {}

    return newBill;
  }

  /**
   * Soft delete a bill (moves to Recently Deleted for 30 days)
   * Note: Deleted bills still count toward the 100-sales limit.
   */
  async deleteBill(
    shopId: string,
    billId: string,
    deletedBy?: string,
    deletedByRole?: 'owner' | 'stylist'
  ): Promise<boolean> {
    const nowIso = new Date().toISOString();
    const who = deletedBy || 'Owner';
    const role = deletedByRole || 'owner';
    if (isRemoteShop(shopId) && isValidUuid(billId)) {
      const { data: current, error: readError } = await supabase
        .from('bills')
        .select('notes')
        .eq('id', billId)
        .eq('shop_id', shopId)
        .maybeSingle();
      assertSaved({ error: readError }, 'the deletion');

      const existingNotes = current?.notes || '';
      const updatedNotes = `deleted_by:${who};deleted_by_role:${role};deleted_at:${nowIso};${existingNotes}`;

      const result = await supabase
        .from('bills')
        .update({
          status: 'deleted',
          notes: updatedNotes,
          updated_at: nowIso,
        })
        .eq('id', billId)
        .eq('shop_id', shopId);
      assertSaved(result, 'the deletion');
    }

    const cached = (await this.getCachedBills(shopId)) || [];
    const updated = cached.map((b) =>
      b.id === billId
        ? {
            ...b,
            status: 'deleted',
            deleted_at: nowIso,
            deleted_by: who,
            deleted_by_role: role,
            notes: `deleted_by:${who};deleted_by_role:${role};deleted_at:${nowIso};${b.notes || ''}`,
          }
        : b
    );
    await this.cacheBills(shopId, updated);
    return true;
  }

  /**
   * Restore a recently deleted bill
   */
  async restoreBill(shopId: string, billId: string): Promise<boolean> {
    const nowIso = new Date().toISOString();
    if (isRemoteShop(shopId) && isValidUuid(billId)) {
      const { data: current, error: readError } = await supabase
        .from('bills')
        .select('notes, total_minor')
        .eq('id', billId)
        .eq('shop_id', shopId)
        .maybeSingle();
      assertSaved({ error: readError }, 'the restore');
      if (!current) throw new Error('This bill was not found on the server, so it could not be restored.');

      const existingNotes = (current.notes || '')
        .replace(/deleted_by:[^;]+;?/, '')
        .replace(/deleted_by_role:[^;]+;?/, '')
        .replace(/deleted_at:[^;]+;?/, '');

      const result = await supabase
        .from('bills')
        .update({
          status: 'paid',
          notes: existingNotes,
          updated_at: nowIso,
        })
        .eq('id', billId)
        .eq('shop_id', shopId);
      assertSaved(result, 'the restore');
    }

    const cached = (await this.getCachedBills(shopId)) || [];
    const updated = cached.map((b) =>
      b.id === billId
        ? {
            ...b,
            status: 'paid',
            deleted_at: null,
            deleted_by: undefined,
            deleted_by_role: undefined,
            notes: (b.notes || '')
              .replace(/deleted_by:[^;]+;?/, '')
              .replace(/deleted_by_role:[^;]+;?/, '')
              .replace(/deleted_at:[^;]+;?/, ''),
          }
        : b
    );
    await this.cacheBills(shopId, updated);
    return true;
  }

  /**
   * Update an existing bill
   */
  async updateBill(
    shopId: string,
    billId: string,
    updates: {
      items?: { name: string; priceMinor: number }[];
      discountMinor?: number;
      tipMinor?: number;
      paymentMethod?: string;
      notes?: string;
      paidAmountMinor?: number;
      dueAmountMinor?: number;
      staffName?: string;
      staffId?: string | null;
      customerName?: string;
      customerId?: string | null;
    },
    fallbackBill?: Bill | null
  ): Promise<Bill | null> {
    const cached = (await this.getCachedBills(shopId)) || [];
    let current = cached.find((b) => b.id === billId || (b.invoice_number && fallbackBill && b.invoice_number === fallbackBill.invoice_number));
    if (!current && fallbackBill) {
      current = fallbackBill;
    }
    if (!current) return null;

    const subtotalMinor = updates.items
      ? updates.items.reduce((acc, it) => acc + it.priceMinor, 0)
      : current.subtotal_minor;
    const discountMinor = updates.discountMinor !== undefined ? updates.discountMinor : current.discount_minor;
    const tipMinor = updates.tipMinor !== undefined ? Math.max(0, updates.tipMinor) : (current.tip_minor || 0);
    const totalMinor = Math.max(0, subtotalMinor - discountMinor + tipMinor);
    const paidAmountMinor = updates.paidAmountMinor !== undefined ? updates.paidAmountMinor : totalMinor;
    const dueAmountMinor = updates.dueAmountMinor !== undefined ? updates.dueAmountMinor : Math.max(0, totalMinor - paidAmountMinor);
    const status = dueAmountMinor > 0 ? (paidAmountMinor > 0 ? 'partially_paid' : 'pending') : 'paid';
    const paymentMethod = updates.paymentMethod || current.payment_method;
    const staffName = updates.staffName !== undefined ? updates.staffName : current.staff_name;
    const staffId = updates.staffId !== undefined ? updates.staffId : current.staff_id;
    const customerName = updates.customerName !== undefined ? updates.customerName : current.customer_name;
    const customerId = updates.customerId !== undefined ? updates.customerId : current.customer_id;

    const effectiveBillId = current.id || billId;

    const cleanOldNotes = (updates.notes || current.notes || '')
      .replace(/staff_name:[^;]+;?/g, '')
      .replace(/staff_ids:[^;]+;?/g, '');
    const updatedNotes = `due:${dueAmountMinor};paid:${paidAmountMinor};tip:${tipMinor};staff_name:${staffName};[Edited];${cleanOldNotes}`;

    const updatedPayments = paidAmountMinor > 0
      ? [
          {
            id: current.payments?.[0]?.id || `pay_${Date.now()}`,
            amount_minor: paidAmountMinor,
            method: paymentMethod,
            paid_at: current.payments?.[0]?.paid_at || current.created_at || new Date().toISOString(),
          },
        ]
      : [];

    const updatedBill: Bill = {
      ...current,
      id: effectiveBillId,
      customer_name: customerName,
      customer_id: customerId,
      subtotal_minor: subtotalMinor,
      discount_minor: discountMinor,
      tip_minor: tipMinor,
      total_minor: totalMinor,
      paid_amount_minor: paidAmountMinor,
      due_amount_minor: dueAmountMinor,
      status,
      payment_method: paymentMethod,
      staff_name: staffName,
      staff_id: staffId,
      notes: updatedNotes,
      is_edited: true,
      payments: updatedPayments,
      items: updates.items
        ? updates.items.map((it) => {
            const qty = (it as any).quantity || 1;
            const unitPrice = (it as any).unitPriceMinor || Math.round(it.priceMinor / qty);
            return {
              id: undefined,
              service_id: null,
              service_name_snapshot: it.name,
              quantity: qty,
              unit_price_minor: unitPrice,
              discount_minor: 0,
              tax_minor: 0,
              line_total_minor: it.priceMinor,
              staff_id: staffId || null,
            };
          })
        : current.items,
    };

    const safeUpdateCustId = isValidUuid(customerId) ? customerId : null;
    const safeUpdateStaffId = isValidUuid(staffId) ? staffId : null;

    if (isRemoteShop(shopId) && isValidUuid(effectiveBillId)) {
      // 1. Line items: add the new rows first and drop the old ones only once the new ones are safely in
      if (updates.items && updates.items.length > 0) {
        const oldRows = await supabase.from('bill_items').select('id').eq('bill_id', effectiveBillId);
        assertSaved(oldRows, 'the bill items');
        const oldIds = (oldRows.data || []).map((r: { id: string }) => r.id);

        const itemRows = updates.items.map((it) => {
          const qty = (it as any).quantity || 1;
          const unitPrice = (it as any).unitPriceMinor || Math.round(it.priceMinor / qty);
          return {
            bill_id: effectiveBillId,
            service_name_snapshot: it.name,
            quantity: qty,
            unit_price_minor: unitPrice,
            line_total_minor: it.priceMinor,
            staff_id: safeUpdateStaffId,
          };
        });
        const inserted = await supabase.from('bill_items').insert(itemRows as any).select('id');
        assertSaved(inserted, 'the bill items');
        const newIds = (inserted.data || []).map((r: { id: string }) => r.id);

        if (oldIds.length > 0) {
          const removed = await supabase.from('bill_items').delete().in('id', oldIds);
          if (removed.error) {
            // keep exactly one set of items, then report the failure
            if (newIds.length > 0) await supabase.from('bill_items').delete().in('id', newIds);
            assertSaved(removed, 'the bill items');
          }
        }
      }

      // 2. Bill header
      const headerFields = {
        customer_id: safeUpdateCustId,
        staff_id: safeUpdateStaffId,
        subtotal_minor: subtotalMinor,
        discount_minor: discountMinor,
        total_minor: totalMinor,
        status,
        notes: updatedNotes,
        updated_at: new Date().toISOString(),
      };
      let header = await supabase
        .from('bills')
        .update({ ...headerFields, tip_minor: tipMinor } as any)
        .eq('id', effectiveBillId)
        .eq('shop_id', shopId)
        .select('id');
      if (header.error && (header.error.code === 'PGRST204' || header.error.message?.includes('tip_minor'))) {
        // Database not yet migrated with the tip column
        header = await supabase
          .from('bills')
          .update(headerFields as any)
          .eq('id', effectiveBillId)
          .eq('shop_id', shopId)
          .select('id');
      }
      assertSaved(header, 'the bill');
      if (!header.data || header.data.length === 0) {
        throw new Error('This bill was not found on the server, so the changes were not saved.');
      }

      // 3. Payment
      if (paidAmountMinor > 0) {
        const existing = await supabase
          .from('payments')
          .select('id, amount_minor')
          .eq('bill_id', effectiveBillId)
          .eq('shop_id', shopId);
        assertSaved(existing, 'the payment');
        const paymentRows = existing.data || [];

        if (paymentRows.length > 0) {
          assertSaved(
            await supabase
              .from('payments')
              .update({ amount_minor: paidAmountMinor, method: paymentMethod, status: 'completed' })
              .eq('id', paymentRows[0].id),
            'the payment'
          );
          if (paymentRows.length > 1) {
            assertSaved(
              await supabase.from('payments').delete().in('id', paymentRows.slice(1).map((p: { id: string }) => p.id)),
              'the payment'
            );
          }
        } else {
          assertSaved(
            await supabase.from('payments').insert({
              bill_id: effectiveBillId,
              shop_id: shopId,
              amount_minor: paidAmountMinor,
              method: paymentMethod,
              status: 'completed',
              reference: paymentMethod.startsWith('Partial Pay')
                ? `Partial upfront payment (${paymentMethod})`
                : 'Salon billing invoice payment',
              paid_at: current.created_at || new Date().toISOString(),
            } as any),
            'the payment'
          );
        }
      } else {
        assertSaved(await supabase.from('payments').delete().eq('bill_id', effectiveBillId), 'the payment');
      }

      // 4. Customer dues
      const oldDue = current.due_amount_minor !== undefined
        ? current.due_amount_minor
        : (current.status === 'pending' ? current.total_minor : 0);
      const newDue = dueAmountMinor;

      const adjustCustomerDue = async (id: string, delta: number) => {
        const { data: row, error: readError } = await supabase
          .from('customers')
          .select('outstanding_due_minor')
          .eq('id', id)
          .maybeSingle();
        assertSaved({ error: readError }, "the customer's dues");
        if (!row) return;
        assertSaved(
          await supabase
            .from('customers')
            .update({ outstanding_due_minor: Math.max(0, (row.outstanding_due_minor || 0) + delta) })
            .eq('id', id),
          "the customer's dues"
        );
      };

      if (current.customer_id && isValidUuid(current.customer_id) && current.customer_id !== customerId && oldDue > 0) {
        await adjustCustomerDue(current.customer_id, -oldDue);
      }
      if (customerId && isValidUuid(customerId)) {
        const dueDiff = current.customer_id === customerId ? newDue - oldDue : newDue;
        if (dueDiff !== 0) await adjustCustomerDue(customerId, dueDiff);
      }
    }

    const hasMatch = cached.some((b) => b.id === effectiveBillId || (b.invoice_number && b.invoice_number === current.invoice_number));
    const updatedList = hasMatch
      ? cached.map((b) => (b.id === effectiveBillId || (b.invoice_number && b.invoice_number === current.invoice_number) ? updatedBill : b))
      : [updatedBill, ...cached];
    await this.cacheBills(shopId, dedupeBills(updatedList));
    return updatedBill;
  }

  /**
   * Update bill communication statuses (reminder_status and/or confirmation_status) in Supabase & cache
   */
  async updateBillCommunicationStatus(
    shopId: string,
    billId: string,
    statuses: { reminder_status?: 'Not Sent' | 'Sent' | 'Pending'; confirmation_status?: 'Pending' | 'Confirmed' }
  ): Promise<Bill> {
    const cachedBills = (await this.getCachedBills(shopId)) || [];
    const current = cachedBills.find((b) => b.id === billId || b.invoice_number === billId);
    const updatedBill: Bill = {
      ...(current || ({} as Bill)),
      reminder_status: statuses.reminder_status !== undefined ? statuses.reminder_status : (current?.reminder_status || 'Not Sent'),
      confirmation_status: statuses.confirmation_status !== undefined ? statuses.confirmation_status : (current?.confirmation_status || 'Pending'),
    };

    try {
      const updatePayload: any = {};
      if (statuses.reminder_status !== undefined) updatePayload.reminder_status = statuses.reminder_status;
      if (statuses.confirmation_status !== undefined) updatePayload.confirmation_status = statuses.confirmation_status;

      await supabase
        .from('bills')
        .update(updatePayload)
        .eq('id', billId)
        .eq('shop_id', shopId);
    } catch (e) {
      console.warn('updateBillCommunicationStatus remote error, using cache:', e);
    }

    const updated = cachedBills.map((b) => (b.id === billId || b.invoice_number === billId ? updatedBill : b));
    await this.cacheBills(shopId, dedupeBills(updated));
    return updatedBill;
  }

  /**
   * Filter recently deleted bills (available for 30 days)
   */
  getRecentlyDeletedBills(bills: Bill[]): Bill[] {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return bills.filter((b) => {
      if (!b || b.status !== 'deleted') return false;
      const delTime = b.deleted_at
        ? new Date(b.deleted_at).getTime()
        : b.created_at
        ? new Date(b.created_at).getTime()
        : b.issued_at
        ? new Date(b.issued_at).getTime()
        : now;
      return now - delTime <= thirtyDaysMs;
    });
  }

  /**
   * Compute real sales metrics directly from genuine shop bills with Day, Week, Month including Today
   */
  getSalesMetrics(period: Period, billsList?: Bill[]): SalesMetrics {
    const allBills = billsList || [];
    const activeBills = allBills.filter((b) => b && b.status !== 'deleted');
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;

    // Helper to get timestamp of a bill
    const getBillTime = (b: Bill): number => {
      if (b.created_at) {
        const t = new Date(b.created_at).getTime();
        if (!isNaN(t)) return t;
      }
      return now.getTime();
    };

    // Helper to get collected revenue for a bill (financial correctness: only count actual paid amounts)
    const getBillCollectedMinor = (b: Bill): number => {
      if (b.status === 'pending') return 0;
      if (b.status === 'partially_paid') {
        return typeof b.paid_amount_minor === 'number' ? b.paid_amount_minor : (b.total_minor || 0);
      }
      return b.total_minor || 0;
    };

    // Flatten all collected payment transactions from active bills
    interface CollectedPayment {
      amount_minor: number;
      method: string;
      time: number;
      bill: Bill;
    }

    const allPayments: CollectedPayment[] = [];
    for (const b of activeBills) {
      const collected = getBillCollectedMinor(b);
      if (collected <= 0 || b.status === 'pending') {
        continue;
      }

      if (b.payments && b.payments.length > 0) {
        const sumPayments = b.payments.reduce((acc, p) => acc + (p.amount_minor || 0), 0);
        for (const p of b.payments) {
          const pt = p.paid_at ? new Date(p.paid_at).getTime() : getBillTime(b);
          // Scale payments proportionally if sum does not match current collected total
          const effectiveAmount = sumPayments > 0 && sumPayments !== collected
            ? Math.round(((p.amount_minor || 0) / sumPayments) * collected)
            : (p.amount_minor || 0);

          if (effectiveAmount > 0) {
            allPayments.push({
              amount_minor: effectiveAmount,
              method: p.method || b.payment_method || 'UPI',
              time: isNaN(pt) ? getBillTime(b) : pt,
              bill: b,
            });
          }
        }
      } else {
        allPayments.push({
          amount_minor: collected,
          method: b.payment_method || 'UPI',
          time: getBillTime(b),
          bill: b,
        });
      }
    }

    let filteredPayments: CollectedPayment[] = [];
    let prevPayments: CollectedPayment[] = [];
    let bars: { label: string; amt_minor: number; height_pct: number }[] = [];
    let subLabel = '';

    if (period === 'Day') {
      // Current day (Today)
      filteredPayments = allPayments.filter((p) => p.time >= todayStart && p.time <= todayEnd);

      // Yesterday
      const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
      prevPayments = allPayments.filter((p) => p.time >= yesterdayStart && p.time < todayStart);

      // Histogram buckets across operating hours for Today: 9am, 11am, 1pm, 3pm, 5pm, 7pm, 9pm
      const timeSlots = [
        { label: '9a', startHour: 0, endHour: 10 },
        { label: '11a', startHour: 10, endHour: 12 },
        { label: '1p', startHour: 12, endHour: 14 },
        { label: '3p', startHour: 14, endHour: 16 },
        { label: '5p', startHour: 16, endHour: 18 },
        { label: '7p', startHour: 18, endHour: 20 },
        { label: '9p', startHour: 20, endHour: 24 },
      ];

      const slotTotals = timeSlots.map((slot) => {
        const slotPayments = filteredPayments.filter((p) => {
          const d = new Date(p.time);
          const h = d.getHours();
          return h >= slot.startHour && h < slot.endHour;
        });
        const amt = slotPayments.reduce((acc, p) => acc + p.amount_minor, 0);
        return { label: slot.label, amt_minor: amt, height_pct: 10 };
      });

      const maxSlot = Math.max(...slotTotals.map((s) => s.amt_minor), 0);
      bars = slotTotals.map((s) => ({
        label: s.label,
        amt_minor: s.amt_minor,
        height_pct: maxSlot > 0 ? Math.max(10, Math.round((s.amt_minor / maxSlot) * 100)) : 10,
      }));

      const todayStr = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
      subLabel = `Today (${todayStr}) vs yesterday`;
    } else if (period === 'Week') {
      // 7 days ending today (inclusive of today)
      const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
      filteredPayments = allPayments.filter((p) => p.time >= weekStart && p.time <= todayEnd);

      // Prior 7-day period
      const prevWeekStart = weekStart - 7 * 24 * 60 * 60 * 1000;
      prevPayments = allPayments.filter((p) => p.time >= prevWeekStart && p.time < weekStart);

      // 7 day bars ending with Today
      const dayBars: { label: string; amt_minor: number; height_pct: number }[] = [];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      for (let i = 6; i >= 0; i--) {
        const dStart = todayStart - i * 24 * 60 * 60 * 1000;
        const dEnd = dStart + 24 * 60 * 60 * 1000 - 1;
        const targetDate = new Date(dStart);
        const dayLabel = i === 0 ? 'Today' : dayNames[targetDate.getDay()];

        const dayPayments = allPayments.filter((p) => p.time >= dStart && p.time <= dEnd);
        const amt = dayPayments.reduce((acc, p) => acc + p.amount_minor, 0);
        dayBars.push({ label: dayLabel, amt_minor: amt, height_pct: 10 });
      }

      const maxDay = Math.max(...dayBars.map((d) => d.amt_minor), 0);
      bars = dayBars.map((d) => ({
        label: d.label,
        amt_minor: d.amt_minor,
        height_pct: maxDay > 0 ? Math.max(10, Math.round((d.amt_minor / maxDay) * 100)) : 10,
      }));

      subLabel = `Last 7 days (including Today) vs prior week`;
    } else {
      // Month: 1st of current month up to today
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      filteredPayments = allPayments.filter((p) => p.time >= monthStart && p.time <= todayEnd);

      // Previous month
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
      const prevMonthEnd = monthStart - 1;
      prevPayments = allPayments.filter((p) => p.time >= prevMonthStart && p.time <= prevMonthEnd);

      // 4-5 weekly buckets for current month up to today
      const weekBuckets: { label: string; amt_minor: number; height_pct: number }[] = [];
      const daysInMonthSoFar = now.getDate();
      const numWeeks = Math.max(1, Math.ceil(daysInMonthSoFar / 7));

      for (let w = 1; w <= Math.max(4, numWeeks); w++) {
        const wStart = monthStart + (w - 1) * 7 * 24 * 60 * 60 * 1000;
        const wEnd = Math.min(todayEnd, wStart + 7 * 24 * 60 * 60 * 1000 - 1);

        const wPayments = allPayments.filter((p) => p.time >= wStart && p.time <= wEnd);
        const amt = wPayments.reduce((acc, p) => acc + p.amount_minor, 0);
        weekBuckets.push({
          label: w === numWeeks ? `W${w} (Now)` : `W${w}`,
          amt_minor: amt,
          height_pct: 10,
        });
      }

      const maxWeek = Math.max(...weekBuckets.map((w) => w.amt_minor), 0);
      bars = weekBuckets.map((w) => ({
        label: w.label,
        amt_minor: w.amt_minor,
        height_pct: maxWeek > 0 ? Math.max(10, Math.round((w.amt_minor / maxWeek) * 100)) : 10,
      }));

      const monthName = now.toLocaleString('en-US', { month: 'long' });
      subLabel = `${monthName} (up to Today) vs last month`;
    }

    const totalMinor = filteredPayments.reduce((acc, p) => acc + p.amount_minor, 0);
    const prevMinor = prevPayments.reduce((acc, p) => acc + p.amount_minor, 0);
    const billsCount = new Set(filteredPayments.map((p) => p.bill.id)).size;
    const avgBillMinor = billsCount > 0 ? Math.round(totalMinor / billsCount) : 0;

    // Service popularity from bills of collected payments
    const serviceCounts: Record<string, number> = {};
    const countedBills = new Set<string>();
    for (const p of filteredPayments) {
      if (countedBills.has(p.bill.id)) continue;
      countedBills.add(p.bill.id);
      if (p.bill.items) {
        for (const it of p.bill.items) {
          const name = it.service_name_snapshot || 'Service';
          serviceCounts[name] = (serviceCounts[name] || 0) + (it.quantity || 1);
        }
      }
    }
    const sortedServices = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]);
    const topService =
      sortedServices.length > 0
        ? `${sortedServices[0][0]} · ${sortedServices[0][1]} sold`
        : 'No services yet';

    // Payment breakdown: UPI, Cash, Card calculated from genuine payments
    const paymentTotals: Record<string, number> = { UPI: 0, Cash: 0, Card: 0 };
    for (const p of filteredPayments) {
      const rawMode = (p.method || 'UPI').trim();
      let modeKey = 'UPI';
      if (/cash/i.test(rawMode)) modeKey = 'Cash';
      else if (/card/i.test(rawMode)) modeKey = 'Card';
      else if (/upi/i.test(rawMode)) modeKey = 'UPI';

      paymentTotals[modeKey] = (paymentTotals[modeKey] || 0) + p.amount_minor;
    }

    const modes = [
      {
        label: 'UPI',
        amt_minor: paymentTotals['UPI'] || 0,
        pct: totalMinor > 0 ? Math.round(((paymentTotals['UPI'] || 0) / totalMinor) * 100) : 0,
      },
      {
        label: 'Cash',
        amt_minor: paymentTotals['Cash'] || 0,
        pct: totalMinor > 0 ? Math.round(((paymentTotals['Cash'] || 0) / totalMinor) * 100) : 0,
      },
      {
        label: 'Card',
        amt_minor: paymentTotals['Card'] || 0,
        pct: totalMinor > 0 ? Math.round(((paymentTotals['Card'] || 0) / totalMinor) * 100) : 0,
      },
    ];

    return {
      total_minor: totalMinor,
      prev_minor: prevMinor,
      bills_count: billsCount,
      avg_bill_minor: avgBillMinor,
      top_service: topService,
      sub_label: subLabel,
      modes,
      bars,
    };
  }

  private async cacheBills(shopId: string, bills: Bill[]): Promise<void> {
    await AsyncStorage.setItem(`${STORAGE_KEY_BILLS}_${shopId}`, JSON.stringify(bills));
  }

  private async getCachedBills(shopId: string): Promise<Bill[] | null> {
    try {
      const data = await AsyncStorage.getItem(`${STORAGE_KEY_BILLS}_${shopId}`);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    return null;
  }
}

export const billingRepository = new BillingRepository();
