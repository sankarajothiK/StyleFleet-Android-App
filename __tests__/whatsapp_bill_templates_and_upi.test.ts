import { buildWhatsAppBillMessage } from '../src/utils/whatsappFormatter';
import { Bill } from '../src/types/domain';
import { shopRepository } from '../src/repositories/shopRepository';

describe('WhatsApp Bill Templates & Salon UPI ID', () => {
  const baseBill: Bill = {
    id: 'bill-123',
    shop_id: 'shop-abc',
    customer_id: 'cust-456',
    customer_name: 'Priya Sharma',
    staff_id: 'staff-789',
    staff_name: 'Anjali',
    invoice_number: 'INV-101',
    status: 'paid',
    subtotal_minor: 150000,
    discount_minor: 0,
    tax_minor: 0,
    total_minor: 150000,
    paid_amount_minor: 150000,
    due_amount_minor: 0,
    notes: null,
    issued_at: new Date().toISOString(),
    payment_method: 'UPI',
    items: [],
  };

  test('Template 1: FULLY PAID bill message matches exact format with NO UPI ID', () => {
    const message = buildWhatsAppBillMessage({
      shopName: 'Glow Unisex Salon',
      shopPhone: '9876543210',
      customerName: 'Priya Sharma',
      bill: baseBill,
      pdfDownloadUrl: 'https://stylefleet.tecstellar.com/b/INV_101.pdf',
      upiId: 'glow@okaxis', // should be omitted for paid bills!
    });

    expect(message).toContain('Hi Priya Sharma 👋,');
    expect(message).toContain('Thank you for choosing Glow Unisex Salon! ✨');
    expect(message).toContain('💰 Total Amount: ₹1,500');
    expect(message).toContain('✅ Payment Status: PAID (UPI)');
    expect(message).toContain('📄 View / Download your Bill:');
    expect(message).toContain('https://stylefleet.tecstellar.com/b/INV_101.pdf');
    expect(message).toContain('📞 For bookings: +91 9876543210');
    expect(message).toContain('We look forward to seeing you again! ❤️');

    // CRITICAL: Full paid bills must NEVER show UPI ID
    expect(message).not.toContain('UPI ID:');
    expect(message).not.toContain('glow@okaxis');
  });

  test('Template 2: PARTIALLY PAID bill message includes paid, balance due, and UPI ID', () => {
    const partialBill: Bill = {
      ...baseBill,
      status: 'partially_paid',
      total_minor: 200000,
      paid_amount_minor: 50000,
      due_amount_minor: 150000,
      payment_method: 'Cash',
    };

    const message = buildWhatsAppBillMessage({
      shopName: 'Glow Unisex Salon',
      shopPhone: '9876543210',
      customerName: 'Rahul Verma',
      bill: partialBill,
      pdfDownloadUrl: 'https://stylefleet.tecstellar.com/b/INV_102.pdf',
      upiId: 'glowsalon@okhdfcbank',
    });

    expect(message).toContain('Hi Rahul Verma 👋,');
    expect(message).toContain('Thank you for choosing Glow Unisex Salon! ✨');
    expect(message).toContain('💰 Total Amount: ₹2,000');
    expect(message).toContain('💵 Total Paid: ₹500');
    expect(message).toContain('🔴 Balance Due: ₹1,500');
    expect(message).toContain('⚠️ Payment Status: PARTIALLY PAID (Cash)');
    expect(message).toContain('📄 View / Download your Bill:');
    expect(message).toContain('https://stylefleet.tecstellar.com/b/INV_102.pdf');
    expect(message).toContain('💳 UPI ID: glowsalon@okhdfcbank');
    expect(message).toContain('📞 For bookings: +91 9876543210');
    expect(message).toContain('We look forward to seeing you again! ❤️');
  });

  test('ShopRepository handles UPI ID persistence and retrieval cleanly', async () => {
    const dummyShop = {
      id: 'shop-test-upi',
      name: 'Elite Salon',
      owner_profile_id: null,
      logo_path: null,
      address: '123 Main Rd',
      city: 'Chennai',
      pin_code: '600001',
      gstin: null,
      phone: '9876543210',
      accent_color: '#D9A441',
      invoice_prefix: 'INV-',
      gst_rate: 18,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const enriched = await shopRepository.enrichShopRow({
      ...dummyShop,
      social_links: { upi_id: 'elitesalon@icici' },
    } as any);

    expect(enriched?.upi_id).toBe('elitesalon@icici');
  });
});
