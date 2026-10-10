import { Appointment, StaffMember } from '../types/domain';

export interface TimeSlot {
  label: string;
  hour: number;
  min: number;
}

export function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    const meridian = match12[3].toUpperCase();
    if (meridian === 'PM' && h < 12) h += 12;
    if (meridian === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const h = parseInt(match24[1], 10);
    const m = parseInt(match24[2], 10);
    return h * 60 + m;
  }
  return null;
}

export function formatMinutesToAmPm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const meridian = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  const hStr = h12 < 10 ? `0${h12}` : `${h12}`;
  const mStr = m < 10 ? `0${m}` : `${m}`;
  return `${hStr}:${mStr} ${meridian}`;
}

export const DEFAULT_ALL_TIME_SLOTS: TimeSlot[] = [
  { label: '09:30 AM', hour: 9, min: 30 },
  { label: '10:00 AM', hour: 10, min: 0 },
  { label: '10:30 AM', hour: 10, min: 30 },
  { label: '11:00 AM', hour: 11, min: 0 },
  { label: '11:30 AM', hour: 11, min: 30 },
  { label: '12:00 PM', hour: 12, min: 0 },
  { label: '12:30 PM', hour: 12, min: 30 },
  { label: '01:00 PM', hour: 13, min: 0 },
  { label: '02:00 PM', hour: 14, min: 0 },
  { label: '02:30 PM', hour: 14, min: 30 },
  { label: '03:00 PM', hour: 15, min: 0 },
  { label: '03:30 PM', hour: 15, min: 30 },
  { label: '04:00 PM', hour: 16, min: 0 },
  { label: '04:30 PM', hour: 16, min: 30 },
  { label: '05:00 PM', hour: 17, min: 0 },
  { label: '05:30 PM', hour: 17, min: 30 },
  { label: '06:00 PM', hour: 18, min: 0 },
  { label: '06:30 PM', hour: 18, min: 30 },
  { label: '07:00 PM', hour: 19, min: 0 },
  { label: '07:30 PM', hour: 19, min: 30 },
  { label: '08:00 PM', hour: 20, min: 0 },
  { label: '08:30 PM', hour: 20, min: 30 },
];

export function generateTimeSlots(startStr = '09:30 AM', endStr = '08:30 PM'): TimeSlot[] {
  const start = parseTimeToMinutes(startStr) ?? 9 * 60 + 30;
  const end = parseTimeToMinutes(endStr) ?? 20 * 60 + 30;
  if (end <= start) return DEFAULT_ALL_TIME_SLOTS;

  const slots: TimeSlot[] = [];
  let current = start;
  while (current <= end) {
    slots.push({
      label: formatMinutesToAmPm(current),
      hour: Math.floor(current / 60),
      min: current % 60,
    });
    current += 30;
  }
  return slots.length > 0 ? slots : DEFAULT_ALL_TIME_SLOTS;
}

export function getSlotHourMin(timeStr?: string): { hour: number; min: number } | null {
  if (!timeStr) return null;
  const ampmMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2], 10);
    const meridian = ampmMatch[3].toUpperCase();
    if (meridian === 'PM' && h < 12) h += 12;
    if (meridian === 'AM' && h === 12) h = 0;
    return { hour: h, min: m };
  }
  const iso24Match = timeStr.match(/(?:T|\s)(\d{1,2}):(\d{2})/);
  if (iso24Match) {
    return { hour: parseInt(iso24Match[1], 10), min: parseInt(iso24Match[2], 10) };
  }
  const simpleMatch = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (simpleMatch) {
    let h = parseInt(simpleMatch[1], 10);
    const m = parseInt(simpleMatch[2], 10);
    if (h >= 1 && h <= 7) h += 12;
    return { hour: h, min: m };
  }
  return null;
}

export function getApptDateStr(appt: Appointment): string {
  if (appt.starts_at) {
    const m = appt.starts_at.match(/\d{4}-\d{2}-\d{2}/);
    if (m) return m[0];
  }
  if (appt.created_at) {
    const m = appt.created_at.match(/\d{4}-\d{2}-\d{2}/);
    if (m) return m[0];
  }
  return '';
}

export const DEFAULT_APPOINTMENT_MINUTES = 30;

/** Appointments that never block a stylist: cancelled, finished or deleted. */
export function isNonBlocking(a: Appointment): boolean {
  return a.status === 'Cancelled' || a.status === 'Done' || Boolean(a.is_deleted);
}

/**
 * Does this appointment belong to the given person? Matches by staff id, or by a whole name
 * among the appointment's stylist names ("Ravi & Meera" holds both). A name that merely
 * contains another ("Ramesh" vs "Ram") is NOT a match.
 */
export function appointmentHasPerson(a: Appointment, person: { id: string | null; name: string }): boolean {
  if (person.id && a.staff_id === person.id) return true;
  const target = person.name.trim().toLowerCase();
  if (!target || !a.staff_name) return false;
  return a.staff_name
    .split(/\s*(?:&|,|\+|\band\b)\s*/i)
    .some((n) => n.trim().toLowerCase() === target);
}

export interface BlockedSlot {
  appt: Appointment;
  stylistName: string;
  /** 'booked': the slot start falls inside an existing appointment.
   *  'overlap': the slot is free, but the new booking's length would run into the next one. */
  reason: 'booked' | 'overlap';
}

export function formatDuration(totalMinutes: number, units: { min: string; hr: string } = { min: 'min', hr: 'hr' }): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} ${units.min}`;
  return m === 0 ? `${h} ${units.hr}` : `${h} ${units.hr} ${m} ${units.min}`;
}

/**
 * Duration-aware conflicts for the given people (stylists and/or the owner) on a date.
 * An existing appointment blocks every slot from its start until start + duration_minutes.
 * A slot is also blocked when a booking of `newDurationMinutes` starting there would run into one.
 * Cancelled/done appointments don't block; people match by id or by name.
 */
export function findBlockedSlots(
  appointments: Appointment[],
  people: { id: string | null; name: string }[],
  dateStr: string,
  timeSlots: TimeSlot[],
  newDurationMinutes: number = DEFAULT_APPOINTMENT_MINUTES
): Map<string, BlockedSlot> {
  const blocked = new Map<string, BlockedSlot>();
  if (people.length === 0) return blocked;

  const busy: { start: number; end: number; appt: Appointment; stylistName: string }[] = [];
  for (const a of appointments) {
    if (isNonBlocking(a)) continue;
    const person = people.find((p) => appointmentHasPerson(a, p));
    if (!person) continue;

    const apptDate = getApptDateStr(a);
    if (apptDate !== dateStr) continue;

    const hm = getSlotHourMin(a.starts_at);
    if (!hm) continue;
    const start = hm.hour * 60 + hm.min;
    busy.push({
      start,
      end: start + Math.max(a.duration_minutes || 0, 15),
      appt: a,
      stylistName: person.name,
    });
  }

  for (const sl of timeSlots) {
    const s = sl.hour * 60 + sl.min;
    const inside = busy.find((b) => s >= b.start && s < b.end);
    if (inside) {
      blocked.set(sl.label, { appt: inside.appt, stylistName: inside.stylistName, reason: 'booked' });
      continue;
    }
    const clash = busy.find((b) => s < b.end && s + newDurationMinutes > b.start);
    if (clash) {
      blocked.set(sl.label, { appt: clash.appt, stylistName: clash.stylistName, reason: 'overlap' });
    }
  }
  return blocked;
}

/**
 * Slots already taken for the given stylists on a date (label -> appointment).
 * Same rules the booking screen has always used: cancelled/done appointments don't block,
 * a stylist matches by id or by name, and only the start slot is compared.
 */
export function findBookedSlots(
  appointments: Appointment[],
  stylists: StaffMember[],
  dateStr: string,
  timeSlots: TimeSlot[]
): Map<string, { appt: Appointment; stylistName: string }> {
  const map = new Map<string, { appt: Appointment; stylistName: string }>();
  if (stylists.length === 0) return map;

  for (const a of appointments) {
    if (isNonBlocking(a)) continue;
    const matchedStylist = stylists.find((s) => appointmentHasPerson(a, s));
    if (!matchedStylist) continue;

    const apptDate = getApptDateStr(a);
    if (apptDate) {
      if (apptDate !== dateStr) continue;
    } else {
      const createdDate = a.created_at ? a.created_at.slice(0, 10) : '';
      if (createdDate !== dateStr) continue;
    }

    const raw = (a.starts_at || '').toUpperCase();
    const hm = getSlotHourMin(a.starts_at);

    for (const sl of timeSlots) {
      const cleanSlot = sl.label.toUpperCase();
      const noLeadingZero = cleanSlot.replace(/^0/, '');
      if (raw.includes(cleanSlot) || raw.includes(noLeadingZero)) {
        map.set(sl.label, { appt: a, stylistName: matchedStylist.name });
        break;
      } else if (hm && hm.hour === sl.hour && hm.min === sl.min) {
        map.set(sl.label, { appt: a, stylistName: matchedStylist.name });
        break;
      }
    }
  }
  return map;
}
