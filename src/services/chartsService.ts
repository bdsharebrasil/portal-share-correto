// @ts-nocheck
import { apiClient } from '@/lib/api-client';

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
    const data = await apiClient.getCharts(icaoUpper);
    return parseChartsData(data);
  } catch (error) {
    console.error(`[chartsService] Erro ao buscar cartas para ${icaoUpper}:`, error);
    return [];
  }
}

// Parse charts data from API response
function parseChartsData(rawData: any): ChartData[] {
  if (!rawData) return [];

  console.debug('[parseChartsData] Raw data:', rawData);

  // Handle both array and object responses
  let chartsArray: any[] = [];

  if (Array.isArray(rawData)) {
    chartsArray = rawData;
  } else if (rawData?.item && Array.isArray(rawData.item)) {
    // Formato DECEA: { item: [...] }
    chartsArray = rawData.item;
  } else if (rawData?.charts && Array.isArray(rawData.charts)) {
    chartsArray = rawData.charts;
  } else if (rawData?.data && Array.isArray(rawData.data)) {
    chartsArray = rawData.data;
  } else {
    console.warn('[parseChartsData] Unexpected response format:', rawData);
    return [];
  }

  console.debug('[parseChartsData] Found', chartsArray.length, 'charts');

  return chartsArray
    .map((chart: any) => {
      if (!chart) return null;

      // Mapear tipo da carta usando campos da API DECEA
      let type: ChartData['type'] = 'AIRPORT';
      const tipoAPI = (chart.tipo || '').toUpperCase();

      if (tipoAPI === 'SID') {
        type = 'SID';
      } else if (tipoAPI === 'STAR') {
        type = 'STAR';
      } else if (tipoAPI === 'IAC') {
        type = 'APPROACH'; // IAC = Carta de Aproximação por Instrumentos
      } else if (tipoAPI.includes('IFR') || tipoAPI.includes('INSTRUMENT')) {
        type = 'IFR';
      } else if (tipoAPI.includes('VFR') || tipoAPI.includes('VISUAL')) {
        type = 'VFR';
      } else if (tipoAPI.includes('DEP')) {
        type = 'DEPARTURE';
      }

      // Extrair título e descrição
      const title = chart.nome || chart.title || chart.nome || chart.designator || 'Sem título';
      const description = chart.tipo_descr || chart.descricao || tipoAPI || '';

      const parsedChart: ChartData = {
        type,
        title,
        description,
        url: chart.link || chart.url || undefined,
        format: chart.format || (chart.arquivo ? 'PDF' : undefined),
        scale: chart.scale || undefined,
        edition: chart.amdt || chart.edition || undefined,
      };

      console.debug('[parseChartsData] Parsed chart:', parsedChart);
      return parsedChart;
    })
    .filter((chart): chart is ChartData => chart !== null)
    .sort((a, b) => {
      // Ordenar por tipo (SID/STAR/APPROACH primeiro, depois outros)
      const typeOrder: Record<string, number> = {
        'SID': 0,
        'STAR': 1,
        'APPROACH': 2,
        'DEPARTURE': 3,
        'IFR': 4,
        'VFR': 5,
        'IAP': 6,
        'AIRPORT': 7,
      };
      return (typeOrder[a.tipo] || 99) - (typeOrder[b.tipo] || 99);
    });
}

