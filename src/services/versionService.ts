import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { STYLEFLEET_PLAY_STORE_URL } from '../constants/app';

export interface VersionCheckResult {
  isMandatoryUpdateRequired: boolean;
  isUpdateAvailable: boolean;
  currentVersion: string;
  minRequiredVersion: string;
  latestVersion: string;
  releaseNotes?: string;
  storeUrl: string;
}

/**
 * Compares two semantic version strings (e.g. "1.0.1" vs "1.0.0").
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = (v1 || '0').split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = (v2 || '0').split('.').map((p) => parseInt(p, 10) || 0);
  const len = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < len; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export const versionService = {
  getCurrentVersion(): string {
    return Constants.expoConfig?.version || '1.0.1';
  },

  async checkAppVersion(): Promise<VersionCheckResult> {
    const currentVersion = this.getCurrentVersion();
    const defaultPlayStore = STYLEFLEET_PLAY_STORE_URL;
    const defaultAppStore = 'https://apps.apple.com/app/id6742398471';
    const defaultStoreUrl = Platform.OS === 'ios' ? defaultAppStore : defaultPlayStore;

    try {
      const { data, error } = await supabase
        .from('app_version_config')
        .select('*')
        .eq('id', 'global')
        .maybeSingle();

      if (error || !data) {
        return {
          isMandatoryUpdateRequired: false,
          isUpdateAvailable: false,
          currentVersion,
          minRequiredVersion: currentVersion,
          latestVersion: currentVersion,
          storeUrl: defaultStoreUrl,
        };
      }

      const minRequired = data.min_required_version || '1.0.0';
      const latest = data.latest_version || currentVersion;
      const storeUrl = Platform.OS === 'ios'
        ? (data.app_store_url || defaultAppStore)
        : (data.play_store_url || defaultPlayStore);

      const isOutdated = compareVersions(currentVersion, minRequired) < 0;
      const isMandatory = isOutdated || (data.is_mandatory && compareVersions(currentVersion, latest) < 0);
      const isUpdateAvailable = compareVersions(currentVersion, latest) < 0;

      return {
        isMandatoryUpdateRequired: isMandatory,
        isUpdateAvailable,
        currentVersion,
        minRequiredVersion: minRequired,
        latestVersion: latest,
        releaseNotes: data.release_notes || undefined,
        storeUrl,
      };
    } catch (err) {
      console.warn('[versionService] Failed to check app version:', err);
      return {
        isMandatoryUpdateRequired: false,
        isUpdateAvailable: false,
        currentVersion,
        minRequiredVersion: currentVersion,
        latestVersion: currentVersion,
        storeUrl: defaultStoreUrl,
      };
    }
  },

  async openAppUpdateStore(storeUrl?: string): Promise<void> {
    const defaultMarketUrl = 'market://details?id=com.stylefleet.app';
    const fallbackPlayStoreWeb = STYLEFLEET_PLAY_STORE_URL;
    const fallbackAppStoreWeb = 'https://apps.apple.com/app/id6742398471';
    const targetUrl = storeUrl || (Platform.OS === 'ios' ? fallbackAppStoreWeb : fallbackPlayStoreWeb);

    try {
      if (Platform.OS === 'android') {
        const canOpen = await Linking.canOpenURL(defaultMarketUrl);
        if (canOpen) {
          await Linking.openURL(defaultMarketUrl);
          return;
        }
      }
      await Linking.openURL(targetUrl);
    } catch {
      Linking.openURL(targetUrl).catch(() => {});
    }
  },
};
