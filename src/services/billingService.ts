import { billingRepository } from '../repositories/billingRepository';
import { Bill } from '../types/domain';

export interface CartCalculation {
  subtotalMinor: number;
  discountMinor: number;
  taxableMinor: number;
  taxMinor: number;
  tipMinor: number;
  totalMinor: number;
  colourSubtotalMinor: number;
  hasOffer: boolean;
  offerNote: string;
}

export class BillingService {
  calculateCart(
    items: { priceMinor: number; isColour?: boolean; name: string }[],
    discountOrOfferActive: boolean | number = 0,
    includeGst = typeof discountOrOfferActive === 'boolean' ? discountOrOfferActive : false,
    tipMinor = 0
  ): CartCalculation {
    const subtotalMinor = items.reduce((sum, item) => sum + item.priceMinor, 0);
    const colourSubtotalMinor = items
      .filter((item) => item.isColour)
      .reduce((sum, item) => sum + item.priceMinor, 0);

    let discountMinor = 0;
    if (typeof discountOrOfferActive === 'number') {
      discountMinor = Math.min(subtotalMinor, Math.max(0, discountOrOfferActive));
    } else if (discountOrOfferActive && colourSubtotalMinor > 0) {
      discountMinor = Math.round(colourSubtotalMinor * 0.2);
    }

    const safeTipMinor = Math.max(0, tipMinor || 0);
    const taxableMinor = subtotalMinor - discountMinor;
    const taxMinor = includeGst ? Math.round(taxableMinor * 0.18) : 0;
    const totalMinor = taxableMinor + taxMinor + safeTipMinor;

    const hasOffer = discountMinor > 0;
    const offerNote = hasOffer
      ? `Discount applied — ₹${Math.round(discountMinor / 100).toLocaleString('en-IN')} off.`
      : '';

    return {
      subtotalMinor,
      discountMinor,
      taxableMinor,
      taxMinor,
      tipMinor: safeTipMinor,
      totalMinor,
      colourSubtotalMinor,
      hasOffer,
      offerNote,
    };
  }

  async createBill(params: {
    shopId: string;
    customerName: string;
    customerId: string | null;
    staffName: string;
    staffId: string | null;
    items: { name: string; priceMinor: number; isColour?: boolean }[];
    paymentMethod: string;
    customDiscountMinor?: number;
    customTipMinor?: number;
    paidAmountMinor?: number;
    dueAmountMinor?: number;
  }): Promise<Bill> {
    if (params.items.length === 0) {
      throw new Error('Please select at least one service');
    }

    return billingRepository.createBill(
      params.shopId,
      params.customerName,
      params.customerId,
      params.staffName,
      params.staffId,
      params.items,
      params.paymentMethod,
      params.customDiscountMinor ?? 0,
      params.paidAmountMinor,
      params.dueAmountMinor,
      params.customTipMinor ?? 0
    );
  }

  async shareInvoiceWhatsApp(bill: Bill): Promise<void> {
    // Integration point for WhatsApp sharing
    return Promise.resolve();
  }
}

export const isOpeningDueBill = (b: { invoice_number?: string; notes?: string | null } | null | undefined): boolean => {
  if (!b) return false;
  if (b.invoice_number?.startsWith('DUE-')) return true;
  const n = (b.notes || '').toLowerCase();
  if (
    n.includes('opening balance') ||
    n.includes('adjusted customer due') ||
    n.includes('opening due balance') ||
    n.includes('customer opening due balance') ||
    n.includes('initial opening')
  ) {
    return true;
  }
  return false;
};

export const billingService = new BillingService();
