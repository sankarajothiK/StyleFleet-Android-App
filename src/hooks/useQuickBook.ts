import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Appointment, Bill, Customer, Service, StaffMember } from '../types/domain';
import { shopRepository } from '../repositories/shopRepository';
import { generateTimeSlots } from '../services/bookingSlots';
import {
  QuickBookSuggestion,
  buildSuggestion,
  getRecentCustomers,
} from '../services/quickBookService';

interface UseQuickBookParams {
  shopId?: string;
  customers: Customer[];
  appointments: Appointment[];
  bills: Bill[];
  services: Service[];
  staff: StaffMember[];
  ownerName: string;
  /** The logged-in stylist's id, so "Book again" is booked for them. */
  preferredStaffId?: string | null;
  /** Returns true when the booking was saved. Must show its own error to the user on failure. */
  onConfirm: (suggestion: QuickBookSuggestion) => Promise<boolean>;
}

const DEFAULT_HOURS = { startTime: '09:30 AM', endTime: '08:30 PM' };

export function useQuickBook({
  shopId,
  customers,
  appointments,
  bills,
  services,
  staff,
  ownerName,
  preferredStaffId,
  onConfirm,
}: UseQuickBookParams) {
  const [bookingHours, setBookingHours] = useState(DEFAULT_HOURS);
  const [suggestion, setSuggestion] = useState<QuickBookSuggestion | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    shopRepository
      .getBookingHours(shopId)
      .then((hours) => {
        if (mounted) setBookingHours(hours);
      })
      .catch(() => {
        // keep default hours
      });
    return () => {
      mounted = false;
    };
  }, [shopId]);

  const timeSlots = useMemo(
    () => generateTimeSlots(bookingHours.startTime, bookingHours.endTime),
    [bookingHours.startTime, bookingHours.endTime]
  );

  const recentCustomers = useMemo(
    () => getRecentCustomers(customers, appointments, bills, 3),
    [customers, appointments, bills]
  );

  /**
   * Pick a customer. Returns the suggestion, or null when there is nothing reliable to suggest
   * (the caller should then open the full booking screen for that customer).
   */
  const select = useCallback(
    (customer: Customer): QuickBookSuggestion | null => {
      const next = buildSuggestion({
        customer,
        appointments,
        bills,
        services,
        staff,
        ownerName,
        preferredStaffId,
        timeSlots,
        now: new Date(),
      });
      setSuggestion(next);
      return next;
    },
    [appointments, bills, services, staff, ownerName, preferredStaffId, timeSlots]
  );

  const clear = useCallback(() => setSuggestion(null), []);

  const confirm = useCallback(async () => {
    if (!suggestion || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const saved = await onConfirm(suggestion);
      if (saved) setSuggestion(null);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [suggestion, onConfirm]);

  return { recentCustomers, suggestion, isSubmitting, select, clear, confirm };
}
