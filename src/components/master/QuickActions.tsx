import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Download, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    {
      icon: Plus,
      label: "Nova Transação",
      action: () => navigate("/financeiro/compras"),
      variant: "default",
    },
    {
      icon: FileText,
      label: "Gerar Relatório",
      action: () => {},
      variant: "outline",
    },
    {
      icon: Download,
      label: "Exportar Dados",
      action: () => {},
      variant: "outline",
    },
    {
      icon: Eye,
      label: "Ver Análise",
      action: () => {},
      variant: "outline",
    },
  ];

  return (
    <Card className="border-border bg-card h-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-foreground">
          Ações Rápidas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Button
              key={index}
              variant={action.variant as any}
              className="w-full justify-start gap-3 h-auto py-2"
              onClick={action.action}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm">{action.label}</span>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
