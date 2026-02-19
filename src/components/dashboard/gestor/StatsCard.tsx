import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  borderColor: string;
  bgColor: string;
  iconBgColor: string;
}

export function StatsCard({
  label,
  value,
  subValue,
  icon,
  borderColor,
  bgColor,
  iconBgColor,
}: StatsCardProps) {
  return (
    <Card className={`${bgColor} ${borderColor} overflow-hidden`}>
      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex items-start justify-between gap-3 flex-1">
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-medium uppercase tracking-wide`}>
              {label}
            </p>
            <p className={`text-lg sm:text-xl font-bold mt-2 truncate`}>
              {value}
            </p>
            {subValue && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                {subValue}
              </p>
            )}
          </div>
          <div className={`p-2 rounded-lg flex-shrink-0 ${iconBgColor}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
