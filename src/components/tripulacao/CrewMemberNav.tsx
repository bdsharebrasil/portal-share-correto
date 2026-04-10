// @ts-nocheck
import { FileText, Award, Calendar, Clock, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

type TabValue = "dados" | "habilitacoes" | "escala" | "horas-voo" | "anexos";

interface CrewMemberNavProps {
  activeTab: TabValue;
  onTabChange: (tab: TabValue) => void;
}

const tabs = [
  {
    id: "dados" as const,
    label: "Dados Principais",
    icon: FileText,
    description: "Informações pessoais"
  },
  {
    id: "habilitacoes" as const,
    label: "Habilitações",
    icon: Award,
    description: "Licenças e certificados"
  },
  {
    id: "escala" as const,
    label: "Escala",
    icon: Calendar,
    description: "Voos programados"
  },
  {
    id: "horas-voo" as const,
    label: "Horas de Voo",
    icon: Clock,
    description: "Registro de voos"
  },
  {
    id: "anexos" as const,
    label: "Anexos",
    icon: Paperclip,
    description: "Documentos"
  }
];

export function CrewMemberNav({ activeTab, onTabChange }: CrewMemberNavProps) {
  return (
    <div className="space-y-4">
      {/* Desktop: Horizontal navigation */}
      <div className="hidden md:block border-b border-slate-700/50">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-all",
                  isActive
                    ? "border-cyan-500 text-cyan-400"
                    : "border-transparent text-slate-400 hover:text-slate-300"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
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
                "w-full flex items-start gap-3 px-4 py-3 rounded-lg transition-all text-left",
                isActive
                  ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-300"
                  : "bg-slate-900/30 border border-slate-700/50 text-slate-400 hover:bg-slate-900/50"
              )}
            >
              <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", isActive && "text-cyan-400")} />
              <div className="flex-1">
                <p className="font-semibold">{tab.label}</p>
                <p className="text-xs opacity-75">{tab.descricao}</p>
              </div>
              {isActive && (
                <div className="h-2 w-2 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
