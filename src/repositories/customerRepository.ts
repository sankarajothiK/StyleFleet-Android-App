import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Customer } from '../types/domain';
import { generateUuid, isValidUuid } from '../utils/uuid';

const STORAGE_KEY_CUSTOMERS = '@salon_os_customers_cache';

export class CustomerRepository {
  /**
   * Fetch all real customers for a shop from Supabase (with offline fallback cache)
   */
  async getCustomers(shopId: string): Promise<Customer[]> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .order('name', { ascending: true });

      if (!error && data) {
        // Fetch actual bill totals to accurately aggregate visits, spend, and dues
        const { data: billsData } = await supabase
          .from('bills')
          .select('id, invoice_number, customer_id, total_minor, paid_amount_minor, due_amount_minor, status, created_at, issued_at, notes, payments(*)')
          .eq('shop_id', shopId);

        let mergedBills = (billsData || []).slice();
        try {
          const rawCached = await AsyncStorage.getItem(`@salon_os_bills_cache_${shopId}`);
          if (rawCached) {
            const parsed = JSON.parse(rawCached);
            const seen = new Set(mergedBills.map((b: any) => b.id || b.invoice_number));
            for (const pb of parsed) {
              const key = pb.id || pb.invoice_number;
              if (key && !seen.has(key)) {
                mergedBills.push(pb);
                seen.add(key);
              }
            }
          }
        } catch {}

        const billsByCustomer: Record<
          string,
          {
            visits: number;
            spend: number;
            dues: number;
            lastDate: string | null;
            dueStartDate: string | null;
          }
        > = {};

        if (mergedBills && mergedBills.length > 0) {
          for (const b of mergedBills) {
            if (!b.customer_id) continue;
            if (b.status === 'deleted') continue;
            if (!billsByCustomer[b.customer_id]) {
              billsByCustomer[b.customer_id] = {
                visits: 0,
                spend: 0,
                dues: 0,
                lastDate: null,
                dueStartDate: null,
              };
            }
            const agg = billsByCustomer[b.customer_id];
            const billDate = b.created_at || (b.issued_at && !b.issued_at.includes(':') ? b.issued_at : null);
            const validDate = billDate ? new Date(billDate) : null;
            const isValidTime = validDate && !isNaN(validDate.getTime());

            let notePaid: number | null = null;
            let noteDue: number | null = null;
            if (b.notes) {
              const mPaid = b.notes.match(/paid:(\d+)/);
              if (mPaid) notePaid = parseInt(mPaid[1], 10);
              const mDue = b.notes.match(/due:(\d+)/);
              if (mDue) noteDue = parseInt(mDue[1], 10);
            }
            const pmts = (b.payments as any[]) || [];
            const sumPmts = pmts.reduce((acc: number, p: any) => acc + (p.amount_minor || 0), 0);

            let billPaid = 0;
            let billDue = 0;
            if (sumPmts > 0) {
              billPaid = sumPmts;
              billDue = noteDue !== null ? noteDue : Math.max(0, (b.total_minor || 0) - billPaid);
            } else if (notePaid !== null || noteDue !== null) {
              billPaid = notePaid !== null ? notePaid : (noteDue !== null ? Math.max(0, (b.total_minor || 0) - noteDue) : 0);
              billDue = noteDue !== null ? noteDue : Math.max(0, (b.total_minor || 0) - billPaid);
            } else if (typeof b.due_amount_minor === 'number' || typeof b.paid_amount_minor === 'number') {
              billDue = typeof b.due_amount_minor === 'number' ? b.due_amount_minor : 0;
              billPaid = typeof b.paid_amount_minor === 'number' ? b.paid_amount_minor : Math.max(0, (b.total_minor || 0) - billDue);
            } else if (b.status === 'paid') {
              billPaid = b.total_minor || 0;
              billDue = 0;
            } else if (b.status === 'pending') {
              billPaid = 0;
              billDue = b.total_minor || 0;
            } else {
              billPaid = 0;
              billDue = b.total_minor || 0;
            }

            billPaid = Math.max(0, Math.min(b.total_minor || 0, billPaid));
            billDue = Math.max(0, billDue);
            if (b.status === 'paid') {
              billPaid = b.total_minor || 0;
              billDue = 0;
            } else if (b.status === 'pending') {
              billPaid = 0;
              billDue = b.total_minor || 0;
            }

            if (b.status === 'paid' || (billDue === 0 && billPaid > 0)) {
              agg.visits += 1;
              agg.spend += billPaid || b.total_minor || 0;
              if (isValidTime && (!agg.lastDate || validDate.getTime() > new Date(agg.lastDate).getTime())) {
                agg.lastDate = billDate;
              }
            } else if (billDue > 0 && billPaid > 0) {
              agg.visits += 1;
              agg.spend += billPaid;
              agg.dues += billDue;
              if (isValidTime && (!agg.dueStartDate || validDate.getTime() < new Date(agg.dueStartDate).getTime())) {
                agg.dueStartDate = billDate;
              }
              if (isValidTime && (!agg.lastDate || validDate.getTime() > new Date(agg.lastDate).getTime())) {
                agg.lastDate = billDate;
              }
            } else {
              agg.dues += billDue;
              if (isValidTime && (!agg.dueStartDate || validDate.getTime() < new Date(agg.dueStartDate).getTime())) {
                agg.dueStartDate = billDate;
              }
            }
          }
        }

        const mapped: Customer[] = data.map((c) => {
          const stats = billsByCustomer[c.id] || {
            visits: 0,
            spend: 0,
            dues: 0,
            lastDate: null,
            dueStartDate: null,
          };

          let formattedLastVisit: string | null = null;
          if (stats.lastDate) {
            const d = new Date(stats.lastDate);
            if (!isNaN(d.getTime())) {
              formattedLastVisit = `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
            }
          }

          let formattedDueStart: string | null = null;
          if (stats.dueStartDate) {
            const d = new Date(stats.dueStartDate);
            if (!isNaN(d.getTime())) {
              formattedDueStart = `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
            }
          }

          return {
            id: c.id,
            shop_id: c.shop_id,
            name: c.name,
            phone: c.phone,
            notes: c.notes,
            preferred_staff_id: c.preferred_staff_id,
            preferred_stylist_name: undefined,
            is_starred: !!c.is_starred,
            visits_count: stats.visits,
            lifetime_spend_minor: stats.spend,
            outstanding_due_minor: stats.dues,
            last_visit_date: formattedLastVisit,
            due_start_date: formattedDueStart,
            created_at: c.created_at,
            is_active: c.is_active !== false && !(c.notes || '').includes('[inactive]'),
          };
        });

        // Deduplicate customers by normalized 10-digit phone number
        const uniqueByPhone = new Map<string, Customer>();
        for (const cust of mapped) {
          const cleanPhone = cust.phone ? cust.phone.replace(/\D/g, '').slice(-10) : '';
          const key = cleanPhone.length === 10 ? cleanPhone : cust.id;
          if (!uniqueByPhone.has(key)) {
            uniqueByPhone.set(key, { ...cust, phone: cleanPhone.length === 10 ? cleanPhone : cust.phone });
          } else {
            const existing = uniqueByPhone.get(key)!;
            existing.visits_count = Math.max(existing.visits_count || 0, cust.visits_count || 0);
            existing.lifetime_spend_minor = Math.max(existing.lifetime_spend_minor || 0, cust.lifetime_spend_minor || 0);
            existing.outstanding_due_minor = Math.max(existing.outstanding_due_minor || 0, cust.outstanding_due_minor || 0);
            if (cust.is_starred) existing.is_starred = true;
            if (cust.notes && !existing.notes) existing.notes = cust.notes;
            if (!existing.last_visit_date && cust.last_visit_date) existing.last_visit_date = cust.last_visit_date;
            if (!existing.due_start_date && cust.due_start_date) existing.due_start_date = cust.due_start_date;
          }
        }
        const deduplicated = Array.from(uniqueByPhone.values());

        await this.cacheCustomers(shopId, deduplicated);
        return deduplicated;
      }
    } catch (e) {
      console.warn('CustomerRepository: Offline fallback active');
    }

    // Return cached real customers, or empty array if none exist
    const cached = await this.getCachedCustomers(shopId);
    if (!cached) return [];

    let cachedBills: any[] = [];
    try {
      const rawB = await AsyncStorage.getItem(`@salon_os_bills_cache_${shopId}`);
      if (rawB) cachedBills = JSON.parse(rawB);
    } catch {}

    const billsByCust: Record<string, { visits: number; spend: number; dues: number }> = {};
    for (const b of cachedBills) {
      if (!b.customer_id || b.status === 'deleted') continue;
      if (!billsByCust[b.customer_id]) {
        billsByCust[b.customer_id] = { visits: 0, spend: 0, dues: 0 };
      }
      const agg = billsByCust[b.customer_id];
      if (b.status === 'paid') {
        agg.visits += 1;
        agg.spend += b.total_minor || 0;
      } else if (b.status === 'partially_paid') {
        agg.visits += 1;
        const paid = typeof b.paid_amount_minor === 'number' ? b.paid_amount_minor : (b.total_minor || 0);
        const due = typeof b.due_amount_minor === 'number' ? b.due_amount_minor : Math.max(0, (b.total_minor || 0) - paid);
        agg.spend += paid;
        agg.dues += due;
      } else if (b.status === 'pending') {
        agg.dues += b.total_minor || 0;
      }
    }

    const map = new Map<string, Customer>();
    for (const c of cached) {
      const cleanPhone = c.phone ? c.phone.replace(/\D/g, '').slice(-10) : '';
      const key = cleanPhone.length === 10 ? cleanPhone : c.id;
      if (!map.has(key)) {
        const stats = billsByCust[c.id];
        const lastVisitClean = (c.last_visit_date && !c.last_visit_date.includes('Invalid') && !c.last_visit_date.includes('NaN')) ? c.last_visit_date : null;
        const dueStartClean = (c.due_start_date && !c.due_start_date.includes('Invalid') && !c.due_start_date.includes('NaN')) ? c.due_start_date : null;
        map.set(key, {
          ...c,
          last_visit_date: lastVisitClean,
          due_start_date: dueStartClean,
          visits_count: stats ? stats.visits : c.visits_count,
          lifetime_spend_minor: stats ? stats.spend : c.lifetime_spend_minor,
          outstanding_due_minor: stats ? stats.dues : c.outstanding_due_minor,
        });
      }
    }
    return Array.from(map.values());
  }

  /**
   * Add a real customer and persist directly to Supabase
   */
  async addCustomer(
    shopId: string,
    name: string,
    phone: string,
    initialDueMinor = 0,
    isStarred = false,
    notes?: string
  ): Promise<Customer> {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    // 1. Prevent duplicate customer with same phone number
    const current = (await this.getCachedCustomers(shopId)) || [];
    const existing = current.find((c) => c.phone && c.phone.replace(/\D/g, '').slice(-10) === cleanPhone);
    if (existing) {
      throw new Error(`Customer with mobile +91 ${cleanPhone} already exists (${existing.name})`);
    }

    // 2. Also check Supabase before adding
    try {
      const { data: exactMatch } = await supabase
        .from('customers')
        .select('id, name')
        .eq('shop_id', shopId)
        .eq('phone', cleanPhone);

      if (exactMatch && exactMatch.length > 0) {
        throw new Error(`Customer with mobile +91 ${cleanPhone} already exists (${exactMatch[0].name})`);
      }

      // Fast indexed lookup for any formatted numbers containing the 10 digits
      const { data: phoneMatches } = await supabase
        .from('customers')
        .select('id, name, phone')
        .eq('shop_id', shopId)
        .ilike('phone', `%${cleanPhone}%`)
        .limit(5);

      if (phoneMatches && phoneMatches.length > 0) {
        const found = phoneMatches.find(
          (c: any) => (c.phone || '').replace(/\D/g, '').slice(-10) === cleanPhone
        );
        if (found) {
          throw new Error(`Customer with mobile +91 ${cleanPhone} already exists (${found.name})`);
        }
      }
    } catch (checkErr: any) {
      if (checkErr?.message?.includes('already exists')) {
        throw checkErr;
      }
    }

    const generatedCustId = generateUuid();
    const newCust: Customer = {
      id: generatedCustId,
      shop_id: shopId,
      name: name.trim(),
      phone: cleanPhone,
      notes: notes || null,
      preferred_staff_id: null,
      is_starred: isStarred,
      visits_count: 0,
      lifetime_spend_minor: 0,
      outstanding_due_minor: initialDueMinor,
      last_visit_date: null,
      created_at: new Date().toISOString(),
      is_active: true,
    };

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          id: generatedCustId,
          shop_id: shopId,
          name: name.trim(),
          phone: cleanPhone,
          notes: notes || null,
          is_starred: isStarred,
          is_active: true,
        } as any)
        .select()
        .single();

      if (!error && data) {
        newCust.id = data.id;
        newCust.created_at = data.created_at;

        // If there is an initial due, record it as a pending bill with bill items in Supabase
        if (initialDueMinor > 0) {
          const invNum = `DUE-${Date.now().toString().slice(-6)}`;
          const { data: billData } = await supabase.from('bills').insert({
            shop_id: shopId,
            customer_id: data.id,
            total_minor: initialDueMinor,
            subtotal_minor: initialDueMinor,
            discount_minor: 0,
            tax_minor: 0,
            status: 'pending',
            invoice_number: invNum,
            notes: 'Initial opening balance due',
          } as any).select().single();

          if (billData) {
            await supabase.from('bill_items').insert({
              bill_id: billData.id,
              service_name_snapshot: 'Opening Due Balance',
              quantity: 1,
              unit_price_minor: initialDueMinor,
              discount_minor: 0,
              tax_minor: 0,
              line_total_minor: initialDueMinor,
            } as any);
          }
        }
      } else if (error) {
        console.error('Supabase customer insert error:', error);
      }
    } catch (e: any) {
      if (e?.message && e.message.includes('already exists')) {
        throw e;
      }
      console.warn('Supabase customer add error:', e);
    }

    const updated = [newCust, ...current.filter((c) => (c.phone || '').replace(/\D/g, '').slice(-10) !== cleanPhone)];
    await this.cacheCustomers(shopId, updated);
    return newCust;
  }

  /**
   * Import multiple contacts from phone directly into Supabase
   */
  async importContacts(
    shopId: string,
    contacts: { name: string; phone: string; initialDueMinor?: number }[]
  ): Promise<Customer[]> {
    if (contacts.length === 0) return [];

    const current = (await this.getCustomers(shopId)) || [];
    const existingPhones = new Set(current.map((c) => c.phone.replace(/\D/g, '').slice(-10)));

    // Filter out contacts that already exist on file
    const uniqueContacts = contacts.filter((c) => {
      const clean = c.phone.replace(/\D/g, '').slice(-10);
      if (!clean || clean.length < 10) return false;
      if (existingPhones.has(clean)) return false;
      existingPhones.add(clean);
      return true;
    });

    if (uniqueContacts.length === 0) return [];

    const rowsToInsert = uniqueContacts.map((c) => ({
      id: generateUuid(),
      shop_id: shopId,
      name: c.name.trim(),
      phone: c.phone.replace(/\D/g, '').slice(-10),
      is_starred: false,
    }));

    const createdCustomers: Customer[] = [];

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert(rowsToInsert as any)
        .select();

      if (!error && data) {
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const due = contacts[i]?.initialDueMinor || 0;

          if (due > 0) {
            const invNum = `DUE-${(Date.now() + i).toString().slice(-6)}`;
            const { data: bRow } = await supabase.from('bills').insert({
              shop_id: shopId,
              customer_id: row.id,
              total_minor: due,
              subtotal_minor: due,
              discount_minor: 0,
              tax_minor: 0,
              status: 'pending',
              invoice_number: invNum,
              notes: 'Imported opening balance due',
            } as any).select().single();

            if (bRow) {
              await supabase.from('bill_items').insert({
                bill_id: bRow.id,
                service_name_snapshot: 'Opening Due Balance',
                quantity: 1,
                unit_price_minor: due,
                discount_minor: 0,
                tax_minor: 0,
                line_total_minor: due,
              } as any);
            }
          }

          createdCustomers.push({
            id: row.id,
            shop_id: row.shop_id,
            name: row.name,
            phone: row.phone,
            notes: row.notes,
            preferred_staff_id: null,
            is_starred: false,
            visits_count: 0,
            lifetime_spend_minor: 0,
            outstanding_due_minor: due,
            last_visit_date: null,
            created_at: row.created_at,
          });
        }
      } else if (error) {
        console.error('Supabase contacts batch import error:', error);
      }
    } catch (e) {
      console.warn('Batch import contacts error:', e);
    }

    const freshCurrent = (await this.getCachedCustomers(shopId)) || [];
    const newPhoneSet = new Set(createdCustomers.map((c) => (c.phone || '').replace(/\D/g, '').slice(-10)));
    const updated = [
      ...createdCustomers,
      ...freshCurrent.filter((c) => !newPhoneSet.has((c.phone || '').replace(/\D/g, '').slice(-10))),
    ];
    await this.cacheCustomers(shopId, updated);
    return createdCustomers;
  }

  /**
   * Update an existing customer's profile in Supabase
   */
  async updateCustomer(
    shopId: string,
    customerId: string,
    updates: { name?: string; phone?: string; notes?: string; is_starred?: boolean; dueMinor?: number }
  ): Promise<Customer | null> {
    const list = (await this.getCachedCustomers(shopId)) || [];
    const targetIdx = list.findIndex((c) => c.id === customerId);
    if (targetIdx === -1) return null;

    const updatedCust = { ...list[targetIdx], ...updates };
    if (updates.name) {
      updatedCust.name = updates.name.trim();
    }
    if (updates.phone) {
      updatedCust.phone = updates.phone.replace(/\D/g, '').slice(-10);
    }
    if (updates.dueMinor !== undefined) {
      updatedCust.outstanding_due_minor = updates.dueMinor;
    }
    list[targetIdx] = updatedCust;

    try {
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updatedCust.name;
      if (updates.phone !== undefined) payload.phone = updatedCust.phone;
      if (updates.notes !== undefined) payload.notes = updates.notes;
      if (updates.is_starred !== undefined) payload.is_starred = updates.is_starred;

      await supabase
        .from('customers')
        .update(payload)
        .eq('id', customerId);

      // Handle due balance update in database
      if (updates.dueMinor !== undefined) {
        const { data: existingDues } = await supabase
          .from('bills')
          .select('id, total_minor')
          .eq('shop_id', shopId)
          .eq('customer_id', customerId)
          .in('status', ['pending', 'partially_paid'])
          .order('created_at', { ascending: false });

        if (updates.dueMinor === 0) {
          // If due set to 0, mark any pending bills as settled
          if (existingDues && existingDues.length > 0) {
            for (const b of existingDues) {
              await supabase.from('bills').update({ status: 'paid' }).eq('id', b.id);
            }
          }
        } else if (existingDues && existingDues.length > 0) {
          // Update the latest pending due bill to match the new due amount
          await supabase
            .from('bills')
            .update({
              total_minor: updates.dueMinor,
              subtotal_minor: updates.dueMinor,
              notes: `due:${updates.dueMinor};paid:0`,
            })
            .eq('id', existingDues[0].id);
          // Close any previous pending bills so their dues are not double-counted
          for (let i = 1; i < existingDues.length; i++) {
            await supabase.from('bills').update({ status: 'paid' }).eq('id', existingDues[i].id);
          }
        } else {
          // Create new pending bill for the due
          const invNum = `DUE-${Date.now().toString().slice(-6)}`;
          await supabase.from('bills').insert({
            shop_id: shopId,
            customer_id: customerId,
            total_minor: updates.dueMinor,
            subtotal_minor: updates.dueMinor,
            discount_minor: 0,
            tax_minor: 0,
            status: 'pending',
            invoice_number: invNum,
            notes: 'Adjusted customer due balance',
          } as any);
        }
      }
    } catch (e) {
      console.warn('Supabase customer update error:', e);
    }

    await this.cacheCustomers(shopId, list);
    return updatedCust;
  }

  /**
   * Settle outstanding dues for a customer (full or partial)
   * Creates a dedicated payment event without duplicating the bill or changing original dates.
   */
  async settleDues(
    shopId: string,
    customerId: string,
    method: 'cash' | 'upi' = 'cash',
    amountToSettleMinor?: number
  ): Promise<number> {
    const list = (await this.getCachedCustomers(shopId)) || [];
    const cachedCust = list.find((c) => c.id === customerId);

    // 1. Fetch pending/partially_paid bills for this customer from Supabase
    let pendingBills: any[] = [];
    let pendingBillsError: unknown = null;
    try {
      const { data, error } = await supabase
        .from('bills')
        .select('*, bill_items(*), payments(*)')
        .eq('shop_id', shopId)
        .eq('customer_id', customerId)
        .in('status', ['pending', 'partially_paid'])
        .order('created_at', { ascending: true });

      if (error) {
        pendingBillsError = error;
      } else {
        pendingBills = data ?? [];
      }
    } catch (e) {
      pendingBillsError = e;
      console.warn('Error fetching pending bills:', e);
    }

    if (pendingBillsError) {
      return Math.max(0, cachedCust?.outstanding_due_minor || 0);
    }

    // Calculate current outstanding due across existing bills
    let billsDueTotal = 0;
    for (const b of pendingBills) {
      const pmts = (b.payments as any[]) || [];
      let paid = pmts.reduce((sum: number, p: any) => sum + (p.amount_minor || 0), 0);
      if (paid === 0 && b.notes && b.notes.includes('paid:')) {
        const m = b.notes.match(/paid:(\d+)/);
        if (m) paid = parseInt(m[1], 10);
      }
      billsDueTotal += Math.max(0, b.total_minor - paid);
    }

    // Determine baseline current due from live pending-bill totals.
    const currentCustDue = billsDueTotal;

    // Determine amount to settle right now
    const amountToSettle =
      typeof amountToSettleMinor === 'number' && amountToSettleMinor > 0
        ? Math.min(amountToSettleMinor, currentCustDue)
        : currentCustDue;

    if (amountToSettle <= 0) {
      return currentCustDue;
    }

    const now = new Date().toISOString();
    const resolvedMethod = method === 'upi' ? 'UPI' : 'Cash';

    // If there are NO pending bills in Supabase for this customer, create one now
    if (!pendingBillsError && pendingBills.length === 0 && currentCustDue > 0) {
      const invNum = `DUE-${Date.now().toString().slice(-6)}`;
      try {
        const { data: createdBill } = await supabase
          .from('bills')
          .insert({
            shop_id: shopId,
            customer_id: customerId,
            total_minor: currentCustDue,
            subtotal_minor: currentCustDue,
            discount_minor: 0,
            tax_minor: 0,
            status: 'pending',
            invoice_number: invNum,
            notes: 'Customer opening due balance',
          } as any)
          .select()
          .single();

        if (createdBill) {
          await supabase.from('bill_items').insert({
            bill_id: createdBill.id,
            service_name_snapshot: 'Opening Due Balance',
            quantity: 1,
            unit_price_minor: currentCustDue,
            discount_minor: 0,
            tax_minor: 0,
            line_total_minor: currentCustDue,
          } as any);

          pendingBills = [{ ...createdBill, payments: [] }];
        }
      } catch (e) {
        console.warn('Error creating opening balance bill for settlement:', e);
      }
    }

    let remainingToAllocate = amountToSettle;

    // 2. Allocate payment across pending bills (FIFO)
    for (const bill of pendingBills) {
      if (remainingToAllocate <= 0) break;

      const pmts = (bill.payments as any[]) || [];
      let alreadyPaid = pmts.reduce((sum: number, p: any) => sum + (p.amount_minor || 0), 0);
      if (alreadyPaid === 0 && bill.notes && bill.notes.includes('paid:')) {
        const m = bill.notes.match(/paid:(\d+)/);
        if (m) alreadyPaid = parseInt(m[1], 10);
      }

      const billDue = Math.max(0, bill.total_minor - alreadyPaid);
      if (billDue <= 0) continue;

      const payThisBill = Math.min(remainingToAllocate, billDue);
      remainingToAllocate -= payThisBill;

      try {
        // Insert new payment event with today's date!
        const { error: paymentInsertError } = await supabase.from('payments').insert({
          shop_id: shopId,
          bill_id: bill.id,
          amount_minor: payThisBill,
          method: resolvedMethod,
          status: 'completed',
          reference: `Due settlement payment (${resolvedMethod})`,
          paid_at: now,
        } as any);

        if (paymentInsertError) {
          throw paymentInsertError;
        }

        const newBillTotalPaid = alreadyPaid + payThisBill;
        const newBillDue = Math.max(0, bill.total_minor - newBillTotalPaid);
        const newBillStatus = newBillDue === 0 ? 'paid' : 'partially_paid';

        await supabase
          .from('bills')
          .update({
            status: newBillStatus,
            updated_at: now,
            notes: `due:${newBillDue};paid:${newBillTotalPaid}`,
          } as any)
          .eq('id', bill.id);
      } catch (e) {
        console.warn('Error recording bill settlement payment:', e);
      }
    }

    // 3. Exact remaining customer due
    const newCustomerDue = Math.max(0, currentCustDue - amountToSettle);

    try {
      await supabase
        .from('customers')
        .update({ outstanding_due_minor: newCustomerDue })
        .eq('id', customerId);
    } catch {}

    // 4. Update local cache
    if (cachedCust) {
      cachedCust.outstanding_due_minor = newCustomerDue;
      if (newCustomerDue === 0) {
        cachedCust.due_start_date = null;
      }
      await this.cacheCustomers(shopId, list);
    }

    // 5. Also update bills cache so bill status and dues remain in perfect sync
    try {
      const rawB = await AsyncStorage.getItem(`@salon_os_bills_cache_${shopId}`);
      if (rawB) {
        const cachedBills: any[] = JSON.parse(rawB);
        const settledMap = new Map(pendingBills.map((b) => [b.id, b]));
        const updatedBills = cachedBills.map((cb) => {
          if (settledMap.has(cb.id)) {
            const pb = settledMap.get(cb.id)!;
            const pmts = (pb.payments as any[]) || [];
            let totalPaid = pmts.reduce((sum: number, p: any) => sum + (p.amount_minor || 0), 0);
            if (cb.notes?.includes('paid:')) {
              const m = cb.notes.match(/paid:(\d+)/);
              if (m && parseInt(m[1], 10) > totalPaid) totalPaid = parseInt(m[1], 10);
            }
            const remDue = Math.max(0, (pb.total_minor || cb.total_minor) - totalPaid);
            return {
              ...cb,
              status: remDue === 0 ? 'paid' : 'partially_paid',
              paid_amount_minor: totalPaid,
              due_amount_minor: remDue,
              notes: `due:${remDue};paid:${totalPaid}`,
            };
          }
          return cb;
        });
        await AsyncStorage.setItem(`@salon_os_bills_cache_${shopId}`, JSON.stringify(updatedBills));
      }
    } catch {}

    return newCustomerDue;
  }

  /**
   * Fetch detailed due and payment records for a customer directly from Supabase
   */
  async getCustomerDueHistory(shopId: string, customerId: string) {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select(`
          id,
          invoice_number,
          total_minor,
          status,
          notes,
          issued_at,
          created_at,
          updated_at,
          payments (
            id,
            amount_minor,
            method,
            reference,
            paid_at,
            status
          )
        `)
        .eq('shop_id', shopId)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data;
      }
    } catch (e) {
      console.warn('Error fetching customer due history:', e);
    }
    return [];
  }

  /**
   * Toggle starred status for VIP customer
   */
  async toggleStar(shopId: string, customerId: string): Promise<boolean> {
    const list = (await this.getCachedCustomers(shopId)) || [];
    const target = list.find((c) => c.id === customerId);
    if (!target) return false;

    const nextState = !target.is_starred;
    target.is_starred = nextState;

    try {
      await supabase
        .from('customers')
        .update({ is_starred: nextState } as any)
        .eq('id', customerId);
    } catch (e) {
      console.warn('Supabase star toggle error:', e);
    }

    await this.cacheCustomers(shopId, list);
    return nextState;
  }

  /**
   * Update customer notes
   */
  async updateNotes(shopId: string, customerId: string, notes: string): Promise<void> {
    const list = (await this.getCachedCustomers(shopId)) || [];
    const target = list.find((c) => c.id === customerId);
    if (target) {
      target.notes = notes;
      await this.cacheCustomers(shopId, list);
    }

    try {
      await supabase
        .from('customers')
        .update({ notes } as any)
        .eq('id', customerId);
    } catch {
      // ignore
    }
  }

  /**
   * Set customer inactive (soft inactive state preserving 100% historical records)
   * Historical bills, appointments, dues, and reports remain completely intact.
   */
  async setCustomerInactive(shopId: string, customerId: string, inactive: boolean = true): Promise<boolean> {
    const list = (await this.getCachedCustomers(shopId)) || [];
    const target = list.find((c) => c.id === customerId);
    if (target) {
      target.is_active = !inactive;
      await this.cacheCustomers(shopId, list);
    }

    try {
      const { error } = await supabase
        .from('customers')
        .update({ is_active: !inactive } as any)
        .eq('id', customerId)
        .eq('shop_id', shopId);

      if (error) {
        // If is_active column is pending, fallback to encoding [inactive] in notes
        const currentNotes = target?.notes || '';
        const updatedNotes = inactive
          ? (currentNotes.includes('[inactive]') ? currentNotes : `[inactive] ${currentNotes}`.trim())
          : currentNotes.replace('[inactive]', '').trim();
        await supabase
          .from('customers')
          .update({ notes: updatedNotes } as any)
          .eq('id', customerId)
          .eq('shop_id', shopId);
      }
    } catch (e) {
      console.warn('Customer inactive update fallback:', e);
    }

    return true;
  }

  /**
   * Alias for backwards compatibility - sets customer to inactive without destroying records
   */
  async deleteCustomer(shopId: string, customerId: string): Promise<boolean> {
    return this.setCustomerInactive(shopId, customerId, true);
  }

  private async cacheCustomers(shopId: string, customers: Customer[]): Promise<void> {
    await AsyncStorage.setItem(`${STORAGE_KEY_CUSTOMERS}_${shopId}`, JSON.stringify(customers));
  }

  private async getCachedCustomers(shopId: string): Promise<Customer[] | null> {
    try {
      const data = await AsyncStorage.getItem(`${STORAGE_KEY_CUSTOMERS}_${shopId}`);
      if (data) {
        const parsed: Customer[] = JSON.parse(data);
        let mutated = false;
        const normalized = parsed.map((c) => {
          if (c.id && !isValidUuid(c.id)) {
            mutated = true;
            return { ...c, id: generateUuid() };
          }
          return c;
        });
        if (mutated) {
          await this.cacheCustomers(shopId, normalized);
        }
        return normalized;
      }
    } catch {
      // ignore
    }
    return null;
  }
}

export const customerRepository = new CustomerRepository();
