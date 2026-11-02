import 'react-native-gesture-handler';
import React, { useEffect, Component, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Colors } from '../src/constants/colors';
import { useUserStore } from '../src/stores/userStore';
import { ttsService } from '../src/services/tts/tts.service';
import { hapticsService } from '../src/services/haptics/haptics.service';
import { sampleCollector } from '../src/services/training/sampleCollector';
import { consumeUpdateNotice } from '../src/services/updates/appUpdates';

/** Wait for the opening screen's own greeting before announcing an update */
const UPDATE_NOTICE_DELAY_MS = 4000;

// Prevent splash screen from auto hiding before app renders
try {
  SplashScreen.preventAutoHideAsync().catch(() => {});
} catch {}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.warn('GuideAI Root Crash Prevented:', error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
    router.replace('/');
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.icon}>⚠️</Text>
          <Text style={errorStyles.title}>GuideAI</Text>
          <Text style={errorStyles.subtitle}>
            An unexpected error occurred. Tap below to resume.
          </Text>
          <TouchableOpacity style={errorStyles.btn} onPress={this.handleRestart}>
            <Text style={errorStyles.btnText}>Restart App</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0E',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginBottom: 24 },
  btn: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});

export default function RootLayout() {
  const { load, isLoaded, settings } = useUserStore();

  useEffect(() => {
    // Hide the native splash screen safely once JS mounts
    setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 150);

    // No accounts: just load this device's saved name, settings and onboarding state
    load();
  }, []);

  // Apply voice & vibration preferences whenever they change
  useEffect(() => {
    if (!isLoaded) return;
    ttsService.setRate(settings.tts_speed);
    ttsService.setPitch(settings.tts_pitch);
    ttsService.setLanguage(settings.tts_language);
    hapticsService.setIntensity(settings.haptic_intensity);
    sampleCollector.setEnabled(settings.collect_training_photos);
  }, [isLoaded, settings]);

  // Updates install silently on restart; tell the user once that they are on a new version
  useEffect(() => {
    if (!isLoaded) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    consumeUpdateNotice().then((updated) => {
      if (updated) {
        timer = setTimeout(() => ttsService.speak('GuideAI was updated to the newest version.'), UPDATE_NOTICE_DELAY_MS);
      }
    });
    return () => clearTimeout(timer);
  }, [isLoaded]);

  return (
    <RootErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="emergency" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="improve-ai" />
        </Stack>
      </SafeAreaProvider>
    </RootErrorBoundary>
  );
}
