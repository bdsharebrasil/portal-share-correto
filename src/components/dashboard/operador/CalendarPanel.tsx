import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { ptBR } from "date-fns/locale";

export function CalendarPanel() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border p-4">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date || new Date())}
      </h3>
      <Calendar
        mode="single"
        selected={date}
        onSelect={setDate}
        locale={ptBR}
        className="rounded-md border-0 p-0"
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-4 w-full",
          caption: "hidden",
          caption_label: "text-sm font-medium",
          nav: "hidden",
          table: "w-full border-collapse",
          head_row: "flex justify-between",
          head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem] text-center",
          row: "flex w-full mt-2 justify-between",
          cell: "relative p-0 text-center text-sm focus-within:relative",
          day: "h-8 w-8 p-0 font-normal text-foreground hover:bg-accent rounded-md transition-colors",
          day_selected: "bg-primary text-primary-foreground hover:bg-primary",
          day_today: "bg-accent text-accent-foreground font-bold",
          day_outside: "text-muted-foreground opacity-50",
          day_disabled: "text-muted-foreground opacity-50",
        }}
      />
    </div>
  );
}
