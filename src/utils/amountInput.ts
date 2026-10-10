/** Digits and one decimal point only, at most 2 decimals, so the amount always parses. */
export const cleanAmountInput = (raw: string): string => {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 2);
};
