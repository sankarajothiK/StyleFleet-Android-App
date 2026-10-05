import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase } from '../lib/supabase';

const DEVICE_ID_KEY = '@stylefleet_device_id';

class SystemLogService {
  private deviceId: string | null = null;
  private currentShopId: string | null = null;

  async getDeviceId(): Promise<string> {
    if (this.deviceId) return this.deviceId;
    try {
      let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (!id) {
        id = Crypto.randomUUID();
        await AsyncStorage.setItem(DEVICE_ID_KEY, id);
      }
      this.deviceId = id;
      return id;
    } catch {
      return 'unknown_device';
    }
  }

  setShopId(shopId: string | null) {
    this.currentShopId = shopId;
  }

  getDeviceInfo() {
    return {
      platform: Platform.OS,
      osVersion: String(Platform.Version),
      deviceName: Constants.deviceName || 'Mobile Device',
      appVersion: Constants.expoConfig?.version || '1.0.0',
    };
  }

  async log(
    level: 'info' | 'warn' | 'error' | 'fatal',
    tag: string,
    message: string,
    errorObj?: unknown,
    context?: Record<string, unknown>
  ): Promise<void> {
    const devInfo = this.getDeviceInfo();
    const devId = await this.getDeviceId();

    let stackTrace: string | null = null;
    if (errorObj instanceof Error) {
      stackTrace = errorObj.stack || null;
      if (!message || message === errorObj.message) {
        message = errorObj.message;
      } else {
        message = `${message}: ${errorObj.message}`;
      }
    } else if (errorObj && typeof errorObj === 'object') {
      try {
        stackTrace = JSON.stringify(errorObj);
      } catch {
        stackTrace = String(errorObj);
      }
    }

    // Console output for immediate developer visibility
    if (level === 'error' || level === 'fatal') {
      console.error(`[${level.toUpperCase()}][${tag}] ${message}`, errorObj);
    } else if (level === 'warn') {
      console.warn(`[WARN][${tag}] ${message}`);
    } else {
      console.log(`[INFO][${tag}] ${message}`);
    }

    // Persist real application log to Supabase public.system_logs
    try {
      await supabase.from('system_logs').insert({
        shop_id: this.currentShopId,
        level,
        tag,
        message,
        stack_trace: stackTrace,
        device_id: devId,
        device_info: devInfo,
        context: context || {},
      });
    } catch (err) {
      // In case Supabase table is not yet created or device is offline, fail silently without crashing
      console.warn('[SystemLogService] Failed to persist system log to Supabase:', err);
    }
  }

  async error(tag: string, message: string, errorObj?: unknown, context?: Record<string, unknown>): Promise<void> {
    return this.log('error', tag, message, errorObj, context);
  }

  async warn(tag: string, message: string, context?: Record<string, unknown>): Promise<void> {
    return this.log('warn', tag, message, undefined, context);
  }

  async info(tag: string, message: string, context?: Record<string, unknown>): Promise<void> {
    return this.log('info', tag, message, undefined, context);
  }
}

export const systemLogService = new SystemLogService();
