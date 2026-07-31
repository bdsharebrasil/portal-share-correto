import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import AnexosDinamicosField, { type AnexoLinha } from "./AnexosDinamicosField";

interface MarcarPagoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: "despesa_direta" | "reembolso" | "combustivel";
  itemId: string;
  onSuccess: () => void;
}

const FORMAS_PAGAMENTO = [
  { value: "pix", label: "PIX" },
  { value: "transferencia", label: "Transferência Bancária" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cheque", label: "Cheque" },
];

export function MarcarPagoDialog({ open, onOpenChange, tipo, itemId, onSuccess }: MarcarPagoDialogProps) {
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split("T")[0]);
  const [formaPagamento, setFormaPagamento] = useState("pix");
  const [banco, setBanco] = useState("");
  const [anexos, setAnexos] = useState<AnexoLinha[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const comprovanteUrl = anexos.find((anexo) => anexo.tipo === "comprovante")?.url || anexos[0]?.url || null;

  const resetForm = () => {
    setDataPagamento(new Date().toISOString().split("T")[0]);
    setFormaPagamento("pix");
    setBanco("");
    setAnexos([]);
  };

  const handleSubmit = async () => {
    if (anexos.some((anexo) => anexo.uploading)) return toast.error("Aguarde o envio dos anexos");

    setIsLoading(true);
    try {
      if (tipo === "despesa_direta") {
        const { error } = await supabase
          .from("despesas_cliente_direto")
          .update({
            status: "pagamento_validado",
            data_pagamento: dataPagamento,
            forma_pagamento: formaPagamento,
            comprovante_pagamento_url: comprovanteUrl,
            atualizado_em: new Date().toISOString(),
          })
          .eq("id", itemId);
        if (error) throw error;
      } else if (tipo === "reembolso") {
        const { error } = await (supabase.from("conciliacoes_bancarias") as any)
          .update({
            status: "reembolsado",
            data_reembolso: dataPagamento,
            forma_pagamento: formaPagamento,
            comprovante_url: comprovanteUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", itemId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("abastecimentos")
          .update({
            status: "pago",
            data_pagamento: dataPagamento,
            forma_pagamento: formaPagamento,
            comprovante_pagamento: comprovanteUrl,
            comprovante_url: comprovanteUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", itemId);
        if (error) throw error;
      }

      toast.success("Pagamento registrado com sucesso");
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || "Erro ao registrar pagamento");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-4xl flex-col overflow-hidden border-white/10 bg-card/90 p-0 backdrop-blur-xl">
        <DialogHeader className="border-b border-white/10 bg-gradient-to-r from-primary/15 to-transparent px-5 py-5 sm:px-7">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-primary/30 bg-primary/15 p-2.5 text-primary"><CreditCard className="h-5 w-5" /></div>
            <div><DialogTitle className="text-xl">Registrar pagamento</DialogTitle><DialogDescription className="mt-1">Confirme os dados financeiros e anexe os documentos do lançamento.</DialogDescription></div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-7">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Liquidação</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Status</Label><div className="flex h-10 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 text-sm font-medium text-emerald-500"><CheckCircle2 className="h-4 w-4" /> Pago</div></div>
              <div className="space-y-2"><Label>Data do pagamento</Label><Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} className="rounded-xl" /></div>
              <div className="space-y-2"><Label>Forma de pagamento</Label><Select value={formaPagamento} onValueChange={setFormaPagamento}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{FORMAS_PAGAMENTO.map((forma) => <SelectItem key={forma.value} value={forma.value}>{forma.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Banco</Label><Input value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Banco de origem" className="rounded-xl" /></div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <AnexosDinamicosField anexos={anexos} onChange={setAnexos} storagePrefix={`pagamentos-cotista/${itemId}`} />
          </section>
        </div>

        <DialogFooter className="border-t border-white/10 bg-card/95 px-5 py-4 sm:px-7">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isLoading} className="min-w-44 gap-2"><Loader2 className={`h-4 w-4 ${isLoading ? "animate-spin" : "hidden"}`} />Confirmar pagamento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
