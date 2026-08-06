import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
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
import { type Aeronave, type Solicitacao, useAgendamentoMutations } from "@/hooks/useAgendamentoVoo";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  aeronaves: Aeronave[];
  diaSelecionado: Date;
  selectedAeronaveId?: string | null;
}

interface ClienteOption {
  id: string;
  razao_social: string;
}

function useClientesLista() {
  return useQuery<ClienteOption[]>({
    queryKey: ["agv", "clientes-lista"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, razao_social")
        .order("razao_social");
      if (error) throw error;
      return (data ?? []) as ClienteOption[];
    },
  });
}

export function NovoAgendamentoDialog({ open, onOpenChange, aeronaves, diaSelecionado, selectedAeronaveId }: Props) {
  const { criarSolicitacao } = useAgendamentoMutations();
  const { data: clientes = [] } = useClientesLista();
  const [form, setForm] = useState({
    cliente_id: "",
    aeronave_id: "",
    origem: "",
    destino: "",
    data_agendada: format(diaSelecionado, "yyyy-MM-dd"),
    horario_partida: "",
    horario_chegada: "",
    dias_duracao: "1",
    qtd_passageiros: "1",
    observacoes: "",
  });

  useEffect(() => {
    if (open) {
      setForm((f) => ({
        ...f,
        data_agendada: format(diaSelecionado, "yyyy-MM-dd"),
        aeronave_id: selectedAeronaveId ?? f.aeronave_id,
      }));
    }
  }, [open, diaSelecionado, selectedAeronaveId]);

  const salvar = () => {
    const payload: Partial<Solicitacao> = {
      cliente_id: form.cliente_id || null,
      aeronave_id: form.aeronave_id || null,
      origem: form.origem.toUpperCase() || null,
      destino: form.destino.toUpperCase() || null,
      data_agendada: form.data_agendada,
      horario_partida: form.horario_partida || null,
      horario_chegada: form.horario_chegada || null,
      dias_duracao: Number(form.dias_duracao) || 1,
      qtd_passageiros: Number(form.qtd_passageiros) || 1,
      observacoes: form.observacoes || null,
      status: "pendente",
    };

    criarSolicitacao.mutate(payload, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo agendamento de voo</DialogTitle>
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
              <Label>Origem</Label>
              <Input
                value={form.origem}
                onChange={(e) => setForm((f) => ({ ...f, origem: e.target.value.toUpperCase() }))}
                placeholder="SBSP"
              />
            </div>
            <div className="space-y-2">
              <Label>Destino</Label>
              <Input
                value={form.destino}
                onChange={(e) => setForm((f) => ({ ...f, destino: e.target.value.toUpperCase() }))}
                placeholder="SBRJ"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={form.data_agendada}
                onChange={(e) => setForm((f) => ({ ...f, data_agendada: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Partida</Label>
              <Input
                type="time"
                value={form.horario_partida}
                onChange={(e) => setForm((f) => ({ ...f, horario_partida: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Chegada</Label>
              <Input
                type="time"
                value={form.horario_chegada}
                onChange={(e) => setForm((f) => ({ ...f, horario_chegada: e.target.value }))}
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

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!form.data_agendada || criarSolicitacao.isPending} onClick={salvar}>
            Criar agendamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
