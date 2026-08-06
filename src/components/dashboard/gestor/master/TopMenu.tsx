import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Users, FileBarChart, Plane, FileSignature } from "lucide-react";

export function TopMenu() {
  const navigate = useNavigate();

  const menuItems = [
    { label: "Colaboradores", path: "/gestor/master/colaboradores", icon: Users },
    { label: "Relatórios", path: "/gestor/master/relatorios", icon: FileBarChart },
    { label: "Aeronaves & Depreciação", path: "/gestor/master/aeronaves", icon: Plane },
    { label: "Criar Proposta", path: "/gestor/master/proposta", icon: FileSignature },
  ];

  return (
    <div className="flex flex-wrap gap-2 sm:gap-3">
      {menuItems.map((item) => {
        const Icon = item.icon;
        return (
          <Button
            key={item.path}
            variant="ghost"
            size="sm"
            className="flex-1 min-w-[150px] sm:flex-none gap-2 rounded-xl border border-cyan-400/25 bg-cyan-500/5 text-foreground/90 shadow-[0_0_0_1px_rgba(34,211,238,0.06),0_0_18px_-8px_rgba(34,211,238,0.6)] hover:bg-cyan-500/15 hover:text-cyan-200 hover:border-cyan-400/60 hover:shadow-[0_0_22px_-6px_rgba(34,211,238,0.75)] transition-all duration-300"
            onClick={() => navigate(item.path)}
          >
            <Icon className="h-4 w-4 shrink-0 text-cyan-400" />
            <span className="truncate">{item.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
