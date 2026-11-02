import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

interface SOSContact {
  name: string;
  phone: string;
}

interface SOSTriggerData {
  deviceId: string;
  userFullName: string;
  latitude: number;
  longitude: number;
  address?: string;
  contacts: SOSContact[];
}

class EmergencyService {
  private getTwilioClient() {
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
      return twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    }
    return null;
  }

  /**
   * Full SOS trigger workflow (there are no user accounts):
   * 1. Text each contact sent by the phone via Twilio
   * 2. Log the event to emergency_events (best effort)
   * 3. Return summary. contactsNotified only counts messages Twilio actually accepted.
   */
  async triggerSOS(data: SOSTriggerData) {
    const { deviceId, userFullName, latitude, longitude, address, contacts } = data;

    // 1. Build SMS message
    const mapsLink = `https://maps.google.com/maps?q=${latitude},${longitude}`;
    const locationText = address ? `near ${address}` : 'at the location below';
    const timestamp = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });

    const smsBody = [
      `🆘 EMERGENCY ALERT`,
      `${userFullName} needs help ${locationText}.`,
      ``,
      `📍 Location:`,
      `${mapsLink}`,
      ``,
      `🕐 Time: ${timestamp}`,
      `📱 Sent from GuideAI, an assistive app for the visually impaired`,
    ].join('\n');

    // 2. Send SMS to each contact
    let notifiedCount = 0;
    const twilioClient = this.getTwilioClient();
    const smsConfigured = !!(twilioClient && env.TWILIO_PHONE_NUMBER);

    if (smsConfigured) {
      for (const contact of contacts) {
        try {
          await twilioClient!.messages.create({
            body: smsBody,
            from: env.TWILIO_PHONE_NUMBER,
            to: contact.phone.replace(/[\s\-()]/g, ''),
          });
          notifiedCount++;
          console.log(`✅ SMS sent to ${contact.name}`);
        } catch (err) {
          console.error(`❌ Failed to SMS ${contact.name}:`, err);
        }
      }
    } else {
      // Never report a fake success for an emergency alert
      console.warn('⚠️ Twilio not configured — SOS SMS NOT sent. Add TWILIO_* env vars to enable real alerts.');
    }

    // 3. Log emergency event (best effort; the alert itself does not depend on it)
    const triggeredAt = new Date().toISOString();
    const { data: event, error: eventError } = await supabase
      .from('emergency_events')
      .insert({
        device_id: deviceId,
        latitude,
        longitude,
        address: address ?? null,
        contacts_notified: notifiedCount,
        status: 'active',
        triggered_at: triggeredAt,
      })
      .select()
      .single();

    if (eventError) {
      console.error('Failed to log emergency event:', eventError);
    }

    let message: string;
    if (!smsConfigured) {
      message = 'Text messages are not set up on the alert server, so no one was alerted. Call 911 directly.';
    } else if (notifiedCount === 0) {
      message = 'The alert could not be delivered to any contact. Call 911 directly.';
    } else {
      message = `SOS sent. ${notifiedCount} of ${contacts.length} contact${contacts.length !== 1 ? 's' : ''} notified.`;
    }

    return {
      event: event ?? {
        id: `evt_${Date.now()}`,
        device_id: deviceId,
        latitude,
        longitude,
        address,
        contacts_notified: notifiedCount,
        status: 'active',
        triggered_at: triggeredAt,
      },
      contactsNotified: notifiedCount,
      message,
    };
  }

  /**
   * Resolve an active emergency event
   */
  async resolveEvent(eventId: string) {
    // Events that failed to log were given a local id; there is nothing to update
    if (eventId.startsWith('evt_')) return { success: true };

    const { error } = await supabase
      .from('emergency_events')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', eventId);

    if (error) throw error;
    return { success: true };
  }
}

export const emergencyService = new EmergencyService();
