import { CalendarCheck, FileText, Book, Users, Fuel, Clock, Wrench } from "lucide-react";
import { useNavigate } from "react-router-dom";

const tools = [
  { icon: CalendarCheck, label: "Agendamentos", route: "/painel-agendamentos", color: "text-teal-400" },
  { icon: FileText, label: "Plano de Voo", route: "/plano-voo", color: "text-MedSpringGreen-400" },
  { icon: Book, label: "Diário de Bordo", route: "/diario-bordo", color: "text-green-600" },
  { icon: Users, label: "Tripulação", route: "/tripulacao", color: "text-purple-400" },
  { icon: Fuel, label: "Abastecimento", route: "/abastecimento", color: "text-orange-400" },
  { icon: Wrench, label: "CTM", route: "/ctm", color: "text-red-400" },
];

export function OperationsTools() {
  const navigate = useNavigate();

  return (
    <div className="flex justify-center">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 w-full max-w-5xl">
        {tools.map((tool) => (
          <button
            key={tool.label}
            onClick={() => navigate(tool.route)}
            className="group flex flex-col items-center justify-center gap-3 p-5 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 hover:border-primary/70 hover:bg-card/90 transition-all duration-300 hover:scale-[1.03] active:scale-95"
          >
            <div className="h-14 w-14 rounded-2xl bg-background/50 flex items-center justify-center border border-border/40 group-hover:border-primary/40 transition-all duration-300">
              <tool.icon
                className={`h-7 w-7 ${tool.color} group-hover:scale-110 transition-all duration-300`}
                strokeWidth={1.7}
              />
            </div>
            <span className="text-sm font-semibold text-foreground text-center leading-tight">
              {tool.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
