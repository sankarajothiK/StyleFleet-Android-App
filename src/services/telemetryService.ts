import { Platform, Dimensions } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase } from '../lib/supabase';
import { systemLogService } from './systemLogService';

const DEVICE_ID_KEY = '@stylefleet_device_id';
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export interface HardwareTelemetryPayload {
  shop_id: string | null;
  device_id: string;
  device_name: string | null;
  platform: string;
  os_name: string;
  os_version: string;
  app_version: string;
  battery_level: number | null;
  is_charging: boolean | null;
  network_type: string | null;
  screen_resolution: string;
  memory_usage: Record<string, unknown>;
  metadata: Record<string, unknown>;
  recorded_at: string;
}

export interface SystemHealthPayload {
  shop_id: string | null;
  component: string;
  status: 'healthy' | 'degraded' | 'unreachable' | 'critical';
  latency_ms: number | null;
  error_count: number;
  details: Record<string, unknown>;
  timestamp: string;
}

class TelemetryService {
  private deviceId: string | null = null;
  private currentShopId: string | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private isStreaming = false;

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

  private isValidUUID(id: string | null | undefined): boolean {
    if (!id) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  }

  setShopId(shopId: string | null) {
    this.currentShopId = this.isValidUUID(shopId) ? shopId : null;
    systemLogService.setShopId(this.currentShopId);
    // Trigger immediate stream on shop context resolution
    if (this.isStreaming) {
      this.captureAndSendTelemetry().catch(() => {});
      this.captureAndSendHealth().catch(() => {});
    }
  }

  /**
   * Collect real device hardware metrics
   */
  async collectHardwareTelemetry(): Promise<HardwareTelemetryPayload> {
    const devId = await this.getDeviceId();
    const window = Dimensions.get('window');
    const screen = Dimensions.get('screen');

    return {
      shop_id: this.isValidUUID(this.currentShopId) ? this.currentShopId : null,
      device_id: devId,
      device_name: Constants.deviceName || (Platform.OS === 'android' ? 'Android Device' : 'iOS Device'),
      platform: Platform.OS,
      os_name: Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'iOS' : 'Web',
      os_version: String(Platform.Version),
      app_version: Constants.expoConfig?.version || '1.0.0',
      battery_level: null, // Populated when battery module is configured
      is_charging: null,
      network_type: 'online',
      screen_resolution: `${Math.round(window.width)}x${Math.round(window.height)} (density: ${screen.scale || 1})`,
      memory_usage: {
        fontScale: window.fontScale,
        screenScale: screen.scale,
      },
      metadata: {
        expoVersion: Constants.expoVersion || null,
        executionEnvironment: Constants.executionEnvironment || null,
        appOwnership: Constants.appOwnership || null,
      },
      recorded_at: new Date().toISOString(),
    };
  }

  /**
   * Stream live hardware telemetry to public.telemetry in Supabase
   */
  async captureAndSendTelemetry(): Promise<boolean> {
    try {
      const payload = await this.collectHardwareTelemetry();
      const { error } = await supabase.from('telemetry').insert(payload as any);

      if (error) {
        // If shop_id violates foreign key (e.g. shop was deleted or not yet synced in DB), retry with null shop_id
        if ((error.code === '23503' || error.message?.includes('foreign key')) && payload.shop_id) {
          const fallbackPayload = { ...payload, shop_id: null };
          const { error: fallbackErr } = await supabase.from('telemetry').insert(fallbackPayload as any);
          if (!fallbackErr) return true;
        }

        // Table might not exist yet or network offline
        if (error.code !== 'PGRST205' && error.code !== '23503') {
          console.warn('[TelemetryService] Telemetry push notice:', error.message);
        }
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[TelemetryService] Failed to stream telemetry:', err);
      return false;
    }
  }

  /**
   * Perform real health probe and stream to public.system_health
   */
  async captureAndSendHealth(): Promise<boolean> {
    const start = Date.now();
    let dbStatus: 'healthy' | 'degraded' | 'unreachable' = 'healthy';
    let latencyMs = 0;

    try {
      // Real database connectivity probe
      const { error } = await supabase.from('shops').select('id').limit(1);
      latencyMs = Date.now() - start;

      if (error) {
        dbStatus = 'degraded';
      }
    } catch {
      dbStatus = 'unreachable';
      latencyMs = Date.now() - start;
    }

    const devId = await this.getDeviceId();
    const safeShopId = this.isValidUUID(this.currentShopId) ? this.currentShopId : null;

    // 1. Mobile App Client Component Health
    const appHealthPayload: SystemHealthPayload = {
      shop_id: safeShopId,
      component: 'mobile_app',
      status: 'healthy',
      latency_ms: null,
      error_count: 0,
      details: {
        device_id: devId,
        platform: Platform.OS,
        os_version: String(Platform.Version),
        app_version: Constants.expoConfig?.version || '1.0.0',
        uptime_seconds: Math.floor(process.uptime ? process.uptime() : 0),
      },
      timestamp: new Date().toISOString(),
    };

    // 2. Supabase Database Component Health
    const dbHealthPayload: SystemHealthPayload = {
      shop_id: safeShopId,
      component: 'database',
      status: dbStatus,
      latency_ms: latencyMs,
      error_count: dbStatus === 'healthy' ? 0 : 1,
      details: {
        endpoint: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://scgokpcoyfewrtrwqxpu.supabase.co',
        responseTimeMs: latencyMs,
      },
      timestamp: new Date().toISOString(),
    };

    try {
      const { error } = await supabase.from('system_health').insert([appHealthPayload, dbHealthPayload] as any);
      if (error && (error.code === '23503' || error.message?.includes('foreign key')) && safeShopId) {
        // Fallback retry with null shop_id
        await supabase.from('system_health').insert([
          { ...appHealthPayload, shop_id: null },
          { ...dbHealthPayload, shop_id: null },
        ] as any);
      }
      return true;
    } catch (err) {
      console.warn('[TelemetryService] Failed to stream system health:', err);
      return false;
    }
  }

  /**
   * Start live background telemetry stream
   */
  startStream(shopId?: string | null) {
    if (shopId !== undefined) {
      this.setShopId(shopId);
    }
    if (this.isStreaming) return;
    this.isStreaming = true;

    // Initial immediate probe
    this.captureAndSendTelemetry().catch(() => {});
    this.captureAndSendHealth().catch(() => {});

    // Periodic heartbeat
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.captureAndSendTelemetry().catch(() => {});
      this.captureAndSendHealth().catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Stop telemetry stream
   */
  stopStream() {
    this.isStreaming = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export const telemetryService = new TelemetryService();
