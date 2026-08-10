import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type Solicitacao, useAgendamentoMutations, usePernasVoo } from "@/hooks/useAgendamentoVoo";

interface Props {
  voo: Solicitacao | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function NovaPernaDialog({ voo, open, onOpenChange }: Props) {
  const { adicionarPerna } = useAgendamentoMutations();
  const { data: pernas = [] } = usePernasVoo(open ? voo?.id : null);

  const [form, setForm] = useState({
    data_perna: "",
    origem: "",
    destino: "",
    horario_acionamento: "",
    horario_decolagem: "",
    horario_pouso: "",
    qtd_passageiros: "1",
    observacoes: "",
  });

  useEffect(() => {
    if (!open || !voo) return;
    const ultima = pernas[pernas.length - 1];
    // Sugere o trecho de volta: origem = destino do último trecho
    const origemSugerida = (ultima?.destino ?? voo.destino ?? "").toUpperCase();
    const destinoSugerido = (ultima?.origem ?? voo.origem ?? "").toUpperCase();
    setForm((f) => ({
      ...f,
      data_perna: f.data_perna || voo.data_partida || format(new Date(), "yyyy-MM-dd"),
      origem: f.origem || origemSugerida,
      destino: f.destino || destinoSugerido,
      qtd_passageiros: String(voo.qtd_passageiros ?? 1),
    }));
  }, [open, voo, pernas]);

  useEffect(() => {
    if (!open) {
      setForm({
        data_perna: "",
        origem: "",
        destino: "",
        horario_acionamento: "",
        horario_decolagem: "",
        horario_pouso: "",
        qtd_passageiros: "1",
        observacoes: "",
      });
    }
  }, [open]);

  if (!voo) return null;

  const ok = !!form.data_perna && !!form.origem && !!form.destino;

  const salvar = () => {
    adicionarPerna.mutate(
      {
        solicitacao: voo,
        dataPerna: form.data_perna,
        origem: form.origem,
        destino: form.destino,
        horarioAcionamento: form.horario_acionamento || null,
        horarioDecolagem: form.horario_decolagem || null,
        horarioPouso: form.horario_pouso || null,
        qtdPassageiros: Number(form.qtd_passageiros) || 1,
        observacoes: form.observacoes || null,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova perna de voo</DialogTitle>
          <DialogDescription>
            Registre o próximo trecho (ex.: volta). Já existem {pernas.length} perna(s) neste agendamento.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Origem (ICAO)</Label>
              <Input
                value={form.origem}
                onChange={(e) => setForm((f) => ({ ...f, origem: e.target.value.toUpperCase() }))}
                placeholder="SDLI"
              />
            </div>
            <div className="space-y-2">
              <Label>Destino (ICAO)</Label>
              <Input
                value={form.destino}
                onChange={(e) => setForm((f) => ({ ...f, destino: e.target.value.toUpperCase() }))}
                placeholder="SBCY"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data do trecho</Label>
              <Input
                type="date"
                value={form.data_perna}
                onChange={(e) => setForm((f) => ({ ...f, data_perna: e.target.value }))}
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

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Acionamento</Label>
              <Input
                type="time"
                value={form.horario_acionamento}
                onChange={(e) => setForm((f) => ({ ...f, horario_acionamento: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Decolagem</Label>
              <Input
                type="time"
                value={form.horario_decolagem}
                onChange={(e) => setForm((f) => ({ ...f, horario_decolagem: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Pouso</Label>
              <Input
                type="time"
                value={form.horario_pouso}
                onChange={(e) => setForm((f) => ({ ...f, horario_pouso: e.target.value }))}
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
          <Button disabled={!ok || adicionarPerna.isPending} onClick={salvar}>
            Registrar perna
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
