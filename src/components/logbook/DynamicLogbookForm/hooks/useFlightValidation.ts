import { useToast } from '@/hooks/use-toast';
import { FlightFormData, FlightCategory, ValidationResult } from '../types';
import { TIME_REGEX } from '../constants';

export function useFlightValidation() {
  const { toast } = useToast();

  const validateStep1 = (
    date: Date | undefined,
    formData: FlightFormData,
    flightCategory: FlightCategory,
    selectedPic: string,
    selectedClient: string,
    selectedBorrowerClient: string,
    specialFlightType: string
  ): ValidationResult => {
    if (!date) {
      return { isValid: false, error: 'Selecione a data do voo.' };
    }

    if (!formData.departure_airport || !formData.arrival_airport) {
      return { isValid: false, error: 'Preencha os aeroportos DE e PARA.' };
    }

    if (!selectedPic) {
      return { isValid: false, error: 'Selecione o Piloto em Comando (PIC).' };
    }

    // Validar categoria de voo
    if (flightCategory === 'cliente' && !selectedClient) {
      return { isValid: false, error: 'Selecione um cliente.' };
    }

    if (flightCategory === 'rateio' && !specialFlightType) {
      return { isValid: false, error: 'Selecione o tipo de voo para rateio.' };
    }

    if (flightCategory === 'emprestimo') {
      if (!selectedClient) {
        return {
          isValid: false,
          error: 'Selecione o cotista que está emprestando a aeronave.'
        };
      }
      if (!selectedBorrowerClient) {
        return {
          isValid: false,
          error: 'Selecione o cliente que está pegando emprestado.'
        };
      }
    }

    // Validar horários
    const timeFields = [
      { field: formData.ac_time, name: 'AC' },
      { field: formData.departure_time, name: 'DEP' },
      { field: formData.pou_time, name: 'POU' },
      { field: formData.cor_time, name: 'COR' },
    ];

    for (const { field, name } of timeFields) {
      if (!field || !TIME_REGEX.test(field)) {
        return {
          isValid: false,
          error: `${name} inválido. Use o formato HH:MM.`
        };
      }
    }

    return { isValid: true };
  };

  const validateStep2 = (formData: FlightFormData): ValidationResult => {
    if (
      (formData.flight_time_hours === '' || formData.flight_time_hours === '0') &&
      (formData.flight_time_minutes === '' || formData.flight_time_minutes === '0')
    ) {
      return { isValid: false, error: 'Informe o tempo de voo.' };
    }

    if (formData.flight_time_minutes) {
      const minutes = parseInt(formData.flight_time_minutes, 10);
      if (isNaN(minutes) || minutes < 0 || minutes > 59) {
        return {
          isValid: false,
          error: 'Minutos devem estar entre 0 e 59.'
        };
      }
    }

    return { isValid: true };
  };

  const showValidationError = (error: string) => {
    toast({
      title: 'Erro',
      description: error,
      variant: 'destructive',
    });
  };

  return {
    validateStep1,
    validateStep2,
    showValidationError,
  };
}
