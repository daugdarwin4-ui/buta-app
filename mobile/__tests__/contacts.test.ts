/**
 * Unit Tests — emergency contact phone validation
 * A bad number is only discovered when an SOS text fails, so it must be caught on save.
 */
import { normalizePhoneNumber, spellPhoneNumber } from '../src/services/emergency/contacts.service';

describe('normalizePhoneNumber', () => {
  it.each([
    ['0917 123 4567', '09171234567'],
    ['0917-123-4567', '09171234567'],
    ['(0917) 123.4567', '09171234567'],
    ['+63 917 123 4567', '+639171234567'],
    ['63 917 123 4567', '+639171234567'],
    ['(035) 422 1234', '0354221234'],
    ['+1 415 555 0100', '+14155550100'],
  ])('accepts %s', (input, expected) => {
    expect(normalizePhoneNumber(input)).toBe(expected);
  });

  it.each([
    ['0917 123 456'],     // PH mobile, one digit short
    ['0917 123 45678'],   // PH mobile, one digit long
    ['+63 917 123 456'],  // +63 mobile, short
    ['call me'],
    ['123'],
    ['911'],
    [''],
  ])('rejects %s', (input) => {
    expect(normalizePhoneNumber(input)).toBeNull();
  });
});

describe('spellPhoneNumber', () => {
  it('spells digits one by one for a screen reader', () => {
    expect(spellPhoneNumber('09171234567')).toBe('0 9 1 7 1 2 3 4 5 6 7');
    expect(spellPhoneNumber('+639171234567')).toBe('plus 6 3 9 1 7 1 2 3 4 5 6 7');
  });
});
