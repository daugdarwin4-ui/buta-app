import React from 'react';
import { Redirect } from 'expo-router';
import { useUserStore } from '../src/stores/userStore';
import { LoadingScreen } from '../src/components/common/LoadingScreen';

/**
 * Entry point. No sign-in: first launch goes to the short intro, every launch after goes straight Home.
 */
export default function Index() {
  const { isLoaded } = useUserStore();

  if (!isLoaded) return <LoadingScreen />;
  return <Redirect href="/(tabs)" />;
}
