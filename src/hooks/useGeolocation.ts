import { useState, useCallback } from 'react';
import { Geolocation } from '../types';

interface GeolocationState {
  loading: boolean;
  error: GeolocationPositionError | null;
  location: Geolocation | null;
}

export const useGeolocation = () => {
  const [state, setState] = useState<GeolocationState>({
    loading: false,
    error: null,
    location: null,
  });

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocalização não é suportada por este navegador.');
      return;
    }

    setState({ loading: true, error: null, location: null });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          loading: false,
          error: null,
          location: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        });
      },
      (error) => {
        setState({
          loading: false,
          error,
          location: null,
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const resetLocation = useCallback(() => {
    setState({ loading: false, error: null, location: null });
  }, []);

  return { ...state, getLocation, resetLocation };
};