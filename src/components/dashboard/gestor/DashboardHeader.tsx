import React from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface DashboardHeaderProps {
  onExport?: () => void;
}

export function DashboardHeader({ onExport }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Dashboard do Gestor
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Visão consolidada das operações financeiras
        </p>
      </div>
      <Button
        variant="outline"
        className="border-border w-full sm:w-auto"
        size="sm"
        onClick={onExport}
      >
        <Download className="w-4 h-4 mr-2" />
        Exportar
      </Button>
    </div>
  );
}
