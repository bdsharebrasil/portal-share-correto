import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MonthYearPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function MonthYearPicker({ value, onChange, className }: MonthYearPickerProps) {
  const [open, setOpen] = useState(false);
  const [displayYear, setDisplayYear] = useState(() => {
    const [year] = value.split("-");
    return parseInt(year) || new Date().getFullYear();
  });

  const [year, month] = value.split("-");
  const selectedMonth = month ? parseInt(month) : new Date().getMonth() + 1;
  const displayDate = new Date(displayYear, selectedMonth - 1, 1);

  const months = [
    "jan", "fev", "mar", "abr",
    "mai", "jun", "jul", "ago",
    "set", "out", "nov", "dez"
  ];

  const handleMonthSelect = (monthIndex: number) => {
    const newValue = `${displayYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    onChange(newValue);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`bg-slate-800/50 border-slate-700/60 text-foreground w-full sm:w-auto sm:min-w-[160px] text-xs sm:text-sm h-9 focus:border-blue-400/40 flex items-center justify-between hover:bg-slate-700/50 transition-colors ${className}`}
        >
          <span>{format(displayDate, "MMMM 'de' yyyy", { locale: ptBR })}</span>
          <Calendar className="w-4 h-4 ml-2 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4 bg-slate-900/95 border-slate-700/50 backdrop-blur-xl shadow-xl">
        <div className="space-y-4">
          {/* Header with year navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDisplayYear(displayYear - 1)}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-slate-800/50"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold text-foreground">{displayYear}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDisplayYear(displayYear + 1)}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-slate-800/50"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-4 gap-2">
            {months.map((monthName, index) => {
              const isSelected = displayYear === parseInt(year) && index + 1 === selectedMonth;
              return (
                <Button
                  key={monthName}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleMonthSelect(index)}
                  className={`text-xs h-9 font-medium transition-colors ${
                    isSelected
                      ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-500"
                      : "bg-slate-800/30 border-slate-700/60 hover:bg-slate-700/60 text-foreground"
                  }`}
                >
                  {monthName}
                </Button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
