import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Users, FileBarChart, Plane } from "lucide-react";

export function TopMenu() {
  const navigate = useNavigate();

  const menuItems = [
    { label: "Colaboradores", path: "/gestor/master/colaboradores", icon: Users },
    { label: "Relatórios", path: "/gestor/master/relatorios", icon: FileBarChart },
    { label: "Aeronaves & Depreciação", path: "/gestor/master/aeronaves", icon: Plane },
  ];

  return (
    <div className="flex flex-wrap gap-2 sm:gap-3">
      {menuItems.map((item) => {
        const Icon = item.icon;
        return (
          <Button
            key={item.path}
            variant="outline"
            size="sm"
            className="flex-1 min-w-[140px] sm:flex-none gap-2 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
            onClick={() => navigate(item.path)}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Button>
        );
      })}
    </div>
  );
}