import * as React from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DatePickerCalendarProps {
  value?: Date | null;
  onChange: (date: Date | undefined) => void;
  disabled?: (date: Date) => boolean;
}

export function DatePickerCalendar({
  value,
  onChange,
  disabled,
}: DatePickerCalendarProps) {
  const [month, setMonth] = React.useState<Date>(value || new Date());

  const handlePreviousMonth = () => {
    setMonth(new Date(month.getFullYear(), month.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setMonth(new Date(month.getFullYear(), month.getMonth() + 1));
  };

  return (
    <div className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-4">
      {/* Header with selected date */}
      {value && (
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-800">
          <Calendar className="w-5 h-5 text-slate-400" />
          <span className="text-sm font-medium text-slate-200">
            {format(value, "dd/MM/yyyy", { locale: ptBR })}
          </span>
        </div>
      )}

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePreviousMonth}
          className="h-7 w-7 p-0 hover:bg-slate-800"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <div className="text-center">
          <h2 className="text-sm font-semibold text-slate-200">
            {format(month, "MMMM yyyy", { locale: ptBR })}
          </h2>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleNextMonth}
          className="h-7 w-7 p-0 hover:bg-slate-800"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="w-full">
        <DayPicker
          mode="single"
          selected={value}
          onSelect={onChange}
          month={month}
          onMonthChange={setMonth}
          disabled={disabled}
          locale={ptBR}
          showOutsideDays={true}
          className="w-full"
          classNames={{
            months: "w-full",
            month: "w-full space-y-3",
            caption: "hidden",
            nav: "hidden",
            table: "w-full border-collapse",
            head_row: "flex gap-1 mb-2",
            head_cell:
              "text-xs font-medium text-slate-400 w-9 text-center uppercase",
            row: "flex gap-1",
            cell: cn(
              "h-9 w-9 text-center text-xs p-0 relative",
              "[&:has([aria-selected])]:bg-transparent"
            ),
            day: cn(
              "h-9 w-9 p-0 font-medium rounded-md transition-colors",
              "text-slate-300 hover:bg-slate-700 hover:text-slate-100"
            ),
            day_selected: "bg-cyan-500 text-white hover:bg-cyan-600",
            day_today: "text-slate-100",
            day_outside:
              "text-slate-600 opacity-50",
            day_disabled: "text-slate-600 opacity-30 cursor-not-allowed",
            day_range_middle: "aria-selected:bg-transparent",
          }}
        />
      </div>
    </div>
  );
}
