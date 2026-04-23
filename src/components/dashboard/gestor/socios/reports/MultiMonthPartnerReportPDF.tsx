"use client";

import React, { useMemo } from "react";
import { MonthlyPartnerReportPDF, type ReportFilter } from "./MonthlyPartnerReportPDF";
import type { MonthlyReportData } from "@/hooks/useMonthlyPartnerReport";

interface Props {
  dataByMonth: Map<string, MonthlyReportData>;
  months: string[];
  includeCharts: boolean;
  includeFlights: boolean;
  includeFuels: boolean;
  includeExpenses: boolean;
  selectedPartnerIds: string[];
  activeFilter?: ReportFilter;
}

export function MultiMonthPartnerReportPDF({
  dataByMonth,
  months,
  includeCharts,
  includeFlights,
  includeFuels,
  includeExpenses,
  selectedPartnerIds,
  activeFilter = "todos",
}: Props) {
  // Sort months chronologically
  const sortedMonths = useMemo(() => {
    return [...months].sort((a, b) => {
      const [yearA, monthA] = a.split("-");
      const [yearB, monthB] = b.split("-");
      const dateA = new Date(parseInt(yearA), parseInt(monthA) - 1);
      const dateB = new Date(parseInt(yearB), parseInt(monthB) - 1);
      return dateA.getTime() - dateB.getTime();
    });
  }, [months]);

  return (
    <div>
      {sortedMonths.map((month, index) => {
        const data = dataByMonth.get(month);
        if (!data) return null;

        return (
          <div key={month}>
            {/* Add page break before each month except the first */}
            {index > 0 && (
              <div style={{ pageBreakBefore: "always", height: "0px" }} />
            )}
            
            <MonthlyPartnerReportPDF
              data={data}
              month={month}
              includeCharts={includeCharts}
              includeFlights={includeFlights}
              includeFuels={includeFuels}
              includeExpenses={includeExpenses}
              selectedPartnerIds={selectedPartnerIds}
              activeFilter={activeFilter}
            />
          </div>
        );
      })}
    </div>
  );
}
