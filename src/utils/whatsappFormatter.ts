import { Bill, SocialLinks } from '../types/domain';
import { inrFromMinor } from './format';

export interface WhatsAppBillParams {
  shopName: string;
  shopAddress?: string | null;
  shopPhone?: string | null;
  customerName?: string | null;
  bill: Bill;
  pdfDownloadUrl?: string | null;
  socialLinks?: SocialLinks | null;
  upiId?: string | null;
}

/**
 * Normalizes user-entered URLs into full https:// links.
 */
export function normalizeSocialUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Formats configured social media links into a clean, customer-facing list.
 * Only non-empty links are included. Returns empty string if no valid links exist.
 */
export function formatSocialLinksForWhatsApp(socialLinks?: SocialLinks | null): string {
  if (!socialLinks) return '';

  const validEntries: string[] = [];

  const insta = normalizeSocialUrl(socialLinks.instagram);
  if (insta) validEntries.push(`Instagram: ${insta}`);

  const fb = normalizeSocialUrl(socialLinks.facebook);
  if (fb) validEntries.push(`Facebook: ${fb}`);

  const yt = normalizeSocialUrl(socialLinks.youtube);
  if (yt) validEntries.push(`YouTube: ${yt}`);

  const web = normalizeSocialUrl(socialLinks.website);
  if (web) validEntries.push(`Website: ${web}`);

  return validEntries.join('\n');
}

/**
 * Builds the official StyleFleet WhatsApp bill message template.
 *
 * FULLY PAID:
 * Hi [Customer Name] 👋,
 * Thank you for choosing [Shop Name]! ✨
 * 💰 Total Amount: ₹[Total Amount]
 * ✅ Payment Status: PAID ([Payment Method])
 * 📄 View / Download your Bill:
 * [Bill PDF Link]
 * 📞 For bookings: [Booking Phone Number]
 * We look forward to seeing you again! ❤️
 *
 * PARTIALLY PAID:
 * Hi [Customer Name] 👋,
 * Thank you for choosing [Shop Name]! ✨
 * 💰 Total Amount: ₹[Total Amount]
 * 💵 Total Paid: ₹[Paid Amount]
 * 🔴 Balance Due: ₹[Balance Amount]
 * ⚠️ Payment Status: PARTIALLY PAID ([Payment Method])
 * 📄 View / Download your Bill:
 * [Bill PDF Link]
 * 💳 UPI ID: [UPI ID]
 * 📞 For bookings: [Booking Phone Number]
 * We look forward to seeing you again! ❤️
 */
export function buildWhatsAppBillMessage(params: WhatsAppBillParams): string {
  const {
    shopName,
    shopPhone,
    customerName,
    bill,
    pdfDownloadUrl,
    socialLinks,
    upiId,
  } = params;

  const cleanShop = (shopName || 'StyleFleet Salon').trim();
  const rawCustomer = (customerName || bill.customer_name || '').trim();
  const resolvedCustomer = rawCustomer ? rawCustomer : 'Customer';

  // Format booking phone number
  const cleanPhone = (shopPhone || '').replace(/\D/g, '').slice(-10);
  const bookingPhone = cleanPhone
    ? `+91 ${cleanPhone}`
    : (shopPhone && shopPhone.trim() ? shopPhone.trim() : cleanShop);

  // Financial calculations
  const totalInr = Math.round((bill.total_minor || 0) / 100).toLocaleString('en-IN');
  const paidMinor = bill.paid_amount_minor ?? (bill.status === 'paid' ? bill.total_minor : 0);
  const paidInr = Math.round(paidMinor / 100).toLocaleString('en-IN');
  const dueMinor = bill.due_amount_minor ?? Math.max(0, (bill.total_minor || 0) - paidMinor);
  const dueInr = Math.round(dueMinor / 100).toLocaleString('en-IN');

  // Payment method
  const paymentMethod = (bill.payment_method || 'UPI').trim();

  // PDF Short Link
  const cleanNumber = (bill.invoice_number || 'INV').replace(/[^a-zA-Z0-9_-]/g, '_');
  const shortId = bill.id ? bill.id.slice(0, 4) : '';
  const fallbackShortUrl = shortId
    ? `https://stylefleet.tecstellar.com/b/${cleanNumber}_${shortId}.pdf`
    : `https://stylefleet.tecstellar.com/b/${cleanNumber}.pdf`;

  const effectivePdfUrl = pdfDownloadUrl && !pdfDownloadUrl.startsWith('file://')
    ? (pdfDownloadUrl.startsWith('http') ? pdfDownloadUrl : fallbackShortUrl)
    : (bill.pdf_url && bill.pdf_url.startsWith('http') ? bill.pdf_url : fallbackShortUrl);

  const isPartiallyPaid = dueMinor > 0 || bill.status === 'partially_paid' || bill.status === 'pending';

  let lines: string[] = [];

  if (!isPartiallyPaid) {
    // Template 1: FULLY PAID
    lines = [
      `Hi ${resolvedCustomer} 👋,`,
      ``,
      `Thank you for choosing ${cleanShop}! ✨`,
      ``,
      `💰 Total Amount: ₹${totalInr}`,
      `✅ Payment Status: PAID (${paymentMethod})`,
      ``,
      `📄 View / Download your Bill:`,
      effectivePdfUrl,
      ``,
      `📞 For bookings: ${bookingPhone}`,
      ``,
      `We look forward to seeing you again! ❤️`,
    ];
  } else {
    // Template 2: PARTIALLY PAID (Includes UPI ID for balance collection)
    const cleanUpi = (upiId || '').trim();
    lines = [
      `Hi ${resolvedCustomer} 👋,`,
      ``,
      `Thank you for choosing ${cleanShop}! ✨`,
      ``,
      `💰 Total Amount: ₹${totalInr}`,
      `💵 Total Paid: ₹${paidInr}`,
      `🔴 Balance Due: ₹${dueInr}`,
      `⚠️ Payment Status: PARTIALLY PAID (${paymentMethod})`,
      ``,
      `📄 View / Download your Bill:`,
      effectivePdfUrl,
      ``,
      `💳 UPI ID: ${cleanUpi || 'Available on request'}`,
      ``,
      `📞 For bookings: ${bookingPhone}`,
      ``,
      `We look forward to seeing you again! ❤️`,
    ];
  }

  // Optional social media section if configured
  const socialSection = formatSocialLinksForWhatsApp(socialLinks);
  if (socialSection) {
    lines.push(``, socialSection);
  }

  return lines.join('\n');
}
