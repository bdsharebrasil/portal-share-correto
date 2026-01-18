import { useState, useCallback } from 'react';
import { useToast } from './use-toast';

interface CalculationResult {
  distance: {
    nm: number;
    km: number;
  };
  nightTime: {
    hours: number;
    minutes: number;
    decimal: number;
  };
  solarTimes: {
    sunrise: { time: string; minutes: number };
    sunset: { time: string; minutes: number };
    dawn: { time: string; minutes: number };
    dusk: { time: string; minutes: number };
  };
  flight: {
    departure: { icao: string; name: string };
    arrival: { icao: string; name: string };
    date: string;
    landingTime: string;
    isNightFlightAtLanding: boolean;
  };
}

interface UseFlightCalculationsReturn {
  calculating: boolean;
  result: CalculationResult | null;
  calculateFlightMetrics: (
    departureIcao: string,
    arrivalIcao: string | null,
    arrivalManual: { lat: number; lng: number; nome: string } | null,
    flightDate: string,
    landingTime: string
  ) => Promise<CalculationResult | null>;
  clearResult: () => void;
}

const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:3001/api';

export function useFlightCalculations(): UseFlightCalculationsReturn {
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const { toast } = useToast();

  const calculateFlightMetrics = useCallback(
    async (
      departureIcao: string,
      arrivalIcao: string | null,
      arrivalManual: { lat: number; lng: number; nome: string } | null,
      flightDate: string,
      landingTime: string
    ): Promise<CalculationResult | null> => {
      try {
        setCalculating(true);

        // Validações básicas
        if (!departureIcao || !flightDate || !landingTime) {
          toast({
            title: 'Erro',
            description: 'Preencha aeroporto de partida, data e hora de pouso.',
            variant: 'destructive',
          });
          return null;
        }

        if (!arrivalIcao && !arrivalManual) {
          toast({
            title: 'Erro',
            description: 'Preencha o aeroporto de chegada.',
            variant: 'destructive',
          });
          return null;
        }

        // Validar formato de data (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(flightDate)) {
          toast({
            title: 'Erro',
            description: 'Formato de data inválido. Use YYYY-MM-DD.',
            variant: 'destructive',
          });
          return null;
        }

        // Validar formato de hora (HH:MM)
        if (!/^\d{2}:\d{2}$/.test(landingTime)) {
          toast({
            title: 'Erro',
            description: 'Formato de hora inválido. Use HH:MM.',
            variant: 'destructive',
          });
          return null;
        }

        const payload: any = {
          departureIcao,
          flightDate,
          landingTime,
        };

        if (arrivalIcao) {
          payload.arrivalIcao = arrivalIcao;
        }

        if (arrivalManual) {
          payload.arrivalManual = arrivalManual;
        }

        const response = await fetch(`${API_BASE_URL}/flight-calculations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || 'Erro ao calcular métricas do voo'
          );
        }

        const data = await response.json();
        setResult(data.data);

        toast({
          title: 'Sucesso',
          description: 'Cálculos realizados com sucesso.',
        });

        return data.data;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
        toast({
          title: 'Erro',
          description: errorMsg,
          variant: 'destructive',
        });
        return null;
      } finally {
        setCalculating(false);
      }
    },
    [toast]
  );

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  return {
    calculating,
    result,
    calculateFlightMetrics,
    clearResult,
  };
}
