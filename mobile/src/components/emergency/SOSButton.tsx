import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { Typography } from '../../constants/typography';
import { Colors } from '../../constants/colors';
import { MIN_TOUCH_TARGET } from '../../constants/config';

interface SOSButtonProps {
  onPress: () => void;
  onCancel: () => void;
  isCountingDown: boolean;
  isSending: boolean;
  isActive: boolean;
  countdownSeconds: number;
}

export const SOSButton: React.FC<SOSButtonProps> = ({
  onPress,
  onCancel,
  isCountingDown,
  isSending,
  isActive,
  countdownSeconds,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(1)).current;

  // Idle breathing pulse
  useEffect(() => {
    if (!isCountingDown && !isSending && !isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isCountingDown, isSending, isActive]);

  // Countdown pulsing ring animation
  useEffect(() => {
    if (isCountingDown) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim, { toValue: 1.35, duration: 500, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(ringAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      ringAnim.stopAnimation();
      ringAnim.setValue(1);
    }
  }, [isCountingDown]);

  if (isActive) {
    return (
      <View style={styles.activeContainer}>
        <View style={styles.activeCircle}>
          <Text style={styles.activeIcon}>🆘</Text>
          <Text style={styles.activeText}>SOS ACTIVE</Text>
          <Text style={styles.activeSub}>Help is on the way</Text>
        </View>
      </View>
    );
  }

  if (isSending) {
    return (
      <View style={styles.sendingContainer}>
        <View style={styles.sendingCircle}>
          <Text style={styles.sendingIcon}>📡</Text>
          <Text style={styles.sendingText}>Sending…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Pulsing outer ring during countdown */}
      {isCountingDown && (
        <Animated.View
          style={[
            styles.countdownRing,
            { transform: [{ scale: ringAnim }], opacity: ringAnim.interpolate({ inputRange: [1, 1.35], outputRange: [0.8, 0] }) },
          ]}
        />
      )}

      {/* Countdown seconds arc */}
      {isCountingDown && (
        <View style={styles.countdownBadge}>
          <Text style={styles.countdownNumber}>{countdownSeconds}</Text>
        </View>
      )}

      {/* Main SOS button */}
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          style={[styles.button, isCountingDown && styles.buttonCounting]}
          onPress={onPress}
          accessibilityLabel={
            isCountingDown
              ? `SOS activating in ${countdownSeconds} seconds. Tap to cancel.`
              : 'Emergency SOS button. Tap to activate emergency alert.'
          }
          accessibilityHint="Sends your GPS location to emergency contacts via SMS"
          accessibilityRole="button"
          activeOpacity={0.85}
        >
          <Text style={styles.sosText}>SOS</Text>
          {!isCountingDown && (
            <Text style={styles.sosSubtext}>Tap to activate</Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Cancel button appears during countdown */}
      {isCountingDown && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          accessibilityLabel="Cancel SOS countdown"
          accessibilityRole="button"
        >
          <Text style={styles.cancelText}>✕ Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 24,
  },
  countdownRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 4,
    borderColor: '#EF4444',
    zIndex: 0,
  },
  countdownBadge: {
    position: 'absolute',
    top: -16,
    right: '28%',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 10,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  countdownNumber: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: Typography.fontWeight.extrabold,
  },
  button: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 16,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    borderWidth: 5,
    borderColor: '#EF4444',
  },
  buttonCounting: {
    backgroundColor: '#B91C1C',
    borderColor: '#F87171',
  },
  sosText: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 6,
  },
  sosSubtext: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: Typography.fontWeight.medium,
    marginTop: 4,
  },
  cancelButton: {
    marginTop: 28,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#1F1F2A',
    borderWidth: 2,
    borderColor: '#EF4444',
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: '#EF4444',
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  activeContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  activeCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#7F1D1D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FCA5A5',
    elevation: 12,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    gap: 6,
  },
  activeIcon: { fontSize: 36 },
  activeText: {
    color: '#FECACA',
    fontSize: 16,
    fontWeight: Typography.fontWeight.extrabold,
    letterSpacing: 2,
  },
  activeSub: {
    color: 'rgba(252, 165, 165, 0.75)',
    fontSize: 12,
    fontWeight: Typography.fontWeight.medium,
  },
  sendingContainer: { alignItems: 'center', marginVertical: 24 },
  sendingCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#1E1B4B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#818CF8',
    gap: 8,
    elevation: 12,
    shadowColor: '#818CF8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  sendingIcon: { fontSize: 36 },
  sendingText: {
    color: '#C7D2FE',
    fontSize: 16,
    fontWeight: Typography.fontWeight.bold,
  },
});
