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

  // Calcular tempo de voo (DEP até POU) e tempo noturno do bloco (AC até COR)
  useEffect(() => {
    if (!formData.departure_time || !formData.pou_time) {
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
      // Calcular tempo de voo (DEP até POU)
      const [depHours, depMinutes] = formData.departure_time.split(':').map(Number);
      const [pouHours, pouMinutes] = formData.pou_time.split(':').map(Number);

      const depTotalMinutes = depHours * 60 + depMinutes;
      const pouTotalMinutes = pouHours * 60 + pouMinutes;

      let diffMinutes = pouTotalMinutes - depTotalMinutes;
      if (diffMinutes < 0) diffMinutes += 24 * 60; // Se passou da meia-noite

      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;

      setFormData(prev => ({
        ...prev,
        flight_time_hours: hours.toString(),
        flight_time_minutes: minutes.toString(),
      }));

      // Calcular tempo noturno do bloco (AC até COR) se temos AC e COR
      if (formData.ac_time && formData.cor_time) {
        try {
          const [acHours, acMinutes] = formData.ac_time.split(':').map(Number);
          const [corHours, corMinutes] = formData.cor_time.split(':').map(Number);

          const acTotalMinutes = acHours * 60 + acMinutes;
          const corTotalMinutes = corHours * 60 + corMinutes;

          let blockDiffMinutes = corTotalMinutes - acTotalMinutes;
          if (blockDiffMinutes < 0) blockDiffMinutes += 24 * 60;

          // Determinar se AC e COR são noturnos
          const acIsNight = acTotalMinutes < 6 * 60 || acTotalMinutes > 18 * 60;
          const corIsNight = corTotalMinutes < 6 * 60 || corTotalMinutes > 18 * 60;

          let nightMinutes = 0;
          if (acIsNight && corIsNight) {
            // Bloco todo noturno
            nightMinutes = blockDiffMinutes;
          } else if (acIsNight || corIsNight) {
            // Bloco parcialmente noturno (metade)
            nightMinutes = Math.round(blockDiffMinutes * 0.5);
          }
          // Senão é todo diurno, nightMinutes = 0

          const nightHours = Math.floor(nightMinutes / 60);
          const nightMins = nightMinutes % 60;

          setFormData(prev => ({
            ...prev,
            night_time_hours: nightHours.toString(),
            night_time_minutes: nightMins.toString(),
          }));
        } catch (err) {
          console.error('Erro ao calcular tempo noturno:', err);
        }
      }
    } catch {
      setFormData(prev => ({
        ...prev,
        flight_time_hours: '',
        flight_time_minutes: '',
      }));
    }
  }, [formData.departure_time, formData.pou_time, formData.ac_time, formData.cor_time]);

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
