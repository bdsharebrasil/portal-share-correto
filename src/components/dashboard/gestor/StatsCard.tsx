import React from "react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode;
  borderColor?: string;
  bgColor?: string;
  iconBgColor?: string;
}

export function StatsCard({
  label,
  value,
  subValue,
  icon,
  borderColor = "border-primary/30",
  bgColor = "bg-card/80",
  iconBgColor = "bg-primary/20",
}: StatsCardProps) {
  return (
    <Card className={`border ${borderColor} ${bgColor} shadow-none hover:shadow-md transition-shadow`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {label}
            </p>
            <p className="text-2xl font-bold text-foreground mb-1">
              {value}
            </p>
            {subValue && (
              <p className="text-xs text-muted-foreground">{subValue}</p>
            )}
          </div>
          {icon && (
            <div className={`p-3 rounded-lg ${iconBgColor}`}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
