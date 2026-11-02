/**
 * Unit Tests — Gemini voice assistant: routing between offline keywords and the AI, answer
 * validation, and every failure falling back to offline (network is faked; no real calls)
 */
import { commandParser } from '../src/services/voice/commandParser';
import { cleanForSpeech, parseAssistantReply } from '../src/services/ai/gemini.service';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../src/services/voice/speechRecognition', () => ({
  SpeechRecognition: null,
  useSpeechRecognitionEvent: jest.fn(),
}));
import { shouldUseOfflineOnly } from '../src/hooks/useVoiceAssistant';

type Gemini = typeof import('../src/services/ai/gemini.service');

/** A fresh service (no cooldown, no history) with the given API key */
function loadService(key: string | undefined = 'test-key'): Gemini['geminiService'] {
  jest.resetModules();
  if (key === undefined) delete process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  else process.env.EXPO_PUBLIC_GEMINI_API_KEY = key;
  return (require('../src/services/ai/gemini.service') as Gemini).geminiService;
}

/** Fake fetch answering with a Gemini-shaped body */
function mockFetch(status: number, text?: string) {
  const fn = jest.fn(async (_url: string, _init?: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => (text === undefined ? {} : { candidates: [{ content: { parts: [{ text }] } }] }),
  }));
  (globalThis as unknown as { fetch: unknown }).fetch = fn;
  return fn;
}

const answer = (o: object) => JSON.stringify(o);

describe('shouldUseOfflineOnly', () => {
  const offline = (text: string) => shouldUseOfflineOnly(text, commandParser.parse(text));

  it('handles emergencies and stop on the device, never waiting for the internet', () => {
    expect(offline('emergency')).toBe(true);
    expect(offline('tulong')).toBe(true);
    expect(offline('I fell down this is an emergency please')).toBe(true);
    expect(offline('stop')).toBe(true);
  });

  it('acts directly on short, clear commands', () => {
    expect(offline('where am i')).toBe(true);
    expect(offline('read text')).toBe(true);
    expect(offline('navigate to rizal boulevard')).toBe(true);
  });

  it('sends free-form speech and questions to the AI', () => {
    expect(offline('what time does the public market close')).toBe(false);
    expect(offline('gutom na ko, dad-a ko sa merkado')).toBe(false);
    // Contains a keyword ("help") but is clearly not an emergency
    expect(offline('can you help me find the nearest pharmacy around here')).toBe(false);
  });
});

describe('parseAssistantReply', () => {
  it('accepts a valid answer', () => {
    expect(parseAssistantReply(answer({ intent: 'NAVIGATE', parameter: 'Public Market', reply: 'Starting navigation.' }))).toEqual({
      intent: 'NAVIGATE', parameter: 'Public Market', reply: 'Starting navigation.',
    });
  });

  it('tolerates a code fence and lowercase intent', () => {
    expect(parseAssistantReply('```json\n{"intent":"answer","reply":"It is sunny."}\n```')?.intent).toBe('ANSWER');
  });

  it('rejects unknown intents, empty replies and non-JSON', () => {
    expect(parseAssistantReply(answer({ intent: 'DELETE_EVERYTHING', reply: 'ok' }))).toBeNull();
    expect(parseAssistantReply(answer({ intent: 'ANSWER', reply: '  ' }))).toBeNull();
    expect(parseAssistantReply('Sure! I can help with that.')).toBeNull();
  });

  it('removes markdown the speech engine would read aloud', () => {
    expect(cleanForSpeech('**Car** ahead.\n\n* Keep `left`')).toBe('Car ahead. Keep left');
  });
});

describe('geminiService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is off without an API key and makes no request', async () => {
    const fetchFn = mockFetch(200, answer({ intent: 'ANSWER', reply: 'hi' }));
    const g = loadService('');
    expect(g.status).toBe('not-configured');
    await expect(g.understand('hello')).resolves.toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('returns the understood action and sends the context', async () => {
    const fetchFn = mockFetch(200, answer({ intent: 'NAVIGATE', parameter: 'Public Market', reply: 'Starting navigation to the public market.' }));
    const g = loadService();
    const reply = await g.understand('dad-a ko sa merkado', { detections: ['Car ahead, 3 meters'], knownPlaces: ['Public Market'] });
    expect(reply).toEqual({ intent: 'NAVIGATE', parameter: 'Public Market', reply: 'Starting navigation to the public market.' });

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toContain('gemini-3.5-flash-lite:generateContent');
    expect((init!.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(init!.body as string);
    expect(body.systemInstruction.parts[0].text).toContain('Car ahead, 3 meters');
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });

  it('remembers the last exchange for follow-up questions', async () => {
    const fetchFn = mockFetch(200, answer({ intent: 'ANSWER', reply: 'It opens at 6 in the morning.' }));
    const g = loadService();
    await g.understand('when does the market open');
    await g.understand('and when does it close');
    const body = JSON.parse(fetchFn.mock.calls[1][1]!.body as string);
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user']);
  });

  it('goes quiet after the free limit is reached (429) instead of failing every request', async () => {
    const fetchFn = mockFetch(429);
    const g = loadService();
    await expect(g.understand('what is the weather')).resolves.toBeNull();
    expect(g.status).toBe('cooling-down');
    await g.understand('what is the weather');
    expect(fetchFn).toHaveBeenCalledTimes(1); // second request never left the phone
  });

  it('returns null (fall back to offline) on server errors, bad answers and network failure', async () => {
    mockFetch(500);
    await expect(loadService().understand('hello there')).resolves.toBeNull();
    mockFetch(200, 'not json at all');
    await expect(loadService().understand('hello there')).resolves.toBeNull();
    mockFetch(200); // blocked: no candidates
    await expect(loadService().understand('hello there')).resolves.toBeNull();
    (globalThis as unknown as { fetch: unknown }).fetch = jest.fn(async () => { throw new Error('Network request failed'); });
    await expect(loadService().understand('hello there')).resolves.toBeNull();
  });

  it('describes a photo, sending it as an inline image', async () => {
    const fetchFn = mockFetch(200, 'A **tricycle** is parked in front of you.');
    const g = loadService();
    await expect(g.describeImage('BASE64DATA', 'What is this?')).resolves.toBe('A tricycle is parked in front of you.');
    const body = JSON.parse(fetchFn.mock.calls[0][1]!.body as string);
    expect(body.contents[0].parts[0].inlineData).toEqual({ mimeType: 'image/jpeg', data: 'BASE64DATA' });
  });
});
