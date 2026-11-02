import * as Speech from 'expo-speech';
import { DEFAULT_TTS_RATE, DEFAULT_TTS_PITCH, DEFAULT_TTS_LANGUAGE } from '../../constants/config';
import type { RiskLevel } from '../../constants/hazards';

interface TTSQueueItem {
  text: string;
  priority: number; // Lower = higher priority (0 = critical)
  /** Drop instead of speaking after this time: a late hazard warning describes a scene that is gone */
  expiresAt?: number;
}

/**
 * Universal Crash-Proof TTS Service
 *
 * Handles:
 *  - Lazy Android TTS Engine initialization (zero cold-start crashes)
 *  - Duplicate voice suppression (prevents stuttering)
 *  - Priority queuing for critical hazard alerts
 *  - Graceful multi-tier fallback to default speech voice
 */
class TTSService {
  private queue: TTSQueueItem[] = [];
  private isSpeaking = false;
  /** Priority of the message currently being spoken (0 = critical) */
  private currentPriority = 2;
  /** When the current message is expected to be over, in case the engine never reports "done" */
  private speakingUntil = 0;
  private rate = DEFAULT_TTS_RATE;
  private pitch = DEFAULT_TTS_PITCH;
  private language = DEFAULT_TTS_LANGUAGE;
  private voiceIdentifier: string | undefined = undefined;
  private voices: Speech.Voice[] = [];
  private isInitialized = false;

  /** Tracks recently spoken text to suppress duplicates */
  private lastSpoken = '';
  private lastSpokenTime = 0;

  /** Last message actually sent to the speech engine, for "repeat" */
  private lastUtterance = '';
  private readonly DUPLICATE_SUPPRESS_MS = 3000; // 3 seconds
  /** Queued announcements older than this are skipped */
  private readonly STALE_MS = 4000;

  /** Debounce timer for batch queue flushes */
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_MS = 200;

  /** Priority map per risk level */
  private priorityMap: Record<RiskLevel, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  /** Lazy voice initialization without crashing on Android cold start */
  private async _ensureVoiceInitialized() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    try {
      // Add timeout to prevent hanging on native TTS binding
      const voicesPromise = Speech.getAvailableVoicesAsync();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TTS voice lookup timeout')), 1000)
      );
      const voices = await Promise.race([voicesPromise, timeoutPromise]);
      this.voices = Array.isArray(voices) ? voices : [];
    } catch {
      this.voices = [];
    }
    // Honor the language chosen in Settings (it may have been set before voices loaded)
    this.voiceIdentifier = this._pickVoice(this.language);
  }

  /**
   * Best installed voice for a language such as "en-PH", or undefined to let the engine choose.
   * Prefers an exact locale match, then the enhanced-quality one.
   */
  private _pickVoice(language: string): string | undefined {
    const want = language.toLowerCase();
    const matches = this.voices.filter((v) => v?.language?.toLowerCase().replace('_', '-') === want);
    if (matches.length === 0) return undefined;
    const enhanced = matches.find((v) => v.quality === Speech.VoiceQuality.Enhanced);
    return (enhanced ?? matches[0]).identifier;
  }

  /**
   * True while a message is being spoken. Guarded by an estimate of the message's length, so a
   * speech engine that never reports "done" cannot leave the app silent forever.
   */
  get isBusy(): boolean {
    return this.isSpeaking && Date.now() < this.speakingUntil;
  }

  /** Priority of the message being spoken (0 = critical, 2 = info), or null when silent */
  get speakingPriority(): number | null {
    return this.isBusy ? this.currentPriority : null;
  }

  setRate(rate: number) { this.rate = rate; }
  setPitch(pitch: number) { this.pitch = pitch; }
  setLanguage(language: string) {
    this.language = language;
    // Without this, a previously picked voice (e.g. Indian English) would override the new choice
    this.voiceIdentifier = this.isInitialized ? this._pickVoice(language) : undefined;
  }
  setVoice(voiceIdentifier: string) { this.voiceIdentifier = voiceIdentifier; }

  /**
   * Speak a message with priority queuing.
   * Duplicate texts within 3 seconds are silently dropped.
   */
  speak(text: string, riskLevel: RiskLevel = 'info') {
    if (!text?.trim()) return;

    const priority = this.priorityMap[riskLevel];
    const now = Date.now();

    // Suppress duplicate within window (unless critical)
    if (priority > 0 && text === this.lastSpoken && now - this.lastSpokenTime < this.DUPLICATE_SUPPRESS_MS) {
      return;
    }

    this.lastSpoken = text;
    this.lastSpokenTime = now;

    // Critical alerts bypass queue and speak immediately
    if (priority === 0) {
      this.stop();
      this._speakDirect(text, 0);
      return;
    }

    // Insert into priority queue
    const insertIdx = this.queue.findIndex((item) => item.priority > priority);
    if (insertIdx === -1) {
      this.queue.push({ text, priority, expiresAt: now + this.STALE_MS });
    } else {
      this.queue.splice(insertIdx, 0, { text, priority, expiresAt: now + this.STALE_MS });
    }

    // Debounce processing
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this._processQueue(), this.DEBOUNCE_MS);
  }

  /**
   * Speak immediately (bypasses queue, used for UI buttons & actions).
   *
   * Safety rule: a non-critical message never cuts off a critical one that is still being
   * spoken (e.g. a navigation step cannot interrupt "Stairs ahead"). It waits its turn instead.
   */
  speakImmediate(text: string, riskLevel: RiskLevel = 'info') {
    if (!text?.trim()) return;
    const priority = this.priorityMap[riskLevel];

    if (priority > 0 && this.isSpeaking && this.currentPriority === 0) {
      // Play right after any queued critical items
      const insertIdx = this.queue.findIndex((item) => item.priority > 0);
      this.queue.splice(insertIdx === -1 ? this.queue.length : insertIdx, 0, { text, priority });
      return;
    }

    this.stop();
    this._speakDirect(text, priority);
  }

  /**
   * Repeat the last message that was spoken
   */
  repeatLast() {
    this.speakImmediate(this.lastUtterance || 'Nothing to repeat yet.');
  }

  /**
   * Internal direct speak call with safe fallbacks
   */
  private async _speakDirect(text: string, priority = 2) {
    this.lastUtterance = text;
    this.currentPriority = priority;
    try {
      await this._ensureVoiceInitialized();
      await this._callNativeSpeak(text);
    } catch {
      // Fallback without options
      try {
        Speech.speak(text, { language: 'en-US', rate: 0.95 });
      } catch {
        this.isSpeaking = false;
        this._processQueue();
      }
    }
  }

  /**
   * Multi-tier native speak wrapper to prevent Android NPE crashes
   */
  private async _callNativeSpeak(text: string): Promise<void> {
    this.isSpeaking = true;
    // Generous estimate (slowest speed setting, plus engine start-up)
    this.speakingUntil = Date.now() + 2000 + text.length * 110;

    const baseOptions: Speech.SpeechOptions = {
      language: this.language || 'en-IN',
      pitch: this.pitch,
      rate: this.rate,
      onDone: () => {
        this.isSpeaking = false;
        this._processQueue();
      },
      onError: () => {
        this.isSpeaking = false;
        this._processQueue();
      },
      onStopped: () => {
        this.isSpeaking = false;
      },
    };

    try {
      if (this.voiceIdentifier) {
        Speech.speak(text, { ...baseOptions, voice: this.voiceIdentifier });
      } else {
        Speech.speak(text, baseOptions);
      }
    } catch {
      // Silent fallback
      Speech.speak(text, {
        language: 'en-US',
        onDone: () => {
          this.isSpeaking = false;
          this._processQueue();
        },
        onError: () => {
          this.isSpeaking = false;
          this._processQueue();
        },
      });
    }
  }

  /**
   * Process next item in priority queue
   */
  private _processQueue() {
    if (this.isSpeaking) return;
    const now = Date.now();
    let next = this.queue.shift();
    // Skip announcements that went stale while waiting
    while (next && next.expiresAt !== undefined && next.expiresAt < now) next = this.queue.shift();
    if (next) this._speakDirect(next.text, next.priority);
  }

  /**
   * Stop speaking and clear queue
   */
  stop() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.queue = [];
    this.isSpeaking = false;
    try {
      Speech.stop();
    } catch {
      // Ignore
    }
  }

  /**
   * Check if speech engine is speaking
   */
  async isSpeechActive(): Promise<boolean> {
    try {
      return await Speech.isSpeakingAsync();
    } catch {
      return this.isSpeaking;
    }
  }
}

export const ttsService = new TTSService();
