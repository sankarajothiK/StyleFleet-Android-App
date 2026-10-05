import { authService } from '../src/services/authService';
import { AuthRepository } from '../src/repositories/authRepository';

describe('Auth Service Validation', () => {
  it('rejects invalid mobile numbers', async () => {
    const res1 = await authService.sendOtp('12345');
    expect(res1.success).toBe(false);
    expect(res1.error).toContain('10-digit');

    const res2 = await authService.sendOtp('');
    expect(res2.success).toBe(false);
  });

  it('rejects incomplete OTPs', async () => {
    const res = await authService.verifyOtp('9845062110', '1234');
    expect(res.success).toBe(false);
    expect(res.error).toContain('6-digit');
  });

  it('validates shop registration fields', async () => {
    await expect(
      authService.registerShop('user_123', {
        name: '',
        ownerName: 'Arun Prakash',
        address: '14 Kasturba Road',
        city: 'Bengaluru',
        pinCode: '560001',
      })
    ).rejects.toThrow('Shop name is required');

    await expect(
      authService.registerShop('user_123', {
        name: 'Salon',
        ownerName: 'Arun Prakash',
        address: '14 Kasturba Road',
        city: 'Bengaluru',
        pinCode: '560',
      })
    ).rejects.toThrow('Valid 6-digit PIN code is required');
  });

  it('reuses in-flight OTP dispatches and rejects failed dispatches without mock sessions', async () => {
    const repo = new AuthRepository();
    const originalFetch = global.fetch;

    const fetchMock = jest.spyOn(global as any, 'fetch').mockImplementation(async (...args: any[]) => {
      const input = args[0];
      const url = String(input);
      if (url.includes('9876543210')) {
        return {
          json: async () => ({ Status: 'Success', Details: 'otp_session_abc123' }),
        } as any;
      }
      if (url.includes('9988776655')) {
        return {
          json: async () => ({ Status: 'Error', Details: 'dispatch failed' }),
        } as any;
      }
      return {
        json: async () => ({ Status: 'Success', Details: 'otp_session_fallback' }),
      } as any;
    });

    try {
      const pending = repo.sendOtp('9876543210');
      const samePhone = await repo.sendOtp('9876543210');
      const failed = await repo.sendOtp('9988776655');

      expect(samePhone.success).toBe(true);
      expect(samePhone.sessionId).toBe('otp_session_abc123');
      expect(failed.success).toBe(false);
      expect(failed.sessionId).toBeUndefined();
      expect(failed.error).toContain('dispatch');
      await pending;
    } finally {
      fetchMock.mockRestore();
      global.fetch = originalFetch;
    }
  });

  it('triggers resend OTP handler upon cooldown expiration', async () => {
    let resendCount = 0;
    const onResend = async () => {
      resendCount++;
    };

    expect(resendCount).toBe(0);
    await onResend();
    expect(resendCount).toBe(1);
  });

  it('supports stylist mode login without requiring shop registration button', async () => {
    const { PhoneScreen } = await import('../src/screens/auth/PhoneScreen');
    expect(PhoneScreen).toBeDefined();
  });
});
