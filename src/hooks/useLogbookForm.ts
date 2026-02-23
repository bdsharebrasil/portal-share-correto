import { useState, useCallback, useEffect } from 'react';
import { Aerodrome } from '@/types';
import { calculateDistanceNM, parseDMSCoordinate } from '@/utils/geoUtils';
import { getSolarTimes, timeStringToMinutes } from '@/utils/solarUtils';

export interface LogbookFormData {
  // Chaves Estrangeiras Obrigatórias no SQL
  aircraft_id: string;
  logbook_month_id: string;
  pic_canac: string;
  
  // Campos de Dados
  entry_date: string;
  departure_aerodrome: string;
  arrival_aerodrome: string;
  flight_nature: string; // Corrigido de flight_type
  ac_time: string;
  dep_time: string;      // Corrigido de departure_time
  pou_time: string;
  cor_time: string;
  crew_checkin_time: string;
  distance_nm: string;
  
  // Tempos formatados para o banco (numeric 10,2)
  total_time: string;    // Soma de DEP até POU em decimal
  night_hours: string;   // Tempo noturno em decimal
  ifr_time: string;      // Corrigido de ifr_count
  
  // Outros campos
  pousos: string;        // Corrigido de landings
  fuel_added: string;
  fuel_liters: string;
  celula: string;        // Corrigido de fuel_cell
  daily_rate: string;
  occurrences: string;   // Corrigido de remarks
  discrepancies: string; // Corrigido de extras
}

export function useLogbookForm(aerodromes: Aerodrome[]) {
  const [formData, setFormData] = useState<LogbookFormData>({
    aircraft_id: '',
    logbook_month_id: '',
    pic_canac: '',
    entry_date: new Date().toISOString().split('T')[0],
    departure_aerodrome: '',
    arrival_aerodrome: '',
    flight_nature: 'PV', // Valor padrão baseado no seu CHECK constraint
    ac_time: '',
    dep_time: '',
    pou_time: '',
    cor_time: '',
    crew_checkin_time: '',
    distance_nm: '',
    total_time: '0',
    night_hours: '0',
    ifr_time: '0',
    pousos: '1',
    fuel_added: '',
    fuel_liters: '',
    celula: '',
    daily_rate: '',
    occurrences: '',
    discrepancies: '',
  });

  const updateField = useCallback((field: keyof LogbookFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const updateFields = useCallback((updates: Partial<LogbookFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // 1. Cálculo de Distância (Haversine)
  useEffect(() => {
    if (!formData.departure_aerodrome || !formData.arrival_aerodrome) return;

    const depAero = aerodromes?.find(a => a.designativo === formData.departure_aerodrome.toUpperCase());
    const arrAero = aerodromes?.find(a => a.designativo === formData.arrival_aerodrome.toUpperCase());

    if (!depAero?.coordenadas || !arrAero?.coordenadas) return;

    try {
      const c1 = parseDMSCoordinate(depAero.coordenadas);
      const c2 = parseDMSCoordinate(arrAero.coordenadas);
      if (c1 && c2) {
        const distance = calculateDistanceNM(c1.lat, c1.lng, c2.lat, c2.lng);
        updateField('distance_nm', (Math.round(distance * 100) / 100).toString());
      }
    } catch (err) {
      console.error('Erro distância:', err);
    }
  }, [formData.departure_aerodrome, formData.arrival_aerodrome, aerodromes, updateField]);

  // 2. Cálculo de tempos (Voo e Noturno)
  useEffect(() => {
    if (!formData.dep_time || !formData.pou_time || !formData.ac_time || !formData.cor_time) return;

    try {
      // Cálculo do Tempo Total (Decimal para o banco)
      const dMin = timeStringToMinutes(formData.dep_time);
      let pMin = timeStringToMinutes(formData.pou_time);
      if (pMin < dMin) pMin += 1440;
      const totalDiff = (pMin - dMin) / 60;

      // Cálculo Noturno (Simplificado para o exemplo, mantendo sua lógica solar)
      let nMinutes = 0;
      const depAero = aerodromes?.find(a => a.designativo === formData.departure_aerodrome.toUpperCase());
      
      if (depAero?.coordenadas && formData.entry_date) {
        const coord = parseDMSCoordinate(depAero.coordenadas);
        if (coord) {
          const { sunrise, sunset } = getSolarTimes(new Date(formData.entry_date), coord.lat, coord.lng);
          const nightStart = (sunset.getUTCHours() * 60 + sunset.getUTCMinutes()) + 15;
          const nightEnd = (sunrise.getUTCHours() * 60 + sunrise.getUTCMinutes()) - 15;
          
          const acMin = timeStringToMinutes(formData.ac_time);
          let corMin = timeStringToMinutes(formData.cor_time);
          if (corMin < acMin) corMin += 1440;

          const calculateOverlap = (s1: number, e1: number, s2: number, e2: number) => 
            Math.max(0, Math.min(e1, e2) - Math.max(s1, s2));

          nMinutes = calculateOverlap(acMin, corMin, nightStart, 1440) + 
                     calculateOverlap(acMin, corMin, 0, nightEnd < 0 ? nightEnd + 1440 : nightEnd);
        }
      }

      setFormData(prev => ({
        ...prev,
        total_time: totalDiff.toFixed(2),
        night_hours: (nMinutes / 60).toFixed(2),
      }));
    } catch (err) {
      console.error('Erro tempos:', err);
    }
  }, [formData.dep_time, formData.pou_time, formData.ac_time, formData.cor_time, formData.departure_aerodrome, aerodromes]);

  const resetForm = useCallback(() => {
    // ... mesmo objeto do estado inicial
  }, []);

  return { formData, updateField, updateFields, resetForm };
}