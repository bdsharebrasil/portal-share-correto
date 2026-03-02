import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

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
      className={cn("p-5 bg-slate-950 rounded-2xl", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-6 sm:space-x-6 sm:space-y-0",
        month: "space-y-5",
        caption: "flex justify-center pt-2 relative items-center mb-4",
        caption_label: "text-lg font-bold text-white",
        nav: "space-x-2 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-transparent p-0 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        ),
        nav_button_previous: "absolute left-2",
        nav_button_next: "absolute right-2",
        table: "w-full border-collapse space-y-2",
        head_row: "flex",
        head_cell:
          "text-slate-400 rounded-md w-10 font-semibold text-[0.75rem] uppercase tracking-wider py-2",
        row: "flex w-full mt-3 gap-1",
        cell: "h-10 w-10 text-center text-sm p-0 relative rounded-lg transition-all",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 p-0 font-semibold text-slate-300 hover:text-white rounded-lg transition-all hover:bg-slate-800"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-cyan-500 text-white hover:bg-cyan-600 focus:bg-cyan-600 font-bold shadow-lg shadow-cyan-500/50",
        day_today: "bg-slate-800 text-cyan-400 font-bold border border-cyan-500/50",
        day_outside:
          "day-outside text-slate-600 opacity-40",
        day_disabled: "text-slate-600 opacity-30 cursor-not-allowed",
        day_range_middle:
          "aria-selected:bg-slate-800 aria-selected:text-cyan-400",
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
