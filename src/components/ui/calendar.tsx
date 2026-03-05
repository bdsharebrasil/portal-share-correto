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
      className={cn("p-6 bg-[#0f172a] rounded-3xl border border-slate-800 shadow-2xl", className)}
      classNames={{
        months: "flex flex-col space-y-4",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center mb-4",
        caption_label: "text-md font-medium text-slate-100 capitalize",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          "h-9 w-9 bg-slate-800/50 flex items-center justify-center p-0 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-all border border-slate-700/50"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex justify-between mb-2",
        head_cell: "text-slate-500 w-10 font-medium text-[0.85rem] lowercase",
        row: "flex w-full mt-1 justify-between",
        cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day: cn(
          "h-10 w-10 p-0 font-normal text-slate-400 aria-selected:opacity-100 hover:bg-slate-800 hover:text-white rounded-[14px] transition-all"
        ),
        day_selected:
          "bg-[#22d3ee] text-[#0f172a] hover:bg-[#22d3ee] hover:text-[#0f172a] focus:bg-[#22d3ee] focus:text-[#0f172a] font-bold !rounded-[14px]",
        day_today: "bg-slate-800/50 text-cyan-400 border border-slate-700",
        day_outside: "text-slate-600 opacity-30",
        day_disabled: "text-slate-600 opacity-20",
        day_range_middle: "aria-selected:bg-slate-800 aria-selected:text-slate-100",
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