import type { ParsedCommand, VoiceCommandIntent } from '../../types/voice.types';

interface IntentPattern {
  intent: VoiceCommandIntent;
  keywords: string[];
  paramExtractor?: (text: string) => string | undefined;
}

const INTENT_PATTERNS: IntentPattern[] = [
  // NAVIGATE — "navigate to X", "go to X", "take me to X", "directions to X"
  {
    intent: 'NAVIGATE',
    keywords: ['navigate', 'navigation', 'go to', 'take me to', 'directions to', 'route to', 'bring me to', 'how to get to',
      'pumunta sa', 'punta sa', 'papunta sa', 'dalhin mo ako sa'],
    paramExtractor: (text) => {
      const patterns = [
        /(?:navigate|go|take me|get me|directions|route|bring me)\s+to\s+(.+)/i,
        /(?:how to get to)\s+(.+)/i,
        /(?:pumunta|punta|papunta|dalhin mo ako)\s+sa\s+(.+)/i,
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m?.[1]) return m[1].trim();
      }
      return undefined;
    },
  },
  // READ_TEXT — "read text", "read sign", "what does this say", "scan sign"
  {
    intent: 'READ_TEXT',
    keywords: ['read text', 'read sign', 'read the sign', 'what does this say', 'scan sign', 'scan text', 'what does it say', 'read this',
      'basahin', 'ano ang nakasulat'],
  },
  // DETECT — "what's around me", "detect objects", "scan environment", "describe surroundings"
  {
    intent: 'DETECT',
    keywords: ["what's around me", 'detect', 'scan', 'describe', 'surroundings', 'obstacles', 'environment', "what's in front", 'look around', 'detect objects',
      'ano ang nasa harap', 'ano ang nasa paligid'],
  },
  // SOS — "emergency", "SOS", "help", "call for help", "send SOS"
  {
    intent: 'SOS',
    keywords: ['emergency', 'sos', 'help', 'help me', 'call for help', 'send sos', 'send emergency', 'i need help', 'call emergency',
      'tulong', 'saklolo', 'tulungan'],
  },
  // STOP — "stop", "cancel", "never mind", "quiet", "shut up", "pause"
  {
    intent: 'STOP',
    keywords: ['stop', 'cancel', 'never mind', 'quiet', 'shut up', 'pause', 'halt', 'silence', 'enough', 'abort',
      'tigil', 'hinto', 'tama na'],
  },
  // MUTE — "mute", "turn off sound", "be quiet"
  {
    intent: 'MUTE',
    keywords: ['mute', 'turn off sound', 'disable voice', 'no sound'],
  },
  // UNMUTE — "unmute", "turn on sound", "enable voice"
  {
    intent: 'UNMUTE',
    keywords: ['unmute', 'turn on sound', 'enable voice', 'sound on'],
  },
  // SETTINGS — "settings", "preferences", "accessibility"
  {
    intent: 'SETTINGS',
    keywords: ['settings', 'preferences', 'accessibility', 'configure', 'options'],
  },
  // PROFILE — "profile", "my account", "account"
  {
    intent: 'PROFILE',
    keywords: ['profile', 'my account', 'account', 'user profile'],
  },
  // HOME — "home", "go home", "main screen", "main menu"
  {
    intent: 'HOME',
    keywords: ['home', 'go home', 'main screen', 'main menu', 'back to home', 'start screen'],
  },
  // REPEAT — "repeat", "say again", "what did you say", "come again"
  {
    intent: 'REPEAT',
    keywords: ['repeat', 'say again', 'what did you say', 'come again', 'repeat that',
      'ulitin', 'ulit'],
  },
  // WHERE_AM_I — "where am I", "my location"
  {
    intent: 'WHERE_AM_I',
    keywords: ['where am i', 'my location', 'current location', 'where i am', 'what street',
      'nasaan ako', 'saan ako'],
  },
  // HELP — list available commands. Bare "help" stays with SOS on purpose.
  {
    intent: 'HELP',
    keywords: ['what can you do', 'what can i say', 'list commands', 'commands', 'voice commands'],
  },
];

export const HELP_MESSAGE =
  'You can say: Scan surroundings. Navigate to, followed by a place. Where am I. Read text. Emergency. Repeat. Or stop. Tagalog also works, like: Nasaan ako, Pumunta sa, Basahin, or Tulong.';

class CommandParser {
  /**
   * Parse a raw STT transcript into a structured voice command intent
   */
  parse(rawText: string): ParsedCommand {
    const normalized = rawText.toLowerCase().trim();

    let bestMatch: { intent: VoiceCommandIntent; confidence: number; parameter?: string } | null = null;

    for (const pattern of INTENT_PATTERNS) {
      for (const keyword of pattern.keywords) {
        if (normalized.includes(keyword.toLowerCase())) {
          const confidence = keyword.length / normalized.length; // Longer keyword = higher confidence
          if (!bestMatch || confidence > bestMatch.confidence) {
            bestMatch = {
              intent: pattern.intent,
              confidence: Math.min(0.95, 0.6 + confidence * 0.4),
              parameter: pattern.paramExtractor?.(normalized),
            };
          }
        }
      }
    }

    if (bestMatch) {
      return {
        intent: bestMatch.intent,
        confidence: bestMatch.confidence,
        rawText,
        parameter: bestMatch.parameter,
      };
    }

    return {
      intent: 'UNKNOWN',
      confidence: 0,
      rawText,
    };
  }

  /**
   * Build a human-readable response message for a parsed command
   */
  getResponseMessage(command: ParsedCommand): string {
    switch (command.intent) {
      case 'NAVIGATE':
        return command.parameter
          ? `Starting navigation to ${command.parameter}.`
          : 'Opening navigation. Where would you like to go?';
      case 'READ_TEXT':
        return 'Opening the text reader. Point your camera at a sign.';
      case 'DETECT':
        return 'Opening object detection. Scanning your surroundings.';
      case 'SOS':
        return 'Opening emergency SOS. Tap the large red button to alert your contacts.';
      case 'STOP':
        return 'Stopped.';
      case 'MUTE':
        return 'Voice guidance muted.';
      case 'UNMUTE':
        return 'Voice guidance enabled.';
      case 'SETTINGS':
        return 'Opening settings.';
      case 'PROFILE':
        return 'Opening your profile.';
      case 'HOME':
        return 'Going back to the main screen.';
      case 'REPEAT':
        return 'Repeating last message.';
      case 'WHERE_AM_I':
        return 'Finding your location.';
      case 'HELP':
        return HELP_MESSAGE;
      default:
        return `I didn't understand "${command.rawText}". Say "what can I say" to hear the commands.`;
    }
  }
}

export const commandParser = new CommandParser();
