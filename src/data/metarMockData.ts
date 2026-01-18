import { type METARData } from '@/hooks/useAviationWeather';

// Mock data for Brazilian airports - realistic METAR data
// This is used as fallback when API is unavailable
export const METAR_MOCK_DATA: Record<string, METARData> = {
  // Major Brazilian Airports
  SBGR: {
    temp: 24,
    dewp: 16,
    wdir: 180,
    wspd: 8,
    wgst: 12,
    visib: 10,
    altim: 30.12,
    rawOb: 'SBGR 121856Z 18008KT 10SM FEW020 BKN050 24/16 A3012 RMK AO2 SLP019',
    flightCategory: 'VFR',
    updatedTime: new Date().toISOString(),
    source: 'FALLBACK',
  },
  SBRJ: {
    temp: 26,
    dewp: 18,
    wdir: 160,
    wspd: 6,
    wgst: 10,
    visib: 10,
    altim: 30.08,
    rawOb: 'SBRJ 121900Z 16006KT 10SM SCT025 BKN045 26/18 A3008 RMK AO2 SLP003',
    flightCategory: 'VFR',
    updatedTime: new Date().toISOString(),
    source: 'FALLBACK',
  },
  SBSP: {
    temp: 22,
    dewp: 14,
    wdir: 170,
    wspd: 7,
    wgst: 11,
    visib: 10,
    altim: 30.14,
    rawOb: 'SBSP 121856Z 17007KT 10SM FEW015 BKN035 22/14 A3014 RMK AO2 SLP025',
    flightCategory: 'VFR',
    updatedTime: new Date().toISOString(),
    source: 'FALLBACK',
  },
  SBCT: {
    temp: 23,
    dewp: 15,
    wdir: 200,
    wspd: 9,
    wgst: 14,
    visib: 10,
    altim: 30.10,
    rawOb: 'SBCT 121845Z 20009KT 10SM FEW030 SCT050 23/15 A3010 RMK AO2 SLP010',
    flightCategory: 'VFR',
    updatedTime: new Date().toISOString(),
    source: 'FALLBACK',
  },
  SBRF: {
    temp: 27,
    dewp: 20,
    wdir: 150,
    wspd: 5,
    wgst: 8,
    visib: 10,
    altim: 30.06,
    rawOb: 'SBRF 121800Z 15005KT 10SM FEW020 SCT040 27/20 A3006 RMK AO2 SLP000',
    flightCategory: 'VFR',
    updatedTime: new Date().toISOString(),
    source: 'FALLBACK',
  },
  SBBR: {
    temp: 25,
    dewp: 17,
    wdir: 180,
    wspd: 6,
    wgst: 10,
    visib: 10,
    altim: 30.09,
    rawOb: 'SBBR 121830Z 18006KT 10SM FEW025 SCT045 25/17 A3009 RMK AO2 SLP005',
    flightCategory: 'VFR',
    updatedTime: new Date().toISOString(),
    source: 'FALLBACK',
  },
  SBMA: {
    temp: 28,
    dewp: 21,
    wdir: 140,
    wspd: 4,
    wgst: 7,
    visib: 10,
    altim: 30.04,
    rawOb: 'SBMA 121815Z 14004KT 10SM FEW015 SCT035 28/21 A3004 RMK AO2 SLP002',
    flightCategory: 'VFR',
    updatedTime: new Date().toISOString(),
    source: 'FALLBACK',
  },
  SBPV: {
    temp: 29,
    dewp: 22,
    wdir: 130,
    wspd: 3,
    wgst: 6,
    visib: 10,
    altim: 30.02,
    rawOb: 'SBPV 121800Z 13003KT 10SM SCT020 BKN040 29/22 A3002 RMK AO2 SLP001',
    flightCategory: 'VFR',
    updatedTime: new Date().toISOString(),
    source: 'FALLBACK',
  },
  SBAL: {
    temp: 26,
    dewp: 19,
    wdir: 170,
    wspd: 6,
    wgst: 10,
    visib: 10,
    altim: 30.05,
    rawOb: 'SBAL 121830Z 17006KT 10SM FEW025 SCT040 26/19 A3005 RMK AO2 SLP003',
    flightCategory: 'VFR',
    updatedTime: new Date().toISOString(),
    source: 'FALLBACK',
  },
  SBSV: {
    temp: 27,
    dewp: 20,
    wdir: 160,
    wspd: 5,
    wgst: 9,
    visib: 10,
    altim: 30.07,
    rawOb: 'SBSV 121815Z 16005KT 10SM FEW020 SCT035 27/20 A3007 RMK AO2 SLP004',
    flightCategory: 'VFR',
    updatedTime: new Date().toISOString(),
    source: 'FALLBACK',
  },
};

// Function to get mock data for any ICAO code
export function getMockMETAR(icao: string): METARData {
  const upperIcao = icao.toUpperCase();
  
  // Return existing mock data or generate default
  if (METAR_MOCK_DATA[upperIcao]) {
    return METAR_MOCK_DATA[upperIcao];
  }

  // Generate realistic default for unknown airports
  const randomTemp = Math.floor(Math.random() * 15) + 20; // 20-35°C
  const randomWind = Math.floor(Math.random() * 20); // 0-20 knots
  const randomVisib = Math.floor(Math.random() * 3) + 8; // 8-10 SM
  const flightCategories: Array<'VFR' | 'MVFR' | 'IFR' | 'LIFR'> = ['VFR', 'VFR', 'VFR', 'MVFR'];
  const randomCategory = flightCategories[Math.floor(Math.random() * flightCategories.length)];

  return {
    temp: randomTemp,
    dewp: randomTemp - 8,
    wdir: Math.floor(Math.random() * 360),
    wspd: randomWind,
    wgst: randomWind + Math.floor(Math.random() * 5),
    visib: randomVisib,
    altim: 29.92 + Math.random() * 0.3,
    rawOb: `${upperIcao} - METAR (dados simulados) - ${new Date().toLocaleTimeString('pt-BR')}`,
    flightCategory: randomCategory,
    updatedTime: new Date().toISOString(),
    source: 'FALLBACK',
  };
}

// Simulate different weather conditions
export function generateConditionMETAR(condition: 'vfr' | 'mvfr' | 'ifr' | 'lifr', icao: string): METARData {
  const upperIcao = icao.toUpperCase();
  
  switch (condition) {
    case 'vfr':
      return {
        temp: Math.floor(Math.random() * 15) + 20,
        dewp: Math.floor(Math.random() * 10) + 10,
        wdir: Math.floor(Math.random() * 360),
        wspd: Math.floor(Math.random() * 15),
        wgst: Math.floor(Math.random() * 5) + 5,
        visib: 10,
        altim: 30.12,
        rawOb: `${upperIcao} - VFR CONDITIONS`,
        flightCategory: 'VFR',
        updatedTime: new Date().toISOString(),
        source: 'FALLBACK',
      };
    case 'mvfr':
      return {
        temp: Math.floor(Math.random() * 10) + 15,
        dewp: Math.floor(Math.random() * 5) + 10,
        wdir: Math.floor(Math.random() * 360),
        wspd: Math.floor(Math.random() * 20) + 5,
        wgst: Math.floor(Math.random() * 10) + 10,
        visib: Math.floor(Math.random() * 3) + 5,
        altim: 29.95,
        rawOb: `${upperIcao} - MARGINAL VFR`,
        flightCategory: 'MVFR',
        updatedTime: new Date().toISOString(),
        source: 'FALLBACK',
      };
    case 'ifr':
      return {
        temp: Math.floor(Math.random() * 8) + 12,
        dewp: Math.floor(Math.random() * 3) + 9,
        wdir: Math.floor(Math.random() * 360),
        wspd: Math.floor(Math.random() * 25) + 10,
        wgst: Math.floor(Math.random() * 15) + 15,
        visib: Math.floor(Math.random() * 2) + 2,
        altim: 29.82,
        rawOb: `${upperIcao} - IFR CONDITIONS`,
        flightCategory: 'IFR',
        updatedTime: new Date().toISOString(),
        source: 'FALLBACK',
      };
    case 'lifr':
      return {
        temp: Math.floor(Math.random() * 5) + 10,
        dewp: Math.floor(Math.random() * 2) + 8,
        wdir: Math.floor(Math.random() * 360),
        wspd: Math.floor(Math.random() * 30) + 15,
        wgst: Math.floor(Math.random() * 20) + 20,
        visib: Math.floor(Math.random() * 1) + 0.25,
        altim: 29.70,
        rawOb: `${upperIcao} - LOW IFR CONDITIONS`,
        flightCategory: 'LIFR',
        updatedTime: new Date().toISOString(),
        source: 'FALLBACK',
      };
    default:
      return getMockMETAR(upperIcao);
  }
}
