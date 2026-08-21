import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={ptBR}
      className={cn("bg-[#1a2332] rounded-lg border-0 shadow-none", className)}
      classNames={{
        months: "flex flex-col space-y-3",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center mb-4",
        caption_label: "text-base font-semibold text-foreground capitalize",
        nav: "space-x-2 flex items-center justify-center",
        nav_button: cn(
          "h-8 w-8 bg-secondary/40 flex items-center justify-center p-0 text-muted-foreground hover:text-white hover:bg-muted rounded-md transition-all"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-2",
        head_row: "flex justify-between mb-3 gap-1 px-1",
        head_cell: "text-muted-foreground w-12 h-8 font-medium text-[0.7rem] uppercase flex items-center justify-center",
        row: "flex w-full gap-1 justify-between px-1",
        cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day: cn(
          "h-12 w-12 p-0 font-normal text-muted-foreground aria-selected:opacity-100 hover:bg-muted/50 hover:text-white rounded-md transition-all text-base"
        ),
        day_selected:
          "bg-blue-500 text-white hover:bg-blue-500 hover:text-white focus:bg-blue-500 focus:text-white font-semibold rounded-md",
        day_today: "bg-secondary/50 text-cyan-400 border border-border",
        day_outside: "text-muted-foreground opacity-30",
        day_disabled: "text-muted-foreground opacity-25",
        day_range_middle: "aria-selected:bg-secondary aria-selected:text-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-5 w-5" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-5 w-5" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };