import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WhatsAppAudience {
  id: number;
  label: string;
  count: number;
}

export const WHATSAPP_AUDIENCES: WhatsAppAudience[] = [
  { id: 0, label: 'All customers', count: 312 },
  { id: 1, label: 'MVP · starred', count: 28 },
  { id: 2, label: 'Beard regulars', count: 96 },
  { id: 3, label: 'Not seen in 60 days', count: 54 },
];

export interface FestivalOfferTemplate {
  id: string;
  category: string;
  title: string;
  defaultOffer: string;
  defaultValidity: string;
  templateBody: string;
}

export const FESTIVAL_OFFER_TEMPLATES: FestivalOfferTemplate[] = [
  {
    id: 'diwali',
    category: 'Diwali offer',
    title: 'Diwali Festive Sparkle',
    defaultOffer: 'Flat 20% OFF',
    defaultValidity: 'Valid till Diwali night',
    templateBody: '✨ Happy Diwali, [name]! Light up your look with [offer] on all hair & spa packages at [shop]. [validity]. Reply BOOK to reserve your festive chair!',
  },
  {
    id: 'pongal',
    category: 'Pongal offer',
    title: 'Pongal Harvest Glow',
    defaultOffer: 'Special ₹200 OFF',
    defaultValidity: 'Valid this festive week',
    templateBody: '🌾 Happy Pongal, [name]! Celebrate the harvest festival with style. Enjoy [offer] on traditional styling & grooming at [shop]. [validity]. Reply YES to book your slot!',
  },
  {
    id: 'new_year',
    category: 'New Year offer',
    title: 'New Year Fresh Look',
    defaultOffer: 'Flat 25% OFF',
    defaultValidity: 'Valid till Jan 10',
    templateBody: '🎉 Happy New Year, [name]! Welcome the new year with a fresh makeover. Get [offer] across all grooming services at [shop]. [validity]. Reply BOOK to lock your spot!',
  },
  {
    id: 'christmas',
    category: 'Christmas offer',
    title: 'Christmas Joy Glow',
    defaultOffer: 'Buy 1 Get 1 Free on Spa',
    defaultValidity: 'Valid till Dec 26',
    templateBody: '🎄 Merry Christmas, [name]! Pamper yourself with holiday luxury. Enjoy [offer] at [shop]. [validity]. Reply BOOK to confirm your appointment!',
  },
  {
    id: 'festival_general',
    category: 'Festival offer',
    title: 'Festive Season Special',
    defaultOffer: 'Flat 20% OFF',
    defaultValidity: 'Limited festive days only',
    templateBody: '🌟 Festive Special, [name]! Enjoy [offer] on your favorite services at [shop]. [validity]. Show this message to claim your discount!',
  },
  {
    id: 'birthday',
    category: 'Birthday offer',
    title: 'Birthday Pampering',
    defaultOffer: 'Complimentary Styling + 20% OFF',
    defaultValidity: 'Valid during your birthday week',
    templateBody: '🎂 Happy Birthday, [name]! Everyone at [shop] wishes you a wonderful year ahead. Enjoy [offer] this week. Just show this message at the desk!',
  },
  {
    id: 'anniversary',
    category: 'Anniversary offer',
    title: 'Anniversary Celebration',
    defaultOffer: 'Couple / Luxury Combo at ₹499',
    defaultValidity: 'Valid this month',
    templateBody: '🥂 Happy Anniversary, [name]! Celebrate your special milestone with [offer] at [shop]. [validity]. Reply to book your celebration slot!',
  },
  {
    id: 'weekend',
    category: 'Weekend offer',
    title: 'Weekend Recharge Combo',
    defaultOffer: 'Free Beard Trim with Haircut',
    defaultValidity: 'Valid this Fri - Sun',
    templateBody: '⚡ Weekend Special, [name]! Recharge your grooming this weekend. Enjoy [offer] at [shop]. [validity]. Reply BOOK to grab your chair!',
  },
  {
    id: 'special',
    category: 'Special salon offer',
    title: 'Exclusive Salon Privilege',
    defaultOffer: 'Flat ₹150 OFF',
    defaultValidity: 'Valid for next 5 days',
    templateBody: '👑 Exclusive Salon Privilege: Hi [name], enjoy [offer] on any hair, beard, or facial service at [shop]. [validity]. Reply BOOK to confirm!',
  },
  {
    id: 'custom',
    category: 'Custom offer',
    title: 'Personalized Special Offer',
    defaultOffer: 'Special Discount',
    defaultValidity: 'Valid this week',
    templateBody: 'Hello [name]! Exclusive offer from [shop]: [offer] exclusively tailored for you. [validity]. Reply BOOK and we’ll reserve your chair.',
  },
];

export const WHATSAPP_TEMPLATES: Record<string, string> = {
  'Diwali offer':
    '✨ Happy Diwali, [name]! Light up your look with [offer] on all hair & spa packages at [shop]. Valid this festive week. Reply BOOK to reserve your festive chair!',
  'Pongal offer':
    '🌾 Happy Pongal, [name]! Celebrate the harvest festival with style. Enjoy [offer] on traditional styling & grooming at [shop]. Reply YES to book your slot!',
  'New Year offer':
    '🎉 Happy New Year, [name]! Welcome the new year with a fresh makeover. Get [offer] across all grooming services at [shop]. Reply BOOK to lock your spot!',
  'Christmas offer':
    '🎄 Merry Christmas, [name]! Pamper yourself with holiday luxury. Enjoy [offer] at [shop]. Reply BOOK to confirm your appointment!',
  'Festival offer':
    '🌟 Festive Special, [name]! Enjoy [offer] on your favorite services at [shop]. Show this message to claim your discount!',
  'Birthday offer':
    '🎂 Happy birthday, [name]! From everyone at [shop] — [offer] on any service this week. Just show this message at the desk.',
  'Anniversary offer':
    '🥂 Happy Anniversary, [name]! Celebrate your special milestone with [offer] at [shop]. Reply to book your celebration slot!',
  'Weekend offer':
    '⚡ Weekend Special, [name]! Recharge your grooming this weekend with [offer] at [shop]. Reply BOOK to grab your chair!',
  'Special salon offer':
    '👑 Exclusive Salon Privilege: Hi [name], enjoy [offer] on any hair, beard, or facial service at [shop]. Reply BOOK to confirm!',
  'Monthly offer':
    'Hi [name] — [offer] at [shop] this month: beard colour free with any haircut, Mon–Wed. Reply BOOK and we’ll hold your chair.',
  'Rebook nudge':
    'Hi [name], it’s been a while. Your last cut at [shop] was 6 weeks ago — shall we keep your usual Saturday slot? Reply YES and we’ll confirm.',
};

export class WhatsAppRepository {
  getAudiences(): WhatsAppAudience[] {
    return WHATSAPP_AUDIENCES;
  }

  getTemplates(): Record<string, string> {
    return WHATSAPP_TEMPLATES;
  }

  getFestivalTemplates(): FestivalOfferTemplate[] {
    return FESTIVAL_OFFER_TEMPLATES;
  }

  renderPreview(
    templateBody: string,
    customerName: string,
    shopName: string,
    offer = '20% off',
    validity = 'Valid this week'
  ): string {
    return templateBody
      .replace(/\[name\]/g, customerName || 'Valued Customer')
      .replace(/\[shop\]/g, shopName || 'Our Salon')
      .replace(/\[offer\]/g, offer || 'Special Offer')
      .replace(/\[validity\]/g, validity ? (validity.startsWith('Valid') ? validity : `Valid: ${validity}`) : '');
  }
}

export const whatsappRepository = new WhatsAppRepository();
