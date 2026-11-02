export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export type ManeuverType =
  | 'straight'
  | 'turn-right'
  | 'turn-left'
  | 'slight-right'
  | 'slight-left'
  | 'u-turn'
  | 'arrive';

export interface NavigationStep {
  instruction: string;
  maneuver: ManeuverType;
  distanceMeters: number;
  distanceText: string;
  durationSeconds: number;
  durationText: string;
  startLocation: GeoCoordinates;
  endLocation: GeoCoordinates;
}

export interface RoutePlan {
  origin: string;
  destination: string;
  totalDistanceMeters: number;
  totalDistanceText: string;
  totalDurationSeconds: number;
  totalDurationText: string;
  eta: string;
  polyline: GeoCoordinates[];
  steps: NavigationStep[];
}

export type NavigationStatus = 'idle' | 'calculating' | 'navigating' | 'arrived';
