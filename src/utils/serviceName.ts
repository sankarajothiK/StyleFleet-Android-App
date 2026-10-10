import type { Service } from '../types/domain';

/** Case, spacing and punctuation-at-the-ends insensitive key used to spot the same service typed twice. */
export function normalizeServiceName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Returns the existing service with the same name (any category), ignoring `excludeId`. */
export function findDuplicateService(services: Service[], name: string, excludeId?: string): Service | undefined {
  const key = normalizeServiceName(name);
  if (!key) return undefined;
  return services.find((sv) => sv.id !== excludeId && normalizeServiceName(sv.name) === key);
}
