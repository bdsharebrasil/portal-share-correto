import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function TopMenu() {
  const navigate = useNavigate();

  const menuItems = [
    {
      label: "Financeiro",
      path: "/financeiro/master",
    },
    {
      label: "Colaboradores",
      path: "/financeiro/master/colaboradores",
    },
    {
      label: "Relatórios",
      path: "/relatorios",
    },
  ];

  return (
    <div className="flex gap-3 mb-6">
      {menuItems.map((item) => (
        <Button
          key={item.path}
          variant="outline"
          className="px-6 py-2 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
          onClick={() => navigate(item.path)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}