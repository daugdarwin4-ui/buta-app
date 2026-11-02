import * as Location from 'expo-location';
import { GeoCoordinates } from '../../types/navigation.types';

class GPSService {
  private subscription: Location.LocationSubscription | null = null;
  private hasFix = false;
  private lastKnownLocation: GeoCoordinates = {
    latitude: 9.3071,
    longitude: 123.3011, // Dumaguete City default
    heading: 45,
    speed: 1.2,
    accuracy: 5,
  };

  /**
   * Request foreground location permissions from the user
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (e) {
      console.warn('Location permission request error:', e);
      return false;
    }
  }

  /**
   * Fetch current one-time GPS location
   */
  async getCurrentLocation(): Promise<GeoCoordinates> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return this.lastKnownLocation;

      // Try quick cached position first
      const lastPos = await Location.getLastKnownPositionAsync();
      if (lastPos) {
        this.hasFix = true;
        this.lastKnownLocation = {
          latitude: lastPos.coords.latitude,
          longitude: lastPos.coords.longitude,
          heading: lastPos.coords.heading,
          speed: lastPos.coords.speed,
          altitude: lastPos.coords.altitude,
          accuracy: lastPos.coords.accuracy,
        };
      }

      // Query fresh GPS coordinates with balanced accuracy for fast indoor/outdoor lock
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (pos?.coords) {
        this.hasFix = true;
        this.lastKnownLocation = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          altitude: pos.coords.altitude,
          accuracy: pos.coords.accuracy,
        };
      }

      return this.lastKnownLocation;
    } catch {
      return this.lastKnownLocation;
    }
  }

  /**
   * Start high-frequency continuous tracking for pedestrian turn-by-turn guidance
   */
  async startTracking(onUpdate: (coords: GeoCoordinates) => void): Promise<void> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      onUpdate(this.lastKnownLocation);
      return;
    }

    try {
      this.subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1500, // Every 1.5 seconds
          distanceInterval: 2, // Every 2 meters
        },
        (loc) => {
          this.hasFix = true;
          this.lastKnownLocation = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            heading: loc.coords.heading,
            speed: loc.coords.speed,
            altitude: loc.coords.altitude,
            accuracy: loc.coords.accuracy,
          };
          onUpdate(this.lastKnownLocation);
        }
      );
    } catch (e) {
      console.warn('Could not start live GPS watcher, using current position:', e);
      onUpdate(this.lastKnownLocation);
    }
  }

  /**
   * Stop active GPS subscription
   */
  stopTracking(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
  }

  /**
   * Reverse geocode coordinates to human-readable address.
   * Falls back to raw coordinates — never a made-up address, since this is sent in SOS alerts.
   */
  async getAddress(coords: GeoCoordinates): Promise<string> {
    const fallback = `latitude ${coords.latitude.toFixed(5)}, longitude ${coords.longitude.toFixed(5)}`;
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      if (results && results.length > 0) {
        const item = results[0];
        const street = [item.streetNumber, item.street].filter(Boolean).join(' ');
        const parts = [item.name !== street ? item.name : null, street, item.district, item.city].filter(Boolean);
        return parts.join(', ') || fallback;
      }
    } catch {
      // fallback
    }
    return fallback;
  }

  /**
   * Build a spoken "where am I" sentence from a fresh GPS reading
   */
  async describeCurrentLocation(): Promise<string> {
    const location = await this.getCurrentLocation();
    if (!this.hasFix) {
      return 'I could not get your location. Please make sure location is turned on.';
    }
    const address = await this.getAddress(location);
    return `You are near ${address}.`;
  }

  /**
   * Whether we have a real GPS fix (not the hard-coded default location)
   */
  get hasRealFix(): boolean {
    return this.hasFix;
  }

  /**
   * Calculate distance in meters between two coordinates (Haversine formula)
   */
  calculateDistanceMeters(c1: GeoCoordinates, c2: GeoCoordinates): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (c1.latitude * Math.PI) / 180;
    const phi2 = (c2.latitude * Math.PI) / 180;
    const deltaPhi = ((c2.latitude - c1.latitude) * Math.PI) / 180;
    const deltaLambda = ((c2.longitude - c1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

export const gpsService = new GPSService();
