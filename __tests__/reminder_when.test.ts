import { describeAppointmentWhen } from '../src/repositories/reminderRepository';

describe('describeAppointmentWhen', () => {
  const now = new Date(2026, 9, 6, 9, 0); // 6 Oct 2026
  it('formats today, tomorrow and later days', () => {
    expect(describeAppointmentWhen('2026-10-06 10:30 AM', now)).toEqual({ when: 'Today · 10:30 AM', time: '10:30 AM', isToday: true });
    expect(describeAppointmentWhen('2026-10-07 4:00 pm', now).when).toBe('Tomorrow · 04:00 PM');
    expect(describeAppointmentWhen('2026-10-12 11:00 AM', now).when).toBe('Oct 12 · 11:00 AM');
  });
  it('handles ISO 24h and time-only values', () => {
    expect(describeAppointmentWhen('2026-10-06T15:05:00', now).when).toBe('Today · 03:05 PM');
    expect(describeAppointmentWhen('10:00 AM', now).when).toBe('10:00 AM');
  });
});
