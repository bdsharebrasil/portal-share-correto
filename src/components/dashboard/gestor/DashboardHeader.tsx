import React from "react";
import { ChartSection } from "./ChartSection";
import { ActivityFeed } from "./ActivityFeed";
import { QuickActions } from "./QuickActions";
import { MonthlyPerformance } from "./MonthlyPerformance";
import { PipelineTable } from "./PipelineTable";
import { StatsGrid } from "./StatsGrid";
import { LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  onExport?: () => void;
}

export function DashboardHeader({ onExport }: DashboardHeaderProps) {
  const currentDate = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-primary/10">
              <LayoutDashboard className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          </div>
          <p className="text-muted-foreground capitalize">{currentDate}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <StatsGrid />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts - 2 columns */}
        <div className="lg:col-span-2">
          <ChartSection />
        </div>

        {/* Monthly Performance - 1 column */}
        <div className="lg:col-span-1">
          <MonthlyPerformance />
        </div>
      </div>

      {/* Secondary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed - 2 columns */}
        <div className="lg:col-span-2">
          <ActivityFeed />
        </div>

        {/* Quick Actions - 1 column */}
        <div className="lg:col-span-1">
          <QuickActions />
        </div>
      </div>

      {/* Pipeline Table - Full width */}
      <PipelineTable />
    </div>
  );
}
