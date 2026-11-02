import axios from 'axios';
import { env } from '../config/env';

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

export interface NavigationStepDto {
  instruction: string;
  maneuver: 'straight' | 'turn-right' | 'turn-left' | 'slight-right' | 'slight-left' | 'u-turn' | 'arrive';
  distanceMeters: number;
  distanceText: string;
  durationSeconds: number;
  durationText: string;
  startLocation: LocationCoords;
  endLocation: LocationCoords;
}

export interface RoutePlanDto {
  origin: string;
  destination: string;
  totalDistanceMeters: number;
  totalDistanceText: string;
  totalDurationSeconds: number;
  totalDurationText: string;
  eta: string;
  polyline: LocationCoords[];
  steps: NavigationStepDto[];
}

export const mapsService = {
  /**
   * Geocode a destination string into GPS coordinates using Photon & Nominatim OpenStreetMap.
   */
  async geocode(destinationStr: string, proximity?: LocationCoords): Promise<LocationCoords | null> {
    const cleanQuery = (destinationStr || '').trim();
    if (!cleanQuery) return null;

    // 1. Fast Photon by Komoot with proximity
    try {
      const lat = proximity?.latitude || 9.3071;
      const lng = proximity?.longitude || 123.3011;
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

    // 2. Nominatim OpenStreetMap
    try {
      const viewboxParam = proximity
        ? `&viewbox=${proximity.longitude - 0.25},${proximity.latitude + 0.25},${proximity.longitude + 0.25},${proximity.latitude - 0.25}&bounded=0`
        : '';

      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        cleanQuery
      )}&limit=1${viewboxParam}`;

      const res = await axios.get(url, {
        headers: { 'User-Agent': 'GuideAI-App/1.0' },
        timeout: 4000,
      });

      if (res.data && res.data.length > 0) {
        return {
          latitude: parseFloat(res.data[0].lat),
          longitude: parseFloat(res.data[0].lon),
        };
      }
    } catch (err) {
      console.warn('Geocoding error, using proximity estimation:', err);
    }
    return null;
  },

  /**
   * Fetch real turn-by-turn pedestrian route using OSRM (Open Source Routing Machine)
   * or Google Maps if API key is provided.
   */
  async getDirections(origin: LocationCoords, destinationStr: string): Promise<RoutePlanDto> {
    const isRealKey = env.GOOGLE_MAPS_API_KEY && !env.GOOGLE_MAPS_API_KEY.includes('your-google-maps') && env.GOOGLE_MAPS_API_KEY.length > 20;

    // 1. Try Google Maps if real API key configured
    if (isRealKey) {
      try {
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${encodeURIComponent(
          destinationStr
        )}&mode=walking&key=${env.GOOGLE_MAPS_API_KEY}`;

        const res = await axios.get(url, { timeout: 6000 });
        if (res.data.status === 'OK' && res.data.routes.length > 0) {
          const route = res.data.routes[0];
          const leg = route.legs[0];
          const now = new Date();
          const arrivalTime = new Date(now.getTime() + leg.duration.value * 1000);
          const eta = arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          const steps: NavigationStepDto[] = leg.steps.map((s: any) => {
            const rawHtml = s.html_instructions || '';
            const plainText = rawHtml.replace(/<[^>]*>?/gm, ' ');
            let maneuver: NavigationStepDto['maneuver'] = 'straight';
            if (s.maneuver) {
              if (s.maneuver.includes('right')) maneuver = 'turn-right';
              else if (s.maneuver.includes('left')) maneuver = 'turn-left';
              else if (s.maneuver.includes('uturn')) maneuver = 'u-turn';
            }
            return {
              instruction: plainText.trim(),
              maneuver,
              distanceMeters: s.distance.value,
              distanceText: s.distance.text,
              durationSeconds: s.duration.value,
              durationText: s.duration.text,
              startLocation: { latitude: s.start_location.lat, longitude: s.start_location.lng },
              endLocation: { latitude: s.end_location.lat, longitude: s.end_location.lng },
            };
          });

          return {
            origin: `${origin.latitude.toFixed(4)}, ${origin.longitude.toFixed(4)}`,
            destination: destinationStr,
            totalDistanceMeters: leg.distance.value,
            totalDistanceText: leg.distance.text,
            totalDurationSeconds: leg.duration.value,
            totalDurationText: leg.duration.text,
            eta,
            polyline: [origin, ...steps.map((s) => s.endLocation)],
            steps,
          };
        }
      } catch (err) {
        console.warn('Google Maps API failed, trying OSRM pedestrian routing:', err);
      }
    }

    // 2. Real-World OSRM Pedestrian Routing Engine (100% Free, Full Street Accuracy)
    try {
      // Find destination coordinates
      const destCoords = await this.geocode(destinationStr, origin);
      if (!destCoords) {
        // Never guess a destination for a user who cannot see where they are being led
        throw new Error(`Could not find ${destinationStr}`);
      }

      // Query OSRM Foot Routing Engine
      const osrmUrl = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${origin.longitude},${origin.latitude};${destCoords.longitude},${destCoords.latitude}?overview=full&geometries=geojson&steps=true`;

      const osrmRes = await axios.get(osrmUrl, { timeout: 6000 });

      if (osrmRes.data?.routes && osrmRes.data.routes.length > 0) {
        const route = osrmRes.data.routes[0];
        const leg = route.legs[0];

        // Convert GeoJSON polyline [lng, lat] -> [lat, lng]
        const polyline: LocationCoords[] = (route.geometry.coordinates || []).map(
          ([lng, lat]: [number, number]) => ({
            latitude: lat,
            longitude: lng,
          })
        );

        const now = new Date();
        const arrivalTime = new Date(now.getTime() + route.duration * 1000);
        const eta = arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const steps: NavigationStepDto[] = (leg.steps || []).map((s: any) => {
          let maneuver: NavigationStepDto['maneuver'] = 'straight';
          const type = s.maneuver?.type || '';
          const modifier = s.maneuver?.modifier || '';

          if (modifier.includes('right')) {
            maneuver = modifier.includes('slight') ? 'slight-right' : 'turn-right';
          } else if (modifier.includes('left')) {
            maneuver = modifier.includes('slight') ? 'slight-left' : 'turn-left';
          } else if (type === 'arrive') {
            maneuver = 'arrive';
          }

          const streetName = s.name ? ` onto ${s.name}` : '';
          let instruction = 'Continue straight';

          if (type === 'depart') {
            instruction = `Head ${modifier || 'forward'}${streetName}`;
          } else if (type === 'turn') {
            instruction = `Turn ${modifier || 'straight'}${streetName}`;
          } else if (type === 'arrive') {
            instruction = `You have arrived at ${destinationStr}`;
          } else if (type === 'new name' || type === 'continue') {
            instruction = `Continue${streetName}`;
          }

          const distM = Math.round(s.distance);
          const distText = distM >= 1000 ? `${(distM / 1000).toFixed(1)} km` : `${distM} m`;
          const durSec = Math.round(s.duration);
          const durText = durSec >= 60 ? `${Math.ceil(durSec / 60)} min` : `${durSec} s`;

          const startCoords = s.maneuver?.location
            ? { latitude: s.maneuver.location[1], longitude: s.maneuver.location[0] }
            : origin;

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

        const totalDist = Math.round(route.distance);
        const totalDistText =
          totalDist >= 1000 ? `${(totalDist / 1000).toFixed(1)} km` : `${totalDist} m`;
        const totalDur = Math.round(route.duration);
        const totalDurText = `${Math.max(1, Math.ceil(totalDur / 60))} min`;

        return {
          origin: 'Current Location',
          destination: destinationStr,
          totalDistanceMeters: totalDist,
          totalDistanceText: totalDistText,
          totalDurationSeconds: totalDur,
          totalDurationText: totalDurText,
          eta,
          polyline,
          steps,
        };
      }
    } catch (e) {
      console.warn('OSRM routing request error:', e instanceof Error ? e.message : e);
      throw e instanceof Error ? e : new Error('Walking route service unavailable');
    }

    // No route found. Never invent one: a blind pedestrian would follow it.
    throw new Error('No walking route found for this destination');
  },
};
