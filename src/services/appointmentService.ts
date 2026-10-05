import { appointmentRepository, STANDARD_SLOTS } from '../repositories/appointmentRepository';
import { Appointment, AppointmentStatus } from '../types/domain';

export class AppointmentService {
  async getAppointmentsForDay(shopId: string, dayIndex = 1): Promise<Appointment[]> {
    return appointmentRepository.getAppointments(shopId, dayIndex);
  }

  getAvailableSlots(
    bookedAppointments: Appointment[],
    allSlots: readonly string[] = STANDARD_SLOTS
  ): { slot: string; taken: boolean }[] {
    const bookedTimes = new Set(bookedAppointments.map(a => a.starts_at));
    return allSlots.map(slot => ({
      slot,
      taken: bookedTimes.has(slot),
    }));
  }

  async bookAppointment(params: {
    shopId: string;
    customerName: string;
    serviceName: string;
    stylistName: string;
    slot: string;
    amountRupees: number;
    sendConfirm?: boolean;
  }): Promise<Appointment> {
    if (!params.slot) throw new Error('Please select an appointment time slot');
    if (!params.serviceName) throw new Error('Please select a service');

    return appointmentRepository.addAppointment({
      shopId: params.shopId,
      customerName: params.customerName,
      serviceName: params.serviceName,
      stylistName: params.stylistName,
      slot: params.slot,
      amountRupees: params.amountRupees,
      sendConfirm: params.sendConfirm ?? true,
    });
  }

  async advanceAppointment(shopId: string, appointmentId: string): Promise<AppointmentStatus | null> {
    return appointmentRepository.advanceStatus(shopId, appointmentId);
  }
}

export const appointmentService = new AppointmentService();
