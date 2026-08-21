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
import { AerodromeCombobox } from "@/components/plano-voo/AerodromeCombobox";
import { useAerodromes } from "@/hooks/useAerodromes";
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
  const { aerodromes } = useAerodromes();
  const [form, setForm] = useState({
    cliente_id: "",
    aeronave_id: "",
    origem: "",
    destino: "",
    data_agendada: format(diaSelecionado, "yyyy-MM-dd"),
    horario_previsto_agendamento: "",
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

  const camposObrigatoriosOk =
    !!form.aeronave_id &&
    !!form.origem &&
    !!form.destino &&
    !!form.data_agendada &&
    !!form.horario_previsto_agendamento;

  const salvar = () => {
    const payload: Partial<Solicitacao> = {
      cliente_id: form.cliente_id || null,
      aeronave_id: form.aeronave_id,
      origem: form.origem.toUpperCase(),
      destino: form.destino.toUpperCase(),
      data_agendada: form.data_agendada,
      horario_previsto_agendamento: `${form.horario_previsto_agendamento}:00`.slice(0, 8),
      dias_duracao: Number(form.dias_duracao) || 1,
      qtd_passageiros: Number(form.qtd_passageiros) || 1,
      observacoes: form.observacoes || null,
      status: "pendente",
    };

    criarSolicitacao.mutate(payload, { onSuccess: () => onOpenChange(false) });
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto rounded-2xl p-4 sm:max-h-[calc(100vh-2rem)] sm:w-[calc(100%-2rem)] sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle>Novo agendamento de voo</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Origem</Label>
              <AerodromeCombobox
                aerodromes={aerodromes}
                value={form.origem}
                onChange={(v) => setForm((f) => ({ ...f, origem: v }))}
                placeholder="Aeródromo de origem"
              />
            </div>
            <div className="space-y-2">
              <Label>Destino</Label>
              <AerodromeCombobox
                aerodromes={aerodromes}
                value={form.destino}
                onChange={(v) => setForm((f) => ({ ...f, destino: v }))}
                placeholder="Aeródromo de destino"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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


          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

        <DialogFooter className="grid grid-cols-1 gap-2 sm:flex sm:flex-row sm:justify-end">
          <Button className="min-h-11 w-full sm:w-auto" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="min-h-11 w-full sm:w-auto" disabled={!camposObrigatoriosOk || criarSolicitacao.isPending} onClick={salvar}>
            Criar agendamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
