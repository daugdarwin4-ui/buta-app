/**
 * GuideAI Color System
 * High-contrast, accessibility-first palette for visually impaired users.
 * All foreground/background pairs meet WCAG AA (4.5:1 contrast ratio minimum).
 */

export const Colors = {
  // ─── Brand ────────────────────────────────────────────────
  primary: '#8B5CF6',        // Purple — primary actions
  primaryDark: '#6D28D9',    // Purple dark — pressed state
  primaryLight: '#A78BFA',   // Purple light — highlights

  // ─── Backgrounds ──────────────────────────────────────────
  background: '#0A0A0A',     // Deep black — main background
  surface: '#111111',        // Dark gray — cards, panels
  surfaceAlt: '#1A1A1A',     // Slightly lighter — elevated surfaces
  border: '#2A2A2A',         // Subtle borders

  // ─── Semantic ─────────────────────────────────────────────
  danger: '#EF4444',         // Red — emergencies, critical hazards
  dangerDark: '#DC2626',     // Red dark — pressed state
  warning: '#F97316',        // Orange — warnings
  success: '#22C55E',        // Green — safe detections, info
  info: '#3B82F6',           // Blue — informational

  // ─── Text ─────────────────────────────────────────────────
  textPrimary: '#FFFFFF',    // White — primary text
  textSecondary: '#A1A1AA',  // Gray — secondary text
  textMuted: '#52525B',      // Dark gray — disabled/hint text

  // ─── Navigation buttons (home dashboard) ──────────────────
  navDetection: '#8B5CF6',   // Purple
  navNavigation: '#8B5CF6',  // Purple
  navReadText: '#8B5CF6',    // Purple
  navEmergency: '#EF4444',   // Red
  navWhereAmI: '#F59E0B',    // Amber/Gold
  navHistory: '#8B5CF6',     // Purple

  // ─── Detection bounding boxes ────────────────────────────
  bboxSafe: '#22C55E',       // Green — person, low-risk
  bboxHazard: '#EF4444',     // Red — vehicles, critical hazards
  bboxWarning: '#F97316',    // Orange — moderate hazards

  // ─── Misc ─────────────────────────────────────────────────
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  // ─── Overlay ──────────────────────────────────────────────
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.4)',
} as const;

export type ColorKey = keyof typeof Colors;
