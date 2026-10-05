import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_AUTH_USER = '@salon_os_current_auth_user';
const STORAGE_KEY_CURRENT_SHOP = '@salon_os_current_shop_id';

const TWO_FACTOR_KEY = 'e11be203-4f77-11f1-9800-0200cd936042';
const TWO_FACTOR_TEMPLATE = 'Login_Verification_OTP';

import { StylistPermissions } from '../types/domain';

export interface AuthUser {
  id: string;
  phone: string;
  fullName?: string;
  shopId?: string;
  role?: 'owner' | 'stylist';
  stylistId?: string;
  permissions?: StylistPermissions;
}

const DEMO_OTP_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

// Guard against dual sends or rapid double-taps
let lastOtpSentPhone = '';
let lastOtpSentTime = 0;
const inFlightOtpDispatches = new Map<string, Promise<{ success: boolean; sessionId?: string; error?: string }>>();
let lastSessionId = '';

export class AuthRepository {
  /**
   * Request 6-digit OTP for a 10-digit mobile number via 2Factor Login_Verification_OTP
   * Strictly enforces single SMS dispatch to eliminate duplicate messages.
   */
  async sendOtp(phone: string): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    const clean = phone.replace(/\D/g, '').slice(-10);
    if (clean.length !== 10) {
      return { success: false, error: 'Please enter a valid 10-digit mobile number' };
    }



    if (process.env.NODE_ENV !== 'test' && (clean === '9876543210' || clean === '9800000000' || DEMO_OTP_MODE)) {
      lastOtpSentPhone = clean;
      lastOtpSentTime = Date.now();
      lastSessionId = `demo_session_${clean}`;
      return { success: true, sessionId: lastSessionId };
    }

    const existingDispatch = inFlightOtpDispatches.get(clean);
    if (existingDispatch) {
      return await existingDispatch;
    }

    const now = Date.now();
    if (lastOtpSentPhone === clean && now - lastOtpSentTime < 15000 && lastSessionId) {
      return { success: true, sessionId: lastSessionId };
    }

    const dispatchPromise = (async () => {
      try {
        const url = `https://2factor.in/API/V1/${TWO_FACTOR_KEY}/SMS/${clean}/AUTOGEN/${TWO_FACTOR_TEMPLATE}`;
        const res = await fetch(url);
        const json = await res.json();

        if (json && json.Status === 'Success') {
          lastOtpSentPhone = clean;
          lastOtpSentTime = Date.now();
          lastSessionId = json.Details;
          return { success: true, sessionId: json.Details };
        }

        if (json && json.Details) {
          console.warn('2Factor error response:', json.Details);
        }

        const dispatchError = json?.Details || 'OTP dispatch failed. Please try again.';
        return { success: false, error: dispatchError };
      } catch (e: any) {
        console.warn('2Factor direct fetch error:', e.message);
        return { success: false, error: e.message || 'OTP dispatch failed. Please try again.' };
      }
    })();

    inFlightOtpDispatches.set(clean, dispatchPromise);

    try {
      const result = await dispatchPromise;
      if (!result.success && (DEMO_OTP_MODE || clean === '9876543210' || clean === '9888800001' || clean === '9888800002')) {
        const mockSess = `mock_sess_${Date.now()}`;
        lastOtpSentPhone = clean;
        lastOtpSentTime = Date.now();
        lastSessionId = mockSess;
        return { success: true, sessionId: mockSess };
      }
      return result;
    } finally {
      if (inFlightOtpDispatches.get(clean) === dispatchPromise) {
        inFlightOtpDispatches.delete(clean);
      }
    }
  }

  /**
   * Verify the 6-digit OTP
   */
  async verifyOtp(
    phone: string,
    otp: string,
    sessionId?: string
  ): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    const clean = phone.replace(/\D/g, '').slice(-10);
    if (otp.length !== 6) {
      return { success: false, error: 'OTP must be 6 digits' };
    }

    try {
      // 1. Reviewer & Demo OTP bypass (Cashfree, Play Store, Apple App Review)
      // Must be evaluated BEFORE remote SMS verify to ensure reviewers with fixed OTP 123456 are never rejected.
      if (otp === '123456' || (sessionId && sessionId.startsWith('mock_')) || (sessionId && sessionId.startsWith('demo_'))) {
        const authUser = await this.establishSupabaseSession(clean);
        return { success: true, user: authUser };
      }

      // 2. Try Supabase Edge Function verification
      if (sessionId && !sessionId.startsWith('mock_') && !sessionId.startsWith('demo_')) {
        try {
          const { data, error } = await supabase.functions.invoke('otp-service', {
            body: { action: 'verify', phone: clean, otp, sessionId },
          });

          if (!error && data && data.success) {
            const authUser: AuthUser = {
              id: data.auth?.userId || `user_${clean}`,
              phone: clean,
            };
            await this.saveSession(authUser);
            return { success: true, user: authUser };
          }
        } catch {
          // Fall through to direct verification
        }

        // 3. Direct 2Factor SMS verify endpoint
        try {
          const verifyUrl = `https://2factor.in/API/V1/${TWO_FACTOR_KEY}/SMS/VERIFY/${sessionId}/${otp}`;
          const res = await fetch(verifyUrl);
          const json = await res.json();

          if (json && json.Status === 'Success' && json.Details === 'OTP Matched') {
            const authUser = await this.establishSupabaseSession(clean);
            return { success: true, user: authUser };
          } else if (json && json.Details) {
            return { success: false, error: json.Details };
          }
        } catch (e: any) {
          console.warn('2Factor verification direct error:', e.message);
        }
      }

      return { success: false, error: 'Invalid verification code' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Verification failed' };
    }
  }

  /**
   * Verify OTP code without establishing or overriding the active Supabase Auth user session.
   * Used for sensitive multi-factor verification flows such as Changing Phone Number.
   */
  async verifyOtpCodeOnly(
    phone: string,
    otp: string,
    sessionId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const clean = phone.replace(/\D/g, '').slice(-10);
    if (otp.length !== 6) {
      return { success: false, error: 'OTP must be 6 digits' };
    }

    try {
      // 1. Reviewer & Demo OTP bypass
      if (
        otp === '123456' ||
        (sessionId && (sessionId.startsWith('mock_') || sessionId.startsWith('demo_'))) ||
        DEMO_OTP_MODE ||
        clean === '9876543210' ||
        clean === '9800000000'
      ) {
        return { success: true };
      }

      // 2. Try Supabase Edge Function verification
      if (sessionId && !sessionId.startsWith('mock_') && !sessionId.startsWith('demo_')) {
        try {
          const { data, error } = await supabase.functions.invoke('otp-service', {
            body: { action: 'verify', phone: clean, otp, sessionId },
          });

          if (!error && data && data.success) {
            return { success: true };
          }
        } catch {
          // Fall through to direct verification
        }

        // 3. Direct 2Factor SMS verify endpoint
        try {
          const verifyUrl = `https://2factor.in/API/V1/${TWO_FACTOR_KEY}/SMS/VERIFY/${sessionId}/${otp}`;
          const res = await fetch(verifyUrl);
          const json = await res.json();

          if (json && json.Status === 'Success' && json.Details === 'OTP Matched') {
            return { success: true };
          } else if (json && json.Details) {
            return { success: false, error: json.Details };
          }
        } catch (e: any) {
          console.warn('2Factor verification direct error:', e.message);
        }
      }

      return { success: false, error: 'Invalid verification code' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Verification failed' };
    }
  }

  private async establishSupabaseSession(cleanPhone: string): Promise<AuthUser> {
    const authEmail = `user_${cleanPhone}@stylefleet.salon`;
    const authPassword = `StyleFleet_${cleanPhone}_SecureAuth!`;

    try {
      // 1. Try signing in if already registered in Supabase Auth
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });

      if (!signInError && signInData.user) {
        await supabase.from('profiles').upsert({
          id: signInData.user.id,
          phone: cleanPhone,
        });

        const authUser: AuthUser = {
          id: signInData.user.id,
          phone: cleanPhone,
        };
        await this.saveSession(authUser);
        return authUser;
      }

      // 2. If new user, create account in Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: {
          data: { phone: cleanPhone },
        },
      });

      if (!signUpError && signUpData.user) {
        if (signUpData.session) {
          await supabase.from('profiles').upsert({
            id: signUpData.user.id,
            phone: cleanPhone,
          });
        }

        const authUser: AuthUser = {
          id: signUpData.user.id,
          phone: cleanPhone,
        };
        await this.saveSession(authUser);
        return authUser;
      }
    } catch (e) {
      console.warn('Supabase Auth establishment notice:', e);
    }

    const fallbackUser: AuthUser = {
      id: `user_${cleanPhone}`,
      phone: cleanPhone,
    };
    await this.saveSession(fallbackUser);
    return fallbackUser;
  }

  async saveSession(user: AuthUser): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(user));
  }

  async getSession(): Promise<AuthUser | null> {
    // 1. Instant local storage check (sub-millisecond, offline-safe)
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY_AUTH_USER);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.id || parsed.phone)) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }

    // 2. Active Supabase Auth session
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        const phone =
          data.session.user.phone ||
          (data.session.user.user_metadata?.phone as string) ||
          '';
        const user: AuthUser = {
          id: data.session.user.id,
          phone,
        };
        await this.saveSession(user);
        return user;
      }
    } catch {
      // ignore
    }

    return null;
  }

  async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    await AsyncStorage.removeItem(STORAGE_KEY_AUTH_USER);
    await AsyncStorage.removeItem(STORAGE_KEY_CURRENT_SHOP);
  }

  async getCurrentShopId(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEY_CURRENT_SHOP);
  }

  async setCurrentShopId(shopId: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_CURRENT_SHOP, shopId);
  }
}

export const authRepository = new AuthRepository();
