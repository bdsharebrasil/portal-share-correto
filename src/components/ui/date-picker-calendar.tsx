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
    <div className="w-full max-w-sm bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-700/50 rounded-2xl p-6 shadow-2xl">
      {/* Header with selected date */}
      {value && (
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700/50">
          <Calendar className="w-5 h-5 text-cyan-400" />
          <span className="text-sm font-semibold text-slate-100">
            {format(value, "dd/MM/yyyy", { locale: ptBR })}
          </span>
        </div>
      )}

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePreviousMonth}
          className="h-8 w-8 p-0 hover:bg-slate-800/50 text-slate-300 hover:text-slate-100 transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <div className="text-center">
          <h2 className="text-base font-bold text-slate-100 capitalize">
            {format(month, "MMMM yyyy", { locale: ptBR })}
          </h2>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleNextMonth}
          className="h-8 w-8 p-0 hover:bg-slate-800/50 text-slate-300 hover:text-slate-100 transition-all"
        >
          <ChevronRight className="w-5 h-5" />
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
            month: "w-full space-y-4",
            caption: "hidden",
            nav: "hidden",
            table: "w-full border-collapse space-y-2",
            head_row: "grid grid-cols-7 gap-2 mb-3",
            head_cell:
              "text-xs font-semibold text-slate-400 w-10 h-10 flex items-center justify-center",
            row: "grid grid-cols-7 gap-2",
            cell: cn(
              "h-10 w-10 text-center text-sm p-0 relative",
              "[&:has([aria-selected])]:bg-transparent"
            ),
            day: cn(
              "h-10 w-10 p-0 font-medium rounded-lg transition-all duration-200",
              "text-slate-300 hover:bg-slate-700/60 hover:text-slate-100"
            ),
            day_selected: "bg-cyan-500 text-white font-semibold hover:bg-cyan-600 shadow-lg shadow-cyan-500/30",
            day_today: "text-cyan-300 font-semibold",
            day_outside:
              "text-slate-600 opacity-40",
            day_disabled: "text-slate-600 opacity-30 cursor-not-allowed hover:bg-transparent",
            day_range_middle: "aria-selected:bg-transparent",
          }}
        />
      </div>
    </div>
  );
}
