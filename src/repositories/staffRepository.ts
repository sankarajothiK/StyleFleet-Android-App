import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { assertSaved, isRemoteShop } from '../utils/persist';
import { isValidUuid } from '../utils/uuid';
import { authRepository } from './authRepository';

export const INVITE_SHOP_KEY = '@salon_os_invite_shop_id';

const isPermissionDenied = (error: { code?: string; message?: string } | null): boolean =>
  !!error && (error.code === '42501' || /row-level security/i.test(error.message || ''));
import { StaffMember, StylistPermissions, DEFAULT_STYLIST_PERMISSIONS } from '../types/domain';

const STORAGE_KEY_STAFF = '@salon_os_staff_cache';
const DEFAULT_STYLIST_LIMIT = 3;

export class StaffRepository {
  /**
   * Fetch real staff members for a shop from Supabase
   */
  async getStaff(shopId: string): Promise<StaffMember[]> {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('shop_id', shopId)
        .order('name', { ascending: true });

      if (!error && data) {

        const mapped: StaffMember[] = data.map((s) => {
          return {
            id: s.id,
            shop_id: s.shop_id,
            name: s.name,
            role: s.role || 'Barber',
            phone: s.phone,
            is_active: s.is_active,
            permissions: s.permissions || DEFAULT_STYLIST_PERMISSIONS,
            invitation_status: s.invitation_status || 'not_invited',
            invited_at: s.invited_at || null,
            target_amount_minor: 500000,
            revenue_minor: 0, // per-period figures come from the bills on the Staff screen
            service_count: 0,
            rebook_rate: '', // worked out from bills where it is shown, never invented
            rating: s.rating != null ? String(s.rating) : '5.0',
            chair_utilization: '',
          };
        });

        await this.cacheStaff(shopId, mapped);
        return mapped;
      }
    } catch {
      console.warn('StaffRepository: Offline fallback active');
    }

    const cached = await this.getCachedStaff(shopId);
    return cached || [];
  }

  /**
   * Max active stylists for a shop (owner does not count). Defaults to 3;
   * support raises it via shops.max_stylists.
   */
  async getStylistLimit(shopId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('max_stylists')
        .eq('id', shopId)
        .maybeSingle();
      const value = (data as { max_stylists?: number } | null)?.max_stylists;
      if (!error && typeof value === 'number' && value >= 0) return value;
    } catch {
      // fall through to default
    }
    return DEFAULT_STYLIST_LIMIT;
  }

  /**
   * Add a real staff member and persist to Supabase
   * Enforces the per-shop stylist limit (owner does not count).
   */
  async addStaff(
    shopId: string,
    name: string,
    role = 'Stylist',
    phone?: string,
    commissionPct = 10
  ): Promise<StaffMember> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('NAME_REQUIRED: Stylist name is required.');
    }

    const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      throw new Error('PHONE_REQUIRED: Valid 10-digit mobile number is required.');
    }

    // Client-side pre-check; the database trigger is the real enforcement.
    const [currentList, limit] = await Promise.all([this.getStaff(shopId), this.getStylistLimit(shopId)]);
    const activeStaff = currentList.filter((s) => s.is_active);
    if (activeStaff.length >= limit) {
      throw new Error(`STYLIST_LIMIT_REACHED: Maximum ${limit} stylists allowed per account.`);
    }

    const newStaff: StaffMember = {
      id: `staff_${Date.now()}`,
      shop_id: shopId,
      name: trimmedName,
      role: role || 'Stylist',
      phone: cleanPhone,
      is_active: true,
      permissions: DEFAULT_STYLIST_PERMISSIONS,
      invitation_status: 'not_invited',
      invited_at: null,
      target_amount_minor: 500000,
      revenue_minor: 0,
      service_count: 0,
      rebook_rate: '0%',
      rating: '5.0',
      chair_utilization: '0%',
    };

    const insertRow = () =>
      supabase
        .from('staff')
        .insert({
          shop_id: shopId,
          name: trimmedName,
          role: role || 'Stylist',
          phone: cleanPhone,
          is_active: true,
          permissions: DEFAULT_STYLIST_PERMISSIONS,
        } as any)
        .select()
        .single();

    let { data, error } = await insertRow();

    // Refused for lack of a signed-in owner: reconnect once and try again
    if (error && isPermissionDenied(error)) {
      if (await authRepository.ensureSupabaseSession()) {
        ({ data, error } = await insertRow());
      }
      if (error && isPermissionDenied(error)) {
        throw new Error(
          'Your login has expired, so the stylist could not be saved. Please log out, log in again with your OTP, and try again.'
        );
      }
    }

    if (error || !data) {
      if ((error?.message || '').includes('STYLIST_LIMIT_REACHED')) {
        throw new Error('STYLIST_LIMIT_REACHED: Stylist limit reached. Contact StyleFleet support to add more.');
      }
      throw new Error(error?.message || 'Could not save stylist. Please try again.');
    }
    newStaff.id = data.id;

    const current = (await this.getCachedStaff(shopId)) || [];
    const updated = [...current, newStaff];
    await this.cacheStaff(shopId, updated);
    return newStaff;
  }

  /**
   * Update an existing staff member
   */
  async updateStaff(
    shopId: string,
    staffId: string,
    updates: { name?: string; role?: string; phone?: string; rating?: string }
  ): Promise<StaffMember | null> {
    const list = (await this.getCachedStaff(shopId)) || [];
    const target = list.find((s) => s.id === staffId);
    if (!target) return null;

    const newName = updates.name !== undefined ? updates.name.trim() : target.name;
    const newPhone = updates.phone !== undefined ? updates.phone.replace(/\D/g, '').slice(-10) : target.phone;
    const newRole = updates.role !== undefined ? updates.role.trim() : target.role;
    const newRating = updates.rating !== undefined ? updates.rating : (target.rating || '5.0');

    const updated: StaffMember = {
      ...target,
      name: newName,
      phone: newPhone,
      role: newRole,
      rating: newRating,
    };

    if (isRemoteShop(shopId) && isValidUuid(staffId)) {
      const result = await supabase
        .from('staff')
        .update({
          name: newName,
          phone: newPhone,
          role: newRole,
          rating: newRating,
        } as any)
        .eq('id', staffId)
        .eq('shop_id', shopId)
        .select('id');
      assertSaved(result, 'the stylist');
      if (!result.data || result.data.length === 0) {
        throw new Error('This stylist was not found on the server, so the changes were not saved.');
      }
    }

    const updatedList = list.map((s) => (s.id === staffId ? updated : s));
    await this.cacheStaff(shopId, updatedList);
    return updated;
  }

  /**
   * Update a stylist's rating and persist to Supabase & cache
   */
  async updateStaffRating(
    shopId: string,
    staffId: string,
    rating: string
  ): Promise<StaffMember | null> {
    const list = (await this.getCachedStaff(shopId)) || [];
    const target = list.find((s) => s.id === staffId);
    if (!target) return null;

    const num = parseFloat(rating);
    const formattedRating = !isNaN(num) && num > 0 ? num.toFixed(1) : '5.0';
    const updated: StaffMember = {
      ...target,
      rating: formattedRating,
    };

    if (isRemoteShop(shopId) && isValidUuid(staffId)) {
      const result = await supabase
        .from('staff')
        .update({ rating: formattedRating } as any)
        .eq('id', staffId)
        .eq('shop_id', shopId)
        .select('id');
      assertSaved(result, 'the rating');
      if (!result.data || result.data.length === 0) {
        throw new Error('This stylist was not found on the server, so the rating was not saved.');
      }
    }

    const updatedList = list.map((s) => (s.id === staffId ? updated : s));
    await this.cacheStaff(shopId, updatedList);
    return updated;
  }

  /**
   * Delete / remove a staff member
   */
  async deleteStaff(shopId: string, staffId: string): Promise<boolean> {
    if (isRemoteShop(shopId) && isValidUuid(staffId)) {
      await authRepository.ensureSupabaseSession();
      const result = await supabase.from('staff').delete().eq('id', staffId).eq('shop_id', shopId);
      assertSaved(result, 'the removal');
    }

    const list = (await this.getCachedStaff(shopId)) || [];
    const updatedList = list.filter((s) => s.id !== staffId);
    await this.cacheStaff(shopId, updatedList);
    return true;
  }

  /**
   * Toggle staff active status
   */
  async toggleStaffStatus(shopId: string, staffId: string): Promise<boolean> {
    const list = (await this.getCachedStaff(shopId)) || [];
    const target = list.find((s) => s.id === staffId);
    if (!target) return false;

    const nextState = !target.is_active;

    // Save first. The phone's copy changes only once the database has it.
    if (isRemoteShop(shopId) && isValidUuid(staffId)) {
      const result = await supabase
        .from('staff')
        .update({ is_active: nextState } as any)
        .eq('id', staffId)
        .select('id');
      if (result.error?.message?.includes('STYLIST_LIMIT_REACHED')) {
        throw new Error('STYLIST_LIMIT_REACHED: Stylist limit reached. Contact StyleFleet support to add more.');
      }
      assertSaved(result, 'the stylist status');
      if (!result.data || result.data.length === 0) {
        throw new Error('This stylist was not found on the server, so the status was not saved.');
      }
    }

    target.is_active = nextState;
    await this.cacheStaff(shopId, list);
    return nextState;
  }

  /**
   * Find an active stylist by their 10-digit mobile number
   */
  async getStylistByPhone(phone: string, preferredShopId?: string | null): Promise<StaffMember | null> {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) return null;

    try {
      // The same number can be a stylist in more than one salon. The salon in the invite link wins.
      const invitedShop = preferredShopId ?? (await AsyncStorage.getItem(INVITE_SHOP_KEY).catch(() => null));

      const findMatch = (shopFilter: string | null) => {
        const selectBuilder = supabase.from('staff').select('*');
        const filteredBuilder =
          typeof (selectBuilder as any).or === 'function'
            ? (selectBuilder as any).or(`phone.ilike.%${cleanPhone}%,phone.eq.${cleanPhone}`)
            : selectBuilder.eq('phone', cleanPhone);
        const active = filteredBuilder.eq('is_active', true);
        return (shopFilter ? active.eq('shop_id', shopFilter) : active).limit(1).maybeSingle();
      };

      let { data, error } = invitedShop && isValidUuid(invitedShop) ? await findMatch(invitedShop) : { data: null, error: null };
      if (error || !data) ({ data, error } = await findMatch(null));

      if (!error && data) {
        return {
          id: data.id,
          shop_id: data.shop_id,
          name: data.name,
          role: data.role || 'Stylist',
          phone: data.phone,
          is_active: data.is_active,
          permissions: data.permissions || DEFAULT_STYLIST_PERMISSIONS,
          invitation_status: data.invitation_status || 'not_invited',
          invited_at: data.invited_at || null,
          target_amount_minor: data.target_amount_minor || 500000,
          revenue_minor: 0,
          service_count: 0,
          rebook_rate: '',
          rating: '5.0',
          chair_utilization: '',
        };
      }
    } catch (e) {
      console.warn('getStylistByPhone error:', e);
    }

    return null;
  }

  /**
   * Record that a stylist was invited via WhatsApp and track timestamp
   */
  async recordStylistInvite(shopId: string, staffId: string): Promise<void> {
    const nowIso = new Date().toISOString();
    if (isRemoteShop(shopId)) {
      const result = await supabase
        .from('staff')
        .update({
          invitation_status: 'invited',
          invited_at: nowIso,
          updated_at: nowIso,
        } as any)
        .eq('id', staffId)
        .eq('shop_id', shopId)
        .select('id');
      assertSaved(result, 'the invitation');
      if (!result.data || result.data.length === 0) {
        throw new Error('This stylist was not found on the server, so the invitation was not recorded.');
      }
    }

    const list = (await this.getCachedStaff(shopId)) || [];
    const updated = list.map((s) =>
      s.id === staffId ? { ...s, invitation_status: 'invited' as const, invited_at: nowIso } : s
    );
    await this.cacheStaff(shopId, updated);
  }

  /**
   * Mark stylist as active upon their first login into StyleFleet
   */
  async markStylistActive(shopId: string, staffId: string, profileId?: string, phone?: string): Promise<boolean> {
    // Runs while a stylist is logging in, so a failure is reported (returned and logged) but never blocks the login
    const nowIso = new Date().toISOString();
    let allSaved = true;
    const note = (what: string, error: { message?: string } | null | undefined) => {
      if (error) {
        allSaved = false;
        console.warn(`markStylistActive: ${what} was not saved:`, error.message);
      }
    };

    try {
      const updatePayload: any = {
        invitation_status: 'active',
        updated_at: nowIso,
      };
      if (profileId) {
        updatePayload.profile_id = profileId;
      }
      const staffResult = await supabase
        .from('staff')
        .update(updatePayload)
        .eq('id', staffId)
        .eq('shop_id', shopId);
      note('the stylist status', staffResult.error);

      if (profileId) {
        // Guarantee RLS membership via shop_members
        const memberResult = await supabase
          .from('shop_members')
          .upsert({
            shop_id: shopId,
            profile_id: profileId,
            role: 'stylist',
            is_active: true,
          } as any, { onConflict: 'shop_id,profile_id' });
        note('the shop membership', memberResult.error);

        // Also attempt join_shop_as_stylist RPC if available
        if (phone) {
          const rpcResult = await supabase.rpc('join_shop_as_stylist', {
            p_shop_id: shopId,
            p_phone: phone,
          });
          note('the join request', rpcResult.error);
        }
      }
    } catch (e) {
      allSaved = false;
      console.warn('markStylistActive offline warning:', e);
    }

    // The phone shows "active" only once the server accepted it
    if (allSaved) {
      const list = (await this.getCachedStaff(shopId)) || [];
      const updated = list.map((s) =>
        s.id === staffId ? { ...s, invitation_status: 'active' as const } : s
      );
      await this.cacheStaff(shopId, updated);
    }
    return allSaved;
  }

  /**
   * Update permissions for a specific stylist
   */
  async updateStaffPermissions(
    shopId: string,
    staffId: string,
    permissions: StylistPermissions
  ): Promise<void> {
    const { data, error } = await supabase
      .from('staff')
      .update({
        permissions,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', staffId)
      .eq('shop_id', shopId)
      .select('id');

    if (error) {
      throw new Error(error.message || 'Could not update permissions.');
    }
    if (!data || data.length === 0) {
      throw new Error('Could not update permissions. Only the salon owner can change stylist access.');
    }

    const list = (await this.getCachedStaff(shopId)) || [];
    const updated = list.map((s) => (s.id === staffId ? { ...s, permissions } : s));
    await this.cacheStaff(shopId, updated);
  }

  async cacheStaff(shopId: string, staff: StaffMember[]): Promise<void> {
    await AsyncStorage.setItem(`${STORAGE_KEY_STAFF}_${shopId}`, JSON.stringify(staff));
  }

  async getCachedStaff(shopId: string): Promise<StaffMember[] | null> {
    try {
      const data = await AsyncStorage.getItem(`${STORAGE_KEY_STAFF}_${shopId}`);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    return null;
  }
}

export const staffRepository = new StaffRepository();
