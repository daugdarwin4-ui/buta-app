import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { keepAwake } from '../../src/services/native/keepAwake';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { MIN_TOUCH_TARGET } from '../../src/constants/config';
import { useGPS } from '../../src/hooks/useGPS';
import { useNavigationStore } from '../../src/stores/navigationStore';
import { routingService } from '../../src/services/navigation/routing.service';
import { gpsService } from '../../src/services/navigation/gps.service';
import { TurnByTurnPanel } from '../../src/components/navigation/TurnByTurnPanel';
import { AccessibleButton } from '../../src/components/common/AccessibleButton';
import { ttsService } from '../../src/services/tts/tts.service';
import { hapticsService } from '../../src/services/haptics/haptics.service';
import { NEARBY_PLACES } from '../../src/constants/places';

const KEEP_AWAKE_TAG = 'navigation';
/** GPS fixes fuzzier than this are ignored for off-route checks */
const MAX_USABLE_ACCURACY_M = 30;
/** Farther than this from the route line counts as off route */
const OFF_ROUTE_M = 35;
/** Consecutive off-route readings needed before rerouting (filters GPS jumps) */
const OFF_ROUTE_READINGS = 3;
const REROUTE_COOLDOWN_MS = 20_000;


/** Beyond this, a walking route is almost certainly a mistake: ask before guiding */
const FAR_WALK_METERS = 5000;

interface FarRoute {
  dest: string;
  distanceText: string;
  durationText: string;
}

export default function NavigationScreen() {
  const { coordinates } = useGPS();
  const {
    status,
    destination,
    requestedDestination,
    currentRoute,
    currentStepIndex,
    isMuted,
    setStatus,
    setDestination,
    clearRequestedDestination,
    setCurrentRoute,
    setCurrentStepIndex,
    toggleMute,
    resetNavigation,
  } = useNavigationStore();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [routeError, setRouteError] = useState<string | null>(null);
  // A route that was found but is too far to walk; waits for the user to confirm or pick again
  const [farRoute, setFarRoute] = useState<FarRoute | null>(null);
  const [distanceToNext, setDistanceToNext] = useState<number | undefined>(undefined);
  const isLoadingRoute = status === 'calculating';

  const rerouteInFlightRef = useRef(false);
  /** Step index already given its 30 m heads-up, so it is spoken once */
  const approachedStepRef = useRef(-1);
  const offRouteCountRef = useRef(0);
  const lastRerouteRef = useRef(0);

  // Spoken orientation when the user arrives on this tab
  useFocusEffect(
    useCallback(() => {
      const s = useNavigationStore.getState();
      if (s.requestedDestination) return; // a voice request is about to announce itself
      if (s.status === 'navigating' && s.currentRoute) {
        ttsService.speak(`Navigating to ${s.destination}.`, 'info');
      } else {
        ttsService.speak('Navigation. Tap Choose Destination, or say navigate to, followed by a place.', 'info');
      }
    }, [])
  );

  // Destination asked for elsewhere (voice assistant). Works even if this tab was already mounted.
  useEffect(() => {
    if (requestedDestination) {
      const dest = requestedDestination;
      clearRequestedDestination();
      handleStartNavigation(dest);
    }
  }, [requestedDestination]);

  // Keep the screen awake while guiding: Android pauses the app when the screen locks
  useEffect(() => {
    if (status === 'navigating') {
      keepAwake.activate(KEEP_AWAKE_TAG);
    } else {
      keepAwake.deactivate(KEEP_AWAKE_TAG);
    }
  }, [status]);

  // Live guidance on every GPS update: heads-up, advance, arrival, and off-route detection
  useEffect(() => {
    if (status !== 'navigating' || !currentRoute || !coordinates || rerouteInFlightRef.current) return;

    const { event, distance } = routingService.evaluateProgress(coordinates, currentRoute, currentStepIndex);
    setDistanceToNext(distance);
    const step = currentRoute.steps[currentStepIndex];

    if (event === 'arrived') {
      setStatus('arrived');
      hapticsService.success();
      ttsService.speakImmediate(`You have arrived at ${destination}.`);
      return;
    }
    if (event === 'advanced') {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      if (!isMuted) {
        const next = currentRoute.steps[nextIdx];
        routingService.announceStep(next, routingService.distanceToManeuver(coordinates, currentRoute, nextIdx));
      }
      return;
    }
    if (event === 'approaching' && approachedStepRef.current !== currentStepIndex) {
      approachedStepRef.current = currentStepIndex;
      if (!isMuted) routingService.announceStep(step, distance);
    }

    // Off route: ignore fuzzy fixes, and require several bad readings in a row before acting
    const accuracy = coordinates.accuracy ?? 0;
    if (accuracy > MAX_USABLE_ACCURACY_M) return;
    const offBy = routingService.distanceFromRoute(coordinates, currentRoute.polyline);
    offRouteCountRef.current = offBy > OFF_ROUTE_M ? offRouteCountRef.current + 1 : 0;

    if (
      offRouteCountRef.current >= OFF_ROUTE_READINGS &&
      Date.now() - lastRerouteRef.current > REROUTE_COOLDOWN_MS
    ) {
      offRouteCountRef.current = 0;
      lastRerouteRef.current = Date.now();
      handleStartNavigation(destination, true);
    }
  }, [coordinates, status, currentRoute, currentStepIndex]);

  const handleStartNavigation = async (dest: string, isReroute = false, confirmedFar = false) => {
    setIsSearchOpen(false);
    setRouteError(null);
    setFarRoute(null);
    setStatus('calculating');
    setDestination(dest);
    rerouteInFlightRef.current = true;
    hapticsService.triggerForRisk(isReroute ? 'warning' : 'info');
    ttsService.speakImmediate(
      isReroute ? 'You are off the route. Finding a new route.' : `Finding a walking route to ${dest}.`
    );

    try {
      // Fresh fix so the route never starts from the default/placeholder location
      const origin = await gpsService.getCurrentLocation();
      if (!gpsService.hasRealFix) {
        throw new Error('I could not get your location. Please make sure location is turned on.');
      }
      const plan = await routingService.planRoute(origin, dest);

      // A typo or a same-named place far away must not silently start an all-day walk
      if (!isReroute && !confirmedFar && plan.totalDistanceMeters > FAR_WALK_METERS) {
        setFarRoute({ dest, distanceText: plan.totalDistanceText, durationText: plan.totalDurationText });
        setCurrentRoute(null);
        setStatus('idle');
        await hapticsService.triggerForRisk('warning');
        ttsService.speakImmediate(
          `${dest} is ${routingService.formatDistance(plan.totalDistanceMeters)} away, about ${routingService.spokenDuration(plan.totalDurationSeconds)} on foot. That is very far to walk. Tap Start Anyway to go there, or choose another destination.`
        );
        return;
      }

      const firstIdx = routingService.firstGuidanceIndex(plan);
      setCurrentRoute(plan);
      setCurrentStepIndex(firstIdx);
      approachedStepRef.current = -1;
      offRouteCountRef.current = 0;
      setStatus('navigating');
      await hapticsService.success();

      // e.g. "Route found. 850 m, about 11 min. Head forward onto Perdices Street. Then in 120 meters, turn left onto ..."
      const depart = firstIdx > 0 ? ` ${plan.steps[0].instruction}.` : '';
      const next = plan.steps[firstIdx];
      const nextText = next
        ? ` ${firstIdx > 0 ? 'Then, ' : ''}${routingService.formatStep(next, routingService.distanceToManeuver(origin, plan, firstIdx))}.`
        : '';
      const intro = isReroute ? 'New route found.' : `Route found. ${routingService.formatDistance(plan.totalDistanceMeters)}, about ${routingService.spokenDuration(plan.totalDurationSeconds)}.`;
      ttsService.speakImmediate(`${intro}${isMuted ? '' : depart + nextText}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not plan a route.';
      setRouteError(msg);
      setCurrentRoute(null);
      setStatus('idle');
      ttsService.speakImmediate(msg);
      await hapticsService.triggerForRisk('warning');
    } finally {
      rerouteInFlightRef.current = false;
    }
  };

  const handleEndNavigation = async () => {
    await hapticsService.buttonPress();
    ttsService.speakImmediate('Navigation ended.');
    resetNavigation();
  };

  const handleToggleMute = async () => {
    await hapticsService.buttonPress();
    toggleMute();
    ttsService.speakImmediate(isMuted ? 'Voice directions on.' : 'Voice directions muted.');
  };

  const goToStep = async (idx: number) => {
    if (!currentRoute || idx < 0 || idx >= currentRoute.steps.length) return;
    await hapticsService.buttonPress();
    setCurrentStepIndex(idx);
    approachedStepRef.current = -1;
    routingService.announceStep(
      currentRoute.steps[idx],
      coordinates ? routingService.distanceToManeuver(coordinates, currentRoute, idx) : undefined
    );
  };

  const currentStep = currentRoute?.steps[currentStepIndex];
  const totalSteps = currentRoute?.steps?.length || 0;
  const hasRoute = !!currentRoute && (status === 'navigating' || status === 'arrived');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={styles.topBar}>
        <Text style={styles.screenTitle} accessibilityRole="header">
          Navigation
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isLoadingRoute && (
          <View style={styles.loadingCard} accessible accessibilityLabel={`Finding a walking route to ${destination}`}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingCardText}>Finding a walking route to {destination}…</Text>
          </View>
        )}

        {routeError && !isLoadingRoute && (
          <View style={styles.errorBox} accessible accessibilityRole="alert">
            <Text style={styles.errorText}>⚠️ {routeError}</Text>
          </View>
        )}

        {hasRoute && !isLoadingRoute && (
          <>
            <Text style={styles.destinationText} accessibilityRole="header">
              To: {destination}
            </Text>

            <TurnByTurnPanel
              currentStep={currentStep}
              routePlan={currentRoute ?? undefined}
              distanceLabel={
                distanceToNext !== undefined && currentStep?.maneuver !== 'arrive'
                  ? `in ${routingService.formatDistance(distanceToNext)}`
                  : undefined
              }
            />

            {/* Repeat current instruction: the most-used control while walking */}
            <TouchableOpacity
              style={styles.repeatStepButton}
              onPress={() => goToStep(currentStepIndex)}
              accessibilityLabel={`Repeat direction. Step ${currentStepIndex + 1} of ${totalSteps}.`}
              accessibilityRole="button"
            >
              <Text style={styles.repeatStepText}>🔊 Repeat Direction</Text>
              <Text style={styles.stepCounterText}>
                Step {currentStepIndex + 1} of {totalSteps}
              </Text>
            </TouchableOpacity>

            <View style={styles.stepControls}>
              <TouchableOpacity
                style={[styles.stepNavBtn, currentStepIndex === 0 && styles.stepNavBtnDisabled]}
                onPress={() => goToStep(currentStepIndex - 1)}
                disabled={currentStepIndex === 0}
                accessibilityLabel="Previous direction"
                accessibilityRole="button"
              >
                <Text style={styles.stepNavBtnText}>◀ Previous</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.stepNavBtn, currentStepIndex === totalSteps - 1 && styles.stepNavBtnDisabled]}
                onPress={() => goToStep(currentStepIndex + 1)}
                disabled={currentStepIndex === totalSteps - 1}
                accessibilityLabel="Next direction"
                accessibilityRole="button"
              >
                <Text style={styles.stepNavBtnText}>Next ▶</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {farRoute && !isLoadingRoute && !hasRoute && (
          <View style={styles.farBox} accessible={false}>
            <Text style={styles.farTitle} accessibilityRole="alert">
              ⚠️ {farRoute.dest} is very far
            </Text>
            <Text style={styles.farText}>
              {farRoute.distanceText} away, about {farRoute.durationText} on foot.
            </Text>
            <AccessibleButton
              label="Start Anyway"
              hint={`Start walking directions to ${farRoute.dest}`}
              variant="secondary"
              size="lg"
              style={styles.chooseButton}
              onPress={() => handleStartNavigation(farRoute.dest, false, true)}
            />
          </View>
        )}

        {!isLoadingRoute && (
          <AccessibleButton
            label={hasRoute ? 'Change Destination' : 'Choose Destination'}
            hint="Type or dictate the place you want to walk to"
            variant={hasRoute ? 'secondary' : 'primary'}
            size="lg"
            style={styles.chooseButton}
            onPress={() => setIsSearchOpen(true)}
          />
        )}

        {/* Start screen: one-tap places and a voice shortcut, instead of an empty page */}
        {!isLoadingRoute && !hasRoute && (
          <>
            <AccessibleButton
              label="🎤 Say Where To Go"
              hint="Opens the voice assistant. Say navigate to, followed by a place."
              variant="secondary"
              size="lg"
              style={styles.chooseButton}
              onPress={() => router.push('/(tabs)/voice')}
            />
            <Text style={styles.quickTitle} accessibilityRole="header">
              Places in Dumaguete
            </Text>
            {NEARBY_PLACES.map((place) => (
              <TouchableOpacity
                key={place}
                style={styles.quickPlace}
                onPress={() => handleStartNavigation(place)}
                accessibilityLabel={`Navigate to ${place}`}
                accessibilityRole="button"
              >
                <Text style={styles.quickPlaceText}>📍 {place}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      {hasRoute && (
        <View style={styles.bottomBar}>
          <AccessibleButton
            label="End Navigation"
            hint="Stops walking directions"
            variant="danger"
            size="lg"
            style={styles.endNavButton}
            onPress={handleEndNavigation}
          />
          <TouchableOpacity
            style={[styles.speakerButton, isMuted && styles.speakerButtonMuted]}
            onPress={handleToggleMute}
            accessibilityLabel={isMuted ? 'Turn voice directions on' : 'Mute voice directions'}
            accessibilityRole="button"
          >
            <Text style={styles.speakerIcon}>{isMuted ? '🔇' : '🔊'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Destination picker */}
      <Modal
        visible={isSearchOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsSearchOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} accessibilityRole="header">
                Where do you want to go?
              </Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setIsSearchOpen(false)}
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="Type or use the keyboard microphone"
              placeholderTextColor="#9CA3AF"
              autoFocus
              returnKeyType="go"
              onSubmitEditing={() => {
                if (searchInput.trim()) handleStartNavigation(searchInput.trim());
              }}
              accessibilityLabel="Destination"
              accessibilityHint="Type or dictate a place, then press go"
            />

            <Text style={styles.presetHeader}>Nearby places</Text>
            {NEARBY_PLACES.map((name) => (
              <TouchableOpacity
                key={name}
                style={styles.presetRow}
                onPress={() => handleStartNavigation(name)}
                accessibilityLabel={`Navigate to ${name}`}
                accessibilityRole="button"
              >
                <Text style={styles.presetText}>{name}</Text>
                <Text style={styles.presetArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  screenTitle: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 14,
  },
  loadingCard: {
    backgroundColor: '#13151F',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  loadingCardText: {
    color: '#D1D5DB',
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.danger,
    padding: 16,
  },
  farBox: {
    backgroundColor: '#2A1F05',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCD34D',
    padding: 16,
    gap: 10,
  },
  farTitle: {
    color: '#FCD34D',
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  farText: {
    color: '#F3F4F6',
    fontSize: Typography.fontSize.md,
  },
  quickTitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    marginTop: 8,
  },
  quickPlace: {
    minHeight: MIN_TOUCH_TARGET + 16,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  quickPlaceText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  destinationText: {
    color: '#F3F4F6',
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  repeatStepButton: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    minHeight: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  repeatStepText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
  },
  stepCounterText: {
    color: '#EDE9FE',
    fontSize: Typography.fontSize.sm,
  },
  stepControls: {
    flexDirection: 'row',
    gap: 12,
  },
  stepNavBtn: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET + 12,
    borderRadius: 14,
    backgroundColor: '#222232',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNavBtnDisabled: {
    opacity: 0.35,
  },
  stepNavBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  chooseButton: {
    width: '100%',
    borderRadius: 18,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#09090D',
    borderTopWidth: 1,
    borderColor: '#1D1D26',
    gap: 12,
  },
  endNavButton: {
    flex: 1,
    borderRadius: 16,
  },
  speakerButton: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#181820',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2E2E3C',
  },
  speakerButtonMuted: {
    backgroundColor: '#381A22',
    borderColor: '#EF4444',
  },
  speakerIcon: {
    fontSize: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#121218',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  closeBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#9CA3AF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  modalInput: {
    backgroundColor: '#1C1C26',
    color: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    fontSize: Typography.fontSize.md,
    borderWidth: 1,
    borderColor: '#2E2E40',
    marginBottom: 18,
  },
  presetHeader: {
    color: '#9CA3AF',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET + 12,
    borderBottomWidth: 1,
    borderColor: '#1E1E2A',
  },
  presetText: {
    flex: 1,
    color: '#F3F4F6',
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  presetArrow: {
    color: '#6B7280',
    fontSize: 20,
  },
});
