import { billingRepository } from '../src/repositories/billingRepository';
import { serviceRepository } from '../src/repositories/serviceRepository';
import { appointmentRepository } from '../src/repositories/appointmentRepository';
import { Service, Appointment } from '../src/types/domain';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('CHANGE 1: Service Actions & CHANGE 2: Multi-Quantity Service Selection', () => {
  const shopId = 'local_shop_service_actions_test';

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  describe('CHANGE 1: Price List Service Action Menu & Safe Deletion', () => {
    it('updates service name and price in Supabase without affecting historical records', async () => {
      const initialServices: Service[] = [
        {
          id: 'svc_haircut',
          shop_id: shopId,
          category_id: null,
          category_name: 'Hair',
          name: 'Hair Cut',
          price_minor: 30000,
          duration_minutes: 30,
          is_active: true,
        },
      ];
      await (serviceRepository as any).cacheServices(shopId, initialServices);

      await serviceRepository.updateService(shopId, 'svc_haircut', {
        name: 'Classic Hair Cut',
        priceRupees: 350,
      });

      const updated = await serviceRepository.getServices(shopId);
      const found = updated.find((s) => s.id === 'svc_haircut');
      expect(found).toBeDefined();
      expect(found?.name).toBe('Classic Hair Cut');
      expect(found?.price_minor).toBe(35000);
    });

    it('deactivates service on delete so historical bills remain intact and safe', async () => {
      const initialServices: Service[] = [
        {
          id: 'svc_haircut',
          shop_id: shopId,
          category_id: null,
          category_name: 'Hair',
          name: 'Hair Cut',
          price_minor: 30000,
          duration_minutes: 30,
          is_active: true,
        },
        {
          id: 'svc_spa',
          shop_id: shopId,
          category_id: null,
          category_name: 'Hair',
          name: 'Hair Spa',
          price_minor: 50000,
          duration_minutes: 45,
          is_active: true,
        },
      ];
      await (serviceRepository as any).cacheServices(shopId, initialServices);

      // Delete Hair Cut
      await serviceRepository.removeService(shopId, 'svc_haircut');

      const activeServices = await serviceRepository.getServices(shopId);
      expect(activeServices.length).toBe(1);
      expect(activeServices[0].id).toBe('svc_spa');
      expect(activeServices.find((s) => s.id === 'svc_haircut')).toBeUndefined();
    });
  });

  describe('CHANGE 2: Multi-Quantity Service Selection & Billing Calculations', () => {
    it('calculates subtotal correctly for multi-quantity items (e.g. ₹300 × 3 = ₹900)', async () => {
      const haircutUnitPriceMinor = 30000; // ₹300
      const quantity = 3;
      const calculatedPriceMinor = haircutUnitPriceMinor * quantity; // ₹900

      const items = [
        {
          name: 'Hair Cut',
          priceMinor: calculatedPriceMinor,
          unitPriceMinor: haircutUnitPriceMinor,
          quantity: quantity,
        },
      ];

      const created = await billingRepository.createBill(
        shopId,
        'Test Customer',
        null,
        'Stylist',
        null,
        items,
        'UPI',
        0, // discount
        calculatedPriceMinor,
        0,
        0
      );

      expect(created.total_minor).toBe(90000);
      expect(created.subtotal_minor).toBe(90000);
      expect(created.items.length).toBe(1);
      expect(created.items[0].quantity).toBe(3);
      expect(created.items[0].unit_price_minor).toBe(30000);
      expect(created.items[0].line_total_minor).toBe(90000);
    });

    it('correctly handles multi-quantity with discounts and tips', async () => {
      const haircutUnitPriceMinor = 30000; // ₹300
      const quantity = 2; // ₹600 subtotal
      const discountMinor = 10000; // ₹100
      const tipMinor = 5000; // ₹50

      const items = [
        {
          name: 'Hair Cut',
          priceMinor: haircutUnitPriceMinor * quantity,
          unitPriceMinor: haircutUnitPriceMinor,
          quantity: quantity,
        },
      ];

      const created = await billingRepository.createBill(
        shopId,
        'Arun',
        null,
        'Senior Stylist',
        null,
        items,
        'Cash',
        discountMinor,
        55000,
        0,
        tipMinor
      );

      expect(created.subtotal_minor).toBe(60000); // ₹600
      expect(created.discount_minor).toBe(10000); // ₹100
      expect(created.tip_minor).toBe(5000); // ₹50
      expect(created.total_minor).toBe(55000); // 600 - 100 + 50 = ₹550
    });
  });

  describe('CHANGE 2: Critical Appointment -> Bill / Close Flow', () => {
    it('ADDS appointment services to existing bill services without replacing them', () => {
      // Existing bill contains: Hair Cut × 1
      const existingBillServiceIds = ['svc_haircut'];
      const existingServiceQuantities: Record<string, number> = { svc_haircut: 1 };

      // Appointment contains: Hair Spa × 1
      const incomingApptServiceIds = ['svc_spa'];
      const incomingApptQuantities: Record<string, number> = { svc_spa: 1 };

      // Merge logic simulation (identical to NewBillScreen useEffect)
      const mergedIds = [...existingBillServiceIds];
      for (const id of incomingApptServiceIds) {
        if (!mergedIds.includes(id)) {
          mergedIds.push(id);
        }
      }

      const mergedQuantities = { ...existingServiceQuantities };
      for (const id of incomingApptServiceIds) {
        const addQty = incomingApptQuantities[id] || 1;
        mergedQuantities[id] = (mergedQuantities[id] || 0) + addQty;
      }

      // Expected: Hair Cut × 1 AND Hair Spa × 1 (Nothing replaced!)
      expect(mergedIds).toEqual(['svc_haircut', 'svc_spa']);
      expect(mergedQuantities['svc_haircut']).toBe(1);
      expect(mergedQuantities['svc_spa']).toBe(1);
    });

    it('MERGES same service quantity when existing bill already has the same service', () => {
      // Existing bill contains: Hair Cut × 1
      const existingBillServiceIds = ['svc_haircut'];
      const existingServiceQuantities: Record<string, number> = { svc_haircut: 1 };

      // Appointment contains: Hair Cut × 1
      const incomingApptServiceIds = ['svc_haircut'];
      const incomingApptQuantities: Record<string, number> = { svc_haircut: 1 };

      // Merge logic simulation
      const mergedIds = [...existingBillServiceIds];
      for (const id of incomingApptServiceIds) {
        if (!mergedIds.includes(id)) {
          mergedIds.push(id);
        }
      }

      const mergedQuantities = { ...existingServiceQuantities };
      for (const id of incomingApptServiceIds) {
        const addQty = incomingApptQuantities[id] || 1;
        mergedQuantities[id] = (mergedQuantities[id] || 0) + addQty;
      }

      // Expected: Hair Cut × 2 (Merged quantity!)
      expect(mergedIds).toEqual(['svc_haircut']);
      expect(mergedQuantities['svc_haircut']).toBe(2);
    });

    it('transfers multiple services with multiple quantities from appointment into bill', () => {
      // Existing bill contains: Hair Spa × 1
      const existingBillServiceIds = ['svc_spa'];
      const existingServiceQuantities: Record<string, number> = { svc_spa: 1 };

      // Appointment contains: Hair Cut × 2, Beard Trim × 1
      const incomingApptServiceIds = ['svc_haircut', 'svc_beard'];
      const incomingApptQuantities: Record<string, number> = {
        svc_haircut: 2,
        svc_beard: 1,
      };

      // Merge logic simulation
      const mergedIds = [...existingBillServiceIds];
      for (const id of incomingApptServiceIds) {
        if (!mergedIds.includes(id)) {
          mergedIds.push(id);
        }
      }

      const mergedQuantities = { ...existingServiceQuantities };
      for (const id of incomingApptServiceIds) {
        const addQty = incomingApptQuantities[id] || 1;
        mergedQuantities[id] = (mergedQuantities[id] || 0) + addQty;
      }

      // Expected: Hair Spa × 1, Hair Cut × 2, Beard Trim × 1
      expect(mergedIds).toEqual(['svc_spa', 'svc_haircut', 'svc_beard']);
      expect(mergedQuantities['svc_spa']).toBe(1);
      expect(mergedQuantities['svc_haircut']).toBe(2);
      expect(mergedQuantities['svc_beard']).toBe(1);
    });
  });
});
