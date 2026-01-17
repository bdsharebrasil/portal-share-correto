import { useState, useEffect, useCallback } from 'react';

interface WeatherData {
  temperature: number;
  location: string;
  humidity: number;
  description: string;
  icon: string;
  error?: string;
}

const OPENWEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
const UPDATE_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  const setDefaultWeather = useCallback(() => {
    setWeather({
      temperature: 25,
      location: 'Vila Gopoúva',
      humidity: 65,
      description: 'Clima estável',
      icon: '01d',
    });
    setLoading(false);
  }, []);

  const fetchWeather = useCallback(async (latitude: number, longitude: number) => {
    try {
      // Se não houver API key configurada, usar padrão
      if (!OPENWEATHER_API_KEY) {
        setDefaultWeather();
        return;
      }

      setLoading(true);
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHER_API_KEY}&units=metric`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();

      setWeather({
        temperature: Math.round(data.main.temp),
        location: data.name,
        humidity: data.main.humidity,
        description: data.weather[0].description,
        icon: data.weather[0].icon,
      });
    } catch (error) {
      console.warn('Erro ao buscar previsão do tempo:', error);
      // Usar dados padrão em caso de erro
      setDefaultWeather();
    } finally {
      setLoading(false);
    }
  }, [setDefaultWeather]);

  const getLocation = useCallback(() => {
    // Usar localização padrão
    const useDefaultLocation = () => {
      fetchWeather(-23.5505, -46.6333); // São Paulo, Brasil
    };

    if (!navigator.geolocation) {
      useDefaultLocation();
      return;
    }

    // Verificar permissão usando Permissions API antes de tentar geolocation
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((permission) => {
        if (permission.state === 'denied') {
          // Permissão negada - usar padrão
          useDefaultLocation();
          return;
        }

        // Tentar obter localização
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            fetchWeather(latitude, longitude);
          },
          () => {
            // Erro qualquer - usar padrão
            useDefaultLocation();
          },
          {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 300000,
          }
        );
      }).catch(() => {
        // Se Permissions API falhar, tentar geolocation direto
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            fetchWeather(latitude, longitude);
          },
          () => {
            useDefaultLocation();
          },
          {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 300000,
          }
        );
      });
    } else {
      // Se Permissions API não disponível, tentar geolocation direto
      (navigator as Navigator).geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          fetchWeather(latitude, longitude);
        },
        () => {
          useDefaultLocation();
        },
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 300000,
        }
      );
    }
  }, [fetchWeather]);

  useEffect(() => {
    // Initial load
    getLocation();

    // Set up interval for updates every 30 minutes
    const interval = setInterval(() => {
      getLocation();
    }, UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [getLocation]);

  return { weather, loading };
}
