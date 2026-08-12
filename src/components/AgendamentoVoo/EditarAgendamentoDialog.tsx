import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Solicitacao, useAeronavesAgendamento, useAgendamentoMutations, useTripulantes } from "@/hooks/useAgendamentoVoo";

interface Props {
  voo: Solicitacao | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface ClienteOption {
  id: string;
  razao_social: string;
}

function useClientesLista() {
  return useQuery<ClienteOption[]>({
    queryKey: ["agv", "clientes-lista"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, razao_social").order("razao_social");
      if (error) throw error;
      return (data ?? []) as ClienteOption[];
    },
  });
}

export function EditarAgendamentoDialog({ voo, open, onOpenChange }: Props) {
  const { atualizarSolicitacao, alterarStatusVoo, aprovar } = useAgendamentoMutations();
  const { data: clientes = [] } = useClientesLista();
  const { data: aeronaves = [] } = useAeronavesAgendamento();
  const { data: tripulantes = [] } = useTripulantes();

  const [form, setForm] = useState({
    cliente_id: "",
    aeronave_id: "",
    origem: "",
    destino: "",
    data_agendada: "",
    horario_previsto_agendamento: "",
    dias_duracao: "1",
    qtd_passageiros: "1",
    observacoes: "",
    piloto_id: "",
    copiloto_id: "",
  });

  useEffect(() => {
    if (open && voo) {
      setForm({
        cliente_id: voo.cliente_id ?? "",
        aeronave_id: voo.aeronave_id ?? "",
        origem: voo.origem ?? "",
        destino: voo.destino ?? "",
        data_agendada: voo.data_agendada ?? "",
        horario_previsto_agendamento: (voo.horario_previsto_agendamento ?? "").slice(0, 5),
        dias_duracao: String(voo.dias_duracao ?? 1),
        qtd_passageiros: String(voo.qtd_passageiros ?? 1),
        observacoes: voo.observacoes ?? "",
        piloto_id: voo.piloto_id ?? "",
        copiloto_id: voo.copiloto_id ?? "",
      });
    }
  }, [open, voo]);

  if (!voo) return null;

  const ok = !!form.aeronave_id && !!form.origem && !!form.destino && !!form.data_agendada;

  const dadosFormulario: Partial<Solicitacao> = {
    cliente_id: form.cliente_id || null,
    aeronave_id: form.aeronave_id,
    origem: form.origem.toUpperCase(),
    destino: form.destino.toUpperCase(),
    data_agendada: form.data_agendada,
    horario_previsto_agendamento: form.horario_previsto_agendamento
      ? `${form.horario_previsto_agendamento}:00`.slice(0, 8)
      : null,
    dias_duracao: Number(form.dias_duracao) || 1,
    qtd_passageiros: Number(form.qtd_passageiros) || 1,
    observacoes: form.observacoes || null,
    piloto_id: form.piloto_id || null,
    copiloto_id: form.copiloto_id || null,
  };

  const salvar = () => {
    atualizarSolicitacao.mutate(
      { id: voo.id, dados: dadosFormulario },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const confirmar = () => {
    aprovar.mutate(
      {
        solicitacao: voo,
        pilotoId: form.piloto_id,
        copilotoId: form.copiloto_id || null,
        dados: dadosFormulario,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar agendamento</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={form.cliente_id} onValueChange={(v) => setForm((f) => ({ ...f, cliente_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.razao_social}
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Origem (ICAO)</Label>
              <Input
                value={form.origem}
                onChange={(e) => setForm((f) => ({ ...f, origem: e.target.value.toUpperCase() }))}
                placeholder="SBCY"
              />
            </div>
            <div className="space-y-2">
              <Label>Destino (ICAO)</Label>
              <Input
                value={form.destino}
                onChange={(e) => setForm((f) => ({ ...f, destino: e.target.value.toUpperCase() }))}
                placeholder="SDLI"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={form.data_agendada}
                onChange={(e) => setForm((f) => ({ ...f, data_agendada: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Horário previsto (UTC)</Label>
              <Input
                type="time"
                value={form.horario_previsto_agendamento}
                onChange={(e) => setForm((f) => ({ ...f, horario_previsto_agendamento: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Dias de duração</Label>
              <Input
                type="number"
                min="1"
                value={form.dias_duracao}
                onChange={(e) => setForm((f) => ({ ...f, dias_duracao: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Passageiros</Label>
              <Input
                type="number"
                min="1"
                value={form.qtd_passageiros}
                onChange={(e) => setForm((f) => ({ ...f, qtd_passageiros: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Comandante (PIC)</Label>
              <Select value={form.piloto_id} onValueChange={(v) => setForm((f) => ({ ...f, piloto_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {tripulantes.map((tripulante) => (
                    <SelectItem key={tripulante.id} value={tripulante.id}>
                      {tripulante.nome_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Copiloto (SIC)</Label>
              <Select value={form.copiloto_id} onValueChange={(v) => setForm((f) => ({ ...f, copiloto_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {tripulantes
                    .filter((tripulante) => tripulante.id !== form.piloto_id)
                    .map((tripulante) => (
                      <SelectItem key={tripulante.id} value={tripulante.id}>
                        {tripulante.nome_completo}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          {!["cancelado", "concluido", "rejeitado"].includes(voo.status) && (
            <Button
              variant="destructive"
              disabled={alterarStatusVoo.isPending}
              onClick={() => alterarStatusVoo.mutate({ solicitacao: voo, status: "cancelado" }, { onSuccess: () => onOpenChange(false) })}
            >
              Cancelar voo
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            {voo.status === "pendente" ? (
              <Button disabled={!ok || !form.piloto_id || aprovar.isPending} onClick={confirmar}>
                Confirmar voo
              </Button>
            ) : (
              <Button disabled={!ok || atualizarSolicitacao.isPending} onClick={salvar}>
                Salvar alterações
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
