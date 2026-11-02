import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { DetectedHazard } from '../../types/detection.types';
import { Typography } from '../../constants/typography';
import { ttsService } from '../../services/tts/tts.service';
import { hapticsService } from '../../services/haptics/haptics.service';

interface HazardBannerProps {
  detections: DetectedHazard[];
  onSelectDetection?: (item: DetectedHazard) => void;
  /** Shown instead of "Path Clear" when the camera cannot see (dark / covered lens) */
  viewWarning?: string | null;
}

export const HazardBanner: React.FC<HazardBannerProps> = ({
  detections,
  onSelectDetection,
  viewWarning,
}) => {
  const handleCardPress = async (item: DetectedHazard) => {
    await hapticsService.buttonPress();
    ttsService.speak(item.announcement, item.riskLevel);
    onSelectDetection?.(item);
  };

  return (
    <View style={styles.container}>
      {/* List of active hazard alert cards */}
      <View style={styles.alertsList}>
        {detections.length === 0 && viewWarning ? (
          <View style={styles.warningCard} accessible accessibilityLabel={viewWarning} accessibilityRole="alert">
            <Text style={styles.clearIcon}>⚠️</Text>
            <View style={styles.clearTextContainer}>
              <Text style={styles.warningTitle}>Camera Can't See</Text>
              <Text style={styles.clearSubtitle}>{viewWarning}</Text>
            </View>
          </View>
        ) : detections.length === 0 ? (
          <View style={styles.clearCard}>
            <Text style={styles.clearIcon}>🔎</Text>
            <View style={styles.clearTextContainer}>
              {/* Never "path clear": the camera can miss thin, glass or low obstacles and drop-offs */}
              <Text style={styles.clearTitle}>No obstacles detected</Text>
              <Text style={styles.clearSubtitle}>The camera can miss things. Keep using your cane.</Text>
            </View>
          </View>
        ) : (
          detections.slice(0, 3).map((item, idx) => {
            // The announcement is already a correct sentence ("Car on your right, 2 meters")
            const title = item.announcement.replace(/\.$/, '');
            const sub = item.source === 'cane' ? 'Cane device' : 'Phone camera';
            const arrow = item.direction === 'left' ? '←' : item.direction === 'right' ? '→' : '↑';
            const arrowColor =
              item.riskLevel === 'critical' ? '#EF4444' : item.riskLevel === 'warning' ? '#F97316' : '#22C55E';

            return (
              <TouchableOpacity
                key={`${item.source}-${item.label}-${idx}`}
                style={styles.hazardCard}
                onPress={() => handleCardPress(item)}
                accessibilityLabel={`${title}. From the ${sub.toLowerCase()}. Tap to hear again.`}
                accessibilityRole="button"
                activeOpacity={0.8}
              >
                {/* Arrow Icon */}
                <View style={styles.arrowBox}>
                  <Text style={[styles.arrowText, { color: arrowColor }]}>{arrow}</Text>
                </View>

                {/* Text Content */}
                <View style={styles.textContainer}>
                  <Text style={styles.titleText}>{title}</Text>
                  <Text style={styles.subText}>{sub}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F0F12',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: '#222228',
  },
  alertsList: {
    gap: 10,
    marginBottom: 16,
  },
  hazardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181D',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#2A2A32',
  },
  arrowBox: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  arrowText: {
    fontSize: 26,
    fontWeight: '900',
  },
  textContainer: {
    flex: 1,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: 2,
  },
  subText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: Typography.fontWeight.medium,
  },
  clearCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181D',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#2A2A32',
  },
  clearIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  clearTextContainer: {
    flex: 1,
  },
  clearTitle: {
    color: '#22C55E',
    fontSize: 16,
    fontWeight: Typography.fontWeight.bold,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A1F05',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  warningTitle: {
    color: '#FCD34D',
    fontSize: 16,
    fontWeight: Typography.fontWeight.bold,
  },
  clearSubtitle: {
    color: '#9CA3AF',
    fontSize: 13,
  },
});
