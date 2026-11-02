import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  AccessibilityRole,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { MIN_TOUCH_TARGET } from '../../constants/config';
import { hapticsService } from '../../services/haptics/haptics.service';

interface AccessibleButtonProps {
  label: string;
  onPress: () => void;
  hint?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityRole?: AccessibilityRole;
}

/**
 * Accessible button — meets WCAG minimum touch target (48×48dp).
 * Always has accessibilityLabel. Triggers haptic on press.
 */
export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  label,
  onPress,
  hint,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  loading = false,
  style,
  textStyle,
  accessibilityRole = 'button',
}) => {
  const handlePress = async () => {
    await hapticsService.buttonPress();
    onPress();
  };

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        disabled && styles.disabled,
        style,
      ]}
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: disabled || loading }}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator color={Colors.white} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, styles[`text_${variant}`], styles[`textSize_${size}`], textStyle]}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    gap: 8,
  },

  // ─── Variants ─────────────────────────────────────────────
  primary: {
    backgroundColor: Colors.primary,
  },
  secondary: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  danger: {
    backgroundColor: Colors.danger,
  },
  ghost: {
    backgroundColor: Colors.transparent,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  disabled: {
    opacity: 0.4,
  },

  // ─── Sizes ────────────────────────────────────────────────
  size_sm: { paddingHorizontal: 16, paddingVertical: 10 },
  size_md: { paddingHorizontal: 24, paddingVertical: 14 },
  size_lg: { paddingHorizontal: 32, paddingVertical: 18 },

  // ─── Text base ────────────────────────────────────────────
  text: {
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: Typography.letterSpacing.wide,
  },
  text_primary: { color: Colors.white },
  text_secondary: { color: Colors.textPrimary },
  text_danger: { color: Colors.white },
  text_ghost: { color: Colors.primary },

  // ─── Text sizes ───────────────────────────────────────────
  textSize_sm: { fontSize: Typography.fontSize.sm },
  textSize_md: { fontSize: Typography.fontSize.md },
  textSize_lg: { fontSize: Typography.fontSize.lg },
});
