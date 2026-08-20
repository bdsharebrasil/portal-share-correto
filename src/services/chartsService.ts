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
    chartsArray = rawData.flatMap((entry: any) => Array.isArray(entry?.item) ? entry.item : entry);
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
      const tipoAPI = String(chart.tipo || chart.type || '').toUpperCase();

      if (tipoAPI === 'SID' || tipoAPI.includes('SAÍDA') || tipoAPI.includes('SAIDA')) {
        type = 'SID';
      } else if (tipoAPI === 'STAR' || tipoAPI.includes('CHEGADA')) {
        type = 'STAR';
      } else if (tipoAPI === 'IAC' || tipoAPI.includes('APROXIMAÇÃO') || tipoAPI.includes('APROXIMACAO')) {
        type = 'APPROACH';
      } else if (tipoAPI.includes('IFR') || tipoAPI.includes('INSTRUMENT')) {
        type = 'IFR';
      } else if (tipoAPI.includes('VFR') || tipoAPI.includes('VISUAL')) {
        type = 'VFR';
      } else if (tipoAPI.includes('DEP') || tipoAPI.includes('PARTIDA')) {
        type = 'DEPARTURE';
      }

      // Extrair título e descrição
      const title = chart.titulo || chart.nome || chart.title || chart.designator || 'Sem título';
      const description = chart.tipo_descr || chart.descricao || tipoAPI || '';

      const rawUrl = chart.url || chart.link || chart.download_url || chart.downloadUrl || chart.pdf_url || chart.pdf || undefined;
      const normalizedUrl = typeof rawUrl === 'string' ? rawUrl.replace(/&amp;/gi, '&').replace(/\\u0026/gi, '&').trim() : undefined;
      const parsedChart: ChartData = {
        type,
        title,
        description,
        url: normalizedUrl,
        format: chart.format || (chart.arquivo || normalizedUrl?.toLowerCase().includes('.pdf') ? 'PDF' : undefined),
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
      return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
    });
}
