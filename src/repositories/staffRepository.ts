import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StaffMember, StylistPermissions, DEFAULT_STYLIST_PERMISSIONS } from '../types/domain';

const STORAGE_KEY_STAFF = '@salon_os_staff_cache';

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
        // Calculate staff revenue & service count from actual bills
        const { data: billItems } = await supabase
          .from('bill_items')
          .select('staff_id, line_total_minor, quantity')
          .eq('shop_id', shopId);

        const revByStaff: Record<string, { rev: number; count: number }> = {};
        if (billItems) {
          for (const it of billItems) {
            if (!it.staff_id) continue;
            if (!revByStaff[it.staff_id]) {
              revByStaff[it.staff_id] = { rev: 0, count: 0 };
            }
            revByStaff[it.staff_id].rev += (it.line_total_minor || 0);
            revByStaff[it.staff_id].count += (it.quantity || 1);
          }
        }

        const mapped: StaffMember[] = data.map((s) => {
          const stats = revByStaff[s.id] || { rev: 0, count: 0 };
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
            revenue_minor: stats.rev,
            service_count: stats.count,
            rebook_rate: stats.count > 0 ? '65%' : '0%',
            rating: s.rating != null ? String(s.rating) : '5.0',
            chair_utilization: stats.count > 0 ? '70%' : '0%',
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
   * Add a real staff member and persist to Supabase
   * Strictly enforces maximum 3 stylists per account (owner does not count).
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

    // Check 3 stylist limit
    const currentList = await this.getStaff(shopId);
    const activeStaff = currentList.filter((s) => s.is_active);
    if (activeStaff.length >= 3) {
      throw new Error('STYLIST_LIMIT_REACHED: Maximum 3 stylists allowed per account.');
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

    try {
      const { data, error } = await supabase
        .from('staff')
        .insert({
          shop_id: shopId,
          name: trimmedName,
          role: role || 'Stylist',
          phone: cleanPhone,
          is_active: true,
        } as any)
        .select()
        .single();

      if (error) {
        console.error('Supabase staff insert error:', error);
      } else if (data) {
        newStaff.id = data.id;
        // Optionally persist permissions if column has been migrated
        supabase
          .from('staff')
          .update({ permissions: DEFAULT_STYLIST_PERMISSIONS } as any)
          .eq('id', data.id)
          .then(() => {}, () => {});
      }
    } catch (e) {
      console.warn('Supabase staff save offline:', e);
    }

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

    try {
      await supabase
        .from('staff')
        .update({
          name: newName,
          phone: newPhone,
          role: newRole,
          rating: newRating,
        } as any)
        .eq('id', staffId)
        .eq('shop_id', shopId);
    } catch (e) {
      console.warn('updateStaff offline fallback:', e);
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

    try {
      await supabase
        .from('staff')
        .update({ rating: formattedRating } as any)
        .eq('id', staffId)
        .eq('shop_id', shopId);
    } catch (e) {
      console.warn('updateStaffRating offline fallback:', e);
    }

    const updatedList = list.map((s) => (s.id === staffId ? updated : s));
    await this.cacheStaff(shopId, updatedList);
    return updated;
  }

  /**
   * Delete / remove a staff member
   */
  async deleteStaff(shopId: string, staffId: string): Promise<boolean> {
    try {
      await supabase
        .from('staff')
        .delete()
        .eq('id', staffId)
        .eq('shop_id', shopId);
    } catch (e) {
      console.warn('deleteStaff offline fallback:', e);
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
    target.is_active = nextState;

    try {
      await supabase
        .from('staff')
        .update({ is_active: nextState } as any)
        .eq('id', staffId);
    } catch {
      // ignore
    }

    await this.cacheStaff(shopId, list);
    return nextState;
  }

  /**
   * Find an active stylist by their 10-digit mobile number
   */
  async getStylistByPhone(phone: string): Promise<StaffMember | null> {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) return null;

    try {
      const selectBuilder = supabase.from('staff').select('*');
      const filteredBuilder =
        typeof (selectBuilder as any).or === 'function'
          ? (selectBuilder as any).or(`phone.ilike.%${cleanPhone}%,phone.eq.${cleanPhone}`)
          : selectBuilder.eq('phone', cleanPhone);

      const { data, error } = await filteredBuilder
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

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
          rebook_rate: '65%',
          rating: '5.0',
          chair_utilization: '70%',
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
    try {
      await supabase
        .from('staff')
        .update({
          invitation_status: 'invited',
          invited_at: nowIso,
          updated_at: nowIso,
        } as any)
        .eq('id', staffId)
        .eq('shop_id', shopId);
    } catch (e) {
      console.warn('recordStylistInvite offline warning:', e);
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
  async markStylistActive(shopId: string, staffId: string, profileId?: string, phone?: string): Promise<void> {
    const nowIso = new Date().toISOString();
    try {
      const updatePayload: any = {
        invitation_status: 'active',
        updated_at: nowIso,
      };
      if (profileId) {
        updatePayload.profile_id = profileId;
      }
      await supabase
        .from('staff')
        .update(updatePayload)
        .eq('id', staffId)
        .eq('shop_id', shopId);

      if (profileId) {
        // Guarantee RLS membership via shop_members
        try {
          await supabase
            .from('shop_members')
            .upsert({
              shop_id: shopId,
              profile_id: profileId,
              role: 'stylist',
              is_active: true,
            } as any, { onConflict: 'shop_id,profile_id' });
        } catch (smErr) {
          console.warn('shop_members upsert notice:', smErr);
        }

        // Also attempt join_shop_as_stylist RPC if available
        if (phone) {
          try {
            await supabase.rpc('join_shop_as_stylist', {
              p_shop_id: shopId,
              p_phone: phone,
            });
          } catch {}
        }
      }
    } catch (e) {
      console.warn('markStylistActive offline warning:', e);
    }

    const list = (await this.getCachedStaff(shopId)) || [];
    const updated = list.map((s) =>
      s.id === staffId ? { ...s, invitation_status: 'active' as const } : s
    );
    await this.cacheStaff(shopId, updated);
  }

  /**
   * Update permissions for a specific stylist
   */
  async updateStaffPermissions(
    shopId: string,
    staffId: string,
    permissions: StylistPermissions
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('staff')
        .update({
          permissions,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', staffId)
        .eq('shop_id', shopId);

      if (error) {
        console.warn('updateStaffPermissions Supabase warning:', error.message);
      }
    } catch (e) {
      console.warn('updateStaffPermissions fallback error:', e);
    }

    const list = (await this.getCachedStaff(shopId)) || [];
    const updated = list.map((s) => (s.id === staffId ? { ...s, permissions } : s));
    await this.cacheStaff(shopId, updated);
  }

  async cacheStaff(shopId: string, staff: StaffMember[]): Promise<void> {
    await AsyncStorage.setItem(`${STORAGE_KEY_STAFF}_${shopId}`, JSON.stringify(staff));
  }

  private async getCachedStaff(shopId: string): Promise<StaffMember[] | null> {
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
