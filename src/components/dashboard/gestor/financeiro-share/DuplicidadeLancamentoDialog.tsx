import { AlertTriangle, ArrowRight, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format";
import type { PossivelDuplicata } from "@/lib/duplicateFinanceCheck";

interface Props {
  open: boolean;
  duplicatas: PossivelDuplicata[];
  onCancelar: () => void;
  onContinuar: () => void;
  onVerificar?: (item: PossivelDuplicata) => void;
}

const dataBR = (d?: string | null) =>
  d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "—";

export default function DuplicidadeLancamentoDialog({
  open,
  duplicatas,
  onCancelar,
  onContinuar,
  onVerificar,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancelar(); }}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            Possível lançamento duplicado
          </DialogTitle>
          <DialogDescription>
            Encontramos {duplicatas.length} lançamento(s) parecido(s) já registrado(s). Verifique
            antes de continuar para evitar duplicidade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {duplicatas.map((d) => (
            <div
              key={`${d.origem}-${d.id}`}
              className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300/80">
                    <FileText className="h-3.5 w-3.5" />
                    {d.origemLabel}
                  </div>
                  <div className="mt-1 truncate text-sm font-semibold text-foreground">
                    {d.descricao}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {dataBR(d.data)} · {d.fornecedor || "Sem fornecedor"}
                    {d.documento ? ` · Doc ${d.documento}` : ""}
                    {d.status ? ` · ${d.status}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-black text-foreground">{formatBRL(d.valor)}</div>
                  {onVerificar && (
                    <button
                      type="button"
                      onClick={() => onVerificar(d)}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      Verificar lançamento <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {d.motivos.map((m) => (
                  <Badge key={m} variant="outline" className="border-amber-500/30 text-[10px] text-amber-300">
                    {m}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onCancelar}>
            Cancelar e revisar
          </Button>
          <Button onClick={onContinuar} className="bg-amber-500 text-black hover:bg-amber-400">
            Inserir mesmo assim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}