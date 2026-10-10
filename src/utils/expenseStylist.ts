import { StaffMember } from '../types/domain';

type StaffLike = Pick<StaffMember, 'id' | 'name' | 'is_active'>;

/** Team members an expense can be linked to: active ones, plus the one already linked even if now inactive. */
export function stylistOptions<T extends StaffLike>(staff: T[], selectedId?: string | null): T[] {
  return (staff || []).filter((s) => !!s && (s.is_active !== false || s.id === selectedId));
}

/** Name of the linked team member, or null for a shop expense or an unknown / removed member. */
export function stylistNameFor(staff: StaffLike[], staffId?: string | null): string | null {
  if (!staffId) return null;
  const found = (staff || []).find((s) => s && s.id === staffId);
  return found ? found.name : null;
}
