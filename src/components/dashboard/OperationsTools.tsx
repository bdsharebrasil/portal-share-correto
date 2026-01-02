import { FileText, BookOpen, Users, Fuel, Clock, Wrench, CalendarCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

const tools = [
  { icon: CalendarCheck, label: "Agendamentos", route: "/painel-agendamentos", color: "from-emerald-500 to-emerald-600" },
  { icon: FileText, label: "Plano de Voo", route: "/plano-voo", color: "from-blue-500 to-blue-600" },
  { icon: BookOpen, label: "Diário de Bordo", route: "/diario-bordo", color: "from-cyan-500 to-cyan-600" },
  { icon: Users, label: "Tripulação", route: "/tripulacao", color: "from-purple-500 to-purple-600" },
  { icon: Fuel, label: "Abastecimento", route: "/abastecimento", color: "from-orange-500 to-orange-600" },
  { icon: Clock, label: "Vencimentos", route: "/vencimentos", color: "from-red-500 to-red-600" },
  { icon: Wrench, label: "CTM", route: "/manutencao/ctm", color: "from-teal-500 to-teal-600" },
];

export function OperationsTools() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {tools.map((tool) => (
        <button
          key={tool.label}
          onClick={() => navigate(tool.route)}
          className="flex flex-col items-center justify-center gap-2 p-4 bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 hover:border-primary/70 hover:bg-card/80 transition-all duration-300 group active:scale-95"
        >
          <div className={`p-2.5 rounded-lg bg-gradient-to-br ${tool.color} shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300`}>
            <tool.icon className="h-5 w-5 text-white" />
          </div>
          <span className="text-xs font-semibold text-foreground text-center leading-tight">{tool.label}</span>
        </button>
      ))}
    </div>
  );
}
