import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationStep, RoutePlan } from '../../types/navigation.types';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';

interface TurnByTurnPanelProps {
  currentStep?: NavigationStep;
  routePlan?: RoutePlan;
  /** Live distance to the upcoming maneuver, e.g. "in 40 meters" */
  distanceLabel?: string;
}

export const TurnByTurnPanel: React.FC<TurnByTurnPanelProps> = ({
  currentStep,
  routePlan,
  distanceLabel,
}) => {
  const instruction = currentStep?.instruction || 'No active route';
  const distanceSub = distanceLabel ?? '';

  const distance = routePlan?.totalDistanceText || '—';
  const timeLeft = routePlan?.totalDurationText || '—';
  const arrival = routePlan?.eta || '—';

  // Maneuver symbol
  let turnIcon = '↱';
  if (currentStep?.maneuver === 'turn-left' || currentStep?.maneuver === 'slight-left') {
    turnIcon = '↰';
  } else if (currentStep?.maneuver === 'straight') {
    turnIcon = '↑';
  } else if (currentStep?.maneuver === 'arrive') {
    turnIcon = '📍';
  }

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${instruction} ${distanceSub}. Total ${distance}, about ${timeLeft}, arriving ${arrival}.`}
    >
      {/* Primary Turn Instruction Header */}
      <View style={styles.instructionRow}>
        <View style={styles.turnIconBox}>
          <Text style={styles.turnIconText}>{turnIcon}</Text>
        </View>

        <View style={styles.instructionTextContainer}>
          <Text style={styles.instructionTitle} accessibilityRole="header">
            {instruction.includes('Turn') ? instruction.split(' in ')[0] : instruction}
          </Text>
          <Text style={styles.distanceSubtitle}>{distanceSub}</Text>
        </View>
      </View>

      {/* Stats Divider */}
      <View style={styles.divider} />

      {/* 3-Column Metrics Strip matching Screen 4 */}
      <View style={styles.metricsRow}>
        {/* Metric 1: Distance */}
        <View style={styles.metricColumn}>
          <Text style={styles.metricValue}>{distance}</Text>
          <Text style={styles.metricLabel}>Distance</Text>
        </View>

        <View style={styles.verticalDivider} />

        {/* Metric 2: Time Left */}
        <View style={styles.metricColumn}>
          <Text style={styles.metricValue}>{timeLeft}</Text>
          <Text style={styles.metricLabel}>Time Left</Text>
        </View>

        <View style={styles.verticalDivider} />

        {/* Metric 3: Arrival */}
        <View style={styles.metricColumn}>
          <Text style={styles.metricValue}>{arrival}</Text>
          <Text style={styles.metricLabel}>Arrival</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111116',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#24242E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  turnIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  turnIconText: {
    fontSize: 28,
    color: '#8B5CF6',
    fontWeight: '900',
  },
  instructionTextContainer: {
    flex: 1,
  },
  instructionTitle: {
    fontSize: 20,
    fontWeight: Typography.fontWeight.extrabold,
    color: '#FFFFFF',
    marginBottom: 3,
  },
  distanceSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: Typography.fontWeight.medium,
  },
  divider: {
    height: 1,
    backgroundColor: '#1F1F28',
    marginBottom: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricColumn: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: Typography.fontWeight.extrabold,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: Typography.fontWeight.medium,
  },
  verticalDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#262633',
  },
});
