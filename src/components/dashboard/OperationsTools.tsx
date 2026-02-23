import { CalendarCheck, FileText, Book, Users, Fuel, Clock, Wrench } from "lucide-react";
import { useNavigate } from "react-router-dom";

const tools = [
  { icon: CalendarCheck, label: "Agendamentos", route: "/painel-agendamentos", color: "text-teal-400" },
  { icon: FileText, label: "Plano de Voo", route: "/plano-voo", color: "text-blue-400" },
  { icon: Book, label: "Diário de Bordo", route: "/diario-bordo", color: "text-cyan-400" },
  { icon: Users, label: "Tripulação", route: "/tripulacao", color: "text-purple-400" },
  { icon: Fuel, label: "Abastecimento", route: "/abastecimento", color: "text-orange-400" },
  { icon: Clock, label: "Vencimentos", route: "/vencimentos", color: "text-red-400" },
  { icon: Wrench, label: "CTM", route: "/manutencao/ctm", color: "text-green-400" },
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
          <tool.icon className={`h-6 w-6 ${tool.color} group-hover:scale-110 transition-all duration-300`} strokeWidth={1.5} />
          <span className="text-xs font-semibold text-foreground text-center leading-tight">{tool.label}</span>
        </button>
      ))}
    </div>
  );
}
