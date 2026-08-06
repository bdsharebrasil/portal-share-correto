import React from "react";
import { TopMenu } from "@/components/dashboard/gestor/master/TopMenu";
import { PipelineTable } from "@/components/dashboard/gestor/master/PipelineTable";
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

  return (
    <Layout>
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 space-y-4 sm:space-y-6 pb-8 overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Master</h1>
            </div>
            <p className="text-sm text-muted-foreground capitalize truncate">{currentDate}</p>
          </div>
        </div>

        {/* Top Menu */}
        <TopMenu />

        {/* Pipeline Table */}
        <div className="w-full min-w-0 overflow-hidden">
          <PipelineTable />
        </div>
      </div>
    </Layout>
  );
}
export default DashboardHeader;
