import { authRepository, AuthUser } from '../repositories/authRepository';
import { shopRepository, ShopRegistrationData } from '../repositories/shopRepository';

export class AuthService {
  async sendOtp(phone: string): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    const clean = phone.replace(/\D/g, '').slice(-10);
    if (clean.length !== 10) {
      return { success: false, error: 'Please enter a valid 10-digit mobile number' };
    }
    return authRepository.sendOtp(clean);
  }

  async verifyOtp(
    phone: string,
    otp: string,
    sessionId?: string
  ): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    if (otp.length !== 6) {
      return { success: false, error: 'Enter the complete 6-digit code' };
    }
    return authRepository.verifyOtp(phone, otp, sessionId);
  }

  async verifyOtpCodeOnly(
    phone: string,
    otp: string,
    sessionId?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (otp.length !== 6) {
      return { success: false, error: 'Enter the complete 6-digit code' };
    }
    return authRepository.verifyOtpCodeOnly(phone, otp, sessionId);
  }

  async registerShop(
    userId: string,
    data: ShopRegistrationData
  ) {
    if (!data.name.trim()) throw new Error('Shop name is required');
    if (!data.ownerName.trim()) throw new Error('Owner name is required');
    if (!data.address.trim()) throw new Error('Address is required');
    if (!data.city.trim()) throw new Error('City is required');
    const cleanPin = data.pinCode.replace(/\D/g, '');
    if (!cleanPin || (cleanPin.length !== 6 && cleanPin.length !== 10)) {
      throw new Error('Valid 6-digit PIN code is required');
    }

    const shop = await shopRepository.createShop(userId, data);
    await authRepository.setCurrentShopId(shop.id);
    return shop;
  }

  async getCurrentSession(): Promise<AuthUser | null> {
    return authRepository.getSession();
  }

  async signOut(): Promise<void> {
    return authRepository.signOut();
  }
}

export const authService = new AuthService();
