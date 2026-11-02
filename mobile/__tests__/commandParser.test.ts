/**
 * Unit Tests — commandParser (Voice Assistant)
 * Tests intent matching, confidence scoring, and parameter extraction
 */
import { commandParser } from '../src/services/voice/commandParser';

describe('commandParser.parse', () => {
  // NAVIGATE intent
  describe('NAVIGATE intent', () => {
    it('recognises "navigate to public market"', () => {
      const result = commandParser.parse('navigate to public market');
      expect(result.intent).toBe('NAVIGATE');
    });

    it('recognises "go to silliman university"', () => {
      const result = commandParser.parse('go to silliman university');
      expect(result.intent).toBe('NAVIGATE');
    });

    it('extracts destination parameter from navigate command', () => {
      const result = commandParser.parse('navigate to dumaguete city hall');
      expect(result.parameter).toBe('dumaguete city hall');
    });

    it('extracts destination from "take me to the hospital"', () => {
      const result = commandParser.parse('take me to the hospital');
      expect(result.intent).toBe('NAVIGATE');
      expect(result.parameter).toContain('hospital');
    });
  });

  // READ_TEXT intent
  describe('READ_TEXT intent', () => {
    it('recognises "read text"', () => {
      expect(commandParser.parse('read text').intent).toBe('READ_TEXT');
    });

    it('recognises "read sign"', () => {
      expect(commandParser.parse('read sign').intent).toBe('READ_TEXT');
    });

    it('recognises "what does this say"', () => {
      expect(commandParser.parse('what does this say').intent).toBe('READ_TEXT');
    });

    it('recognises "scan text"', () => {
      expect(commandParser.parse('scan text').intent).toBe('READ_TEXT');
    });
  });

  // DETECT intent
  describe('DETECT intent', () => {
    it('recognises "describe surroundings"', () => {
      expect(commandParser.parse("describe surroundings").intent).toBe('DETECT');
    });

    it('recognises "what\'s around me"', () => {
      expect(commandParser.parse("what's around me").intent).toBe('DETECT');
    });

    it('recognises "detect objects"', () => {
      expect(commandParser.parse('detect objects').intent).toBe('DETECT');
    });
  });

  // SOS intent
  describe('SOS intent', () => {
    it('recognises "emergency"', () => {
      expect(commandParser.parse('emergency').intent).toBe('SOS');
    });

    it('recognises "send SOS"', () => {
      expect(commandParser.parse('send sos').intent).toBe('SOS');
    });

    it('recognises "help me"', () => {
      expect(commandParser.parse('help me').intent).toBe('SOS');
    });
  });

  // STOP intent
  describe('STOP intent', () => {
    it('recognises "stop"', () => {
      expect(commandParser.parse('stop').intent).toBe('STOP');
    });

    it('recognises "cancel"', () => {
      expect(commandParser.parse('cancel').intent).toBe('STOP');
    });

    it('recognises "never mind"', () => {
      expect(commandParser.parse('never mind').intent).toBe('STOP');
    });
  });

  // HOME and SETTINGS
  describe('HOME and SETTINGS intents', () => {
    it('recognises "go home"', () => {
      expect(commandParser.parse('go home').intent).toBe('HOME');
    });

    it('recognises "settings"', () => {
      expect(commandParser.parse('settings').intent).toBe('SETTINGS');
    });
  });

  // WHERE_AM_I and HELP
  describe('WHERE_AM_I and HELP intents', () => {
    it('recognises "where am I"', () => {
      expect(commandParser.parse('where am i').intent).toBe('WHERE_AM_I');
    });

    it('recognises "what is my location"', () => {
      expect(commandParser.parse('what is my location').intent).toBe('WHERE_AM_I');
    });

    it('recognises "what can I say"', () => {
      expect(commandParser.parse('what can i say').intent).toBe('HELP');
    });

    it('treats bare "help" as SOS, not the command list', () => {
      expect(commandParser.parse('help').intent).toBe('SOS');
    });
  });

  // UNKNOWN intent
  describe('UNKNOWN intent', () => {
    it('returns UNKNOWN for unrecognised input', () => {
      const result = commandParser.parse('qwertyuiop');
      expect(result.intent).toBe('UNKNOWN');
      expect(result.confidence).toBe(0);
    });

    it('preserves raw text in result', () => {
      const raw = 'this is an unknown command';
      expect(commandParser.parse(raw).rawText).toBe(raw);
    });
  });

  // Confidence
  describe('confidence scoring', () => {
    it('returns confidence > 0.5 for known intents', () => {
      const result = commandParser.parse('navigate to somewhere');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('returns confidence 0 for UNKNOWN intent', () => {
      expect(commandParser.parse('zzz').confidence).toBe(0);
    });
  });
});

describe('commandParser.getResponseMessage', () => {
  it('includes destination in NAVIGATE response when parameter is set', () => {
    const msg = commandParser.getResponseMessage({
      intent: 'NAVIGATE',
      confidence: 0.9,
      rawText: 'navigate to the market',
      parameter: 'the market',
    });
    expect(msg).toContain('the market');
  });

  it('returns fallback NAVIGATE message when no parameter', () => {
    const msg = commandParser.getResponseMessage({
      intent: 'NAVIGATE',
      confidence: 0.7,
      rawText: 'navigate',
    });
    expect(msg).toMatch(/navigation/i);
  });

  it('returns a non-empty message for UNKNOWN intent', () => {
    const msg = commandParser.getResponseMessage({
      intent: 'UNKNOWN',
      confidence: 0,
      rawText: 'zzz',
    });
    expect(msg.length).toBeGreaterThan(0);
  });

  it('returns SOS message for SOS intent', () => {
    const msg = commandParser.getResponseMessage({
      intent: 'SOS',
      confidence: 0.9,
      rawText: 'emergency',
    });
    expect(msg.toLowerCase()).toContain('sos');
  });
});
