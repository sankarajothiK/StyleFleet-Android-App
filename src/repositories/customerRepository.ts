import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Customer } from '../types/domain';
import { generateUuid, isValidUuid } from '../utils/uuid';
import { assertSaved, friendlyDbMessage, isRemoteShop } from '../utils/persist';
import { fetchShopBillRows } from './shopBillRows';

const STORAGE_KEY_CUSTOMERS = '@salon_os_customers_cache';

export class CustomerRepository {
  /**
   * Fetch all real customers for a shop from Supabase (with offline fallback cache)
   */
  async getCustomers(shopId: string): Promise<Customer[]> {
    try {
      // Both reads only need the shop id, so they run together instead of one after the other
      const [{ data, error }, { data: billsData }] = await Promise.all([
        supabase
          .from('customers')
          .select('*')
          .eq('shop_id', shopId)
          .order('name', { ascending: true }),
        // Actual bill totals, to accurately aggregate visits, spend, and dues (shared with the bills list)
        fetchShopBillRows(shopId),
      ]);

      if (!error && data) {

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

      if (error || !data) {
        // Save first: a customer kept only on this phone would never reach the owner
        throw new Error(friendlyDbMessage(error, 'the customer'));
      }

      {
        newCust.id = data.id;
        newCust.created_at = data.created_at;

        // If there is an initial due, record it as a pending bill with bill items in Supabase
        if (initialDueMinor > 0) {
          const invNum = `DUE-${Date.now().toString().slice(-6)}`;
          const billResult = await supabase.from('bills').insert({
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
          const billData = billResult.data;

          let dueError: Error | null = null;
          if (billResult.error || !billData) {
            dueError = new Error(friendlyDbMessage(billResult.error, "the customer's opening due"));
          } else {
            const itemResult = await supabase.from('bill_items').insert({
              bill_id: billData.id,
              service_name_snapshot: 'Opening Due Balance',
              quantity: 1,
              unit_price_minor: initialDueMinor,
              discount_minor: 0,
              tax_minor: 0,
              line_total_minor: initialDueMinor,
            } as any);
            if (itemResult.error) {
              dueError = new Error(friendlyDbMessage(itemResult.error, "the customer's opening due"));
              await supabase.from('bills').delete().eq('id', billData.id);
            }
          }

          if (dueError) {
            // Undo the customer so a retry starts clean instead of hitting "already exists"
            await supabase.from('customers').delete().eq('id', data.id).eq('shop_id', shopId);
            throw dueError;
          }
        }
      }
    } catch (e: any) {
      if (e instanceof Error) throw e;
      throw new Error(friendlyDbMessage({ message: String(e?.message || e) }, 'the customer'));
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
    const dueByPhone = new Map(
      uniqueContacts.map((c) => [c.phone.replace(/\D/g, '').slice(-10), c.initialDueMinor || 0] as const)
    );
    let saveError: { code?: string; message?: string } | null = null;

    try {
      let { data, error } = await supabase
        .from('customers')
        .insert(rowsToInsert as any)
        .select();

      // One bad row fails the whole batch: save the rest one by one
      if (error || !data) {
        const saved: any[] = [];
        for (const row of rowsToInsert) {
          const one = await supabase.from('customers').insert(row as any).select().single();
          if (one.data) saved.push(one.data);
          else saveError = one.error ?? saveError;
        }
        data = saved;
        error = null;
      }

      if (!error && data) {
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const due = dueByPhone.get(String(row.phone || '').replace(/\D/g, '').slice(-10)) || 0;

          if (due > 0) {
            const invNum = `DUE-${(Date.now() + i).toString().slice(-6)}`;
            const billResult = await supabase.from('bills').insert({
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
            assertSaved(billResult, `the opening due for ${row.name}`);
            const bRow = billResult.data;

            if (bRow) {
              const itemResult = await supabase.from('bill_items').insert({
                bill_id: bRow.id,
                service_name_snapshot: 'Opening Due Balance',
                quantity: 1,
                unit_price_minor: due,
                discount_minor: 0,
                tax_minor: 0,
                line_total_minor: due,
              } as any);
              assertSaved(itemResult, `the opening due for ${row.name}`);
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
      }
    } catch (e) {
      console.warn('Batch import contacts error:', e);
      saveError = { message: e instanceof Error ? e.message : String(e) };
    }

    // Nothing saved: say so, never report "0 imported" as a success
    if (createdCustomers.length === 0 && saveError) {
      throw new Error(friendlyDbMessage(saveError, 'the contacts'));
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

    if (isRemoteShop(shopId)) {
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updatedCust.name;
      if (updates.phone !== undefined) payload.phone = updatedCust.phone;
      if (updates.notes !== undefined) payload.notes = updates.notes;
      if (updates.is_starred !== undefined) payload.is_starred = updates.is_starred;

      // Saved on the server first; a rejected save throws before anything changes on the phone
      if (Object.keys(payload).length > 0) {
        const saved = await supabase
          .from('customers')
          .update(payload)
          .eq('id', customerId)
          .eq('shop_id', shopId)
          .select('id');
        assertSaved(saved, 'the customer');
        if (!saved.data || saved.data.length === 0) {
          throw new Error('This customer was not found on the server, so the changes were not saved.');
        }
      }

      // Handle due balance update in database
      if (updates.dueMinor !== undefined) {
        const duesResult = await supabase
          .from('bills')
          .select('id, total_minor')
          .eq('shop_id', shopId)
          .eq('customer_id', customerId)
          .in('status', ['pending', 'partially_paid'])
          .order('created_at', { ascending: false });
        assertSaved(duesResult, "the customer's dues");
        const existingDues = duesResult.data;
        const dueLabel = "the customer's dues";

        if (updates.dueMinor === 0) {
          // If due set to 0, mark any pending bills as settled
          if (existingDues && existingDues.length > 0) {
            for (const b of existingDues) {
              assertSaved(await supabase.from('bills').update({ status: 'paid' }).eq('id', b.id), dueLabel);
            }
          }
        } else if (existingDues && existingDues.length > 0) {
          // Update the latest pending due bill to match the new due amount
          assertSaved(
            await supabase
              .from('bills')
              .update({
                total_minor: updates.dueMinor,
                subtotal_minor: updates.dueMinor,
                notes: `due:${updates.dueMinor};paid:0`,
              })
              .eq('id', existingDues[0].id),
            dueLabel
          );
          // Close any previous pending bills so their dues are not double-counted
          for (let i = 1; i < existingDues.length; i++) {
            assertSaved(await supabase.from('bills').update({ status: 'paid' }).eq('id', existingDues[i].id), dueLabel);
          }
        } else {
          // Create new pending bill for the due
          const invNum = `DUE-${Date.now().toString().slice(-6)}`;
          assertSaved(
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
            } as any),
            dueLabel
          );
        }
      }
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
      // Never report the old balance back as if the payment had been handled
      throw new Error("The customer's dues could not be loaded, so the payment was not recorded. Please check your connection and try again.");
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
      const createdResult = await supabase
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
      assertSaved(createdResult, 'the due payment');
      const createdBill = createdResult.data;

      if (createdBill) {
        assertSaved(
          await supabase.from('bill_items').insert({
            bill_id: createdBill.id,
            service_name_snapshot: 'Opening Due Balance',
            quantity: 1,
            unit_price_minor: currentCustDue,
            discount_minor: 0,
            tax_minor: 0,
            line_total_minor: currentCustDue,
          } as any),
          'the due payment'
        );

        pendingBills = [{ ...createdBill, payments: [] }];
      }
    }

    let remainingToAllocate = amountToSettle;
    let settleFailure: Error | null = null;

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

      // Insert new payment event with today's date!
      const paymentResult = await supabase.from('payments').insert({
        shop_id: shopId,
        bill_id: bill.id,
        amount_minor: payThisBill,
        method: resolvedMethod,
        status: 'completed',
        reference: `Due settlement payment (${resolvedMethod})`,
        paid_at: now,
      } as any);
      if (paymentResult.error) {
        settleFailure = new Error(friendlyDbMessage(paymentResult.error, 'the due payment'));
        break;
      }
      // The payment is on the server, so it counts as settled from here on
      remainingToAllocate -= payThisBill;

      const newBillTotalPaid = alreadyPaid + payThisBill;
      const newBillDue = Math.max(0, bill.total_minor - newBillTotalPaid);
      const newBillStatus = newBillDue === 0 ? 'paid' : 'partially_paid';

      const statusResult = await supabase
        .from('bills')
        .update({
          status: newBillStatus,
          updated_at: now,
          notes: `due:${newBillDue};paid:${newBillTotalPaid}`,
        } as any)
        .eq('id', bill.id);
      if (statusResult.error) {
        settleFailure = new Error(friendlyDbMessage(statusResult.error, 'the bill status'));
        break;
      }
    }

    // 3. Exact remaining customer due
    // Only what the server actually recorded counts as settled
    const settledAmount = amountToSettle - remainingToAllocate;
    const newCustomerDue = Math.max(0, currentCustDue - settledAmount);

    if (!settleFailure) {
      const customerResult = await supabase
        .from('customers')
        .update({ outstanding_due_minor: newCustomerDue })
        .eq('id', customerId);
      if (customerResult.error) {
        settleFailure = new Error(friendlyDbMessage(customerResult.error, "the customer's balance"));
      }
    }

    // 4. Update local cache
    if (cachedCust) {
      cachedCust.outstanding_due_minor = newCustomerDue;
      if (newCustomerDue === 0) {
        cachedCust.due_start_date = null;
      }
      await this.cacheCustomers(shopId, list);
    }

    if (settleFailure) {
      const rupees = (minor: number) => `\u20b9${Math.round(minor / 100).toLocaleString('en-IN')}`;
      throw new Error(
        settledAmount > 0
          ? `Only ${rupees(settledAmount)} of ${rupees(amountToSettle)} was recorded. ${settleFailure.message}`
          : settleFailure.message
      );
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

    if (isRemoteShop(shopId)) {
      const result = await supabase
        .from('customers')
        .update({ is_starred: nextState } as any)
        .eq('id', customerId)
        .eq('shop_id', shopId)
        .select('id');
      assertSaved(result, 'the VIP star');
      if (!result.data || result.data.length === 0) {
        throw new Error('This customer was not found on the server, so the change was not saved.');
      }
    }

    target.is_starred = nextState;
    await this.cacheCustomers(shopId, list);
    return nextState;
  }

  /**
   * Update customer notes
   */
  async updateNotes(shopId: string, customerId: string, notes: string): Promise<void> {
    if (isRemoteShop(shopId)) {
      const result = await supabase
        .from('customers')
        .update({ notes } as any)
        .eq('id', customerId)
        .eq('shop_id', shopId)
        .select('id');
      assertSaved(result, 'the notes');
      if (!result.data || result.data.length === 0) {
        throw new Error('This customer was not found on the server, so the notes were not saved.');
      }
    }

    const list = (await this.getCachedCustomers(shopId)) || [];
    const target = list.find((c) => c.id === customerId);
    if (target) {
      target.notes = notes;
      await this.cacheCustomers(shopId, list);
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
        const { error: notesError } = await supabase
          .from('customers')
          .update({ notes: updatedNotes } as any)
          .eq('id', customerId)
          .eq('shop_id', shopId);
        if (notesError) throw new Error(notesError.message);
      }
    } catch (e) {
      // Roll the local cache back so the app never shows a delete the backend didn't accept
      if (target) {
        target.is_active = inactive;
        await this.cacheCustomers(shopId, list);
      }
      throw e instanceof Error ? e : new Error('Could not update customer');
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

  async getCachedCustomers(shopId: string): Promise<Customer[] | null> {
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
