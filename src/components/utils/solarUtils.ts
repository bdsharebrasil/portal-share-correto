
/**
 * Utilitário para cálculos solares baseados em latitude, longitude e data.
 * Baseado na Sunrise Equation (Almanaque Naval).
 * Todos os cálculos e retornos são padronizados em UTC (Zulu).
 */

export interface SolarTimes {
  sunrise: Date;
  sunset: Date;
  civilTwilightEnd: Date;
}

export const getSolarTimes = (date: Date, lat: number, lng: number): SolarTimes => {
  const radians = Math.PI / 180;
  const degrees = 180 / Math.PI;

  // 1. Calcular o dia do ano em UTC
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const start = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 0));
  const diff = (utcDate.getTime() - start.getTime());
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

  // 2. Aproximação do tempo solar médio
  const lngHour = lng / 15;
  const tSunrise = dayOfYear + ((6 - lngHour) / 24);
  const tSunset = dayOfYear + ((18 - lngHour) / 24);

  const calculateTime = (t: number, isSunset: boolean) => {
    // Anomalia média do Sol
    const M = (0.9856 * t) - 3.289;
    // Lonitude verdadeira do Sol
    let L = M + (1.916 * Math.sin(M * radians)) + (0.020 * Math.sin(2 * M * radians)) + 282.634;
    L = (L + 360) % 360;

    // Ascensão reta
    let RA = degrees * Math.atan(0.91764 * Math.tan(L * radians));
    RA = (RA + 360) % 360;
    
    // Ajuste de quadrante da ascensão reta
    const Lquadrant = (Math.floor(L / 90)) * 90;
    const RAquadrant = (Math.floor(RA / 90)) * 90;
    RA = RA + (Lquadrant - RAquadrant);
    RA = RA / 15;

    // Declinação do Sol
    const sinDec = 0.39782 * Math.sin(L * radians);
    const cosDec = Math.cos(Math.asin(sinDec));

    // Ângulo horário local (h)
    // -0.833 para pôr do sol oficial, -6 para crepúsculo civil
    const zenith = isSunset ? -0.833 : -6.0; 
    const cosH = (Math.sin(zenith * radians) - (sinDec * Math.sin(lat * radians))) / (cosDec * Math.cos(lat * radians));

    if (cosH > 1) return null; // Sol nunca nasce
    if (cosH < -1) return null; // Sol nunca se põe

    let h = degrees * Math.acos(cosH);
    if (!isSunset) h = 360 - h;
    h = h / 15;

    // Tempo local (UTC)
    const T = h + RA - (0.06571 * t) - 6.622;
    let UT = T - lngHour;
    UT = (UT + 24) % 24;

    const res = new Date(date);
    res.setUTCHours(Math.floor(UT), (UT % 1) * 60, 0, 0);
    return res;
  };

  const sunrise = calculateTime(tSunrise, false) || new Date();
  const sunset = calculateTime(tSunset, true) || new Date();
  
  // Para aviação, o crepúsculo civil termina aprox 15 min após o pôr do sol
  const twilight = new Date(sunset);
  twilight.setUTCMinutes(twilight.getUTCMinutes() + 15);

  return {
    sunrise,
    sunset,
    civilTwilightEnd: twilight
  };
};

/**
 * Converte string HH:mm para minutos totais desde o início do dia (Zulu)
 */
export const timeStringToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};
