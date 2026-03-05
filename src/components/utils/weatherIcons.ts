

export const getWeatherIconType = (metarRaw: string, isDay: boolean): string => {
  const metar = metarRaw.toUpperCase();
  const suffix = isDay ? 'd' : 'n';

  if (metar.includes('TS')) return `thunderstorms-${suffix}`; // Trovoadas
  if (metar.includes('RA') || metar.includes('DZ')) return 'rain'; // Chuva
  if (metar.includes('FG') || metar.includes('BR') || metar.includes('HZ')) return 'fog'; // Neblina
  if (metar.includes('OVC') || metar.includes('BKN')) return 'cloudy'; // Nublado
  if (metar.includes('SCT') || metar.includes('FEW')) return `partly-cloudy-${suffix}`; // Parcialmente
  if (metar.includes('CAVOK') || metar.includes('NSC') || metar.includes('SKC')) return `clear-${suffix}`; // Limpo
  
  return `clear-${suffix}`; // Padrão
};