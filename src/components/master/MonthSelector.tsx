import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MonthSelectorProps {
  monthYear: string;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}

export function MonthSelector({
  monthYear,
  onPreviousMonth,
  onNextMonth,
}: MonthSelectorProps) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4">
      <Button
        variant="outline"
        size="sm"
        onClick={onPreviousMonth}
        className="border-border"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <h2 className="text-base sm:text-lg font-semibold text-center text-foreground capitalize min-w-32 sm:min-w-48">
        {monthYear}
      </h2>
      <Button
        variant="outline"
        size="sm"
        onClick={onNextMonth}
        className="border-border"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
