// @ts-nocheck
import { FileText, Award, Calendar, Clock, Paperclip, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type TabValue = "dados" | "habilitacoes" | "escala" | "horas-voo" | "anexos" | "aprovacoes-pendentes";

interface CrewMemberNavProps {
  activeTab: TabValue;
  onTabChange: (tab: TabValue) => void;
}

const tabs = [
  {
    id: "dados" as const,
    label: "Dados Principais",
    icon: FileText,
    description: "Informações pessoais",
  },
  {
    id: "habilitacoes" as const,
    label: "Habilitações",
    icon: Award,
    description: "Licenças e certificados",
  },
  {
    id: "escala" as const,
    label: "Escala",
    icon: Calendar,
    description: "Voos programados",
  },
  {
    id: "horas-voo" as const,
    label: "Horas de Voo",
    icon: Clock,
    description: "Registro de voos",
  },
  {
    id: "aprovacoes-pendentes" as const,
    label: "Aprovações",
    icon: CheckCircle2,
    description: "Relatórios para aprovação",
  },
  {
    id: "anexos" as const,
    label: "Anexos",
    icon: Paperclip,
    description: "Documentos",
  },
];

export function CrewMemberNav({ activeTab, onTabChange }: CrewMemberNavProps) {
  return (
    <div className="space-y-4">
      {/* Desktop: Horizontal navigation */}
      <div className="hidden md:block rounded-2xl border border-border/80 bg-background/80 p-2 shadow-sm">
        <div className="flex gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "group flex-1 rounded-3xl border px-4 py-4 text-left transition-all duration-200 ease-in-out",
                  isActive
                    ? "border-border/60 bg-card/90 text-foreground"
                    : "border-transparent bg-background/80 text-muted-foreground hover:bg-card/90 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn("h-5 w-5", isActive ? "text-foreground" : "text-muted-foreground")} />
                  <div>
                    <div className="text-sm font-semibold">{tab.label}</div>
                    <div className="text-xs text-muted-foreground group-hover:text-muted-foreground">{tab.description}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile: Vertical navigation */}
      <div className="md:hidden space-y-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "w-full flex items-start gap-3 px-4 py-4 rounded-3xl border transition-all duration-200 text-left",
                isActive
                  ? "border-border/60 bg-card/90 text-foreground"
                  : "border-border/70 bg-background/70 text-muted-foreground hover:border-border/70 hover:bg-card/80"
              )}
            >
              <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", isActive ? "text-cyan-300" : "text-muted-foreground")} />
              <div className="flex-1">
                <p className="font-semibold">{tab.label}</p>
                <p className="text-xs text-muted-foreground">{tab.description}</p>
              </div>
              {isActive && (
                <div className="h-2 w-2 rounded-full bg-slate-500 mt-2 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}