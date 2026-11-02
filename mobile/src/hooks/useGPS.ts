import { useState, useEffect } from 'react';
import { GeoCoordinates } from '../types/navigation.types';
import { gpsService } from '../services/navigation/gps.service';

export function useGPS() {
  const [coordinates, setCoordinates] = useState<GeoCoordinates>({
    latitude: 9.3071,
    longitude: 123.3011,
    heading: 0,
    speed: 0,
  });
  const [address, setAddress] = useState<string>('');
  const [isLocating, setIsLocating] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    gpsService.getCurrentLocation().then((loc) => {
      if (mounted) {
        setCoordinates(loc);
        setIsLocating(false);
        gpsService.getAddress(loc).then((addr) => {
          if (mounted) setAddress(addr);
        });
      }
    });

    gpsService.startTracking((newLoc) => {
      if (mounted) {
        setCoordinates(newLoc);
      }
    });

    return () => {
      mounted = false;
      gpsService.stopTracking();
    };
  }, []);

  return {
    coordinates,
    address,
    isLocating,
    refreshLocation: async () => {
      setIsLocating(true);
      const loc = await gpsService.getCurrentLocation();
      setCoordinates(loc);
      const addr = await gpsService.getAddress(loc);
      setAddress(addr);
      setIsLocating(false);
    },
  };
}
