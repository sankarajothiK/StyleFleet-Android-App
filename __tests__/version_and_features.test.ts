import { compareVersions } from '../src/services/versionService';
import { buildWhatsAppBillMessage } from '../src/utils/whatsappFormatter';
import { Bill } from '../src/types/domain';

describe('Version Service — Semantic Version Comparison', () => {
  it('correctly compares equal versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.1', '1.0.1')).toBe(0);
    expect(compareVersions('2.4.15', '2.4.15')).toBe(0);
  });

  it('correctly detects newer versions', () => {
    expect(compareVersions('1.0.2', '1.0.1')).toBe(1);
    expect(compareVersions('1.1.0', '1.0.9')).toBe(1);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
  });

  it('correctly detects older versions requiring mandatory update', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    expect(compareVersions('1.0.1', '1.1.0')).toBe(-1);
    expect(compareVersions('0.9.8', '1.0.0')).toBe(-1);
  });

  it('handles irregular and missing parts gracefully', () => {
    expect(compareVersions('1', '1.0.0')).toBe(0);
    expect(compareVersions('1.1', '1.1.0')).toBe(0);
    expect(compareVersions('1.2', '1.1.9')).toBe(1);
  });
});

describe('WhatsApp Formatter — Bill Template & Social Links', () => {
  const mockBill: Bill = {
    id: 'bill_123',
    shop_id: 'shop_abc',
    customer_id: 'cust_1',
    customer_name: 'Priya Sharma',
    staff_id: 'staff_1',
    staff_name: 'Pooja',
    invoice_number: 'INV-0042',
    status: 'paid',
    subtotal_minor: 100000,
    discount_minor: 10000,
    tax_minor: 0,
    total_minor: 90000,
    paid_amount_minor: 90000,
    due_amount_minor: 0,
    payment_method: 'upi',
    notes: null,
    issued_at: new Date('2026-09-30T10:00:00Z').toISOString(),
    items: [
      {
        id: 'item_1',
        service_id: 'srv_1',
        service_name_snapshot: 'Hair Cut & Styling',
        quantity: 1,
        unit_price_minor: 60000,
        discount_minor: 0,
        tax_minor: 0,
        line_total_minor: 60000,
        staff_id: 'staff_1',
      },
      {
        id: 'item_2',
        service_id: 'srv_2',
        service_name_snapshot: 'Hair Spa',
        quantity: 1,
        unit_price_minor: 40000,
        discount_minor: 10000,
        tax_minor: 0,
        line_total_minor: 30000,
        staff_id: 'staff_1',
      },
    ],
    created_at: new Date('2026-09-30T10:00:00Z').toISOString(),
  };

  it('formats simplified bill message with customer greeting, salon name, amount paid, and no services or invoice number', () => {
    const msg = buildWhatsAppBillMessage({
      bill: mockBill,
      shopName: 'StyleFleet Luxury Salon',
      customerName: 'Priya Sharma',
    });

    expect(msg).toContain('StyleFleet Luxury Salon');
    expect(msg).toContain('Hi Priya Sharma 👋,');
    expect(msg).toContain('Thank you for choosing StyleFleet Luxury Salon! ✨');
    expect(msg).toContain('💰 Total Amount: ₹900');
    expect(msg).toContain('✅ Payment Status: PAID');
    // Must NOT contain invoice number or services list in WhatsApp text
    expect(msg).not.toContain('Hair Cut & Styling');
    expect(msg).not.toContain('Invoice:');
  });

  it('includes PDF download link when pdfDownloadUrl is provided', () => {
    const msg = buildWhatsAppBillMessage({
      bill: mockBill,
      shopName: 'StyleFleet Salon',
      customerName: 'Priya Sharma',
      pdfDownloadUrl: 'https://scgokpcoyfewrtrwqxpu.supabase.co/storage/v1/object/public/invoices/shop_abc/INV-0042.pdf',
    });

    expect(msg).toContain('📄 View / Download your Bill:');
    expect(msg).toContain('https://scgokpcoyfewrtrwqxpu.supabase.co/storage/v1/object/public/invoices/shop_abc/INV-0042.pdf');
  });

  it('handles partial payment dues clearly in the message', () => {
    const partialBill: Bill = {
      ...mockBill,
      status: 'partially_paid',
      paid_amount_minor: 50000,
      due_amount_minor: 40000,
      payment_method: 'split',
    };

    const msg = buildWhatsAppBillMessage({
      bill: partialBill,
      shopName: 'StyleFleet Salon',
      customerName: 'Priya Sharma',
      upiId: 'salon@upi',
    });

    expect(msg).toContain('💵 Total Paid: ₹500');
    expect(msg).toContain('🔴 Balance Due: ₹400');
    expect(msg).toContain('⚠️ Payment Status: PARTIALLY PAID');
    expect(msg).toContain('💳 UPI ID: salon@upi');
  });
});

describe('SvgIcons — Social Media & Action Icons', () => {
  it('exports valid Instagram, Facebook, YouTube, Website, and MoreVertical icons', async () => {
    const { InstagramIcon, FacebookIcon, YouTubeIcon, WebsiteIcon, MoreVerticalIcon } = await import('../src/components/common/SvgIcons');
    expect(InstagramIcon).toBeDefined();
    expect(FacebookIcon).toBeDefined();
    expect(YouTubeIcon).toBeDefined();
    expect(WebsiteIcon).toBeDefined();
    expect(MoreVerticalIcon).toBeDefined();

    // Verify icons can be instantiated
    const insta = InstagramIcon({ size: 24, color: '#E1306C' });
    const fb = FacebookIcon({ size: 24, color: '#1877F2' });
    const yt = YouTubeIcon({ size: 24, color: '#FF0000' });
    const web = WebsiteIcon({ size: 24, color: '#0284C7' });
    const more = MoreVerticalIcon({ size: 20, color: '#666' });

    expect(insta).toBeDefined();
    expect(fb).toBeDefined();
    expect(yt).toBeDefined();
    expect(web).toBeDefined();
    expect(more).toBeDefined();
  });
});
