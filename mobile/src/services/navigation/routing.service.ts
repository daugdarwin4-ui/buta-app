import axios from 'axios';
import { GeoCoordinates, RoutePlan, NavigationStep, ManeuverType } from '../../types/navigation.types';
import { gpsService } from './gps.service';
import { ttsService } from '../tts/tts.service';
import { hapticsService } from '../haptics/haptics.service';

// Well-known places dictionary for instant offline / local lock if geocoder is slow
const LOCAL_POI_CACHE: Record<string, { lat: number; lng: number; name: string }> = {
  'public market': { lat: 9.3072, lng: 123.3082, name: 'Dumaguete Public Market' },
  'silliman medical': { lat: 9.3175, lng: 123.3039, name: 'Silliman University Medical Center' },
  'rizal boulevard': { lat: 9.3092, lng: 123.3114, name: 'Rizal Boulevard, Dumaguete' },
  'citymall': { lat: 9.3248, lng: 123.2985, name: 'CityMall Dumaguete' },
  'port terminal': { lat: 9.3138, lng: 123.3132, name: 'Dumaguete Port Terminal' },
  'hospital': { lat: 9.3175, lng: 123.3039, name: 'Silliman University Medical Center' },
  'pharmacy': { lat: 9.3065, lng: 123.3075, name: 'Mercury Drug' },
  'police': { lat: 9.3088, lng: 123.3045, name: 'Dumaguete Police Station' },
};

/** Within this distance the maneuver counts as reached (typical phone GPS error is 5–15 m) */
const MANEUVER_REACHED_M = 15;
/** Speak a heads-up once when the next turn is this close */
const APPROACH_WARNING_M = 30;

/**
 * Walking time for the screen ("11 min", "1 h 5 min") or for speech ("11 minutes",
 * "1 hour 5 minutes"). Long routes in bare minutes ("1026 min") are impossible to judge.
 */
export function formatDuration(seconds: number, spoken = false): string {
  const totalMin = Math.max(1, Math.ceil(seconds / 60));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (spoken) {
    const hours = h > 0 ? `${h} ${h === 1 ? 'hour' : 'hours'}` : '';
    const mins = m > 0 || h === 0 ? `${m} ${m === 1 ? 'minute' : 'minutes'}` : '';
    return [hours, mins].filter(Boolean).join(' ');
  }
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

class RoutingService {
  /**
   * High-Precision Destination Geocoder
   * 1. Check local POI cache
   * 2. Query Photon by Komoot (fast, OpenStreetMap-based, proximity-ranked)
   * 3. Query Nominatim OpenStreetMap (comprehensive global search)
   */
  async geocode(destinationStr: string, origin: GeoCoordinates): Promise<GeoCoordinates | null> {
    const cleanQuery = (destinationStr || '').trim().toLowerCase();
    if (!cleanQuery) return null;

    // Check if query is raw coordinates "lat, lng"
    const coordMatch = cleanQuery.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      return {
        latitude: parseFloat(coordMatch[1]),
        longitude: parseFloat(coordMatch[3]),
      };
    }

    // Check local POI lookup
    for (const [key, poi] of Object.entries(LOCAL_POI_CACHE)) {
      if (cleanQuery.includes(key)) {
        return { latitude: poi.lat, longitude: poi.lng };
      }
    }

    const lat = origin.latitude || 9.3071;
    const lng = origin.longitude || 123.3011;

    // Provider 1: Photon by Komoot (Fastest OpenStreetMap geocoder with proximity bias)
    try {
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
        cleanQuery
      )}&lat=${lat}&lon=${lng}&limit=1`;

      const photonRes = await axios.get(photonUrl, { timeout: 3500 });
      if (photonRes.data?.features && photonRes.data.features.length > 0) {
        const [pLng, pLat] = photonRes.data.features[0].geometry.coordinates;
        if (pLat && pLng) {
          return { latitude: pLat, longitude: pLng };
        }
      }
    } catch {
      // Fallback to Nominatim
    }

    // Provider 2: Nominatim OpenStreetMap (Proximity Box)
    try {
      const bbox = `&viewbox=${lng - 0.25},${lat + 0.25},${lng + 0.25},${lat - 0.25}&bounded=0`;
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        cleanQuery
      )}&limit=1${bbox}`;

      const nomRes = await axios.get(nomUrl, {
        headers: { 'User-Agent': 'GuideAI-Mobile/1.0' },
        timeout: 4000,
      });

      if (nomRes.data && nomRes.data.length > 0) {
        return {
          latitude: parseFloat(nomRes.data[0].lat),
          longitude: parseFloat(nomRes.data[0].lon),
        };
      }
    } catch {
      // Fallback below
    }

    return null;
  }

  /**
   * Plan a real, accurate turn-by-turn route to the exact destination coordinates
   */
  async planRoute(origin: GeoCoordinates, destinationStr: string): Promise<RoutePlan> {
    const lat = origin.latitude || 9.3071;
    const lng = origin.longitude || 123.3011;
    const destName = destinationStr?.trim() || 'Public Market';

    // The app routes directly against public OpenStreetMap services, so navigation works
    // without the GuideAI server (this is a mobile-only project with no hosted backend).

    // 1. Resolve true destination GPS coordinates. Never guess: a wrong destination is
    //    worse than no destination for a user who cannot see where they are being led.
    const targetDest = await this.geocode(destName, origin);
    if (!targetDest) {
      throw new Error(`I could not find ${destName}. Please try a different name or a nearby landmark.`);
    }

    // 2. Query Real Street Routing Engines (OSRM Pedestrian -> OSRM Global Driving -> OSRM Bicycle -> OSRM Car)
    const engineEndpoints = [
      `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${lng},${lat};${targetDest.longitude},${targetDest.latitude}?overview=full&geometries=geojson&steps=true`,
      `https://router.project-osrm.org/route/v1/driving/${lng},${lat};${targetDest.longitude},${targetDest.latitude}?overview=full&geometries=geojson&steps=true`,
      `https://routing.openstreetmap.de/routed-bike/route/v1/bicycle/${lng},${lat};${targetDest.longitude},${targetDest.latitude}?overview=full&geometries=geojson&steps=true`,
      `https://routing.openstreetmap.de/routed-car/route/v1/driving/${lng},${lat};${targetDest.longitude},${targetDest.latitude}?overview=full&geometries=geojson&steps=true`,
    ];

    for (const url of engineEndpoints) {
      try {
        const osrmRes = await axios.get(url, { timeout: 4000 });
        if (osrmRes?.data?.routes && osrmRes.data.routes.length > 0) {
          const route = osrmRes.data.routes[0];
          const leg = route.legs[0];

          // Parse polyline coordinates [lng, lat] -> { latitude, longitude }
          const polyline: GeoCoordinates[] = (route.geometry.coordinates || []).map(
            ([pLng, pLat]: [number, number]) => ({
              latitude: pLat,
              longitude: pLng,
            })
          );

          if (polyline.length > 1) {
            const now = new Date();
            const arrivalTime = new Date(now.getTime() + route.duration * 1000);
            const eta = arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const steps: NavigationStep[] = (leg.steps || []).map((s: any) => {
              let maneuver: ManeuverType = 'straight';
              const modifier = s.maneuver?.modifier || '';
              const type = s.maneuver?.type || '';

              if (modifier.includes('right')) maneuver = modifier.includes('slight') ? 'slight-right' : 'turn-right';
              else if (modifier.includes('left')) maneuver = modifier.includes('slight') ? 'slight-left' : 'turn-left';
              else if (modifier.includes('uturn')) maneuver = 'u-turn';
              else if (type === 'arrive') maneuver = 'arrive';

              const streetName = s.name ? ` onto ${s.name}` : '';
              let instruction = 'Continue straight';
              if (type === 'depart') instruction = `Head forward${streetName}`;
              else if (type === 'turn') instruction = `Turn ${modifier || 'straight'}${streetName}`;
              else if (type === 'arrive') instruction = `You have arrived at ${destName}`;
              else if (type === 'new name' || type === 'continue') instruction = `Continue along${streetName || ' the road'}`;
              else if (type === 'roundabout') instruction = `Take the roundabout${streetName}`;

              const distM = Math.round(s.distance);
              const distText = distM >= 1000 ? `${(distM / 1000).toFixed(1)} km` : `${distM} meters`;
              const durSec = Math.round(s.duration);
              const durText = durSec >= 60 ? `${Math.ceil(durSec / 60)} min` : `${durSec} s`;

              const startCoords: GeoCoordinates = s.maneuver?.location
                ? { latitude: s.maneuver.location[1], longitude: s.maneuver.location[0] }
                : { latitude: lat, longitude: lng };

              return {
                instruction,
                maneuver,
                distanceMeters: distM,
                distanceText: distText,
                durationSeconds: durSec,
                durationText: durText,
                startLocation: startCoords,
                endLocation: startCoords,
              };
            });

            // No step list means nothing safe to speak — try the next engine
            if (steps.length === 0) continue;

            const totalDist = Math.round(route.distance);
            const totalDistText = totalDist >= 1000 ? `${(totalDist / 1000).toFixed(1)} km` : `${totalDist} m`;
            const totalDur = Math.round(route.duration);
            const totalDurText = formatDuration(totalDur);

            // Each step starts at its maneuver point and ends where the next maneuver begins
            steps.forEach((s, i) => {
              s.endLocation = steps[i + 1]?.startLocation ?? s.startLocation;
            });

            return {
              origin: 'Current Location',
              destination: destName,
              totalDistanceMeters: totalDist,
              totalDistanceText: totalDistText,
              totalDurationSeconds: totalDur,
              totalDurationText: totalDurText,
              eta,
              polyline,
              steps,
            };
          }
        }
      } catch {
        // Continue to next routing engine
      }
    }

    // 3. No routing engine answered. Straight-line "head toward" guidance would lead a blind
    //    pedestrian through buildings and traffic, so report failure instead.
    throw new Error('I could not get walking directions right now. Please check your internet connection and try again.');
  }

  // ── Live guidance ──────────────────────────────────────────
  //
  // `currentStepIndex` always points at the UPCOMING maneuver (the next turn, or the arrival).
  // The user is walking toward `steps[currentStepIndex].startLocation`.

  /** Index to start guidance at: skip the "depart" step, whose maneuver point is the origin */
  firstGuidanceIndex(route: RoutePlan): number {
    return route.steps.length > 1 ? 1 : 0;
  }

  /** Meters from the user to the upcoming maneuver */
  distanceToManeuver(pos: GeoCoordinates, route: RoutePlan, stepIndex: number): number {
    const step = route.steps[stepIndex];
    return step ? gpsService.calculateDistanceMeters(pos, step.startLocation) : 0;
  }

  /**
   * Evaluate one GPS update. Pure: the caller decides what to speak (so mute is respected).
   */
  evaluateProgress(
    pos: GeoCoordinates,
    route: RoutePlan,
    stepIndex: number
  ): { event: 'arrived' | 'advanced' | 'approaching' | null; distance: number } {
    const distance = this.distanceToManeuver(pos, route, stepIndex);
    const isLast = stepIndex >= route.steps.length - 1;

    if (distance <= MANEUVER_REACHED_M) {
      return { event: isLast ? 'arrived' : 'advanced', distance };
    }
    if (distance <= APPROACH_WARNING_M) {
      return { event: 'approaching', distance };
    }
    return { event: null, distance };
  }

  /** Shortest distance in meters from the user to the route line */
  distanceFromRoute(pos: GeoCoordinates, polyline: GeoCoordinates[]): number {
    if (polyline.length === 0) return 0;
    if (polyline.length === 1) return gpsService.calculateDistanceMeters(pos, polyline[0]);

    // Local flat projection (meters) around the user — accurate enough at walking scale
    const R = 6371e3;
    const toXY = (p: GeoCoordinates) => ({
      x: ((p.longitude - pos.longitude) * Math.PI / 180) * R * Math.cos((pos.latitude * Math.PI) / 180),
      y: ((p.latitude - pos.latitude) * Math.PI / 180) * R,
    });

    let min = Infinity;
    for (let i = 0; i < polyline.length - 1; i++) {
      const a = toXY(polyline[i]);
      const b = toXY(polyline[i + 1]);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy;
      // Projection of the user (origin) onto segment AB, clamped to the segment
      const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lenSq));
      const px = a.x + t * dx;
      const py = a.y + t * dy;
      min = Math.min(min, Math.hypot(px, py));
    }
    return min;
  }

  /** Spoken distance, rounded so it is easy to follow while walking */
  /** Spoken walking time, e.g. "11 minutes" or "17 hours 6 minutes" */
  spokenDuration(seconds: number): string {
    return formatDuration(seconds, true);
  }

  formatDistance(meters: number): string {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} kilometers`;
    if (meters < 10) return 'a few meters';
    return `${Math.round(meters / 5) * 5} meters`;
  }

  /**
   * Spoken form of a step with the live distance to it, e.g. "In 40 meters, turn left onto Rizal Street"
   */
  formatStep(step: NavigationStep, distanceMeters?: number): string {
    if (step.maneuver === 'arrive' || distanceMeters === undefined) return step.instruction;
    return `In ${this.formatDistance(distanceMeters)}, ${lowerFirst(step.instruction)}`;
  }

  /**
   * Announce a step clearly for visually impaired users
   */
  announceStep(step: NavigationStep, distanceMeters?: number): void {
    ttsService.speakImmediate(this.formatStep(step, distanceMeters));
    hapticsService.buttonPress();
  }
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export const routingService = new RoutingService();
