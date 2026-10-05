import { Bill, Expense, StaffMember } from '../src/types/domain';

describe('Reports & Team Stylist Performance Logic', () => {
  const mockStaff: StaffMember[] = [
    {
      id: 'staff_1',
      shop_id: 'test_shop',
      name: 'Rohan Sharma',
      role: 'Senior Stylist',
      phone: '9876543210',
      rating: '4.8',
      rebook_rate: '85%',
      is_active: true,
      revenue_minor: 0,
      service_count: 0,
      chair_utilization: '80%',
      target_amount_minor: 500000, // 5,000 INR
    },
    {
      id: 'staff_2',
      shop_id: 'test_shop',
      name: 'Priya Patel',
      role: 'Hair Colorist',
      phone: '9876543211',
      rating: '4.9',
      rebook_rate: '90%',
      is_active: true,
      revenue_minor: 0,
      service_count: 0,
      chair_utilization: '85%',
      target_amount_minor: 800000, // 8,000 INR
    },
  ];

  const mockBills: Bill[] = [
    {
      id: 'b1',
      shop_id: 'test_shop',
      invoice_number: 'INV-001',
      customer_id: 'c1',
      customer_name: 'Aditi Rao',
      staff_id: 'staff_1',
      staff_name: 'Rohan Sharma',
      items: [
        {
          id: 'i1',
          service_id: 's1',
          service_name_snapshot: 'Haircut',
          quantity: 1,
          unit_price_minor: 100000,
          discount_minor: 0,
          tax_minor: 0,
          line_total_minor: 100000,
          staff_id: 'staff_1',
        },
      ],
      subtotal_minor: 100000,
      discount_minor: 0,
      tax_minor: 0,
      total_minor: 100000, // 1,000 INR
      paid_amount_minor: 100000,
      due_amount_minor: 0,
      status: 'paid',
      payment_method: 'UPI',
      notes: null,
      issued_at: '2026-09-28T10:00:00.000Z',
      created_at: '2026-09-28T10:00:00.000Z',
    },
    {
      id: 'b2',
      shop_id: 'test_shop',
      invoice_number: 'INV-002',
      customer_id: 'c2',
      customer_name: 'Karan Mehra',
      staff_id: 'staff_2',
      staff_name: 'Priya Patel',
      items: [
        {
          id: 'i2',
          service_id: 's2',
          service_name_snapshot: 'Hair Color',
          quantity: 1,
          unit_price_minor: 300000,
          discount_minor: 0,
          tax_minor: 0,
          line_total_minor: 300000,
          staff_id: 'staff_2',
        },
      ],
      subtotal_minor: 300000,
      discount_minor: 0,
      tax_minor: 0,
      total_minor: 300000, // 3,000 INR
      paid_amount_minor: 200000,
      due_amount_minor: 100000,
      status: 'pending',
      payment_method: 'Cash',
      notes: null,
      issued_at: '2026-09-28T14:00:00.000Z',
      created_at: '2026-09-28T14:00:00.000Z',
    },
    {
      id: 'b3',
      shop_id: 'test_shop',
      invoice_number: 'INV-003',
      customer_id: 'c3',
      customer_name: 'Sneha Kapoor',
      staff_id: 'staff_1',
      staff_name: 'Rohan Sharma',
      items: [
        {
          id: 'i3',
          service_id: 's3',
          service_name_snapshot: 'Beard Trim',
          quantity: 1,
          unit_price_minor: 50000,
          discount_minor: 0,
          tax_minor: 0,
          line_total_minor: 50000,
          staff_id: 'staff_1',
        },
      ],
      subtotal_minor: 50000,
      discount_minor: 0,
      tax_minor: 0,
      total_minor: 50000, // 500 INR
      paid_amount_minor: 50000,
      due_amount_minor: 0,
      status: 'paid',
      payment_method: 'UPI',
      notes: null,
      issued_at: '2026-09-29T11:00:00.000Z',
      created_at: '2026-09-29T11:00:00.000Z',
    },
    {
      id: 'b4_deleted',
      shop_id: 'test_shop',
      invoice_number: 'INV-004',
      customer_id: 'c4',
      customer_name: 'Deleted Client',
      staff_id: 'staff_1',
      staff_name: 'Rohan Sharma',
      items: [
        {
          id: 'i4',
          service_id: 's4',
          service_name_snapshot: 'Cancelled Service',
          quantity: 1,
          unit_price_minor: 200000,
          discount_minor: 0,
          tax_minor: 0,
          line_total_minor: 200000,
          staff_id: 'staff_1',
        },
      ],
      subtotal_minor: 200000,
      discount_minor: 0,
      tax_minor: 0,
      total_minor: 200000,
      status: 'deleted',
      payment_method: 'Cash',
      notes: null,
      issued_at: '2026-09-29T12:00:00.000Z',
      created_at: '2026-09-29T12:00:00.000Z',
      deleted_at: '2026-09-29T12:30:00.000Z',
    },
  ];

  const mockExpenses: Expense[] = [
    {
      id: 'exp1',
      shop_id: 'test_shop',
      category_id: null,
      category_name: 'Supplies',
      note: 'Shampoo stock',
      amount_minor: 50000, // 500 INR
      payment_method: 'Cash',
      expense_date: '2026-09-28',
      created_at: '2026-09-28T16:00:00.000Z',
    },
    {
      id: 'exp2',
      shop_id: 'test_shop',
      category_id: null,
      category_name: 'Refreshments',
      note: 'Tea & Coffee',
      amount_minor: 20000, // 200 INR
      payment_method: 'UPI',
      expense_date: '2026-09-29',
      created_at: '2026-09-29T10:00:00.000Z',
    },
  ];

  describe('Day-Wise Breakdown Calculations for Reports', () => {
    it('aggregates daily sales, paid, dues, expenses, and net profit correctly', () => {
      const activeBills = mockBills.filter((b) => b.status !== 'deleted');

      const map = new Map<string, any>();
      for (const b of activeBills) {
        const d = new Date(b.issued_at || b.created_at || '');
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!map.has(dateKey)) {
          map.set(dateKey, {
            dateKey,
            billsCount: 0,
            salesMinor: 0,
            paidMinor: 0,
            dueMinor: 0,
            expensesMinor: 0,
            netProfitMinor: 0,
          });
        }
        const row = map.get(dateKey);
        row.billsCount += 1;
        row.salesMinor += b.total_minor || 0;
        row.paidMinor += b.paid_amount_minor || 0;
        row.dueMinor += b.due_amount_minor || 0;
      }

      for (const ex of mockExpenses) {
        const d = new Date(ex.expense_date || ex.created_at || '');
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!map.has(dateKey)) {
          map.set(dateKey, {
            dateKey,
            billsCount: 0,
            salesMinor: 0,
            paidMinor: 0,
            dueMinor: 0,
            expensesMinor: 0,
            netProfitMinor: 0,
          });
        }
        const row = map.get(dateKey);
        row.expensesMinor += ex.amount_minor || 0;
      }

      const rows = Array.from(map.values()).map((r) => ({
        ...r,
        netProfitMinor: r.salesMinor - r.expensesMinor,
      }));

      // Day 1: 2026-09-28
      const day28 = rows.find((r) => r.dateKey === '2026-09-28');
      expect(day28).toBeDefined();
      expect(day28.billsCount).toBe(2);
      expect(day28.salesMinor).toBe(400000); // 1,000 + 3,000 = 4,000 INR
      expect(day28.paidMinor).toBe(300000); // 1,000 + 2,000 = 3,000 INR
      expect(day28.dueMinor).toBe(100000); // 1,000 INR due
      expect(day28.expensesMinor).toBe(50000); // 500 INR
      expect(day28.netProfitMinor).toBe(350000); // 4,000 - 500 = 3,500 INR

      // Day 2: 2026-09-29
      const day29 = rows.find((r) => r.dateKey === '2026-09-29');
      expect(day29).toBeDefined();
      expect(day29.billsCount).toBe(1); // Deleted bill excluded
      expect(day29.salesMinor).toBe(50000); // 500 INR
      expect(day29.paidMinor).toBe(50000);
      expect(day29.dueMinor).toBe(0);
      expect(day29.expensesMinor).toBe(20000); // 200 INR
      expect(day29.netProfitMinor).toBe(30000); // 500 - 200 = 300 INR
    });
  });

  describe('Team Stylist Performance Calculations', () => {
    it('accurately computes revenue, services delivered, target %, and sales contribution % for each stylist', () => {
      const activeBills = mockBills.filter((b) => b.status !== 'deleted');
      const totalSalonSales = activeBills.reduce((acc, b) => acc + (b.total_minor || 0), 0);
      expect(totalSalonSales).toBe(450000); // 4,500 INR

      const perf = mockStaff.map((s) => {
        const stylistBills = activeBills.filter((b) => b.staff_id === s.id);
        const salesMinor = stylistBills.reduce((acc, b) => acc + (b.total_minor || 0), 0);
        const servicesCount = stylistBills.reduce((acc, b) => acc + (b.items ? b.items.length : 1), 0);
        const targetPct = s.target_amount_minor ? Math.round((salesMinor / s.target_amount_minor) * 100) : 0;
        const sharePct = totalSalonSales > 0 ? Math.round((salesMinor / totalSalonSales) * 100) : 0;

        return {
          id: s.id,
          name: s.name,
          role: s.role,
          phone: s.phone,
          servicesCount,
          salesMinor,
          targetPct,
          sharePct,
        };
      });

      // Rohan: 1,000 + 500 = 1,500 INR (150,000 paise). Target = 5,000 INR -> 30% achieved. Share = 1,500 / 4,500 = 33%
      const rohan = perf.find((p) => p.name === 'Rohan Sharma');
      expect(rohan).toBeDefined();
      expect(rohan!.salesMinor).toBe(150000);
      expect(rohan!.servicesCount).toBe(2);
      expect(rohan!.targetPct).toBe(30);
      expect(rohan!.sharePct).toBe(33);

      // Priya: 3,000 INR (300,000 paise). Target = 8,000 INR -> 38% achieved. Share = 3,000 / 4,500 = 67%
      const priya = perf.find((p) => p.name === 'Priya Patel');
      expect(priya).toBeDefined();
      expect(priya!.salesMinor).toBe(300000);
      expect(priya!.servicesCount).toBe(1);
      expect(priya!.targetPct).toBe(38);
      expect(priya!.sharePct).toBe(67);
    });
  });
});
