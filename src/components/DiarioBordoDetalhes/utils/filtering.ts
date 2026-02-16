// utils/filtering.ts
import { FlightEntry } from '../types';

export interface FlightFilters {
  searchTerm?: string;
  flightNature?: string;
  dateFrom?: string;
  dateTo?: string;
  picCanac?: string;
}

/**
 * Filtra entradas de voo baseado em múltiplos critérios
 */
export function filterFlightEntries(
  entries: FlightEntry[],
  filters: FlightFilters
): FlightEntry[] {
  let filtered = [...entries];

  // Filtro de busca (rota, PIC, cliente)
  if (filters.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    filtered = filtered.filter(
      (entry) =>
        entry.departure_aerodrome.toLowerCase().includes(term) ||
        entry.arrival_aerodrome.toLowerCase().includes(term) ||
        entry.pic_canac.toLowerCase().includes(term) ||
        entry.trecho.toLowerCase().includes(term)
    );
  }

  // Filtro de natureza do voo
  if (filters.flightNature) {
    filtered = filtered.filter(
      (entry) => entry.flight_nature === filters.flightNature
    );
  }

  // Filtro de data (de)
  if (filters.dateFrom) {
    filtered = filtered.filter(
      (entry) => entry.entry_date >= filters.dateFrom!
    );
  }

  // Filtro de data (até)
  if (filters.dateTo) {
    filtered = filtered.filter((entry) => entry.entry_date <= filters.dateTo!);
  }

  // Filtro de PIC
  if (filters.picCanac) {
    filtered = filtered.filter((entry) => entry.pic_canac === filters.picCanac);
  }

  return filtered;
}

/**
 * Agrupa entradas por data
 */
export function groupEntriesByDate(
  entries: FlightEntry[]
): Map<string, FlightEntry[]> {
  const grouped = new Map<string, FlightEntry[]>();

  entries.forEach((entry) => {
    const date = entry.entry_date;
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(entry);
  });

  return grouped;
}

/**
 * Ordena entradas por data e hora
 */
export function sortEntriesByDateTime(entries: FlightEntry[]): FlightEntry[] {
  return [...entries].sort((a, b) => {
    const dateCompare = a.entry_date.localeCompare(b.entry_date);
    if (dateCompare !== 0) return dateCompare;
    return a.ac_time.localeCompare(b.ac_time);
  });
}