import { supabase } from '../lib/supabase';

export interface ShopBillRowsResult {
  data: any[] | null;
  error: { message?: string; code?: string } | null;
}

const inFlight = new Map<string, Promise<ShopBillRowsResult>>();

/**
 * Every bill of a shop with its customer, stylist, items and payments.
 *
 * The bills list, the customer totals and the staff screen all need the same rows, and the app asks for
 * them in the same instant at start-up. Asking for the rows once and sharing the answer cuts the download
 * to a third. Only requests made in the same tick share an answer, so a read that starts after a bill was
 * saved always goes back to the server and can never get older rows. Callers must not change the rows.
 */
export function fetchShopBillRows(shopId: string): Promise<ShopBillRowsResult> {
  const existing = inFlight.get(shopId);
  if (existing) return existing;

  // A Supabase query sends a new request every time it is awaited, so turn it into one real promise first
  const request = Promise.resolve(
    supabase
    .from('bills')
    .select(`
      *,
      customers(name),
      staff(name),
      bill_items(*),
      payments(*)
    `)
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
  ) as Promise<ShopBillRowsResult>;

  inFlight.set(shopId, request);
  setTimeout(() => inFlight.delete(shopId), 0);
  return request;
}
