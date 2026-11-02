import React from 'react';
import { Redirect } from 'expo-router';

/**
 * Get Started / Onboarding screen bypassed and redirected to Home.
 */
export default function OnboardingScreen() {
  return <Redirect href="/(tabs)" />;
}
