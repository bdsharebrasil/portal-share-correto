import { useMemo } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DataBloqueada, Solicitacao } from "@/hooks/useAgendamentoVoo";

interface Props {
  mes: Date;
  onMesChange: (d: Date) => void;
  diaSelecionado: Date;
  onDiaSelecionado: (d: Date) => void;
  solicitacoes: Solicitacao[];
  bloqueios: DataBloqueada[];
}

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function CalendarioEscala({
  mes,
  onMesChange,
  diaSelecionado,
  onDiaSelecionado,
  solicitacoes,
  bloqueios,
}: Props) {
  const inicio = startOfMonth(mes);
  const fim = endOfMonth(mes);
  const dias = eachDayOfInterval({ start: inicio, end: fim });
  const offset = inicio.getDay();

  const porDia = useMemo(() => {
    const map = new Map<string, Solicitacao[]>();
    solicitacoes.forEach((s) => {
      const arr = map.get(s.data_agendada) ?? [];
      arr.push(s);
      map.set(s.data_agendada, arr);
    });
    return map;
  }, [solicitacoes]);

  const hojeKey = format(new Date(), "yyyy-MM-dd");
  const amanhaKey = format(new Date(Date.now() + 86400000), "yyyy-MM-dd");
  const voosHoje = porDia.get(hojeKey) ?? [];
  const voosAmanha = porDia.get(amanhaKey) ?? [];

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Calendário de Escala</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMesChange(subMonths(mes, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-24 text-center text-xs font-medium capitalize text-muted-foreground">
            {format(mes, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMesChange(addMonths(mes, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="py-1">
            {d}
          </span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {dias.map((dia) => {
          const key = format(dia, "yyyy-MM-dd");
          const voos = porDia.get(key) ?? [];
          const bloqueado = bloqueios.some((b) => b.data_bloqueio === key);
          const selecionado = isSameDay(dia, diaSelecionado);
          const hoje = isSameDay(dia, new Date());
          return (
            <button
              key={key}
              type="button"
              onClick={() => onDiaSelecionado(dia)}
              className={cn(
                "relative flex h-8 items-center justify-center rounded-md text-xs transition-colors hover:bg-muted",
                isSameMonth(dia, mes) ? "text-foreground" : "text-muted-foreground/50",
                hoje && "font-semibold text-primary",
                selecionado && "bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              {format(dia, "d")}
              {(voos.length > 0 || bloqueado) && (
                <span
                  className={cn(
                    "absolute bottom-1 h-1 w-1 rounded-full",
                    bloqueado ? "bg-destructive" : "bg-emerald-500",
                    selecionado && "bg-primary-foreground",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-2">
        <div className="rounded-lg border-l-2 border-primary bg-background/50 px-3 py-2">
          <p className="text-xs font-semibold text-foreground">Hoje: {voosHoje.length} voo(s)</p>
          <p className="text-[11px] text-muted-foreground">
            {voosHoje.filter((v) => v.status === "confirmado" || v.status === "em_voo").length} confirmado(s) ·{" "}
            {voosHoje.filter((v) => v.status === "pendente").length} pendente(s)
          </p>
        </div>
        <div className="rounded-lg border-l-2 border-emerald-500 bg-background/50 px-3 py-2">
          <p className="text-xs font-semibold text-foreground">Amanhã: {voosAmanha.length} voo(s)</p>
          <p className="text-[11px] text-muted-foreground">
            {voosAmanha.filter((v) => v.status === "pendente").length === 0
              ? "Todos os voos confirmados"
              : `${voosAmanha.filter((v) => v.status === "pendente").length} aguardando aprovação`}
          </p>
        </div>
      </div>
    </section>
  );
}
