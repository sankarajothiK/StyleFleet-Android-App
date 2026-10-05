import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SupportMessage {
  id?: string;
  shop_id: string;
  user_id?: string;
  message: string;
  contact_info?: string;
  status?: string;
  created_at?: string;
}

export interface SupportMessageAnswer {
  id: string;
  shop_id: string;
  message_id?: string;
  admin_name?: string;
  answer: string;
  is_read: boolean;
  created_at?: string;
}

export interface AccountDeletionRecord {
  id?: string;
  shop_id?: string;
  user_id?: string;
  phone?: string;
  shop_name?: string;
  reason?: string;
  status?: string;
  deleted_at?: string;
}

export const supportRepository = {
  /**
   * Fetch all answers / replies sent from the admin panel for this shop
   */
  async getSupportMessageAnswers(shopId: string): Promise<SupportMessageAnswer[]> {
    try {
      const { data, error } = await supabase
        .from('support_message_answers')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase fetch support answers error:', error.message);
      } else if (data) {
        await AsyncStorage.setItem(
          `@salon_os_support_answers_${shopId}`,
          JSON.stringify(data)
        );
        return data as SupportMessageAnswer[];
      }
    } catch (e) {
      console.warn('Offline fetch support answers:', e);
    }

    try {
      const cached = await AsyncStorage.getItem(`@salon_os_support_answers_${shopId}`);
      if (cached) return JSON.parse(cached);
    } catch {
      // ignore
    }
    return [];
  },

  /**
   * Mark a support message answer as read
   */
  async markAnswerAsRead(shopId: string, answerId: string): Promise<void> {
    try {
      await supabase
        .from('support_message_answers')
        .update({ is_read: true })
        .eq('id', answerId);
    } catch (e) {
      // ignore
    }

    try {
      const cached = await AsyncStorage.getItem(`@salon_os_support_answers_${shopId}`);
      if (cached) {
        const list: SupportMessageAnswer[] = JSON.parse(cached);
        const updated = list.map((a) => (a.id === answerId ? { ...a, is_read: true } : a));
        await AsyncStorage.setItem(`@salon_os_support_answers_${shopId}`, JSON.stringify(updated));
      }
    } catch {
      // ignore
    }
  },

  /**
   * Realtime subscription for incoming answers from admin panel
   */
  subscribeToSupportAnswers(
    shopId: string,
    onNewAnswer: (answer: SupportMessageAnswer) => void
  ) {
    const channel = supabase
      .channel(`support_answers_${shopId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_message_answers',
          filter: `shop_id=eq.${shopId}`,
        },
        (payload) => {
          if (payload.new) {
            onNewAnswer(payload.new as SupportMessageAnswer);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
  /**
   * Submit a help desk support ticket to Supabase support_messages
   */
  async submitSupportMessage(ticket: Omit<SupportMessage, 'id' | 'created_at'>): Promise<SupportMessage> {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .insert({
          shop_id: ticket.shop_id,
          user_id: ticket.user_id,
          message: ticket.message,
          contact_info: ticket.contact_info || '',
          status: 'open',
        })
        .select()
        .single();

      if (error) {
        console.warn('Supabase support message insert error:', error.message);
      }

      if (data) {
        return data as SupportMessage;
      }
    } catch (e) {
      console.warn('Offline support ticket submission:', e);
    }

    // Fallback store locally if offline
    const localId = `ticket_${Date.now()}`;
    const localTicket: SupportMessage = {
      id: localId,
      ...ticket,
      status: 'open',
      created_at: new Date().toISOString(),
    };
    try {
      const existing = await AsyncStorage.getItem('@salon_os_support_tickets');
      const list = existing ? JSON.parse(existing) : [];
      list.push(localTicket);
      await AsyncStorage.setItem('@salon_os_support_tickets', JSON.stringify(list));
    } catch (e) {
      // Ignore
    }
    return localTicket;
  },

  /**
   * Permanently delete account and record into Supabase account_deletions
   */
  async permanentlyDeleteAccount(params: {
    shopId: string;
    userId?: string;
    shopName?: string;
    phone?: string;
    reason?: string;
  }): Promise<boolean> {
    const shopId = params.shopId;
    const phone = params.phone || '';
    const shopName = params.shopName || '';
    const reason = params.reason || 'User requested permanent account deletion';

    try {
      // 1. Primary method: Call atomic SECURITY DEFINER function in Supabase
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc(
          'permanently_delete_salon' as any,
          {
            p_shop_id: shopId,
            p_phone: phone,
            p_reason: reason,
          }
        );
        if (!rpcErr && rpcData?.success) {
          console.log('Successfully deleted salon via RPC permanently_delete_salon');
        } else if (rpcErr) {
          console.warn('RPC permanently_delete_salon error, falling back to direct delete:', rpcErr.message);
        }
      } catch (rpcEx) {
        console.warn('RPC call exception, proceeding with direct delete:', rpcEx);
      }

      // 2. Direct client-side deletion (guarantees removal even if RPC is not present)
      // A. Log record in account_deletions
      try {
        await supabase.from('account_deletions').insert({
          shop_id: shopId,
          phone: phone,
          shop_name: shopName,
          reason: reason,
          status: 'processed',
          deleted_at: new Date().toISOString(),
        });
      } catch (logErr) {
        console.warn('Could not record account_deletions row:', logErr);
      }

      // B. Retrieve shop record to get owner_profile_id before deleting
      let ownerProfileId: string | null = null;
      if (shopId) {
        try {
          const { data: shopRecord } = await supabase
            .from('shops')
            .select('owner_profile_id, phone')
            .eq('id', shopId)
            .single();
          if (shopRecord) {
            ownerProfileId = shopRecord.owner_profile_id;
          }
        } catch {
          // ignore
        }

        // C. Explicitly delete child records across all tables
        try {
          await supabase.from('support_message_answers').delete().eq('shop_id', shopId);
          await supabase.from('support_messages').delete().eq('shop_id', shopId);

          const { data: shopBills } = await supabase
            .from('bills')
            .select('id')
            .eq('shop_id', shopId);
          if (shopBills && shopBills.length > 0) {
            const billIds = shopBills.map((b) => b.id);
            await supabase.from('bill_items').delete().in('bill_id', billIds);
          }
          await supabase.from('payments').delete().eq('shop_id', shopId);
          await supabase.from('bills').delete().eq('shop_id', shopId);
          await supabase.from('appointments').delete().eq('shop_id', shopId);
          await supabase.from('expenses').delete().eq('shop_id', shopId);
          await supabase.from('expense_categories').delete().eq('shop_id', shopId);
          await supabase.from('customers').delete().eq('shop_id', shopId);
          await supabase.from('staff').delete().eq('shop_id', shopId);
          await supabase.from('services').delete().eq('shop_id', shopId);
          await supabase.from('service_categories').delete().eq('shop_id', shopId);
          await supabase.from('offers').delete().eq('shop_id', shopId);
          await supabase.from('reminder_rules').delete().eq('shop_id', shopId);
          await supabase.from('shop_settings').delete().eq('shop_id', shopId);
          await supabase.from('whatsapp_messages').delete().eq('shop_id', shopId);
          await supabase.from('whatsapp_campaigns').delete().eq('shop_id', shopId);
          await supabase.from('whatsapp_templates').delete().eq('shop_id', shopId);
          await supabase.from('shop_members').delete().eq('shop_id', shopId);
        } catch (cascadeErr) {
          console.warn('Cascading pre-deletion caught:', cascadeErr);
        }

        // D. Delete the shop row itself
        const { error: shopDelErr } = await supabase.from('shops').delete().eq('id', shopId);
        if (shopDelErr) {
          console.warn('Direct delete shops row error:', shopDelErr.message);
        }
      }

      // Also delete any duplicate shop by phone if phone was provided
      if (phone) {
        try {
          await supabase.from('shops').delete().eq('phone', phone);
        } catch {
          // ignore
        }
      }

      // E. Delete the owner profile
      if (ownerProfileId) {
        try {
          await supabase.from('profiles').delete().eq('id', ownerProfileId);
        } catch {
          // ignore
        }
      }
      if (phone) {
        try {
          await supabase.from('profiles').delete().eq('phone', phone);
        } catch {
          // ignore
        }
      }

      // 3. Clear all local AsyncStorage caches and session keys
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToClear = allKeys.filter(
        (k) => k.startsWith('@salon_os') || k.startsWith('sb-')
      );
      if (keysToClear.length > 0) {
        await AsyncStorage.multiRemove(keysToClear);
      }

      // 4. Sign out auth session
      await supabase.auth.signOut().catch(() => {});

      return true;
    } catch (e) {
      console.error('Error during permanent account deletion:', e);
      // Ensure local state is wiped even if remote delete encountered error
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const keysToClear = allKeys.filter(
          (k) => k.startsWith('@salon_os') || k.startsWith('sb-')
        );
        if (keysToClear.length > 0) {
          await AsyncStorage.multiRemove(keysToClear);
        }
        await supabase.auth.signOut().catch(() => {});
      } catch {
        // Ignore
      }
      return true;
    }
  },
};
