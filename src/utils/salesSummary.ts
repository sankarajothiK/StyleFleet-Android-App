import { Bill } from '../types/domain';
import { isOpeningDueBill } from '../services/billingService';

/** When a bill was made: created_at, else issued_at, else 0. */
export const getBillTimestamp = (b: Bill | null | undefined): number => {
  if (!b) return 0;
  if (b.created_at) {
    const t = new Date(b.created_at).getTime();
    if (!isNaN(t)) return t;
  }
  if (b.issued_at) {
    const t = new Date(b.issued_at).getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
};

export interface SummaryTotals {
  billsCount: number;
  salesMinor: number;
}

export interface SummaryYear extends SummaryTotals {
  year: number;
}

export interface SummaryMonth extends SummaryTotals {
  /** 0 = January */
  month: number;
}

export interface SummaryDay extends SummaryTotals {
  /** 1-31 */
  day: number;
  dateKey: string;
}

export interface SummaryBillLine {
  id: string;
  customerName: string;
  /** One entry per service, e.g. "Haircut" or "Beard ×2". Empty when the bill has no line items. */
  services: string[];
  priceMinor: number;
  time: number;
}

/** Genuine sales only: no deleted bills, no opening-due entries, and a readable date. */
export const summaryBills = (bills: Bill[]): Bill[] =>
  (bills || []).filter((b) => !!b && b.status !== 'deleted' && !isOpeningDueBill(b) && getBillTimestamp(b) > 0);

const pad = (n: number) => String(n).padStart(2, '0');

export const dateKeyOf = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const add = (t: SummaryTotals, b: Bill) => {
  t.billsCount += 1;
  t.salesMinor += b.total_minor || 0;
};

/** Years that have sales, newest first. Dates use the phone's local time, like the rest of Reports. */
export function getSummaryYears(bills: Bill[]): SummaryYear[] {
  const map = new Map<number, SummaryYear>();
  for (const b of summaryBills(bills)) {
    const year = new Date(getBillTimestamp(b)).getFullYear();
    const row = map.get(year) || { year, billsCount: 0, salesMinor: 0 };
    add(row, b);
    map.set(year, row);
  }
  return Array.from(map.values()).sort((a, b) => b.year - a.year);
}

/** Months of a year that have sales, newest first. */
export function getSummaryMonths(bills: Bill[], year: number): SummaryMonth[] {
  const map = new Map<number, SummaryMonth>();
  for (const b of summaryBills(bills)) {
    const d = new Date(getBillTimestamp(b));
    if (d.getFullYear() !== year) continue;
    const row = map.get(d.getMonth()) || { month: d.getMonth(), billsCount: 0, salesMinor: 0 };
    add(row, b);
    map.set(d.getMonth(), row);
  }
  return Array.from(map.values()).sort((a, b) => b.month - a.month);
}

/** Days of a month that have sales, newest first. */
export function getSummaryDays(bills: Bill[], year: number, month: number): SummaryDay[] {
  const map = new Map<number, SummaryDay>();
  for (const b of summaryBills(bills)) {
    const ms = getBillTimestamp(b);
    const d = new Date(ms);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const row = map.get(d.getDate()) || { day: d.getDate(), dateKey: dateKeyOf(ms), billsCount: 0, salesMinor: 0 };
    add(row, b);
    map.set(d.getDate(), row);
  }
  return Array.from(map.values()).sort((a, b) => b.day - a.day);
}

/** Every bill of one day: customer, services and price. Latest first. */
export function getSummaryDayBills(bills: Bill[], dateKey: string): SummaryBillLine[] {
  return summaryBills(bills)
    .filter((b) => dateKeyOf(getBillTimestamp(b)) === dateKey)
    .map((b) => ({
      id: b.id,
      customerName: (b.customer_name || '').trim(),
      services: (b.items || [])
        .map((it) => {
          const name = (it.service_name_snapshot || '').trim();
          if (!name) return '';
          return (it.quantity || 1) > 1 ? `${name} ×${it.quantity}` : name;
        })
        .filter(Boolean),
      priceMinor: b.total_minor || 0,
      time: getBillTimestamp(b),
    }))
    .sort((a, b) => b.time - a.time);
}

export interface SummaryMonthDay extends SummaryTotals {
  day: number;
  dateKey: string;
  bills: SummaryBillLine[];
}

export interface SummaryMonthDetail {
  year: number;
  month: number;
  /** Chronological: day 1 first, and within a day the earliest bill first. */
  days: SummaryMonthDay[];
  totals: SummaryTotals;
}

/** Everything inside one month: each day that has sales, with every bill's customer, services and price. */
export function getSummaryMonthDetail(bills: Bill[], year: number, month: number): SummaryMonthDetail {
  const days: SummaryMonthDay[] = getSummaryDays(bills, year, month)
    .sort((a, b) => a.day - b.day)
    .map((d) => ({
      ...d,
      bills: getSummaryDayBills(bills, d.dateKey).sort((a, b) => a.time - b.time),
    }));
  return {
    year,
    month,
    days,
    totals: {
      billsCount: days.reduce((s, d) => s + d.billsCount, 0),
      salesMinor: days.reduce((s, d) => s + d.salesMinor, 0),
    },
  };
}
