import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAeronavesAgendamento, useAgendamentoMutations } from "@/hooks/useAgendamentoVoo";

function useClienteDoUsuario() {
  return useQuery({
    queryKey: ["agv", "cliente-do-usuario"],
    queryFn: async (): Promise<string | null> => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) return null;

      const sb = supabase as any;
      const byId = await sb.from("user_clientes").select("clientes_id").eq("id", user.id).maybeSingle();
      if (byId.data?.clientes_id) return byId.data.clientes_id as string;

      if (user.email) {
        const byEmail = await sb
          .from("user_clientes")
          .select("clientes_id")
          .eq("email", user.email)
          .maybeSingle();
        if (byEmail.data?.clientes_id) return byEmail.data.clientes_id as string;
      }
      return null;
    },
  });
}

export function SolicitarVooCliente() {
  const { data: clienteId } = useClienteDoUsuario();
  const { data: aeronaves = [] } = useAeronavesAgendamento();
  const { criarSolicitacao } = useAgendamentoMutations();
  const [open, setOpen] = useState(false);
  const hoje = format(new Date(), "yyyy-MM-dd");

  const [form, setForm] = useState({
    aeronave_id: "",
    origem: "",
    destino: "",
    data_agendada: hoje,
    horario_previsto_agendamento: "",
    dias_duracao: "1",
    qtd_passageiros: "1",
    observacoes: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm((f) => ({ ...f, data_agendada: hoje }));
  }, [open, hoje]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Solicitar voo</DialogTitle>
            <DialogDescription>
              A coordenação de operações recebe a solicitação e confirma a aeronave e a tripulação.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Aeronave desejada</Label>
              <Select value={form.aeronave_id} onValueChange={(v) => setForm((f) => ({ ...f, aeronave_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem preferência" />
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
                  min={hoje}
                  value={form.data_agendada}
                  onChange={(e) => setForm((f) => ({ ...f, data_agendada: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Partida (UTC)</Label>
                <Input
                  type="time"
                  value={form.horario_previsto_agendamento}
                  onChange={(e) => setForm((f) => ({ ...f, horario_previsto_agendamento: e.target.value }))}
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
                placeholder="Bagagem, catering, horário flexível..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                !form.aeronave_id ||
                !form.origem ||
                !form.destino ||
                !form.horario_previsto_agendamento ||
                criarSolicitacao.isPending
              }
              onClick={() =>
                criarSolicitacao.mutate(
                  {
                    cliente_id: clienteId ?? null,
                    aeronave_id: form.aeronave_id,
                    origem: form.origem,
                    destino: form.destino,
                    data_agendada: form.data_agendada,
                    horario_previsto_agendamento: `${form.horario_previsto_agendamento}:00`.slice(0, 8),
                    dias_duracao: Number(form.dias_duracao) || 1,
                    qtd_passageiros: Number(form.qtd_passageiros) || 1,
                    observacoes: form.observacoes || null,
                    status: "pendente",
                  } as any,
                  { onSuccess: () => setOpen(false) },
                )
              }
            >
              Enviar solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
