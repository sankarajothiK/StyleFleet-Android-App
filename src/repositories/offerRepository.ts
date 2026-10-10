import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Offer } from '../types/domain';
import { assertSaved, isRemoteShop } from '../utils/persist';

const STORAGE_KEY_OFFERS = '@salon_os_offers_cache';

export class OfferRepository {
  /**
   * Fetch real promotional offers for a shop from Supabase
   */
  async getOffers(shopId: string): Promise<Offer[]> {
    try {
      const { data, error } = await supabase
        .from('offers')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const mapped: Offer[] = data.map((o) => ({
          id: o.id,
          shop_id: o.shop_id,
          name: o.name,
          description: o.description,
          discount_type: o.discount_type as any,
          discount_value: o.discount_value,
          conditions: (o.conditions as any) || {},
          is_active: o.is_active,
        }));
        await this.cacheOffers(shopId, mapped);
        return mapped;
      }
    } catch {
      console.warn('OfferRepository: Offline fallback active');
    }

    const cached = await this.getCachedOffers(shopId);
    return cached || [];
  }

  /**
   * Add a real promotional offer and persist to Supabase
   */
  async addOffer(
    shopId: string,
    name: string,
    description: string,
    discountType: 'percentage' | 'fixed',
    discountValue: number,
    conditions: Record<string, any> = {}
  ): Promise<Offer> {
    const newOffer: Offer = {
      id: `offer_${Date.now()}`,
      shop_id: shopId,
      name,
      description,
      discount_type: discountType,
      discount_value: discountValue,
      conditions,
      is_active: true,
    };

    if (isRemoteShop(shopId)) {
      const result = await supabase
        .from('offers')
        .insert({
          shop_id: shopId,
          name,
          description,
          discount_type: discountType,
          discount_value: discountValue,
          conditions,
          is_active: true,
        } as any)
        .select()
        .single();
      assertSaved(result, 'the offer');
      if (result.data) {
        newOffer.id = result.data.id;
      }
    }

    const current = (await this.getCachedOffers(shopId)) || [];
    const updated = [...current, newOffer];
    await this.cacheOffers(shopId, updated);
    return newOffer;
  }

  /**
   * Toggle offer active state
   */
  async toggleOffer(shopId: string, offerId: string): Promise<boolean> {
    const list = (await this.getCachedOffers(shopId)) || [];
    const target = list.find((o) => o.id === offerId);
    if (!target) return false;

    const nextState = !target.is_active;

    if (isRemoteShop(shopId)) {
      const result = await supabase
        .from('offers')
        .update({ is_active: nextState } as any)
        .eq('id', offerId)
        .eq('shop_id', shopId)
        .select('id');
      assertSaved(result, 'the offer');
      if (!result.data || result.data.length === 0) {
        throw new Error('This offer was not found on the server, so the change was not saved.');
      }
    }

    target.is_active = nextState;
    await this.cacheOffers(shopId, list);
    return nextState;
  }

  async updateOffer(
    shopId: string,
    offerId: string,
    updates: { name?: string; description?: string; discount_value?: number }
  ): Promise<void> {
    if (isRemoteShop(shopId)) {
      const result = await supabase
        .from('offers')
        .update(updates as any)
        .eq('id', offerId)
        .eq('shop_id', shopId)
        .select('id');
      assertSaved(result, 'the offer');
      if (!result.data || result.data.length === 0) {
        throw new Error('This offer was not found on the server, so the change was not saved.');
      }
    }

    const current = (await this.getCachedOffers(shopId)) || [];
    const updated = current.map((o) => (o.id === offerId ? { ...o, ...updates } : o));
    await this.cacheOffers(shopId, updated);
  }

  async removeOffer(shopId: string, offerId: string): Promise<void> {
    if (isRemoteShop(shopId)) {
      const result = await supabase
        .from('offers')
        .delete()
        .eq('id', offerId)
        .eq('shop_id', shopId);
      assertSaved(result, 'the offer removal');
    }

    const current = (await this.getCachedOffers(shopId)) || [];
    const updated = current.filter((o) => o.id !== offerId);
    await this.cacheOffers(shopId, updated);
  }

  private async cacheOffers(shopId: string, offers: Offer[]): Promise<void> {
    await AsyncStorage.setItem(`${STORAGE_KEY_OFFERS}_${shopId}`, JSON.stringify(offers));
  }

  private async getCachedOffers(shopId: string): Promise<Offer[] | null> {
    try {
      const data = await AsyncStorage.getItem(`${STORAGE_KEY_OFFERS}_${shopId}`);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    return null;
  }
}

export const offerRepository = new OfferRepository();
