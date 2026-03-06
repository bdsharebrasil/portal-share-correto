import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MonthSelectorProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  isCurrentMonth?: boolean;
}

export function MonthSelector({
  currentDate,
  onDateChange,
  isCurrentMonth,
}: MonthSelectorProps) {
  const [open, setOpen] = useState(false);

  const previousMonth = () => {
    onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDayClick = (date: Date) => {
    onDateChange(new Date(date.getFullYear(), date.getMonth(), 1));
    setOpen(false);
  };

  const monthYear = format(currentDate, "MMMM yyyy", { locale: ptBR }).charAt(0).toUpperCase() +
    format(currentDate, "MMMM yyyy", { locale: ptBR }).slice(1);

  return (
    <div className="flex items-center gap-4">
      <Button
        variant="outline"
        size="sm"
        onClick={previousMonth}
        className="rounded-lg border-border/50 hover:bg-accent/50"
        title="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="min-w-40 flex items-center gap-2 hover:bg-accent/50 rounded-lg"
          >
            <CalendarIcon className="h-4 w-4 text-primary" />
            <span className="text-lg font-semibold text-foreground">{monthYear}</span>
            {isCurrentMonth && (
              <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-1 rounded-md font-medium">
                Atual
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="single"
            selected={currentDate}
            onDayClick={handleDayClick}
            defaultMonth={currentDate}
            disabled={(date) => false}
            className="rounded-md border"
          />
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="sm"
        onClick={nextMonth}
        className="rounded-lg border-border/50 hover:bg-accent/50"
        title="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
