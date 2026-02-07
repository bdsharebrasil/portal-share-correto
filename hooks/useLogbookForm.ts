import { useState, useCallback, useEffect } from 'react';
import { Aerodrome } from '@/types';
import { calculateDistanceNM } from '@/utils/geoUtils';
import { parseDMSCoordinate } from '@/utils/geoUtils';
import { getSolarTimes, timeStringToMinutes } from '@/utils/solarUtils';

export interface LogbookFormData {
  entry_date: string;
  departure_airport: string;
  arrival_airport: string;
  flight_type: string;
  ac_time: string;
  departure_time: string;
  pou_time: string;
  cor_time: string;
  crew_checkin_time: string;
  distance_nm: string;
  flight_time_hours: string;
  flight_time_minutes: string;
  night_time_hours: string;
  night_time_minutes: string;
  ifr_count: string;
  landings: string;
  fuel_added: string;
  fuel_liters: string;
  fuel_cell: string;
  daily_rate: string;
  extras: string;
  remarks: string;
}

export function useLogbookForm(aerodromes: Aerodrome[]) {
  const [formData, setFormData] = useState<LogbookFormData>({
    entry_date: new Date().toISOString().split('T')[0],
    departure_airport: '',
    arrival_airport: '',
    flight_type: '',
    ac_time: '',
    departure_time: '',
    pou_time: '',
    cor_time: '',
    crew_checkin_time: '',
    distance_nm: '',
    flight_time_hours: '',
    flight_time_minutes: '',
    night_time_hours: '',
    night_time_minutes: '',
    ifr_count: '',
    landings: '1',
    fuel_added: '',
    fuel_liters: '',
    fuel_cell: '',
    daily_rate: '',
    extras: '',
    remarks: '',
  });

  // Atualizar um campo específico
  const updateField = useCallback((field: keyof LogbookFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Atualizar múltiplos campos
  const updateFields = useCallback((updates: Partial<LogbookFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // Calcular distância entre aeródromos (Haversine)
  useEffect(() => {
    if (!formData.departure_airport || !formData.arrival_airport) return;

    const depAero = aerodromes?.find(
      a => a.designativo === formData.departure_airport.toUpperCase()
    );
    const arrAero = aerodromes?.find(
      a => a.designativo === formData.arrival_airport.toUpperCase()
    );

    if (!depAero?.coordenadas || !arrAero?.coordenadas) return;

    try {
      const c1 = parseDMSCoordinate(depAero.coordenadas);
      const c2 = parseDMSCoordinate(arrAero.coordenadas);

      if (!c1 || !c2) return;

      const distance = calculateDistanceNM(c1.lat, c1.lng, c2.lat, c2.lng);
      setFormData(prev => ({
        ...prev,
        distance_nm: Math.round(distance * 100) / 100 + ''
      }));
    } catch (err) {
      console.error('Erro ao calcular distância:', err);
    }
  }, [formData.departure_airport, formData.arrival_airport, aerodromes]);

  // Calcular horário de apresentação (30 min antes do AC)
  useEffect(() => {
    if (!formData.ac_time) {
      setFormData(prev => ({ ...prev, crew_checkin_time: '' }));
      return;
    }

    try {
      const [hours, minutes] = formData.ac_time.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes - 30;
      
      let checkinHours = Math.floor(totalMinutes / 60);
      let checkinMinutes = totalMinutes % 60;

      // Tratar horários negativos (dia anterior)
      if (checkinHours < 0) {
        checkinHours += 24;
      }

      const checkinTime = `${String(checkinHours).padStart(2, '0')}:${String(checkinMinutes).padStart(2, '0')}`;
      setFormData(prev => ({ ...prev, crew_checkin_time: checkinTime }));
    } catch {
      setFormData(prev => ({ ...prev, crew_checkin_time: '' }));
    }
  }, [formData.ac_time]);

  // Calcular tempo de voo (DEP até POU) e tempo noturno preciso (AC até COR)
  useEffect(() => {
    if (!formData.departure_time || !formData.pou_time || !formData.ac_time || !formData.cor_time) {
      setFormData(prev => ({
        ...prev,
        flight_time_hours: '',
        flight_time_minutes: '',
        night_time_hours: '',
        night_time_minutes: '',
      }));
      return;
    }

    try {
      // 1. TEMPO DE VOO (DEP -> POU)
      const depMin = timeStringToMinutes(formData.departure_time);
      let pouMin = timeStringToMinutes(formData.pou_time);
      if (pouMin < depMin) pouMin += 1440; // Cruzou meia-noite

      const flightDiff = pouMin - depMin;
      const flightH = Math.floor(flightDiff / 60);
      const flightM = flightDiff % 60;

      // 2. TEMPO NOTURNO (AC -> COR) baseado em Geolocalização
      const depAero = aerodromes?.find(a => a.designativo === formData.departure_airport.toUpperCase());
      
      let nightMinutes = 0;

      if (depAero?.coordenadas && formData.entry_date) {
        const coord = parseDMSCoordinate(depAero.coordenadas);
        if (coord) {
          const flightDate = new Date(formData.entry_date);
          const { sunrise, sunset } = getSolarTimes(flightDate, coord.lat, coord.lng);

          // Converter solares para minutos UTC
          const sunriseMin = sunrise.getUTCHours() * 60 + sunrise.getUTCMinutes();
          const sunsetMin = sunset.getUTCHours() * 60 + sunset.getUTCMinutes();
          
          // Regra RBAC: Noite = Sunset + 15min (Crepúsculo Civil) até Sunrise - 15min
          const nightStart = sunsetMin + 15;
          const nightEnd = sunriseMin - 15 < 0 ? sunriseMin - 15 + 1440 : sunriseMin - 15;

          // Horários do Bloco
          const acMin = timeStringToMinutes(formData.ac_time);
          let corMin = timeStringToMinutes(formData.cor_time);
          if (corMin < acMin) corMin += 1440;

          // Função para calcular sobreposição entre dois intervalos
          const calculateOverlap = (start1: number, end1: number, start2: number, end2: number) => {
            return Math.max(0, Math.min(end1, end2) - Math.max(start1, start2));
          };

          // A noite "pula" a meia-noite (ex: 18:30 às 05:45), então calculamos:
          // 1. Parte noturna antes da meia-noite (nightStart até 1440)
          // 2. Parte noturna após a meia-noite (0 até nightEnd)
          // 3. Se o voo cruzou para o próximo dia, considerar noite do próximo dia também
          
          const nightBeforeMidnight = calculateOverlap(acMin, corMin, nightStart, 1440);
          const nightAfterMidnight = calculateOverlap(acMin, corMin, 0, nightEnd);
          const nightNextDay = calculateOverlap(acMin, corMin, nightStart + 1440, 2880);

          nightMinutes = nightBeforeMidnight + nightAfterMidnight + nightNextDay;
          
          // Garantir que não exceda o tempo total de bloco
          const totalBlockTime = corMin - acMin;
          nightMinutes = Math.min(nightMinutes, totalBlockTime);
        }
      }

      const nightH = Math.floor(nightMinutes / 60);
      const nightM = nightMinutes % 60;

      setFormData(prev => ({
        ...prev,
        flight_time_hours: flightH.toString(),
        flight_time_minutes: flightM.toString(),
        night_time_hours: nightH.toString(),
        night_time_minutes: nightM.toString(),
      }));

    } catch (err) {
      console.error('Erro no cálculo de tempos:', err);
    }
  }, [
    formData.departure_time, 
    formData.pou_time, 
    formData.ac_time, 
    formData.cor_time, 
    formData.departure_airport, 
    formData.entry_date, 
    aerodromes
  ]);

  // Resetar formulário
  const resetForm = useCallback(() => {
    setFormData({
      entry_date: new Date().toISOString().split('T')[0],
      departure_airport: '',
      arrival_airport: '',
      flight_type: '',
      ac_time: '',
      departure_time: '',
      pou_time: '',
      cor_time: '',
      crew_checkin_time: '',
      distance_nm: '',
      flight_time_hours: '',
      flight_time_minutes: '',
      night_time_hours: '',
      night_time_minutes: '',
      ifr_count: '',
      landings: '1',
      fuel_added: '',
      fuel_liters: '',
      fuel_cell: '',
      daily_rate: '',
      extras: '',
      remarks: '',
    });
  }, []);

  return {
    formData,
    updateField,
    updateFields,
    resetForm,
  };
}
