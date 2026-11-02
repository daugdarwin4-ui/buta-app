import { DirectSms } from '../../../modules/direct-sms';
import type { EmergencyContact } from '../../types/emergency.types';

export interface SmsSendResult {
  sent: EmergencyContact[];   // contacts Android confirmed as sent
  failed: EmergencyContact[]; // contacts that failed
}

/**
 * Primary SOS channel: texts contacts straight from the phone's SIM.
 * Works with only cell signal — no internet, no server, no Twilio.
 */
export const smsService = {
  isAvailable(): boolean {
    try {
      return !!DirectSms?.isAvailable();
    } catch {
      return false;
    }
  },

  async ensurePermission(): Promise<boolean> {
    if (!DirectSms) return false;
    try {
      const res = await DirectSms.requestPermissionAsync();
      return res.granted;
    } catch {
      return false;
    }
  },

  /**
   * Plain text only: emoji would switch the SMS to UCS-2 (70 chars per part) and cost more load.
   */
  buildMessage(userName: string, latitude: number, longitude: number, address?: string): string {
    const where = address ? ` near ${address}` : '';
    return (
      `EMERGENCY: ${userName} needs help${where}. ` +
      `Location: https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)} ` +
      `- sent by GuideAI, an app for the visually impaired.`
    );
  },

  async sendToContacts(contacts: EmergencyContact[], message: string): Promise<SmsSendResult> {
    const result: SmsSendResult = { sent: [], failed: [] };
    if (!DirectSms) {
      result.failed = [...contacts];
      return result;
    }
    // Sequential so one bad number cannot block the rest, and the radio is not flooded
    for (const contact of contacts) {
      try {
        await DirectSms.sendSmsAsync(contact.phone_number.replace(/[\s\-()]/g, ''), message);
        result.sent.push(contact);
      } catch (err) {
        console.warn(`SOS SMS to ${contact.name} failed:`, err);
        result.failed.push(contact);
      }
    }
    return result;
  },
};
