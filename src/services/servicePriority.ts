import { Service } from '../types/domain';

const norm = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * The services most used at a counter always come first, in this order:
 * Haircut, Trim, Shaving, Haircut + wash. Everything else keeps its original order.
 * A service that does not exist in the shop's price list is simply skipped.
 */
export function orderServicesForQuickPick<T extends Pick<Service, 'id' | 'name'>>(services: T[]): T[] {
  const taken = new Set<string>();
  const pick = (matcher: (name: string) => boolean): T | undefined => {
    const found = services.find((s) => !taken.has(s.id) && matcher(norm(s.name)));
    if (found) taken.add(found.id);
    return found;
  };

  const haircut = pick((n) => /^hair ?cut$/.test(n));
  const trim =
    pick((n) => n === 'trim' || n === 'hair trim' || n === 'trimming') ||
    pick((n) => n.includes('trim') && !n.includes('beard'));
  const shaving =
    pick((n) => n === 'shaving' || n === 'shave') ||
    pick((n) => n.includes('shav') && !n.includes('head'));
  const haircutWash = pick((n) => /^hair ?cut\s*(\+|&|and|with)\s*(hair )?wash$/.test(n)) ||
    pick((n) => n.includes('haircut') && n.includes('wash'));

  const first = [haircut, trim, shaving, haircutWash].filter((s): s is T => Boolean(s));
  return [...first, ...services.filter((s) => !taken.has(s.id))];
}
