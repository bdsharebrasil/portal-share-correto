import { useMemo, useState } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Aeronave,
  DisponibilidadeTripulante,
  EscalaItem,
  useAgendamentoMutations,
} from "@/hooks/useAgendamentoVoo";

const SITUACAO_META: Record<DisponibilidadeTripulante["situacao"], { label: string; className: string }> = {
  disponivel: { label: "Disponível", className: "bg-emerald-500/15 text-emerald-500" },
  em_voo: { label: "Em voo", className: "bg-amber-500/15 text-amber-500" },
  ferias: { label: "Férias", className: "bg-sky-500/15 text-sky-500" },
  cma_vencido: { label: "CMA vencido", className: "bg-destructive/15 text-destructive" },
  inativo: { label: "Inativo", className: "bg-muted text-muted-foreground" },
};

interface Props {
  disponibilidade: DisponibilidadeTripulante[];
  escala: EscalaItem[];
  aeronaves: Aeronave[];
  diaSelecionado: Date;
}

export function EscalaTripulacao({ disponibilidade, escala, aeronaves, diaSelecionado }: Props) {
  const { criarEscala, removerEscala } = useAgendamentoMutations();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({
    membro_id: "",
    aeronave_id: "",
    funcao: "pic",
    data_inicio: format(diaSelecionado, "yyyy-MM-dd"),
    data_fim: format(diaSelecionado, "yyyy-MM-dd"),
  });

  const dias = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(diaSelecionado, i)),
    [diaSelecionado],
  );

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Escala de Tripulação</h2>
          <p className="text-xs text-muted-foreground">
            Semana de {format(dias[0], "dd/MM", { locale: ptBR })} a {format(dias[6], "dd/MM", { locale: ptBR })}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setForm((f) => ({
              ...f,
              data_inicio: format(diaSelecionado, "yyyy-MM-dd"),
              data_fim: format(diaSelecionado, "yyyy-MM-dd"),
            }));
            setAberto(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Escalar
        </Button>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr className="text-[11px] uppercase text-muted-foreground">
              <th className="w-56 px-2 text-left font-medium">Tripulante</th>
              {dias.map((d) => (
                <th key={d.toISOString()} className="px-1 text-center font-medium">
                  {format(d, "EEEEEE dd", { locale: ptBR })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {disponibilidade.map(({ tripulante, situacao, detalhe }) => {
              const meta = SITUACAO_META[situacao];
              return (
                <tr key={tripulante.id} className="bg-background/40">
                  <td className="rounded-l-lg px-2 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={tripulante.url_avatar ?? undefined} alt={tripulante.nome_completo} />
                        <AvatarFallback className="text-[11px]">
                          {tripulante.nome_completo.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-foreground">{tripulante.nome_completo}</p>
                        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", meta.className)}>
                          {detalhe ?? meta.label}
                        </span>
                      </div>
                    </div>
                  </td>
                  {dias.map((d, idx) => {
                    const dia = format(d, "yyyy-MM-dd");
                    const item = escala.find(
                      (e) => e.membro_id === tripulante.id && e.data_inicio <= dia && e.data_fim >= dia,
                    );
                    const aeronave = aeronaves.find((a) => a.id === item?.aeronave_id);
                    return (
                      <td
                        key={dia}
                        className={cn(
                          "px-1 py-2 text-center align-middle",
                          idx === dias.length - 1 && "rounded-r-lg",
                          isSameDay(d, diaSelecionado) && "bg-primary/5",
                        )}
                      >
                        {item ? (
                          <button
                            onClick={() => removerEscala.mutate(item.id)}
                            title="Remover escala"
                            className="group inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-1 text-[10px] font-medium text-primary"
                          >
                            {aeronave?.matricula ?? item.funcao.toUpperCase()}
                            <Trash2 className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escalar tripulante</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Tripulante</Label>
              <Select value={form.membro_id} onValueChange={(v) => setForm((f) => ({ ...f, membro_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {disponibilidade
                    .filter((d) => d.situacao === "disponivel")
                    .map((d) => (
                      <SelectItem key={d.tripulante.id} value={d.tripulante.id}>
                        {d.tripulante.nome_completo}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Aeronave</Label>
              <Select value={form.aeronave_id} onValueChange={(v) => setForm((f) => ({ ...f, aeronave_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {aeronaves.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.matricula} · {a.modelo ?? ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Função</Label>
              <Select value={form.funcao} onValueChange={(v) => setForm((f) => ({ ...f, funcao: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pic">Comandante (PIC)</SelectItem>
                  <SelectItem value="sic">Copiloto (SIC)</SelectItem>
                  <SelectItem value="sobreaviso">Sobreaviso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Início</Label>
                <Input
                  type="date"
                  value={form.data_inicio}
                  onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input
                  type="date"
                  value={form.data_fim}
                  onChange={(e) => setForm((f) => ({ ...f, data_fim: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!form.membro_id || criarEscala.isPending}
              onClick={() =>
                criarEscala.mutate(
                  {
                    membro_id: form.membro_id,
                    aeronave_id: form.aeronave_id || null,
                    funcao: form.funcao,
                    data_inicio: form.data_inicio,
                    data_fim: form.data_fim,
                    status: "escalado",
                  },
                  { onSuccess: () => setAberto(false) },
                )
              }
            >
              Salvar escala
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
