/** An expense counts against profit unless the owner turned it off. Old records without the field count. */
export const countsInProfit = (e: { include_in_profit?: boolean | null } | null | undefined): boolean =>
  !!e && e.include_in_profit !== false;

export interface ExpenseProfitSplit {
  /** Subtracted when profit is calculated */
  countedMinor: number;
  countedCount: number;
  /** Saved and listed, but profit ignores it */
  excludedMinor: number;
  excludedCount: number;
}

export function splitExpenseTotals(
  expenses: { amount_minor?: number | null; include_in_profit?: boolean | null }[]
): ExpenseProfitSplit {
  const out: ExpenseProfitSplit = { countedMinor: 0, countedCount: 0, excludedMinor: 0, excludedCount: 0 };
  for (const e of expenses || []) {
    if (!e) continue;
    const amount = e.amount_minor || 0;
    if (countsInProfit(e)) {
      out.countedMinor += amount;
      out.countedCount += 1;
    } else {
      out.excludedMinor += amount;
      out.excludedCount += 1;
    }
  }
  return out;
}
