import { useState, useEffect, useRef } from 'react';
import { logLocation } from '../api/employees';
import { isFieldEmployeePunchedIn } from '../api/attendance';

export function useFieldTracking(employeeId: string | null, isFieldEmployee: boolean) {
  const [isTracking, setIsTracking] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const lastCoordsRef = useRef<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    let watchId: number | null = null;
    let punchInterval: NodeJS.Timeout | null = null;

    const stopTracking = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        setIsTracking(false);
      }
    };

    const startTracking = () => {
      if (watchId !== null) return; // already tracking
      
      watchId = navigator.geolocation.watchPosition(
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

          if (shouldUpdate && employeeId) {
            lastUpdateRef.current = now;
            lastCoordsRef.current = { lat: latitude, lng: longitude };
            
            logLocation({
              employeeId,
              latitude,
              longitude,
              accuracy,
              timestamp: new Date(position.timestamp).toISOString()
            }).catch(() => {});
          }
        },
        (err) => {
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
    };

    if (!employeeId || !isFieldEmployee || !navigator.geolocation) {
      stopTracking();
      return;
    }

     const checkPunchStatus = async () => {
      try {
        const isPunchedIn = await isFieldEmployeePunchedIn();
        if (isPunchedIn) {
          startTracking();
        } else {
          stopTracking();
        }
      } catch (e) {
        console.warn('Failed to check punch status', e);
      }
    };
    
    checkPunchStatus();
    punchInterval = setInterval(checkPunchStatus, 30000); // Check every 30s

    return () => {
      if (punchInterval) clearInterval(punchInterval);
      stopTracking();
    };
  }, [employeeId, isFieldEmployee]);

  return { isTracking, currentPosition, error };
}
