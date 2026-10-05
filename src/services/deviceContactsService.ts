import * as Contacts from 'expo-contacts/legacy';

/**
 * Service to safely handle device contacts synchronization
 * Prevents duplicates and gracefully handles permissions on Android and iOS
 */
export const deviceContactsService = {
  /**
   * Saves a customer to the native device contacts if permissions allow
   * and if the contact does not already exist on the device.
   */
  async saveCustomerToDevice(name: string, phone: string): Promise<boolean> {
    try {
      const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
      if (!cleanPhone || cleanPhone.length < 10) return false;
      const cleanName = (name || '').trim();
      if (!cleanName) return false;

      // Request permission safely
      const { status } = await Contacts.requestPermissionsAsync().catch(() => ({ status: 'denied' }));
      if (status !== 'granted') {
        return false;
      }

      // Query existing device contacts to ensure zero duplicate creation
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.FirstName, Contacts.Fields.LastName],
      }).catch(() => ({ data: [] }));

      const alreadyExists = (data || []).some((contact) => {
        if (!contact.phoneNumbers || contact.phoneNumbers.length === 0) return false;
        return contact.phoneNumbers.some((p) => {
          const num = (p.number || '').replace(/\D/g, '').slice(-10);
          return num === cleanPhone;
        });
      });

      if (alreadyExists) {
        return true; // Already exists on device, do not create duplicate
      }

      // Add to device contacts
      await Contacts.addContactAsync({
        [Contacts.Fields.FirstName]: cleanName,
        [Contacts.Fields.PhoneNumbers]: [
          {
            label: 'mobile',
            number: `+91 ${cleanPhone}`,
          },
        ],
      } as any);

      return true;
    } catch (err) {
      console.warn('deviceContactsService: failed to write contact to device:', err);
      return false;
    }
  },
};
