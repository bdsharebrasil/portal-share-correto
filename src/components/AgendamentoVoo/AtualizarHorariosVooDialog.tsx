import { CheckCircle2, Clock3, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type PernaVoo, type Solicitacao, useAgendamentoMutations, usePernasVoo } from "@/hooks/useAgendamentoVoo";

interface Props {
  voo: Solicitacao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const timeValue = (value?: string | null) => value?.slice(0, 5) ?? "";
const todayYYYYMMDD = () => new Date().toISOString().slice(0, 10);

function EtapaHorarios({ perna, voo, onComplete }: { perna: PernaVoo | null; voo: Solicitacao; onComplete: () => void }) {
  const { registrarEtapaVoo } = useAgendamentoMutations();
  const [dataPerna, setDataPerna] = useState("");
  const [acionamento, setAcionamento] = useState("");
  const [decolagem, setDecolagem] = useState("");
  const [pouso, setPouso] = useState("");
  const [corte, setCorte] = useState("");

  const retorno = (perna?.numero_perna ?? 1) > 1;
  const voltaEmRota = retorno && Boolean(perna?.horario_decolagem);

  useEffect(() => {
    setDataPerna(perna?.data_perna ?? voo.data_partida ?? voo.data_agendada ?? todayYYYYMMDD());
    setAcionamento(timeValue(perna?.horario_acionamento) || timeValue(voo.horario_acionamento));
    setDecolagem(timeValue(perna?.horario_decolagem) || timeValue(voo.horario_decolagem));
    setPouso(timeValue(perna?.horario_pouso));
    setCorte(timeValue(perna?.horario_corte));
  }, [perna, voo]);

  const fase = retorno ? (voltaEmRota ? "concluir_volta" : "iniciar_volta") : "pousar_ida";
  const podeSalvar =
    Boolean(dataPerna && acionamento && decolagem) &&
    (fase === "iniciar_volta" || Boolean(pouso && (fase === "pousar_ida" || corte)));

  const salvar = () => {
    if (!podeSalvar) return;
    registrarEtapaVoo.mutate(
      {
        solicitacao: voo,
        perna,
        fase,
        dataPerna,
        horarioAcionamento: acionamento,
        horarioDecolagem: decolagem,
        horarioPouso: pouso || null,
        horarioCorte: corte || null,
      },
      { onSuccess: onComplete },
    );
  };

  const titulo = fase === "pousar_ida" ? "Registrar pouso" : fase === "iniciar_volta" ? "Iniciar voo de volta" : "Concluir voo de volta";
  const descricao = fase === "pousar_ida"
    ? "Revise AC e DEP e informe o horário de pouso. A perna de volta será aberta automaticamente."
    : fase === "iniciar_volta"
      ? "Informe AC e DEP para colocar a perna de volta em rota."
      : "Revise os horários e informe o pouso e o corte para concluir o voo.";
  const acao = fase === "pousar_ida" ? "Confirmar pouso" : fase === "iniciar_volta" ? "Colocar em rota" : "Concluir voo";

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {fase === "concluir_volta" ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Plane className="h-5 w-5 text-amber-500" />}
          {titulo}
        </DialogTitle>
        <DialogDescription>{descricao} Todos os horários são em UTC.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="data-etapa">Data da perna</Label>
          <Input id="data-etapa" type="date" value={dataPerna} onChange={(event) => setDataPerna(event.target.value)} className="font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ac-etapa">Acionamento (AC)</Label>
          <Input id="ac-etapa" type="time" value={acionamento} onChange={(event) => setAcionamento(event.target.value)} className="font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dep-etapa">Decolagem (DEP)</Label>
          <Input id="dep-etapa" type="time" value={decolagem} onChange={(event) => setDecolagem(event.target.value)} className="font-mono" />
        </div>
        {fase !== "iniciar_volta" && (
          <div className="space-y-1.5">
            <Label htmlFor="arr-etapa">Pouso (ARR)</Label>
            <Input id="arr-etapa" type="time" value={pouso} onChange={(event) => setPouso(event.target.value)} className="font-mono" />
          </div>
        )}
        {fase === "concluir_volta" && (
          <div className="space-y-1.5">
            <Label htmlFor="cort-etapa">Corte (CORT)</Label>
            <Input id="cort-etapa" type="time" value={corte} onChange={(event) => setCorte(event.target.value)} className="font-mono" />
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onComplete}>Cancelar</Button>
        <Button onClick={salvar} disabled={!podeSalvar || registrarEtapaVoo.isPending}>
          <Clock3 className="mr-1.5 h-4 w-4" />
          {registrarEtapaVoo.isPending ? "Salvando..." : acao}
        </Button>
      </DialogFooter>
    </>
  );
}

export function AtualizarHorariosVooDialog({ voo, open, onOpenChange }: Props) {
  const { data: pernas = [] } = usePernasVoo(open ? voo?.id : null);
  const pernaAtual = pernas[pernas.length - 1] ?? null;

  if (!voo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
        <EtapaHorarios key={pernaAtual?.id ?? voo.id} perna={pernaAtual} voo={voo} onComplete={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
