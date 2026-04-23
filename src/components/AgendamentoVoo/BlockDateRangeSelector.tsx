import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BlockDateRangeSelectorProps {
  selectedDates: Date[];
  onDatesChange: (dates: Date[]) => void;
}

export function BlockDateRangeSelector({
  selectedDates,
  onDatesChange
}: BlockDateRangeSelectorProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [firstClickDate, setFirstClickDate] = useState<Date | null>(null);
  const [tempSelected, setTempSelected] = useState<Date[]>(selectedDates);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getDateRangeBetween = (start: Date, end: Date): Date[] => {
    const dates: Date[] = [];
    const current = new Date(start);
    const endDate = new Date(end);

    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  };

  const isDateSelected = (date: Date) => {
    return tempSelected.some(d => isSameDay(d, date));
  };

  const isFirstClickDate = (date: Date) => {
    return firstClickDate && isSameDay(firstClickDate, date);
  };

  const handleDayClick = (date: Date) => {
    if (!firstClickDate) {
      // Primeiro clique: marca a data inicial
      setFirstClickDate(date);
      setTempSelected([date]);
    } else {
      // Segundo clique: seleciona o intervalo
      const [start, end] = isBefore(firstClickDate, date) 
        ? [firstClickDate, date] 
        : [date, firstClickDate];
      
      const dateRange = getDateRangeBetween(start, end);
      setTempSelected(dateRange);
      setFirstClickDate(null); // Reset para nova seleção
    }
  };

  const handleClearDates = () => {
    setTempSelected([]);
    setFirstClickDate(null);
  };

  const handleRemoveDate = (date: Date) => {
    setTempSelected(prev => prev.filter(d => !isSameDay(d, date)));
  };

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
        {firstClickDate ? (
          <span>Clique na data final para completar a seleção</span>
        ) : (
          <span>Clique em uma data inicial, depois em uma data final</span>
        )}
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium text-sm">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Mini Calendar with Click Select */}
      <div className="border rounded-lg p-4 bg-muted/30">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Empty cells for days before month starts */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: monthStart.getDay() }).map((_, i) => (
            <div key={`empty-${i}`} className="p-2" />
          ))}

          {/* Calendar days */}
          {calendarDays.map((day) => {
            const isSelected = isDateSelected(day);
            const isFirst = isFirstClickDate(day);
            const isToday = isSameDay(day, new Date());

            return (
              <button
                key={day.toISOString()}
                onClick={() => handleDayClick(day)}
                className={cn(
                  'p-2 text-sm rounded transition-colors cursor-pointer select-none font-medium',
                  isFirst && 'bg-blue-500 text-white ring-2 ring-blue-400 ring-offset-1',
                  isSelected && !isFirst && 'bg-primary text-primary-foreground',
                  isToday && !isSelected && !isFirst && 'border border-primary',
                  !isSelected && !isFirst && 'hover:bg-muted text-foreground'
                )}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Dates Display - Only show when dates are selected */}
      {tempSelected.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {tempSelected.length} data(s) selecionada(s)
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearDates}
              className="text-xs text-destructive hover:text-destructive"
            >
              <X className="h-3 w-3 mr-1" />
              Limpar
            </Button>
          </div>

          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg max-h-32 overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              {tempSelected
                .sort((a, b) => a.getTime() - b.getTime())
                .map((date) => (
                  <Badge
                    key={date.toISOString()}
                    variant="secondary"
                    className="cursor-pointer hover:opacity-80"
                    onClick={() => handleRemoveDate(date)}
                  >
                    {format(date, 'dd/MM')}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
            </div>
          </div>

          {/* Apply changes when dates change */}
          <Button
            onClick={() => onDatesChange(tempSelected)}
            className="w-full"
            size="sm"
          >
            Aplicar Seleção ({tempSelected.length} data(s))
          </Button>
        </div>
      )}
    </div>
  );
}
