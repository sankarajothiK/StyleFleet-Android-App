/**
 * Formatting utilities for Indian Rupee currency, dates, times, and initials
 * Source of truth: Salon OS.dc.html and DESIGN_SYSTEM.md
 */

/**
 * Format amount as Indian Rupees (e.g., ₹14,280 or ₹450)
 * @param amountInRupees Amount in rupees
 */
export function inr(amountInRupees: number): string {
  const rounded = Math.round(amountInRupees);
  return '₹' + rounded.toLocaleString('en-IN');
}

/**
 * Format amount from minor units (paise) to Rupees string
 * @param amountInPaise Amount in paise
 */
export function inrFromMinor(amountInPaise: number): string {
  return inr(amountInPaise / 100);
}

/**
 * Short Indian rupee format:
 * >= 1,00,000 -> ₹X.XL
 * >= 1,000 -> ₹Xk
 * else -> ₹X
 */
export function shortInr(amountInRupees: number): string {
  const n = Math.round(amountInRupees);
  if (n >= 100000) {
    const l = n / 100000;
    const formatted = l % 1 === 0 ? l.toFixed(0) : l.toFixed(1).replace(/\.0$/, '');
    return '₹' + formatted + 'L';
  }
  if (n >= 1000) {
    const k = n / 1000;
    const formatted = k % 1 === 0 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, '');
    return '₹' + formatted + 'k';
  }
  return '₹' + n;
}

export function shortInrFromMinor(amountInPaise: number): string {
  return shortInr(amountInPaise / 100);
}

/**
 * Extract 1-2 uppercase initials from a name
 * e.g. "Vikram Rao" -> "VR", "Deepak" -> "D"
 */
export function getInitials(name: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return parts
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Format date for display (e.g., "17 Aug", "Sunday 17 August")
 */
export function formatDisplayDate(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export function formatTimeDisplay(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minsStr = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minsStr} ${ampm}`;
}
