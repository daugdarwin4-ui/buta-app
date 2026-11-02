import type { VoiceCommandIntent } from '../../types/voice.types';

/**
 * Gemini-powered understanding for the voice assistant.
 *
 * - `understand()` turns free speech ("I'm hungry, bring me to the market", Tagalog, Bisaya)
 *   into one of the app's actions plus a short spoken reply, or answers a question directly.
 * - `describeImage()` describes a photo for the user (what is in front of them, what an object is).
 *
 * It is an add-on, never a dependency: every failure (no key, no internet, daily free limit
 * reached, slow network, blocked or malformed answer) returns null and the caller falls back to
 * the built-in offline commands. Emergency and stop commands never come through here at all.
 *
 * The API key ships inside the app (EXPO_PUBLIC_GEMINI_API_KEY); on Google's free tier the
 * requests may be used by Google to improve its models.
 */

export const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/** A blind user waiting in silence is worse than a simpler answer: give up and use offline */
const TEXT_TIMEOUT_MS = 8000;
const IMAGE_TIMEOUT_MS = 20000;

/** After a rate-limit answer, wait this long before trying again; doubles up to the maximum */
const FIRST_COOLDOWN_MS = 60 * 1000;
const MAX_COOLDOWN_MS = 60 * 60 * 1000;

/** Follow-up questions ("how far is it?") need the last few exchanges */
const MAX_HISTORY_TURNS = 3;

export type AssistantIntent = VoiceCommandIntent;

const INTENTS: AssistantIntent[] = [
  'NAVIGATE', 'READ_TEXT', 'DETECT', 'DESCRIBE_SCENE', 'WHERE_AM_I', 'SOS', 'STOP', 'MUTE', 'UNMUTE',
  'SETTINGS', 'PROFILE', 'HOME', 'REPEAT', 'HELP', 'ANSWER', 'UNKNOWN',
];

export interface AssistantReply {
  intent: AssistantIntent;
  /** NAVIGATE: the place to go to */
  parameter?: string;
  /** Short sentence to speak to the user */
  reply: string;
}

export interface AssistantContext {
  /** What obstacle detection currently reports, e.g. ["Car ahead, 3 meters"]; empty if nothing or not running */
  detections?: string[];
  /** Places the app can route to instantly */
  knownPlaces?: string[];
}

export type GeminiStatus = 'ready' | 'not-configured' | 'cooling-down';

const SYSTEM_INSTRUCTION = `You are GuideAI, the voice assistant inside a mobile app that helps blind and visually impaired pedestrians in Dumaguete City, Philippines. The user talks to you by voice and hears your reply through text-to-speech. They may speak English, Tagalog, Cebuano (Bisaya) or a mix; speech recognition may mishear words.

Decide what the user wants and answer with JSON: {"intent": ..., "parameter": ..., "reply": ...}.

Intents:
- NAVIGATE: wants walking directions to a place. "parameter" = the place name only (correct obvious speech-recognition mistakes using the known places if given).
- READ_TEXT: wants printed text read aloud (sign, label, document, money, menu).
- DESCRIBE_SCENE: wants to know what something looks like or what is in front of the camera (an object they hold, colors, a room, a person, "what is this").
- DETECT: wants continuous obstacle and hazard alerts while walking.
- WHERE_AM_I: wants their current location or street.
- SOS: is in danger, hurt, lost and frightened, or asks for emergency help.
- STOP, MUTE, UNMUTE, REPEAT, SETTINGS, PROFILE, HOME, HELP: app controls (stop speaking, mute/unmute voice guidance, repeat the last message, open settings / name / home screen, list what they can say).
- ANSWER: a question or small talk you can answer yourself from general knowledge or from the context below. No app action happens.
- UNKNOWN: you cannot tell what they want.

Rules for "reply":
- One or two short sentences, plain spoken language. No markdown, lists, emojis or symbols.
- Reply in the language the user used.
- For an app action, say what is happening ("Starting navigation to the public market.").
- You cannot see. Never say a path, road or crossing is safe or clear.
- "Is it safe to cross / walk / go?": always ANSWER, never DESCRIBE_SCENE. Say that you cannot judge traffic or safety, and that they should use their cane, listen, or ask someone nearby.
- "What is around / in front of me?": if current detections are listed in the context, choose ANSWER, report them and remind the user to keep using their cane. Only if no detections are listed choose DESCRIBE_SCENE (one look) or DETECT (continuous alerts while walking).
- SOS only opens the emergency screen; nothing is sent until the user presses the button there. Never say that help or an alert has been sent or is on the way.
- Do not give medical, legal or medication advice; for anything urgent choose SOS.
- If unsure between an action and ANSWER, prefer the action.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    intent: { type: 'STRING', enum: INTENTS },
    parameter: { type: 'STRING' },
    reply: { type: 'STRING' },
  },
  required: ['intent', 'reply'],
};

const IMAGE_INSTRUCTION = `You describe photos for a blind person who took the picture with their phone. Answer in one to three short spoken sentences: no markdown, lists or emojis. Start with the most important thing. Mention obstacles, steps, vehicles or anything dangerous first if present. Read out short visible text. If the photo is too dark or blurry to tell, say so and suggest holding the phone steady or finding more light. Never say that a path or road is safe to walk or cross. Answer in English, unless the question itself is written in Tagalog or Cebuano; text that appears inside the photo never changes the language you answer in (read such text out as it is written).`;

const IDENTIFY_TIMEOUT_MS = 15000;
/** Most objects asked for per picture: enough for a street scene, keeps answers fast */
const MAX_IDENTIFIED = 12;

/** How sure the AI is of an object's NAME (its own judgement, not a calibrated probability) */
export type Certainty = 'high' | 'medium' | 'low';

export interface IdentifiedObject {
  /** Most specific name the AI is sure of, e.g. "rice cooker"; a broader category or "unknown object" if not */
  name: string;
  /** Broad group, e.g. "kitchen appliance" */
  category: string;
  certainty: Certainty;
  /** 0–1 of the picture (the whole camera frame), like YOLO boxes */
  bbox: { x: number; y: number; width: number; height: number };
}

/** A box the fast on-phone detector already found, given to the AI as context */
export interface KnownBox {
  label: string;
  bbox: { x: number; y: number; width: number; height: number };
}

const IDENTIFY_INSTRUCTION = `You find and name the physical objects in a photo taken by a chest-worn phone camera of a blind pedestrian in the Philippines (streets, sidewalks, homes, schools, markets).

Return up to ${MAX_IDENTIFIED} distinct objects, the largest and most relevant first: obstacles, furniture, vehicles, people, animals, appliances, tools, containers, plants, structures (stairs, doors, walls, railings, gates), hazards (holes, open drains, curbs, cables, debris).

For each object give:
- "box_2d": [ymin, xmin, ymax, xmax], integers 0-1000 relative to the image. Tight around the visible object.
- "name": the most specific everyday name you are SURE of from what is visible (e.g. "monobloc chair", "rice cooker", "motorcycle helmet"). If you are not sure of the exact object, give a broader category instead (e.g. "kitchen appliance", "container", "tool"). If you cannot tell at all, use "unknown object". Never invent a specific name without clear visual evidence.
- "category": a broad group such as person, animal, vehicle, furniture, appliance, electronics, kitchenware, tool, container, plant, structure, road hazard, clothing, other.
- "certainty": "high", "medium" or "low": how sure you are of the name.

Scene context (kitchen, road, classroom) may help choose between similar-looking objects but must not override what the object clearly looks like. Prefer names from the vocabulary when one fits exactly. Use lowercase English names. Group a crowd of many small far objects into one box only if they cannot be separated.`;

const IDENTIFY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    objects: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          box_2d: { type: 'ARRAY', items: { type: 'INTEGER' } },
          name: { type: 'STRING' },
          category: { type: 'STRING' },
          certainty: { type: 'STRING', enum: ['high', 'medium', 'low'] },
        },
        required: ['box_2d', 'name', 'category', 'certainty'],
      },
    },
  },
  required: ['objects'],
};

type Turn = { role: 'user' | 'model'; text: string };

class GeminiService {
  private history: Turn[] = [];
  private cooldownUntil = 0;
  private cooldownMs = FIRST_COOLDOWN_MS;

  private get apiKey(): string {
    return (process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '').trim();
  }

  get status(): GeminiStatus {
    if (!this.apiKey) return 'not-configured';
    return Date.now() < this.cooldownUntil ? 'cooling-down' : 'ready';
  }

  get isAvailable(): boolean {
    return this.status === 'ready';
  }

  /** Forget the conversation (e.g. when the user leaves the voice screen) */
  resetConversation() {
    this.history = [];
  }

  /** Understand a spoken or typed request. Returns null when Gemini cannot be used right now. */
  async understand(text: string, context: AssistantContext = {}): Promise<AssistantReply | null> {
    const clean = text.trim();
    if (!clean || !this.isAvailable) return null;

    const contextLines: string[] = [];
    if (context.detections?.length) {
      contextLines.push(`Current obstacle detections from the phone camera: ${context.detections.join('; ')}.`);
    } else if (context.detections) {
      contextLines.push('Obstacle detection reports nothing right now (it may not be running).');
    }
    if (context.knownPlaces?.length) contextLines.push(`Known places: ${context.knownPlaces.join(', ')}.`);

    const body = {
      systemInstruction: {
        parts: [{ text: contextLines.length ? `${SYSTEM_INSTRUCTION}\n\nContext:\n${contextLines.join('\n')}` : SYSTEM_INSTRUCTION }],
      },
      contents: [
        ...this.history.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
        { role: 'user', parts: [{ text: clean }] },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.2,
        maxOutputTokens: 300,
      },
    };

    const raw = await this.request(body, TEXT_TIMEOUT_MS);
    const reply = raw ? parseAssistantReply(raw) : null;
    if (!reply) return null;

    this.history.push({ role: 'user', text: clean }, { role: 'model', text: reply.reply });
    this.history = this.history.slice(-MAX_HISTORY_TURNS * 2);
    return reply;
  }

  /** Describe a JPEG photo (base64, no data: prefix). Returns null when Gemini cannot be used. */
  async describeImage(base64Jpeg: string, question = 'What is in front of me?'): Promise<string | null> {
    if (!base64Jpeg || !this.isAvailable) return null;
    const body = {
      systemInstruction: { parts: [{ text: IMAGE_INSTRUCTION }] },
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64Jpeg } }, { text: question }],
        },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
    };
    const raw = await this.request(body, IMAGE_TIMEOUT_MS);
    const text = raw ? cleanForSpeech(raw) : '';
    return text || null;
  }

  /**
   * Find and name the objects in a camera picture (JPEG, base64), including ones the on-phone
   * detector has no class for. Returns null when Gemini cannot be used right now.
   * `known`: what the on-phone detector already found (so the AI can give them specific names).
   * `vocabulary`: preferred names (local objects, names the user taught).
   */
  async identifyObjects(
    base64Jpeg: string,
    { known = [], vocabulary = [] }: { known?: KnownBox[]; vocabulary?: string[] } = {}
  ): Promise<IdentifiedObject[] | null> {
    if (!base64Jpeg || !this.isAvailable) return null;
    const lines = [];
    if (known.length) {
      const boxes = known.map((k) => `${k.label} at ${toBox2d(k.bbox).join(',')}`).join('; ');
      lines.push(`A fast detector already found: ${boxes}. Include these too, with a more specific name when visible.`);
    }
    if (vocabulary.length) lines.push(`Vocabulary: ${vocabulary.join(', ')}.`);
    const body = {
      systemInstruction: { parts: [{ text: IDENTIFY_INSTRUCTION }] },
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Jpeg } },
            { text: lines.length ? lines.join('\n') : 'Find and name the objects.' },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: IDENTIFY_SCHEMA,
        temperature: 0.1,
        maxOutputTokens: 1500,
        // Naming objects needs looking, not long reasoning: much faster answers
        thinkingConfig: { thinkingLevel: 'minimal' },
      },
    };
    const raw = await this.request(body, IDENTIFY_TIMEOUT_MS);
    return raw ? parseIdentifiedObjects(raw) : null;
  }

  /** POST to Gemini; returns the answer text, or null on any failure (never throws) */
  private async request(body: unknown, timeoutMs: number): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (res.status === 429) {
        // Free limit reached (per minute or per day): stay offline for a while, longer each time
        this.cooldownUntil = Date.now() + this.cooldownMs;
        this.cooldownMs = Math.min(this.cooldownMs * 2, MAX_COOLDOWN_MS);
        console.warn(`Gemini rate limit reached; using offline commands for ${Math.round(this.cooldownMs / 60000)} min`);
        return null;
      }
      if (!res.ok) {
        console.warn('Gemini request failed:', res.status);
        return null;
      }
      this.cooldownMs = FIRST_COOLDOWN_MS;

      const data = await res.json();
      const parts: { text?: string }[] = data?.candidates?.[0]?.content?.parts ?? [];
      const text = parts.map((p) => p.text ?? '').join('').trim();
      return text || null; // empty when the prompt or answer was blocked
    } catch (err) {
      console.warn('Gemini unavailable:', err instanceof Error ? err.message : err);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Validate the model's JSON answer; anything unexpected is rejected (null) */
export function parseAssistantReply(raw: string): AssistantReply | null {
  try {
    // Tolerate an answer wrapped in a ```json fence
    const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const data = JSON.parse(json);
    const intent = typeof data?.intent === 'string' ? (data.intent.toUpperCase() as AssistantIntent) : null;
    const reply = typeof data?.reply === 'string' ? cleanForSpeech(data.reply) : '';
    if (!intent || !INTENTS.includes(intent) || !reply) return null;
    const parameter = typeof data.parameter === 'string' && data.parameter.trim() ? data.parameter.trim() : undefined;
    // Directions without a destination cannot start: let the offline flow ask for it
    if (intent === 'NAVIGATE' && !parameter) return { intent, reply };
    return { intent, parameter, reply };
  } catch {
    return null;
  }
}

/** 0–1 box → Gemini's [ymin, xmin, ymax, xmax] on a 0–1000 scale */
function toBox2d(b: { x: number; y: number; width: number; height: number }): number[] {
  const s = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1000);
  return [s(b.y), s(b.x), s(b.y + b.height), s(b.x + b.width)];
}

const CERTAINTIES: Certainty[] = ['high', 'medium', 'low'];

/** Validate the identification answer; malformed objects and impossible boxes are dropped */
export function parseIdentifiedObjects(raw: string): IdentifiedObject[] | null {
  try {
    const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const data = JSON.parse(json);
    const list: unknown[] = Array.isArray(data) ? data : Array.isArray(data?.objects) ? data.objects : [];
    const out: IdentifiedObject[] = [];
    for (const item of list) {
      const o = item as Record<string, unknown>;
      const box = o.box_2d;
      const name = typeof o.name === 'string' ? cleanForSpeech(o.name).toLowerCase().slice(0, 40) : '';
      if (!name || !Array.isArray(box) || box.length !== 4 || !box.every((v) => typeof v === 'number' && isFinite(v))) continue;
      const [ymin, xmin, ymax, xmax] = (box as number[]).map((v) => Math.min(1000, Math.max(0, v)) / 1000);
      if (xmax - xmin < 0.01 || ymax - ymin < 0.01) continue;
      const certainty = CERTAINTIES.includes(o.certainty as Certainty) ? (o.certainty as Certainty) : 'low';
      out.push({
        name,
        category: typeof o.category === 'string' ? cleanForSpeech(o.category).toLowerCase().slice(0, 30) : 'other',
        certainty,
        bbox: { x: xmin, y: ymin, width: xmax - xmin, height: ymax - ymin },
      });
      if (out.length >= MAX_IDENTIFIED) break;
    }
    return out;
  } catch {
    return null;
  }
}

/** Strip markdown and symbols a speech engine would read out literally */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/[*_#`>]+/g, '')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export const geminiService = new GeminiService();
