import { isValidUuid } from './uuid';

export interface DbErrorLike {
  message?: string;
  code?: string;
  details?: string | null;
}

const NETWORK = /network|fetch|timeout|timed out|offline|econn|enotfound|socket/i;

/** A message the owner can act on, never a raw database error. */
export function friendlyDbMessage(error: DbErrorLike | null | undefined, what: string): string {
  const message = error?.message || '';
  if (NETWORK.test(message)) {
    return `No internet connection, so ${what} was not saved. Please check your connection and try again.`;
  }
  if (error?.code === '42501' || /row-level security|permission denied/i.test(message)) {
    return `You do not have permission to save ${what}.`;
  }
  const subject = what.charAt(0).toUpperCase() + what.slice(1);
  return message ? `${subject} could not be saved: ${message}` : `${subject} could not be saved. Please try again.`;
}

/** Throws a friendly error when a Supabase call returned one. A write that failed must never look like it worked. */
export function assertSaved(result: { error?: DbErrorLike | null } | null | undefined, what: string): void {
  if (result && result.error) {
    throw new Error(friendlyDbMessage(result.error, what));
  }
}

/**
 * Shops with a real database id are saved to Supabase and a failed save is reported.
 * Demo / legacy shops with a non-uuid id exist only on the phone, so there is nothing to save remotely.
 */
export const isRemoteShop = (shopId: string): boolean => isValidUuid(shopId);
