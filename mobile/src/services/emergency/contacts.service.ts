import AsyncStorage from '@react-native-async-storage/async-storage';
import { EmergencyContact } from '../../types/emergency.types';

const CONTACTS_STORAGE_KEY = '@guideai_emergency_contacts';

type ContactFields = Pick<EmergencyContact, 'name' | 'phone_number' | 'relationship' | 'notify_by_sms'>;

/**
 * Clean up a typed or dictated phone number, or return null if it cannot be valid.
 * A bad number would only be discovered when an SOS text fails, so reject it up front.
 *
 * Accepts Philippine mobiles (09XXXXXXXXX, +639XXXXXXXXX, 639XXXXXXXXX) and other
 * numbers of 7–15 digits with an optional leading +.
 */
export function normalizePhoneNumber(raw: string): string | null {
  const compact = raw.trim().replace(/[\s\-().]/g, '');
  if (!/^\+?\d+$/.test(compact)) return null;

  const hasPlus = compact.startsWith('+');
  const digits = compact.replace('+', '');

  // Philippine mobiles must have the exact length, or the SOS text goes nowhere
  if (!hasPlus && digits.startsWith('09')) return digits.length === 11 ? digits : null; // 0917 123 4567
  if (digits.startsWith('639')) return digits.length === 12 ? `+${digits}` : null;      // (+)63 917 123 4567

  if (digits.length >= 7 && digits.length <= 15) return hasPlus ? `+${digits}` : digits;
  return null;
}

/** "0917 123 4567" -> "0 9 1 7, 1 2 3, 4 5 6 7" so a screen-reader user can check it */
export function spellPhoneNumber(phone: string): string {
  const d = phone.replace('+', 'plus ').replace(/\d/g, (c) => `${c} `).trim();
  return d.replace(/\s+/g, ' ');
}

async function save(contacts: EmergencyContact[]): Promise<void> {
  await AsyncStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
}

/**
 * Emergency contacts are stored on the device only (there are no accounts).
 * They are sent along with each SOS request so the server can text them.
 */
export const contactsService = {
  async getContacts(): Promise<EmergencyContact[]> {
    try {
      const stored = await AsyncStorage.getItem(CONTACTS_STORAGE_KEY);
      return stored ? (JSON.parse(stored) as EmergencyContact[]) : [];
    } catch (e) {
      console.warn('Error reading emergency contacts:', e);
      return [];
    }
  },

  async addContact(contact: ContactFields): Promise<EmergencyContact> {
    const newContact: EmergencyContact = {
      id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: contact.name.trim(),
      phone_number: contact.phone_number.trim(),
      relationship: contact.relationship || 'Family',
      notify_by_sms: contact.notify_by_sms !== false,
      created_at: new Date().toISOString(),
    };
    const existing = await this.getContacts();
    await save([...existing, newContact]);
    return newContact;
  },

  async updateContact(contactId: string, updates: Partial<ContactFields>): Promise<void> {
    const existing = await this.getContacts();
    await save(existing.map((c) => (c.id === contactId ? { ...c, ...updates } : c)));
  },

  async deleteContact(contactId: string): Promise<void> {
    const existing = await this.getContacts();
    await save(existing.filter((c) => c.id !== contactId));
  },
};
