import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';
import { base64ToUint8Array } from './pdfStorageService';

export class LogoStorageService {
  /**
   * Converts a local picked image URI into a universally accessible Supabase Storage URL
   * or a base64 data URI so it loads perfectly on all devices (stylists, owners, customer invoices).
   */
  async processAndUploadLogo(shopId: string, localImageUri: string): Promise<string> {
    if (!localImageUri) return '';
    // If already a remote HTTPS URL or base64 data URI, keep as-is
    if (
      localImageUri.startsWith('http://') ||
      localImageUri.startsWith('https://') ||
      localImageUri.startsWith('data:image/')
    ) {
      return localImageUri;
    }

    try {
      const info = await FileSystem.getInfoAsync(localImageUri).catch(() => ({ exists: false }));
      if (!info.exists) {
        return '';
      }

      const base64 = await FileSystem.readAsStringAsync(localImageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!base64) return '';

      const safeShopId = (shopId || 'shop').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `logos/shop_${safeShopId}_${Date.now()}.jpg`;

      // 1. Try uploading to Supabase Storage 'invoices' bucket
      try {
        const fileBytes = base64ToUint8Array(base64);
        const { error: uploadErr } = await supabase.storage
          .from('invoices')
          .upload(fileName, fileBytes, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (!uploadErr) {
          const { data: pubData } = supabase.storage
            .from('invoices')
            .getPublicUrl(fileName);

          if (pubData?.publicUrl) {
            return pubData.publicUrl;
          }
        }
      } catch (storageErr) {
        console.warn('Supabase storage upload notice:', storageErr);
      }

      // 2. Reliable cross-device fallback: Base64 data URI (works everywhere across Android/iOS without local file dependencies)
      return `data:image/jpeg;base64,${base64}`;
    } catch (err) {
      console.warn('processAndUploadLogo error:', err);
      return localImageUri;
    }
  }
}

export const logoStorageService = new LogoStorageService();
