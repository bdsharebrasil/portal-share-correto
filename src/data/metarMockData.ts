// METARData type for fallback data - matches API response format
interface METARData {
  loc: string;
  metar: string;
  taf: string;
}

// Mock data for Brazilian airports - realistic METAR data
// This is used as fallback when API is unavailable
// Format matches: { loc: string, metar: string, taf: string }
export const METAR_MOCK_DATA: Record<string, METARData> = {
  // Major Brazilian Airports
  SBGR: {
    loc: 'SBGR',
    metar: 'METAR SBGR 121856Z 18008KT 9999 FEW020 BKN050 24/16 Q1020',
    taf: 'TAF SBGR 121720Z 1218/1324 18010KT 9999 FEW020 BKN050',
  },
  SBRJ: {
    loc: 'SBRJ',
    metar: 'METAR SBRJ 121900Z 16006KT 9999 SCT025 BKN045 26/18 Q1019',
    taf: 'TAF SBRJ 121800Z 1218/1324 16008KT 9999 SCT025 BKN045',
  },
  SBSP: {
    loc: 'SBSP',
    metar: 'METAR SBSP 121856Z 17007KT 9999 FEW015 BKN035 22/14 Q1021',
    taf: 'TAF SBSP 121720Z 1218/1324 17009KT 9999 FEW015 BKN035',
  },
  SBCT: {
    loc: 'SBCT',
    metar: 'METAR SBCT 121845Z 20009KT 9999 FEW030 SCT050 23/15 Q1020',
    taf: 'TAF SBCT 121730Z 1218/1324 20010KT 9999 FEW030 SCT050',
  },
  SBRF: {
    loc: 'SBRF',
    metar: 'METAR SBRF 121800Z 15005KT 9999 FEW020 SCT040 27/20 Q1018',
    taf: 'TAF SBRF 121700Z 1218/1324 15007KT 9999 FEW020 SCT040',
  },
  SBBR: {
    loc: 'SBBR',
    metar: 'METAR SBBR 121830Z 18006KT 9999 FEW025 SCT045 25/17 Q1019',
    taf: 'TAF SBBR 121730Z 1218/1324 18008KT 9999 FEW025 SCT045',
  },
  SBMA: {
    loc: 'SBMA',
    metar: 'METAR SBMA 121815Z 14004KT 9999 FEW015 SCT035 28/21 Q1017',
    taf: 'TAF SBMA 121715Z 1218/1324 14006KT 9999 FEW015 SCT035',
  },
  SBPV: {
    loc: 'SBPV',
    metar: 'METAR SBPV 121800Z 13003KT 9999 SCT020 BKN040 29/22 Q1016',
    taf: 'TAF SBPV 121700Z 1218/1324 13005KT 9999 SCT020 BKN040',
  },
  SBAL: {
    loc: 'SBAL',
    metar: 'METAR SBAL 121830Z 17006KT 9999 FEW025 SCT040 26/19 Q1018',
    taf: 'TAF SBAL 121730Z 1218/1324 17008KT 9999 FEW025 SCT040',
  },
  SBSV: {
    loc: 'SBSV',
    metar: 'METAR SBSV 121815Z 16005KT 9999 FEW020 SCT035 27/20 Q1019',
    taf: 'TAF SBSV 121715Z 1218/1324 16007KT 9999 FEW020 SCT035',
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
  const randomAltim = Math.floor(Math.random() * 30) + 1005; // 1005-1035 hPa

  return {
    loc: upperIcao,
    metar: `METAR ${upperIcao} 121800Z ${String(Math.floor(Math.random() * 360)).padStart(3, '0')}${String(randomWind).padStart(2, '0')}KT 9999 FEW025 ${randomTemp}/${randomTemp - 8} Q${randomAltim}`,
    taf: `TAF ${upperIcao} 121720Z 1218/1324 ${String(Math.floor(Math.random() * 360)).padStart(3, '0')}${String(randomWind + 2).padStart(2, '0')}KT 9999 FEW025`,
  };
}
