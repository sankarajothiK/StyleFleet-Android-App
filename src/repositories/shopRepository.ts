import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Database } from '../types/database';
import { DEFAULT_ACCENT } from '../theme/colors';
import { logoStorageService } from '../services/logoStorageService';
import { generateInvoicePrefixFromShopName, sanitizeInvoicePrefix } from '../utils/invoicePrefix';
import { assertSaved, isRemoteShop } from '../utils/persist';

export type ShopRow = Database['public']['Tables']['shops']['Row'];

const STORAGE_KEY_SHOP_CACHE = '@salon_os_shop_cache';
const STORAGE_KEY_LAST_PHONE = '@salon_os_last_phone';
const STORAGE_KEY_OWNER_NAMES = '@salon_os_owner_names_by_profile';

export interface ShopRegistrationData {
  name: string;
  ownerName: string;
  address: string;
  city: string;
  pinCode: string;
  gstin?: string;
  phone?: string;
  accentColor?: string;
  logoPath?: string;
  invoicePrefix?: string;
}

export class ShopRepository {
  async enrichShopRow(shop: ShopRow | null): Promise<ShopRow | null> {
    if (!shop) return null;
    let upi = (shop as any).upi_id || (shop.social_links as any)?.upi_id || null;
    if (!upi && shop.id) {
      try {
        upi = await AsyncStorage.getItem(`@salon_os_upi_id_${shop.id}`);
      } catch {
        // ignore
      }
    }

    let prefix = (shop as any).invoice_prefix || (shop.social_links as any)?.invoice_prefix || null;
    if ((!prefix || prefix === 'INV-') && shop.id) {
      try {
        const cachedPref = await AsyncStorage.getItem(`@salon_os_invoice_prefix_${shop.id}`);
        if (cachedPref) prefix = cachedPref;
      } catch {
        // ignore
      }
    }
    if (!prefix || prefix === 'INV-') {
      prefix = generateInvoicePrefixFromShopName(shop.name);
    }

    return { ...shop, upi_id: upi, invoice_prefix: prefix };
  }

  async getShopById(shopId: string): Promise<ShopRow | null> {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .maybeSingle();

      if (!error && data) {
        const enriched = await this.enrichShopRow(data as ShopRow);
        if (enriched) {
          await this.cacheShop(enriched);
          return enriched;
        }
      }

      // If query succeeded and returned no row, the shop definitely does not exist in remote DB
      if (!error && !data) {
        return null;
      }

      // If error indicates 0 rows found
      if (error && (error.code === 'PGRST116' || error.message?.includes('0 rows'))) {
        return null;
      }
    } catch {
      // Network failure / offline: fallback to cache
      return this.getCachedShop();
    }

    return null;
  }

  async getShopForUser(userId: string): Promise<ShopRow | null> {
    try {
      // 1. Direct query on shops by owner_profile_id
      const { data: directShops, error: directErr } = await supabase
        .from('shops')
        .select('*')
        .eq('owner_profile_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!directErr && directShops && directShops.length > 0) {
        await this.cacheShop(directShops[0] as ShopRow);
        return directShops[0] as ShopRow;
      }

      // 2. Query shop_members
      const { data: members, error: memErr } = await supabase
        .from('shop_members')
        .select('shop_id')
        .eq('profile_id', userId)
        .eq('is_active', true)
        .limit(1);

      if (!memErr && members && members.length > 0) {
        return this.getShopById(members[0].shop_id);
      }
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * Find registered shop by phone number in Supabase
   */
  async getShopByPhone(phone: string): Promise<ShopRow | null> {
    const clean = phone.replace(/\D/g, '').slice(-10);
    if (!clean) return null;

    try {
      const selectBuilder = supabase.from('shops').select('*');
      const filteredBuilder =
        typeof (selectBuilder as any).or === 'function'
          ? (selectBuilder as any).or(`phone.ilike.%${clean}%,phone.eq.${clean}`)
          : selectBuilder.eq('phone', clean);

      const { data, error } = await filteredBuilder
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        await this.cacheShop(data[0] as ShopRow);
        return data[0] as ShopRow;
      }
    } catch {
      // ignore
    }
    return null;
  }

  async createShop(
    ownerUserId: string,
    data: ShopRegistrationData
  ): Promise<ShopRow> {
    // Process local logo to universal cloud/data URI if needed
    let processedLogo: string | null = data.logoPath || null;
    if (processedLogo && (processedLogo.startsWith('file://') || processedLogo.startsWith('content://'))) {
      try {
        const uploaded = await logoStorageService.processAndUploadLogo(ownerUserId || 'new_shop', processedLogo);
        if (uploaded) {
          processedLogo = uploaded;
        }
      } catch (lErr) {
        console.warn('Notice: Logo processing warning:', lErr);
      }
    }

    // Auto-generate invoice prefix based on salon name
    const autoPrefix = sanitizeInvoicePrefix(
      data.invoicePrefix || generateInvoicePrefixFromShopName(data.name)
    );

    // 1. Try calling the register_salon RPC function (bypasses RLS with SECURITY DEFINER)
    try {
      const { data: rpcShop, error: rpcError } = await supabase.rpc('register_salon', {
        p_name: data.name,
        p_phone: data.phone || null,
        p_owner_name: data.ownerName || data.name,
        p_address: data.address,
        p_city: data.city,
        p_pin_code: data.pinCode,
        p_gstin: data.gstin || null,
        p_logo_path: processedLogo,
        p_accent_color: data.accentColor || DEFAULT_ACCENT,
      });

      if (!rpcError && rpcShop) {
        const row = rpcShop as ShopRow;
        try {
          await this.updateShop(row.id, { invoice_prefix: autoPrefix });
          row.invoice_prefix = autoPrefix;
          await AsyncStorage.setItem(`@salon_os_invoice_prefix_${row.id}`, autoPrefix);
        } catch {
          // ignore
        }
        await this.cacheShop(row);
        return row;
      }
    } catch {
      // Fall through to direct table insert
    }

    // 2. Resolve active Supabase Auth user ID (UUID)
    let validOwnerId: string | null = ownerUserId;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        validOwnerId = sessionData.session.user.id;
      }
    } catch {
      // ignore
    }

    const isRealUuid =
      validOwnerId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(validOwnerId);

    // 3. Ensure profile exists in public.profiles table
    if (isRealUuid && validOwnerId) {
      try {
        await supabase.from('profiles').upsert({
          id: validOwnerId,
          phone: data.phone || null,
          full_name: data.ownerName || null,
        } as any);
      } catch (profErr) {
        console.warn('Profiles upsert notice:', profErr);
      }
    }

    // 4. Insert salon row into Supabase public.shops
    const insertPayload: any = {
      name: data.name,
      logo_path: processedLogo || null,
      address: data.address,
      city: data.city,
      pin_code: data.pinCode,
      gstin: data.gstin || null,
      phone: data.phone || null,
      accent_color: data.accentColor || DEFAULT_ACCENT,
      invoice_prefix: autoPrefix,
      gst_rate: 0.00,
    };

    if (isRealUuid && validOwnerId) {
      insertPayload.owner_profile_id = validOwnerId;
    }

    const { data: created, error } = await supabase
      .from('shops')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('Supabase shop creation error:', error);
      throw new Error(`Failed to save salon to database: ${error.message}`);
    }

    if (created) {
      const row = created as ShopRow;

      // 4. Create shop membership
      if (isRealUuid && validOwnerId) {
        try {
          await supabase.from('shop_members').insert({
            shop_id: row.id,
            profile_id: validOwnerId,
            role: 'owner',
            is_active: true,
          } as any);
        } catch (memErr) {
          console.warn('Shop member creation notice:', memErr);
        }
      }

      // 5. Initialize shop defaults via RPC
      try {
        await supabase.rpc('initialize_shop_defaults', { new_shop_id: row.id } as any);
      } catch (rpcErr) {
        console.warn('RPC initialize_shop_defaults notice:', rpcErr);
      }

      if (data.ownerName) {
        await this.saveOwnerName(data.ownerName);
        (row as any).owner_name = data.ownerName;
      }

      await this.cacheShop(row);
      return row;
    }

    throw new Error('Unexpected empty response from database when saving salon');
  }

  async updateShop(shopId: string, updates: Partial<ShopRow> & { owner_name?: string }): Promise<ShopRow | null> {
    const { owner_name, ...shopUpdates } = updates;

    if (owner_name) {
      const cached = await this.getCachedShop();
      const ownerProfileId = shopUpdates.owner_profile_id ?? cached?.owner_profile_id ?? null;
      await this.saveOwnerName(owner_name, ownerProfileId);
    }

    if (shopUpdates.logo_path) {
      try {
        const universalLogo = await logoStorageService.processAndUploadLogo(shopId, shopUpdates.logo_path);
        shopUpdates.logo_path = universalLogo;
      } catch (err) {
        if (isRemoteShop(shopId)) {
          throw new Error('The logo could not be uploaded, so it was not saved. Please check your connection and try again.');
        }
        console.warn('Logo processing notice:', err);
      }
    }

    // Phone-side copies change only after the server accepted the save
    const localWrites: (() => Promise<void>)[] = [];

    if (updates.upi_id !== undefined) {
      const cached = await this.getCachedShop();
      const existingSocial = (cached?.social_links as any) || {};
      shopUpdates.social_links = {
        ...existingSocial,
        ...(shopUpdates.social_links || {}),
        upi_id: updates.upi_id,
      };
      if (shopId) {
        localWrites.push(async () => {
          try {
            if (updates.upi_id) {
              await AsyncStorage.setItem(`@salon_os_upi_id_${shopId}`, updates.upi_id);
            } else {
              await AsyncStorage.removeItem(`@salon_os_upi_id_${shopId}`);
            }
          } catch {
            // ignore
          }
        });
      }
    }

    if (updates.invoice_prefix !== undefined) {
      const cleanPrefix = sanitizeInvoicePrefix(updates.invoice_prefix);
      shopUpdates.invoice_prefix = cleanPrefix;
      const cached = await this.getCachedShop();
      const existingSocial = (cached?.social_links as any) || {};
      shopUpdates.social_links = {
        ...existingSocial,
        ...(shopUpdates.social_links || {}),
        invoice_prefix: cleanPrefix,
      };
      if (shopId) {
        localWrites.push(async () => {
          try {
            await AsyncStorage.setItem(`@salon_os_invoice_prefix_${shopId}`, cleanPrefix);
          } catch {
            // ignore
          }
        });
      }
    }

    let savedData: ShopRow | null = null;

    if (isRemoteShop(shopId)) {
      const first = await supabase
        .from('shops')
        .update(shopUpdates as any)
        .eq('id', shopId)
        .select()
        .single();

      if (!first.error && first.data) {
        savedData = first.data as ShopRow;
      } else if (first.error && ((shopUpdates as any).upi_id !== undefined || (shopUpdates as any).invoice_prefix !== undefined)) {
        // Fallback: if top-level column is awaiting DB migration, update without it
        // The values are already safely mirrored in social_links above!
        const { upi_id, invoice_prefix, ...fallbackUpdates } = shopUpdates as any;
        const fallback = await supabase
          .from('shops')
          .update(fallbackUpdates as any)
          .eq('id', shopId)
          .select()
          .single();
        assertSaved(fallback, 'the shop details');
        savedData = (fallback.data as ShopRow | null) ?? null;
      } else {
        assertSaved(first, 'the shop details');
      }

      if (!savedData) {
        throw new Error('The shop was not found on the server, so the changes were not saved.');
      }
    }

    for (const write of localWrites) await write();

    if (savedData) {
      const enriched = await this.enrichShopRow(savedData);
      if (enriched) await this.cacheShop(enriched);
      return enriched;
    }

    const cached = await this.getCachedShop();
    if (cached && cached.id === shopId) {
      const updated = { ...cached, ...shopUpdates };
      const enriched = await this.enrichShopRow(updated as ShopRow);
      if (enriched) await this.cacheShop(enriched);
      return enriched;
    }
    return null;
  }

  async saveOwnerName(ownerName: string, ownerProfileId?: string | null): Promise<void> {
    const trimmed = ownerName?.trim();
    if (!trimmed) return;

    try {
      if (ownerProfileId) {
        const raw = await AsyncStorage.getItem(STORAGE_KEY_OWNER_NAMES);
        const cached: Record<string, string> = raw ? JSON.parse(raw) : {};
        cached[ownerProfileId] = trimmed;
        await AsyncStorage.setItem(STORAGE_KEY_OWNER_NAMES, JSON.stringify(cached));
        return;
      }

      await AsyncStorage.setItem('@salon_os_owner_name', trimmed);
    } catch {
      // ignore
    }
  }

  async getCachedOwnerName(ownerProfileId?: string | null): Promise<string | null> {
    try {
      if (ownerProfileId) {
        const raw = await AsyncStorage.getItem(STORAGE_KEY_OWNER_NAMES);
        if (!raw) return null;
        const cached: Record<string, string> = JSON.parse(raw);
        return cached[ownerProfileId] || null;
      }
      return await AsyncStorage.getItem('@salon_os_owner_name');
    } catch {
      return null;
    }
  }

  async resolveOwnerName(ownerProfileId: string | null): Promise<string | null> {
    if (!ownerProfileId) return null;

    const cached = await this.getCachedOwnerName(ownerProfileId);
    if (cached) return cached;

    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', ownerProfileId)
        .single();
      if (data?.full_name) {
        await this.saveOwnerName(data.full_name, ownerProfileId);
        return data.full_name;
      }
    } catch {
      // ignore
    }
    return null;
  }

  async cacheShop(shop: ShopRow): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_SHOP_CACHE, JSON.stringify(shop));
  }

  async getCachedShop(): Promise<ShopRow | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY_SHOP_CACHE);
      if (data) {
        const parsed = JSON.parse(data);
        return await this.enrichShopRow(parsed);
      }
    } catch {
      // ignore
    }
    return null;
  }

  async clearCachedShop(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY_SHOP_CACHE);
    await AsyncStorage.removeItem('@salon_os_owner_name');
    await AsyncStorage.removeItem(STORAGE_KEY_OWNER_NAMES);
  }

  async saveLastPhone(phone: string): Promise<void> {
    const clean = phone.replace(/\D/g, '').slice(-10);
    if (clean) {
      await AsyncStorage.setItem(STORAGE_KEY_LAST_PHONE, clean);
    }
  }

  async getLastPhone(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEY_LAST_PHONE);
    } catch {
      return null;
    }
  }

  async getBookingHours(shopId?: string): Promise<{ startTime: string; endTime: string }> {
    const defaultHours = { startTime: '09:30 AM', endTime: '08:30 PM' };
    try {
      const storageKey = shopId ? `@salon_os_booking_hours_${shopId}` : '@salon_os_booking_hours';
      const raw = await AsyncStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.startTime && parsed.endTime) {
          return parsed;
        }
      }

      const globalRaw = await AsyncStorage.getItem('@salon_os_booking_hours');
      if (globalRaw) {
        const parsed = JSON.parse(globalRaw);
        if (parsed.startTime && parsed.endTime) {
          return parsed;
        }
      }

      const cachedShop = await this.getCachedShop();
      const meta = (cachedShop as any)?.social_links;
      if (meta?.booking_start_time && meta?.booking_end_time) {
        return {
          startTime: meta.booking_start_time,
          endTime: meta.booking_end_time,
        };
      }
    } catch {
      // fallback
    }
    return defaultHours;
  }

  async saveBookingHours(shopId: string, startTime: string, endTime: string): Promise<void> {
    const hours = { startTime: startTime.trim(), endTime: endTime.trim() };
    if (shopId) {
      const cachedShop = await this.getCachedShop();
      const existingLinks = (cachedShop as any)?.social_links || {};
      const updatedLinks = {
        ...existingLinks,
        booking_start_time: hours.startTime,
        booking_end_time: hours.endTime,
      };
      // Saved on the server first; a rejected save throws before anything changes on the phone
      await this.updateShop(shopId, { social_links: updatedLinks } as any);
    }
    try {
      const storageKey = shopId ? `@salon_os_booking_hours_${shopId}` : '@salon_os_booking_hours';
      await AsyncStorage.setItem(storageKey, JSON.stringify(hours));
      await AsyncStorage.setItem('@salon_os_booking_hours', JSON.stringify(hours));
    } catch (err) {
      console.warn('saveBookingHours notice:', err);
    }
  }

  async getInvoiceNumberingMode(shopId: string): Promise<'monthly' | 'yearly'> {
    try {
      const storageKey = shopId ? `@salon_os_invoice_mode_${shopId}` : '@salon_os_invoice_mode';
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored === 'monthly' || stored === 'yearly') {
        return stored;
      }
      const cached = await this.getCachedShop();
      if ((cached as any)?.invoice_numbering_mode === 'yearly') {
        return 'yearly';
      }
      if ((cached as any)?.invoice_numbering_mode === 'monthly') {
        return 'monthly';
      }
    } catch {
      // fallback
    }
    return 'monthly'; // default per requirement
  }

  async setInvoiceNumberingMode(shopId: string, mode: 'monthly' | 'yearly'): Promise<void> {
    if (shopId) {
      // Saved on the server first; a rejected save throws before anything changes on the phone
      await this.updateShop(shopId, { invoice_numbering_mode: mode } as any);
    }
    try {
      const storageKey = shopId ? `@salon_os_invoice_mode_${shopId}` : '@salon_os_invoice_mode';
      await AsyncStorage.setItem(storageKey, mode);
      await AsyncStorage.setItem('@salon_os_invoice_mode', mode);
    } catch (err) {
      console.warn('setInvoiceNumberingMode notice:', err);
    }
  }

  async getInvoicePrefix(shopId: string, shopName?: string): Promise<string> {
    try {
      const storageKey = shopId ? `@salon_os_invoice_prefix_${shopId}` : '@salon_os_invoice_prefix';
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored && stored !== 'INV-') {
        return stored;
      }
      const cached = await this.getCachedShop();
      if ((cached as any)?.invoice_prefix && (cached as any).invoice_prefix !== 'INV-') {
        return (cached as any).invoice_prefix;
      }
      if (shopId) {
        const { data } = await supabase
          .from('shops')
          .select('name, invoice_prefix, social_links')
          .eq('id', shopId)
          .single();

        if (data?.invoice_prefix && data.invoice_prefix !== 'INV-') {
          await AsyncStorage.setItem(storageKey, data.invoice_prefix);
          return data.invoice_prefix;
        }
        if ((data?.social_links as any)?.invoice_prefix) {
          const p = (data?.social_links as any).invoice_prefix;
          await AsyncStorage.setItem(storageKey, p);
          return p;
        }
        if (data?.name || shopName) {
          const auto = generateInvoicePrefixFromShopName(data?.name || shopName || '');
          await this.setInvoicePrefix(shopId, auto);
          return auto;
        }
      }
    } catch {
      // fallback
    }
    return shopName ? generateInvoicePrefixFromShopName(shopName) : 'CS';
  }

  async setInvoicePrefix(shopId: string, prefix: string): Promise<string> {
    const cleanPrefix = sanitizeInvoicePrefix(prefix);
    if (shopId) {
      const cached = await this.getCachedShop();
      const existingSocial = (cached?.social_links as any) || {};
      const updatedSocial = {
        ...existingSocial,
        invoice_prefix: cleanPrefix,
      };
      // Saved on the server first; a rejected save throws before anything changes on the phone
      await this.updateShop(shopId, {
        invoice_prefix: cleanPrefix,
        social_links: updatedSocial,
      } as any);
    }
    try {
      const storageKey = shopId ? `@salon_os_invoice_prefix_${shopId}` : '@salon_os_invoice_prefix';
      await AsyncStorage.setItem(storageKey, cleanPrefix);
      await AsyncStorage.setItem('@salon_os_invoice_prefix', cleanPrefix);
    } catch (err) {
      console.warn('setInvoicePrefix notice:', err);
    }
    return cleanPrefix;
  }
}

export const shopRepository = new ShopRepository();
