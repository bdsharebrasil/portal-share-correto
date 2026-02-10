import { API_ENDPOINTS } from '@/config/api';

export interface ChartData {
  type: 'IFR' | 'VFR' | 'APPROACH' | 'DEPARTURE' | 'STAR' | 'SID' | 'IAP' | 'AIRPORT';
  title: string;
  description?: string;
  url?: string;
  format?: string;
  scale?: string;
  edition?: string;
}

export async function fetchAirportCharts(icao: string): Promise<ChartData[]> {
  const icaoUpper = icao.toUpperCase();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(
        `${API_ENDPOINTS.charts(icaoUpper)}`,
        {
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 404) {
          console.debug(`[chartsService] No charts found for ${icaoUpper}`);
          return [];
        }
        console.warn(`[chartsService] API error for ${icaoUpper}: ${response.status}`);
        return [];
      }

      const data = await response.json();
      return parseChartsData(data);
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.warn(`[chartsService] Timeout fetching charts for ${icaoUpper}`);
      } else {
        console.warn(`[chartsService] Failed to fetch charts for ${icaoUpper}:`, fetchError);
      }
      return [];
    }
  } catch (error) {
    console.error(`[chartsService] Unexpected error for ${icaoUpper}:`, error);
    return [];
  }
}

// Parse charts data from API response
function parseChartsData(rawData: any): ChartData[] {
  if (!rawData) return [];

  // Handle both array and object responses
  let chartsArray: any[] = [];

  if (Array.isArray(rawData)) {
    chartsArray = rawData;
  } else if (rawData?.charts && Array.isArray(rawData.charts)) {
    chartsArray = rawData.charts;
  } else if (rawData?.data && Array.isArray(rawData.data)) {
    chartsArray = rawData.data;
  } else {
    console.warn('[parseChartsData] Unexpected response format:', rawData);
    return [];
  }

  return chartsArray
    .map((chart: any) => {
      if (!chart) return null;

      // Determinar tipo de carta
      let type: ChartData['type'] = 'AIRPORT';
      const title = (chart.title || chart.name || chart.designator || '').toUpperCase();
      
      if (title.includes('IFR') || title.includes('INSTRUMENT')) {
        type = 'IFR';
      } else if (title.includes('VFR') || title.includes('VISUAL')) {
        type = 'VFR';
      } else if (title.includes('APPROACH') || title.includes('APP')) {
        type = 'APPROACH';
      } else if (title.includes('DEPARTURE') || title.includes('DEP')) {
        type = 'DEPARTURE';
      } else if (title.includes('STAR')) {
        type = 'STAR';
      } else if (title.includes('SID')) {
        type = 'SID';
      } else if (title.includes('IAP') || title.includes('PROCEDURE')) {
        type = 'IAP';
      }

      return {
        type,
        title,
        description: chart.description || chart.designator || '',
        url: chart.url || chart.link || undefined,
        format: chart.format || undefined,
        scale: chart.scale || undefined,
        edition: chart.edition || undefined,
      } as ChartData;
    })
    .filter((chart): chart is ChartData => chart !== null)
    .sort((a, b) => {
      // Ordenar por tipo (IFR/VFR primeiro, depois outros)
      const typeOrder: Record<string, number> = {
        'IFR': 0,
        'VFR': 1,
        'APPROACH': 2,
        'DEPARTURE': 3,
        'STAR': 4,
        'SID': 5,
        'IAP': 6,
        'AIRPORT': 7,
      };
      return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
    });
}
