import { useState, useEffect, useRef } from 'react';

export interface LocationState {
  lat: number;
  lng: number;
  error: string | null;
  loading: boolean;
  accuracy?: number;
  accuracyTried: 'high' | 'standard' | 'none';
}

export function useGeolocation() {
  const [state, setState] = useState<LocationState>({
    lat: 20.5937, // Default center
    lng: 78.9629,
    error: null,
    loading: true,
    accuracyTried: 'none',
  });

  const [retryTrigger, setRetryTrigger] = useState(0);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const retry = () => {
    if (isMounted.current) {
      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }));
      setRetryTrigger((prev) => prev + 1);
    }
  };

  const simulate = (lat: number, lng: number) => {
    if (isMounted.current) {
      setState({
        lat,
        lng,
        error: null,
        loading: false,
        accuracy: 10,
        accuracyTried: 'high',
      });
    }
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      if (isMounted.current) {
        setState((prev) => ({
          ...prev,
          error: "Geolocation is not supported by your browser.",
          loading: false,
        }));
      }
      return;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      if (isMounted.current) {
        setState({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          error: null,
          loading: false,
          accuracy: position.coords.accuracy,
          accuracyTried: 'high',
        });
      }
    };

    const handleFailure = (error: GeolocationPositionError) => {
      console.warn(`High accuracy geolocation failed (Code ${error.code}): ${error.message}`);

      // If the user actively denied permission, do not retry with standard accuracy
      if (error.code === error.PERMISSION_DENIED) {
        if (isMounted.current) {
          setState((prev) => ({
            ...prev,
            error: "Location permission was denied. Please allow location access in your browser settings to pinpoint reported issues.",
            loading: false,
            accuracyTried: 'high',
          }));
        }
        return;
      }

      // If timed out or unavailable, try with standard accuracy (low power/IP-based fallbacks)
      console.log("Retrying with standard accuracy...");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (isMounted.current) {
            setState({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              error: null,
              loading: false,
              accuracy: pos.coords.accuracy,
              accuracyTried: 'standard',
            });
          }
        },
        (standardError) => {
          console.error("Standard accuracy location retrieval failed:", standardError);
          let msg = "Failed to retrieve your location automatically.";
          if (standardError.code === standardError.PERMISSION_DENIED) {
            msg = "Location permission denied.";
          } else if (standardError.code === standardError.TIMEOUT) {
            msg = "Location request timed out. Please select location manually on the map.";
          }
          if (isMounted.current) {
            setState((prev) => ({
              ...prev,
              error: msg,
              loading: false,
              accuracyTried: 'standard',
            }));
          }
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
      );
    };

    // Attempt high accuracy lock first with a fast timeout (e.g., 6 seconds)
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleFailure,
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    );
  }, [retryTrigger]);

  return { ...state, retry, simulate };
}
