import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Service, ServiceCategory } from '../types/domain';

const STORAGE_KEY_SERVICES = '@salon_os_services_cache';
const STORAGE_KEY_CATEGORIES = '@salon_os_service_categories_cache';

export const SERVICE_CATEGORIES = ['Hair', 'Beard', 'Colour', 'Care', 'Packages'] as const;

const DEFAULT_SERVICES: Omit<Service, 'id' | 'shop_id'>[] = [
  { category_id: null, category_name: 'Hair', name: 'Haircut', price_minor: 30000, duration_minutes: 30, is_active: true },
  { category_id: null, category_name: 'Hair', name: 'Haircut + wash', price_minor: 40000, duration_minutes: 40, is_active: true },
  { category_id: null, category_name: 'Hair', name: 'Skin fade', price_minor: 45000, duration_minutes: 45, is_active: true },
  { category_id: null, category_name: 'Hair', name: 'Kids cut', price_minor: 20000, duration_minutes: 25, is_active: true },
  { category_id: null, category_name: 'Hair', name: 'Head shave', price_minor: 25000, duration_minutes: 30, is_active: true },
  { category_id: null, category_name: 'Beard', name: 'Beard trim & shape', price_minor: 20000, duration_minutes: 20, is_active: true },
  { category_id: null, category_name: 'Beard', name: 'Royal shave · hot towel', price_minor: 35000, duration_minutes: 35, is_active: true },
  { category_id: null, category_name: 'Beard', name: 'Beard colour', price_minor: 50000, duration_minutes: 30, is_active: true },
  { category_id: null, category_name: 'Colour', name: 'Hair colour · black', price_minor: 70000, duration_minutes: 45, is_active: true },
  { category_id: null, category_name: 'Colour', name: 'Global colour', price_minor: 180000, duration_minutes: 90, is_active: true },
  { category_id: null, category_name: 'Colour', name: 'Highlights', price_minor: 240000, duration_minutes: 120, is_active: true },
  { category_id: null, category_name: 'Care', name: 'Hair spa', price_minor: 90000, duration_minutes: 60, is_active: true },
  { category_id: null, category_name: 'Care', name: 'Head massage', price_minor: 35000, duration_minutes: 30, is_active: true },
  { category_id: null, category_name: 'Care', name: 'Face clean-up', price_minor: 60000, duration_minutes: 45, is_active: true },
  { category_id: null, category_name: 'Care', name: 'D-Tan', price_minor: 50000, duration_minutes: 30, is_active: true },
  { category_id: null, category_name: 'Packages', name: 'Groom package', price_minor: 650000, duration_minutes: 180, is_active: true },
];

export class ServiceRepository {
  /**
   * Fetch all categories for a shop
   */
  async getCategories(shopId: string): Promise<ServiceCategory[]> {
    try {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped: ServiceCategory[] = data.map((c) => ({
          id: c.id,
          shop_id: c.shop_id,
          name: c.name,
          sort_order: c.sort_order,
          is_active: c.is_active,
        }));
        await this.cacheCategories(shopId, mapped);
        return mapped;
      }

      // If no categories found in Supabase for this shop, seed default categories into Supabase!
      const defaultsToInsert = SERVICE_CATEGORIES.map((name, idx) => ({
        shop_id: shopId,
        name,
        sort_order: idx + 1,
        is_active: true,
      }));

      const { data: inserted, error: insertErr } = await supabase
        .from('service_categories')
        .insert(defaultsToInsert as any)
        .select();

      if (!insertErr && inserted && inserted.length > 0) {
        const mapped: ServiceCategory[] = inserted.map((c: any) => ({
          id: c.id,
          shop_id: c.shop_id,
          name: c.name,
          sort_order: c.sort_order,
          is_active: c.is_active,
        }));
        await this.cacheCategories(shopId, mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('Error fetching or seeding categories in Supabase:', e);
    }

    const cached = await this.getCachedCategories(shopId);
    if (cached && cached.length > 0) return cached;

    // Fallback default categories
    const defaults: ServiceCategory[] = SERVICE_CATEGORIES.map((name, idx) => ({
      id: `cat_${idx + 1}`,
      shop_id: shopId,
      name,
      sort_order: idx + 1,
      is_active: true,
    }));
    await this.cacheCategories(shopId, defaults);
    return defaults;
  }

  async addCategory(shopId: string, name: string): Promise<ServiceCategory> {
    const trimmed = name.trim();
    // Check if category already exists in database
    const existing = await this.getCategories(shopId);
    const found = existing.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (found && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(found.id)) {
      return found;
    }

    const sortOrder = existing.length + 1;
    let createdCat: ServiceCategory = {
      id: `cat_${Date.now()}`,
      shop_id: shopId,
      name: trimmed,
      sort_order: sortOrder,
      is_active: true,
    };

    try {
      const { data, error } = await supabase
        .from('service_categories')
        .insert({
          shop_id: shopId,
          name: trimmed,
          sort_order: sortOrder,
          is_active: true,
        } as any)
        .select()
        .single();

      if (error) {
        console.error('Supabase error inserting category:', error);
      } else if (data) {
        createdCat = {
          id: data.id,
          shop_id: data.shop_id,
          name: data.name,
          sort_order: data.sort_order,
          is_active: data.is_active,
        };
      }
    } catch (e) {
      console.error('Exception inserting category into Supabase:', e);
    }

    const current = await this.getCategories(shopId);
    const updated = [...current.filter((c) => c.id !== createdCat.id), createdCat];
    await this.cacheCategories(shopId, updated);
    return createdCat;
  }

  async updateCategory(shopId: string, categoryId: string, name: string): Promise<void> {
    try {
      await supabase
        .from('service_categories')
        .update({ name } as any)
        .eq('id', categoryId);
    } catch {
      // ignore
    }

    const current = await this.getCategories(shopId);
    const updated = current.map((c) => (c.id === categoryId ? { ...c, name } : c));
    await this.cacheCategories(shopId, updated);
  }

  async deleteCategory(shopId: string, categoryId: string): Promise<void> {
    try {
      await supabase
        .from('service_categories')
        .update({ is_active: false } as any)
        .eq('id', categoryId);
    } catch {
      // ignore
    }

    const current = await this.getCategories(shopId);
    const updated = current.filter((c) => c.id !== categoryId);
    await this.cacheCategories(shopId, updated);
  }

  /**
   * Fetch all services for a shop
   */
  async getServices(shopId: string): Promise<Service[]> {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*, service_categories(name)')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .order('price_minor', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped: Service[] = data.map((s) => ({
          id: s.id,
          shop_id: s.shop_id,
          category_id: s.category_id,
          category_name: (s.service_categories as any)?.name || 'Hair',
          name: s.name,
          price_minor: s.price_minor,
          duration_minutes: s.duration_minutes,
          is_active: s.is_active,
        }));
        await this.cacheServices(shopId, mapped);
        return mapped;
      }

      // If no services in Supabase yet, seed all 16 preset services into Supabase!
      const categories = await this.getCategories(shopId);
      const catMap = new Map<string, string>();
      categories.forEach((c) => catMap.set(c.name.toLowerCase(), c.id));

      const servicesToInsert = DEFAULT_SERVICES.map((s) => {
        const matchedCatId = catMap.get((s.category_name || 'Hair').toLowerCase()) || null;
        return {
          shop_id: shopId,
          category_id:
            matchedCatId &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchedCatId)
              ? matchedCatId
              : null,
          name: s.name,
          price_minor: s.price_minor,
          duration_minutes: s.duration_minutes,
          is_active: true,
        };
      });

      const { data: insertedSvc, error: insertSvcErr } = await supabase
        .from('services')
        .insert(servicesToInsert as any)
        .select('*, service_categories(name)');

      if (!insertSvcErr && insertedSvc && insertedSvc.length > 0) {
        const mapped: Service[] = insertedSvc.map((s: any) => ({
          id: s.id,
          shop_id: s.shop_id,
          category_id: s.category_id,
          category_name: (s.service_categories as any)?.name || 'Hair',
          name: s.name,
          price_minor: s.price_minor,
          duration_minutes: s.duration_minutes,
          is_active: s.is_active,
        }));
        await this.cacheServices(shopId, mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('Error fetching or seeding services in Supabase:', e);
    }

    const cached = await this.getCachedServices(shopId);
    if (cached && cached.length > 0) return cached;

    // Seed defaults in-memory fallback
    const seeded: Service[] = DEFAULT_SERVICES.map((s, idx) => ({
      ...s,
      id: `svc_${idx + 1}`,
      shop_id: shopId,
    }));
    await this.cacheServices(shopId, seeded);
    return seeded;
  }

  async addService(
    shopId: string,
    categoryName: string,
    name: string,
    priceRupees: number
  ): Promise<Service> {
    const trimmedCat = categoryName.trim();
    const trimmedName = name.trim();

    // Ensure category exists in Supabase
    let catId: string | null = null;
    const cats = await this.getCategories(shopId);
    let matchedCat = cats.find((c) => c.name.toLowerCase() === trimmedCat.toLowerCase());

    if (!matchedCat || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchedCat.id)) {
      matchedCat = await this.addCategory(shopId, trimmedCat);
    }

    if (matchedCat && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchedCat.id)) {
      catId = matchedCat.id;
    }

    const newService: Service = {
      id: `svc_${Date.now()}`,
      shop_id: shopId,
      category_id: catId,
      category_name: trimmedCat,
      name: trimmedName,
      price_minor: Math.round(priceRupees * 100),
      duration_minutes: 30,
      is_active: true,
    };

    try {
      const payload: any = {
        shop_id: shopId,
        name: trimmedName,
        price_minor: Math.round(priceRupees * 100),
        duration_minutes: 30,
        is_active: true,
      };
      if (catId) {
        payload.category_id = catId;
      }

      const { data, error } = await supabase
        .from('services')
        .insert(payload)
        .select('*, service_categories(name)')
        .single();

      if (error) {
        console.error('Error inserting service into Supabase:', error);
      } else if (data) {
        newService.id = data.id;
        newService.category_id = data.category_id;
        newService.category_name = (data.service_categories as any)?.name || trimmedCat;
      }
    } catch (e) {
      console.error('Exception inserting service into Supabase:', e);
    }

    const current = await this.getServices(shopId);
    const updated = [...current.filter((s) => s.id !== newService.id), newService];
    await this.cacheServices(shopId, updated);
    return newService;
  }

  async updateService(
    shopId: string,
    serviceId: string,
    updates: { name?: string; priceRupees?: number; categoryName?: string }
  ): Promise<void> {
    try {
      const dbUpdates: any = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.priceRupees !== undefined) dbUpdates.price_minor = Math.round(updates.priceRupees * 100);

      if (updates.categoryName) {
        const cats = await this.getCategories(shopId);
        const matched = cats.find((c) => c.name.toLowerCase() === updates.categoryName!.toLowerCase());
        if (matched && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matched.id)) {
          dbUpdates.category_id = matched.id;
        }
      }

      await supabase
        .from('services')
        .update(dbUpdates)
        .eq('id', serviceId);
    } catch {
      // ignore
    }

    const current = await this.getServices(shopId);
    const updated = current.map((s) => {
      if (s.id !== serviceId) return s;
      return {
        ...s,
        name: updates.name || s.name,
        price_minor: updates.priceRupees !== undefined ? Math.round(updates.priceRupees * 100) : s.price_minor,
        category_name: updates.categoryName || s.category_name,
      };
    });
    await this.cacheServices(shopId, updated);
  }

  async removeService(shopId: string, serviceId: string): Promise<void> {
    try {
      await supabase
        .from('services')
        .update({ is_active: false } as any)
        .eq('id', serviceId);
    } catch {
      // local
    }

    const current = await this.getServices(shopId);
    const updated = current.filter((s) => s.id !== serviceId);
    await this.cacheServices(shopId, updated);
  }

  /**
   * Bulk import menu parsed from Gemini AI
   */
  async importMenuFromAI(
    shopId: string,
    extractedItems: { category: string; name: string; priceRupees: number }[]
  ): Promise<Service[]> {
    const existingCats = await this.getCategories(shopId);
    const catMap: Record<string, string> = {};
    for (const c of existingCats) {
      catMap[c.name.toLowerCase()] = c.id;
    }

    const uniqueCategories = Array.from(new Set(extractedItems.map((i) => i.category.trim()))).filter(Boolean);

    for (const catName of uniqueCategories) {
      if (!catMap[catName.toLowerCase()]) {
        const newCat = await this.addCategory(shopId, catName);
        catMap[catName.toLowerCase()] = newCat.id;
      }
    }

    const createdServices: Service[] = [];
    for (const it of extractedItems) {
      const s = await this.addService(shopId, it.category, it.name, it.priceRupees);
      createdServices.push(s);
    }

    return this.getServices(shopId);
  }

  private async cacheServices(shopId: string, services: Service[]): Promise<void> {
    await AsyncStorage.setItem(`${STORAGE_KEY_SERVICES}_${shopId}`, JSON.stringify(services));
  }

  private async getCachedServices(shopId: string): Promise<Service[] | null> {
    try {
      const data = await AsyncStorage.getItem(`${STORAGE_KEY_SERVICES}_${shopId}`);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    return null;
  }

  private async cacheCategories(shopId: string, categories: ServiceCategory[]): Promise<void> {
    await AsyncStorage.setItem(`${STORAGE_KEY_CATEGORIES}_${shopId}`, JSON.stringify(categories));
  }

  private async getCachedCategories(shopId: string): Promise<ServiceCategory[] | null> {
    try {
      const data = await AsyncStorage.getItem(`${STORAGE_KEY_CATEGORIES}_${shopId}`);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    return null;
  }
}

export const serviceRepository = new ServiceRepository();
