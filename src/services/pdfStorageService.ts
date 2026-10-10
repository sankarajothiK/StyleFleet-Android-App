import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';
import { Bill } from '../types/domain';

/**
 * Converts a base64 string to a Uint8Array across all JS runtimes (Hermes, Node, Web).
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binaryString = (global as any).atob ? (global as any).atob(base64) : '';
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export class PdfStorageService {
  /**
   * Uploads an invoice PDF file to Supabase Storage and returns a permanent,
   * customer-accessible public download URL.
   */
  async uploadInvoicePdf(
    shopId: string,
    bill: Bill,
    pdfLocalUri: string,
    base64Data?: string | null
  ): Promise<string> {
    const cleanNumber = (bill.invoice_number || 'INV').replace(/[^a-zA-Z0-9_-]/g, '_');
    const shortId = bill.id ? bill.id.slice(0, 4) : Date.now().toString().slice(-4);
    const fileName = `${cleanNumber}_${shortId}.pdf`;

    try {
      let fileBytes: Uint8Array;

      if (base64Data) {
        fileBytes = base64ToUint8Array(base64Data);
      } else {
        const base64FromFile = await FileSystem.readAsStringAsync(pdfLocalUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        fileBytes = base64ToUint8Array(base64FromFile);
      }

      // 1. Upload to Supabase Storage 'invoices' bucket at clean root path
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(fileName, fileBytes, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        // Never hand out a link to a file that was not stored (customers would get a 404)
        throw new Error(uploadError.message);
      }

      // 2. Short, branded customer-facing direct PDF URL (single line, ~50 chars)
      const brandedUrl = `https://stylefleet.tecstellar.com/b/${fileName}`;

      // 3. Persist on bills table in Supabase
      if (bill.id) {
        try {
          await supabase
            .from('bills')
            .update({ pdf_url: brandedUrl } as any)
            .eq('id', bill.id);
        } catch (dbErr) {
          console.warn('Could not update bill pdf_url:', dbErr);
        }
      }

      return brandedUrl;
    } catch (err: any) {
      console.warn('PDF storage service error:', err);
      throw err;
    }
  }
}

export const pdfStorageService = new PdfStorageService();
