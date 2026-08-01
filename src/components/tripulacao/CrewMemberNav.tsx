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
      <div className="hidden md:block rounded-2xl border border-slate-800/80 bg-slate-950/80 p-2 shadow-sm">
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
                    ? "border-slate-700/60 bg-slate-900/90 text-slate-100"
                    : "border-transparent bg-slate-950/80 text-slate-300 hover:bg-slate-900/90 hover:text-slate-100"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn("h-5 w-5", isActive ? "text-slate-200" : "text-slate-400")} />
                  <div>
                    <div className="text-sm font-semibold">{tab.label}</div>
                    <div className="text-xs text-slate-500 group-hover:text-slate-400">{tab.description}</div>
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
                  ? "border-slate-700/60 bg-slate-900/90 text-slate-100"
                  : "border-slate-800/70 bg-slate-950/70 text-slate-300 hover:border-slate-700/70 hover:bg-slate-900/80"
              )}
            >
              <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", isActive ? "text-cyan-300" : "text-slate-400")} />
              <div className="flex-1">
                <p className="font-semibold">{tab.label}</p>
                <p className="text-xs text-slate-500">{tab.description}</p>
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