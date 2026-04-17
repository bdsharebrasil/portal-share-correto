import { useMemo } from 'react';

interface PerDiemInfo {
  count: number;
  total: number;
  details: Array<{ date: string; location: string; entryId: string }>;
  byEntry: Record<string, number>;
}

export const usePerDiem = (
  entries: any[],
  selectedMonth: number,
  selectedYear: number,
  logbookMonth: any
): PerDiemInfo => {
  return useMemo(() => {
    if (!logbookMonth?.tem_tarifa_diaria || !logbookMonth?.aerodromo_base || !logbookMonth?.tarifa_diaria) {
      return { count: 0, total: 0, details: [], byEntry: {} };
    }

    const baseAerodrome = logbookMonth.aerodromo_base;
    const dailyRate = logbookMonth.tarifa_diaria;

    const periodEntries = entries
      .filter((e: any) => {
        if (!e.data_registro) return false;
        const date = new Date(e.data_registro);
        if (isNaN(date.getTime())) return false;
        return date.getUTCMonth() + 1 === selectedMonth && date.getUTCFullYear() === selectedYear;
      })
      .sort((a: any, b: any) => {
        const dateA = new Date(a.data_registro);
        const dateB = new Date(b.data_registro);
        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
        return dateA.getTime() - dateB.getTime();
      });

    const perDiems: Array<{ date: string; location: string; entryId: string }> = [];
    const byEntry: Record<string, number> = {};

    let isAwayFromBase = false;
    let lastAwayDate: Date | null = null;

    for (const flight of periodEntries) {
      const flightDate = new Date(flight.data_registro);
      const origin = flight.aerodromo_partida;
      const destination = flight.aerodromo_chegada;

      if (flight.divisao_igual) {
        byEntry[flight.id] = 0;
        continue;
      }

      if (!isAwayFromBase && origin === baseAerodrome && destination !== baseAerodrome) {
        isAwayFromBase = true;
        lastAwayDate = new Date(flightDate);
        byEntry[flight.id] = 0;
      } else if (isAwayFromBase && destination === baseAerodrome) {
        if (lastAwayDate) {
          let currentDate = new Date(lastAwayDate);
          currentDate.setDate(currentDate.getDate() + 1);
          while (currentDate <= flightDate) {
            perDiems.push({
              date: currentDate.toLocaleDateString('pt-BR'),
              location: `Fora da Base (${baseAerodrome})`,
              entryId: flight.id
            });
            if (currentDate.toDateString() === flightDate.toDateString()) {
              byEntry[flight.id] = (byEntry[flight.id] || 0) + 1;
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }
        isAwayFromBase = false;
        lastAwayDate = null;
      } else if (isAwayFromBase && origin !== baseAerodrome && destination !== baseAerodrome) {
        if (lastAwayDate) {
          const lastDate = new Date(lastAwayDate);
          if (flightDate.toDateString() !== lastDate.toDateString()) {
            perDiems.push({
              date: flightDate.toLocaleDateString('pt-BR'),
              location: `Fora da Base (${baseAerodrome})`,
              entryId: flight.id
            });
            byEntry[flight.id] = (byEntry[flight.id] || 0) + 1;
            lastAwayDate = flightDate;
          } else {
            byEntry[flight.id] = byEntry[flight.id] || 0;
          }
        }
      } else {
        byEntry[flight.id] = 0;
      }
    }

    return {
      count: perDiems.length,
      total: perDiems.length * dailyRate,
      details: perDiems,
      byEntry
    };
  }, [entries, selectedMonth, selectedYear, logbookMonth]);
};
