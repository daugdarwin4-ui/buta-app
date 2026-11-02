import { Platform } from 'react-native';

export const Typography = {
  // ─── Font Families ──────────────────────────────────────────
  fontFamily: {
    regular: Platform.select({ ios: 'System', android: 'sans-serif' }),
    medium: Platform.select({ ios: 'System', android: 'sans-serif-medium' }),
    bold: Platform.select({ ios: 'System', android: 'sans-serif-bold' }),
    mono: Platform.select({ ios: 'Courier', android: 'monospace' }),
  },

  // ─── Font Sizes (large defaults for accessibility) ──────────
  fontSize: {
    xs: 14,
    sm: 16,
    md: 18,
    lg: 22,
    xl: 28,
    xxl: 36,
    display: 48,
  },

  // ─── Line Heights ────────────────────────────────────────────
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    loose: 1.8,
  },

  // ─── Font Weights ────────────────────────────────────────────
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },

  // ─── Letter Spacing ─────────────────────────────────────────
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
  },
} as const;
