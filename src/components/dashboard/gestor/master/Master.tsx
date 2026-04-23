import React from "react";
import { ChartSection } from "@/components/dashboard/gestor/master/ChartSection";
import { ActivityFeed } from "@/components/dashboard/gestor/master/ActivityFeed";
import { TopMenu } from "@/components/dashboard/gestor/master/TopMenu";
import { PipelineTable } from "@/components/dashboard/gestor/master/PipelineTable";
import { StatsGrid } from "@/components/dashboard/gestor/master/StatsGrid";
import { LayoutDashboard } from "lucide-react";
import { Layout } from "@/components/layout/Layout";


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
type Role = 'admin' |  'gestor_master';
    return (
      <Layout>
        <div className="space-y-6 pb-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 rounded-lg bg-primary/10">
                  <LayoutDashboard className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Master</h1>
              </div>
              <p className="text-muted-foreground capitalize">{currentDate}</p>
            </div>
          </div>
  
          {/* Top Menu */}
          <TopMenu />
  
          {/* KPI Cards */}
          <StatsGrid />
  
          {/* Charts */}
          <ChartSection />
  
          {/* Activity Feed */}
          <ActivityFeed />
  
          {/* Pipeline Table - Full width */}
          <PipelineTable />
        </div>
      </Layout>
    );
  }
export default DashboardHeader;