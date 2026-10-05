/**
 * Utility for generating and validating Salon OS invoice number prefixes.
 */

/**
 * Automatically generates a standard invoice prefix from a salon/shop name.
 * 
 * Rules:
 * 1. Single word: First two letters of that word ('Naturals' -> 'NA')
 * 2. Two words: First letter of each word ('Royal Elegance' -> 'RE')
 * 3. Three or more words: First letter of the first two words ('Green Trends Unisex' -> 'GT')
 * 4. Numbers and symbols are ignored.
 */
export function generateInvoicePrefixFromShopName(shopName: string): string {
  if (!shopName || !shopName.trim()) {
    return 'CS';
  }

  // Clean and split words, ignoring numbers and special symbols
  const words = shopName
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z]/g, ''))
    .filter(Boolean);

  if (words.length === 0) {
    return 'CS';
  }

  if (words.length === 1) {
    const cleanWord = words[0];
    if (cleanWord.length >= 2) {
      return cleanWord.slice(0, 2).toUpperCase();
    }
    return `${cleanWord[0].toUpperCase()}S`;
  }

  // Two or more words: take first letter of the first two words
  const firstChar = words[0][0].toUpperCase();
  const secondChar = words[1][0].toUpperCase();
  return `${firstChar}${secondChar}`;
}

/**
 * Sanitizes and validates an owner-entered invoice prefix.
 * Removes spaces and invalid characters, uppercases, limits length.
 */
export function sanitizeInvoicePrefix(prefix: string, fallbackName?: string): string {
  if (!prefix || !prefix.trim()) {
    return fallbackName ? generateInvoicePrefixFromShopName(fallbackName) : 'CS';
  }

  // Keep alphanumeric characters and optional internal hyphens, remove leading/trailing hyphens/spaces
  let clean = prefix
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/^-+|-+$/g, '');

  if (!clean) {
    return fallbackName ? generateInvoicePrefixFromShopName(fallbackName) : 'CS';
  }

  // Maximum 8 characters
  if (clean.length > 8) {
    clean = clean.slice(0, 8);
  }

  return clean;
}
