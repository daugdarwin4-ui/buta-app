import { useState, useRef, useCallback, useEffect } from 'react';
import { smsService } from '../services/emergency/sms.service';
import { nativeFeatureMissingMessage } from '../services/native/appEnvironment';
import { gpsService } from '../services/navigation/gps.service';
import { sosService } from '../services/emergency/sos.service';
import { contactsService } from '../services/emergency/contacts.service';
import { ttsService } from '../services/tts/tts.service';
import { hapticsService } from '../services/haptics/haptics.service';
import { useUserStore } from '../stores/userStore';
import type { SOSStatus, EmergencyEvent, EmergencyContact } from '../types/emergency.types';

const COUNTDOWN_SECONDS = 5;
const ADDRESS_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

export function useEmergency() {
  const { deviceId, name } = useUserStore();
  const [status, setStatus] = useState<SOSStatus>('idle');
  const [countdownSeconds, setCountdownSeconds] = useState(COUNTDOWN_SECONDS);
  const [activeEvent, setActiveEvent] = useState<EmergencyEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Contacts the SIM actually reached, so "I am safe" goes to the same people */
  const notifiedRef = useRef<EmergencyContact[]>([]);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // ── Begin the 5-second countdown before SOS fires ─────────────
  const startSOS = useCallback(async () => {
    if (status !== 'idle' && status !== 'cancelled' && status !== 'error') return;

    await hapticsService.triggerForRisk('critical');
    ttsService.speakImmediate(
      `Emergency SOS activating in ${COUNTDOWN_SECONDS} seconds. Tap the button again to cancel.`,
      'critical'
    );
    setStatus('countdown');
    setCountdownSeconds(COUNTDOWN_SECONDS);
    setError(null);

    let remaining = COUNTDOWN_SECONDS;
    countdownRef.current = setInterval(async () => {
      remaining -= 1;
      setCountdownSeconds(remaining);

      if (remaining === 3) {
        ttsService.speakImmediate('3', 'critical');
        await hapticsService.triggerForRisk('warning');
      } else if (remaining === 2) {
        ttsService.speakImmediate('2', 'critical');
      } else if (remaining === 1) {
        ttsService.speakImmediate('1', 'critical');
      } else if (remaining <= 0) {
        clearCountdown();
        sendSOS();
      }
    }, 1000);
  }, [status, clearCountdown]);

  // ── Actually fire the SOS after countdown ─────────────────────
  // Primary: direct SMS from the phone's SIM. Backup: server + Twilio for anyone the SIM missed.
  const sendSOS = useCallback(async () => {
    setStatus('sending');
    await hapticsService.triggerForRisk('critical');
    ttsService.speakImmediate('Sending SOS alert to your emergency contacts now.', 'critical');

    try {
      const contacts = (await contactsService.getContacts()).filter(
        (c) => c.notify_by_sms && c.phone_number.trim()
      );
      if (contacts.length === 0) {
        throw new Error('No emergency contacts saved, so no one was alerted. Call 911, or add a contact in Settings.');
      }

      const userName = name || 'A GuideAI user';
      const location = await gpsService.getCurrentLocation();
      // Reverse geocoding needs internet; never let it hold up an emergency
      const address = await withTimeout(gpsService.getAddress(location), ADDRESS_TIMEOUT_MS).catch(
        () => undefined
      );

      // 1. Primary — straight from the SIM
      let sent: EmergencyContact[] = [];
      if (smsService.isAvailable() && (await smsService.ensurePermission())) {
        const message = smsService.buildMessage(userName, location.latitude, location.longitude, address);
        sent = (await smsService.sendToContacts(contacts, message)).sent;
      }

      // 2. Backup — server/Twilio for contacts the SIM could not reach (only works when the server is reachable)
      const missed = contacts.filter((c) => !sent.some((s) => s.id === c.id));
      let backupCount = 0;
      let event: EmergencyEvent | null = null;
      if (missed.length > 0) {
        try {
          const result = await sosService.triggerSOS(deviceId, userName, missed, location, address);
          backupCount = result.contactsNotified;
          event = result.event;
        } catch (err) {
          console.warn('SOS backup (server) failed:', err);
        }
      }

      const total = sent.length + backupCount;
      if (total === 0) {
        throw new Error(
          smsService.isAvailable()
            ? 'The alert could not be sent. Check your signal and load, or call 911 directly.'
            : `No one was alerted. Call 911 directly. ${nativeFeatureMissingMessage('Direct texting')}`
        );
      }

      notifiedRef.current = sent;
      setActiveEvent(
        event ?? {
          id: `local_${Date.now()}`,
          device_id: deviceId,
          latitude: location.latitude,
          longitude: location.longitude,
          address,
          contacts_notified: total,
          status: 'active',
          triggered_at: new Date().toISOString(),
        }
      );
      setStatus('active');

      await hapticsService.success();
      const notReached = contacts.length - total;
      ttsService.speakImmediate(
        `SOS sent to ${total} contact${total !== 1 ? 's' : ''}.` +
          (notReached > 0 ? ` ${notReached} could not be reached.` : '') +
          ' Help is on the way.',
        'critical'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send SOS. Call 911 directly.';
      setError(msg);
      setStatus('error');
      await hapticsService.triggerForRisk('warning');
      ttsService.speakImmediate(`SOS failed. ${msg}`, 'critical');
    }
  }, [deviceId, name]);

  // ── Cancel during countdown window ────────────────────────────
  const cancelSOS = useCallback(async () => {
    clearCountdown();
    setStatus('cancelled');
    setCountdownSeconds(COUNTDOWN_SECONDS);
    await hapticsService.buttonPress();
    ttsService.speakImmediate('SOS cancelled.');
  }, [clearCountdown]);

  // ── Resolve an active SOS event: tell the same contacts the user is safe ──
  const resolveSOS = useCallback(async () => {
    if (!activeEvent) return;
    const notified = notifiedRef.current;
    let safeTexts = 0;
    if (notified.length > 0) {
      const message = `UPDATE: ${name || 'The GuideAI user'} is safe now. The emergency is over.`;
      safeTexts = (await smsService.sendToContacts(notified, message)).sent.length;
    }
    if (!activeEvent.id.startsWith('local_')) {
      sosService.resolveEvent(activeEvent.id).catch(() => {});
    }
    notifiedRef.current = [];
    setStatus('resolved');
    setActiveEvent(null);
    ttsService.speakImmediate(
      safeTexts > 0
        ? `Emergency resolved. ${safeTexts} contact${safeTexts !== 1 ? 's were' : ' was'} told you are safe.`
        : 'Emergency resolved. Please let your contacts know you are safe.'
    );
  }, [activeEvent, name]);

  // ── Reset to idle ─────────────────────────────────────────────
  const resetSOS = useCallback(() => {
    clearCountdown();
    setStatus('idle');
    setCountdownSeconds(COUNTDOWN_SECONDS);
    setActiveEvent(null);
    setError(null);
  }, [clearCountdown]);

  useEffect(() => {
    return () => clearCountdown();
  }, [clearCountdown]);

  return {
    status,
    countdownSeconds,
    activeEvent,
    error,
    startSOS,
    cancelSOS,
    resolveSOS,
    resetSOS,
    isCountingDown: status === 'countdown',
    isSending: status === 'sending',
    isActive: status === 'active',
  };
}
