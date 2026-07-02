import { useState, useEffect, useRef } from 'react';
import { logLocation } from '../api/employees';

export function useFieldTracking(employeeId: string | null, isFieldEmployee: boolean) {
  const [isTracking, setIsTracking] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const lastCoordsRef = useRef<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    if (!employeeId || !isFieldEmployee || !navigator.geolocation) {
  // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsTracking(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setIsTracking(true);
        setCurrentPosition(position);
        
        const now = Date.now();
        const { latitude, longitude, accuracy } = position.coords;
        
        let shouldUpdate = false;
        if (!lastCoordsRef.current) {
          shouldUpdate = true;
        } else {
          // Throttling: 30 seconds OR 50 metres
          const timeDiff = now - lastUpdateRef.current;
          
          // Haversine approximation
          const latDiff = Math.abs(latitude - lastCoordsRef.current.lat) * 111320;
          const lngDiff = Math.abs(longitude - lastCoordsRef.current.lng) * 111320 * Math.cos(latitude * (Math.PI/180));
          const dist = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
          
          if (timeDiff >= 30000 || dist >= 50) {
            shouldUpdate = true;
          }
        }

        if (shouldUpdate) {
          lastUpdateRef.current = now;
          lastCoordsRef.current = { lat: latitude, lng: longitude };
          
          logLocation({
            employeeId,
            latitude,
            longitude,
            accuracy,
            timestamp: new Date(position.timestamp).toISOString()
          }).catch(() => {
            // Silently fail as requested
          });
        }
      },
      (err) => {
        // Silently log to console, do not show error to employee as requested
        console.warn('Geolocation permission denied or unavailable:', err);
        setError(err.message);
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 5000
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [employeeId, isFieldEmployee]);

  return { isTracking, currentPosition, error };
}
