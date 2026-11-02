import { create } from 'zustand';
import { RoutePlan, GeoCoordinates, NavigationStatus } from '../types/navigation.types';

interface NavigationState {
  status: NavigationStatus;
  destination: string;
  /** Destination asked for from outside the Navigate screen (e.g. voice). Consumed by that screen. */
  requestedDestination: string | null;
  currentRoute: RoutePlan | null;
  currentStepIndex: number;
  userLocation: GeoCoordinates;
  isMuted: boolean;

  setStatus: (status: NavigationStatus) => void;
  setDestination: (dest: string) => void;
  requestNavigation: (dest: string) => void;
  clearRequestedDestination: () => void;
  setCurrentRoute: (route: RoutePlan | null) => void;
  setCurrentStepIndex: (idx: number) => void;
  setUserLocation: (loc: GeoCoordinates) => void;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  resetNavigation: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  status: 'idle',
  destination: '',
  requestedDestination: null,
  currentRoute: null,
  currentStepIndex: 0,
  userLocation: {
    latitude: 9.3071,
    longitude: 123.3011,
    heading: 0,
    speed: 0,
  },
  isMuted: false,

  setStatus: (status) => set({ status }),
  setDestination: (destination) => set({ destination }),
  requestNavigation: (requestedDestination) => set({ requestedDestination }),
  clearRequestedDestination: () => set({ requestedDestination: null }),
  setCurrentRoute: (currentRoute) => set({ currentRoute, currentStepIndex: 0 }),
  setCurrentStepIndex: (currentStepIndex) => set({ currentStepIndex }),
  setUserLocation: (userLocation) => set({ userLocation }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  setMuted: (isMuted) => set({ isMuted }),
  resetNavigation: () =>
    set({
      status: 'idle',
      destination: '',
      currentRoute: null,
      currentStepIndex: 0,
    }),
}));
