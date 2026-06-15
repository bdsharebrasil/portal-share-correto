import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

interface FluxoSelecionModalProps {
  open: boolean;
  onSelect: (fluxo: "entrada" | "saida") => void;
}

export function FluxoSelecionModal({ open, onSelect }: FluxoSelecionModalProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md rounded-2xl border-border/50 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Tipo de Movimento</DialogTitle>
          <DialogDescription>
            Escolha se é uma entrada ou saída de caixa
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 pt-4">
          <Button
            onClick={() => onSelect("entrada")}
            variant="outline"
            className="h-32 flex-col gap-3 rounded-xl border-2 border-success/20 bg-success/5 hover:bg-success/10 hover:border-success/40 transition-all"
          >
            <ArrowUpRight className="h-8 w-8 text-success" />
            <div>
              <div className="font-semibold">Entrada</div>
              <div className="text-xs text-muted-foreground">Cotista pagou para o negócio</div>
            </div>
          </Button>

          <Button
            onClick={() => onSelect("saida")}
            variant="outline"
            className="h-32 flex-col gap-3 rounded-xl border-2 border-destructive/20 bg-destructive/5 hover:bg-destructive/10 hover:border-destructive/40 transition-all"
          >
            <ArrowDownLeft className="h-8 w-8 text-destructive" />
            <div>
              <div className="font-semibold">Saída</div>
              <div className="text-xs text-muted-foreground">Negócio pagou despesa do cotista</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
