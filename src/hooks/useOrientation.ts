import { useState, useEffect } from 'react';

export interface OrientationState {
  isPortrait: boolean;
  isLandscape: boolean;
  angle: number;
}

export function useOrientation(): OrientationState {
  const [orientation, setOrientation] = useState<OrientationState>({
    isPortrait: true,
    isLandscape: false,
    angle: 0,
  });

  useEffect(() => {
    const updateOrientation = () => {
      const isPortrait = window.matchMedia('(orientation: portrait)').matches;
      // Handle screen.orientation safely (it might not exist on older browsers/Safari)
      const angle = window.screen && window.screen.orientation ? window.screen.orientation.angle : (window.orientation as number || 0);

      setOrientation({
        isPortrait,
        isLandscape: !isPortrait,
        angle,
      });
    };

    // Initial check
    updateOrientation();

    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);

    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  return orientation;
}
