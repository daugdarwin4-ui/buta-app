import axios from 'axios';
import { EmergencyContact, EmergencyEvent } from '../../types/emergency.types';
import type { GeoCoordinates } from '../../types/navigation.types';
import { API_BASE_URL } from '../../constants/config';

export interface SOSTriggerPayload {
  deviceId: string;
  userFullName: string;
  latitude: number;
  longitude: number;
  address?: string;
  contacts: { name: string; phone: string }[];
}

export interface SOSTriggerResponse {
  event: EmergencyEvent;
  contactsNotified: number;
  message: string;
}

class SOSService {
  /**
   * BACKUP SOS channel (the primary is direct SMS, see sms.service).
   * Contacts live on the device, so they travel with the request; the server texts them via Twilio.
   * Only works when the phone can reach the GuideAI server.
   */
  async triggerSOS(
    deviceId: string,
    userFullName: string,
    contacts: EmergencyContact[],
    location: GeoCoordinates,
    address?: string
  ): Promise<SOSTriggerResponse> {
    const payload: SOSTriggerPayload = {
      deviceId,
      userFullName,
      latitude: location.latitude,
      longitude: location.longitude,
      address,
      contacts: contacts
        .filter((c) => c.notify_by_sms && c.phone_number.trim())
        .map((c) => ({ name: c.name, phone: c.phone_number })),
    };

    const response = await axios.post(
      `${API_BASE_URL}/api/emergency/trigger`,
      payload,
      { timeout: 10000, headers: { 'Content-Type': 'application/json' } }
    );

    return response.data as SOSTriggerResponse;
  }

  /**
   * Mark an active SOS event as resolved
   */
  async resolveEvent(eventId: string): Promise<void> {
    await axios.post(
      `${API_BASE_URL}/api/emergency/resolve`,
      { eventId },
      { timeout: 8000 }
    );
  }
}

export const sosService = new SOSService();
