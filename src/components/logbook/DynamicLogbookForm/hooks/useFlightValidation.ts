import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { TIME_REGEX } from '../constants';
import type { FlightFormData, FlightCategory } from '../types';

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function useFlightValidation() {
  const { toast } = useToast();

  const validateStep1 = useCallback((
    date: Date | undefined,
    formData: FlightFormData,
    flightCategory: FlightCategory,
    selectedPic: string,
    selectedClient: string,
    selectedBorrowerClient: string,
    specialFlightType: string
  ): boolean => {
    const checks: ValidationResult[] = [
      { isValid: !!date, error: 'Selecione a data do voo.' },
      { isValid: !!(formData.departure_airport && formData.arrival_airport), error: 'Preencha os aeroportos DE e PARA.' },
      { isValid: !!selectedPic, error: 'Selecione o Piloto em Comando (PIC).' },
    ];

    if (flightCategory === 'cliente') {
      checks.push({ isValid: !!selectedClient, error: 'Selecione um cliente.' });
    }
    if (flightCategory === 'rateio') {
      checks.push({ isValid: !!specialFlightType, error: 'Selecione o tipo de voo para rateio.' });
    }
    if (flightCategory === 'emprestimo') {
      checks.push(
        { isValid: !!selectedClient, error: 'Selecione o cotista que está emprestando a aeronave.' },
        { isValid: !!selectedBorrowerClient, error: 'Selecione o cliente que está pegando emprestado.' }
      );
    }

    checks.push(
      { isValid: !!(formData.ac_time && TIME_REGEX.test(formData.ac_time)), error: 'AC inválido. Use o formato HH:MM.' },
      { isValid: !!(formData.departure_time && TIME_REGEX.test(formData.departure_time)), error: 'DEP inválido. Use o formato HH:MM.' },
      { isValid: !!(formData.pou_time && TIME_REGEX.test(formData.pou_time)), error: 'POU inválido. Use o formato HH:MM.' },
      { isValid: !!(formData.cor_time && TIME_REGEX.test(formData.cor_time)), error: 'COR inválido. Use o formato HH:MM.' },
    );

    for (const check of checks) {
      if (!check.isValid) {
        toast({ title: 'Erro', description: check.error, variant: 'destructive' });
        return false;
      }
    }

    return true;
  }, [toast]);

  const validateStep2 = useCallback((formData: FlightFormData): boolean => {
    if (
      (formData.flight_time_hours === '' || formData.flight_time_hours === '0') &&
      (formData.flight_time_minutes === '' || formData.flight_time_minutes === '0')
    ) {
      toast({ title: 'Erro', description: 'Informe o tempo de voo.', variant: 'destructive' });
      return false;
    }

    if (formData.flight_time_minutes) {
      const minutes = parseInt(formData.flight_time_minutes, 10);
      if (isNaN(minutes) || minutes < 0 || minutes > 59) {
        toast({ title: 'Erro', description: 'Minutos devem estar entre 0 e 59.', variant: 'destructive' });
        return false;
      }
    }

    return true;
  }, [toast]);

  return { validateStep1, validateStep2 };
}
