import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  FileText, 
  Users, 
  DollarSign, 
  BarChart3,
  ChevronRight,
  Zap
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface QuickAction {
  title: string;
  description: string;
  icon: React.ElementType;
  variant: "primary" | "success" | "warning" | "destructive";
  path: string;
}

const actions: QuickAction[] = [
  {
    title: "Nova Transação",
    description: "Registrar receita ou despesa",
    icon: DollarSign,
    variant: "primary",
    path: "/financeiro",
  },
  {
    title: "Novo Cliente",
    description: "Cadastrar cliente",
    icon: Users,
    variant: "success",
    path: "/clientes",
  },
  {
    title: "Nota Fiscal",
    description: "Emitir nova NF",
    icon: FileText,
    variant: "warning",
    path: "/notas-fiscais",
  },
  {
    title: "Relatórios",
    description: "Ver análises",
    icon: BarChart3,
    variant: "primary",
    path: "/relatorios",
  },
];

const variantStyles = {
  primary: "bg-primary/10 text-primary group-hover:bg-primary/20",
  success: "bg-success/10 text-success group-hover:bg-success/20",
  warning: "bg-warning/10 text-warning group-hover:bg-warning/20",
  destructive: "bg-destructive/10 text-destructive group-hover:bg-destructive/20",
};

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">
              Ações Rápidas
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Acesso direto às funções principais
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            key={action.title}
            onClick={() => navigate(action.path)}
            className="group flex items-center gap-3 p-4 rounded-xl bg-secondary/50 hover:bg-secondary border border-transparent hover:border-border transition-all text-left"
          >
            <div className={cn(
              "p-2.5 rounded-lg transition-colors",
              variantStyles[action.variant]
            )}>
              <action.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{action.title}</p>
              <p className="text-xs text-muted-foreground truncate">{action.description}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
