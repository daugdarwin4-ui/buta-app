import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { OcrResult } from '../../types/ocr.types';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { MIN_TOUCH_TARGET } from '../../constants/config';

interface TextResultCardProps {
  result: OcrResult;
  onReadAloud: () => void;
  onClear: () => void;
}

export const TextResultCard: React.FC<TextResultCardProps> = ({
  result,
  onReadAloud,
  onClear,
}) => {
  const lines = result.text.split('\n').filter((l) => l.trim().length > 0);

  // Detect if contains WARNING / CAUTION / DANGER for extra highlight
  const upperText = result.text.toUpperCase();
  const isCritical =
    upperText.includes('DANGER') ||
    upperText.includes('CAUTION') ||
    upperText.includes('WARNING') ||
    upperText.includes('NO ENTRY');

  const headerColor = isCritical ? Colors.danger : Colors.primary;

  return (
    <View
      style={[styles.container, isCritical && styles.containerCritical]}
      accessible
      accessibilityLabel={`Detected text: ${result.text}`}
    >
      {/* Badge row */}
      <View style={styles.headerRow}>
        <View style={[styles.badge, { backgroundColor: headerColor + '22', borderColor: headerColor }]}>
          <Text style={[styles.badgeText, { color: headerColor }]}>
            {isCritical ? '⚠️ Critical Sign' : '📄 Text Detected'}
          </Text>
        </View>
        {result.confidence != null && (
          <Text style={styles.confidence}>
            {Math.round(result.confidence * 100)}% confidence
          </Text>
        )}
        <TouchableOpacity
          onPress={onClear}
          style={styles.clearBtn}
          accessibilityLabel="Clear detected text"
          accessibilityRole="button"
        >
          <Text style={styles.clearBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Text content */}
      <ScrollView style={styles.textScroll} showsVerticalScrollIndicator={false}>
        {lines.map((line, i) => (
          <Text
            key={i}
            style={[
              styles.line,
              i === 0 && styles.firstLine,
              isCritical && i === 0 && styles.criticalFirstLine,
            ]}
            accessibilityElementsHidden
          >
            {line}
          </Text>
        ))}
      </ScrollView>

      {/* Action row */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: headerColor }]}
          onPress={onReadAloud}
          accessibilityLabel="Read text aloud"
          accessibilityHint="Plays the detected text through the speaker"
          accessibilityRole="button"
        >
          <Text style={styles.actionButtonText}>🔊 Read Aloud</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: 16,
  },
  containerCritical: {
    borderColor: Colors.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  confidence: {
    flex: 1,
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    textAlign: 'right',
  },
  clearBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: {
    color: Colors.textMuted,
    fontSize: 16,
    fontWeight: 'bold',
  },
  textScroll: {
    maxHeight: 140,
    marginBottom: 16,
  },
  line: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.md,
    lineHeight: 26,
    marginBottom: 2,
  },
  firstLine: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: 6,
  },
  criticalFirstLine: {
    color: Colors.danger,
    fontSize: Typography.fontSize.xl,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
});
