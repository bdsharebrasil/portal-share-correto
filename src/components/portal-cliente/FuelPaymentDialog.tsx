import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileUp, Calendar, CreditCard } from "lucide-react";

interface FuelPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fuelRecord: any;
  onSuccess: () => void;
}

export function FuelPaymentDialog({
  open,
  onOpenChange,
  fuelRecord,
  onSuccess
}: FuelPaymentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptFileName, setReceiptFileName] = useState("");

  const handleClose = () => {
    setPaymentDate("");
    setPaymentMethod("");
    setReceiptFile(null);
    setReceiptFileName("");
    onOpenChange(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      setReceiptFileName(file.name);
    }
  };

  const handleSubmit = async () => {
    try {
      if (!fuelRecord) {
        toast.error("Erro ao carregar dados do abastecimento");
        return;
      }

      if (!paymentDate || !paymentMethod) {
        toast.error("Preencha a data e a forma de pagamento");
        return;
      }

      setLoading(true);

      let receiptUrl = fuelRecord.comprovante_url;

      // Upload comprovante se fornecido
      if (receiptFile) {
        const fileExt = receiptFile.name.split(".").pop();
        const fileName = `fuel_payment_${fuelRecord.id}_${Date.now()}.${fileExt}`;
        const filePath = `abastecimentos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("client-documents")
          .upload(filePath, receiptFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("client-documents")
          .getPublicUrl(filePath);

        receiptUrl = publicUrlData.publicUrl;
      }

      // Atualizar status do abastecimento
      const { error } = await supabase
        .from("abastecimentos")
        .update({
          status_pagamento: "pago",
          data_pagamento: paymentDate,
          forma_pagamento: paymentMethod,
          comprovante_url: receiptUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", fuelRecord.id);

      if (error) throw error;

      toast.success("Pagamento registrado com sucesso");
      handleClose();
      onSuccess();
    } catch (error) {
      console.error("Erro ao registrar pagamento:", error);
      toast.error("Erro ao registrar pagamento");
    } finally {
      setLoading(false);
    }
  };

  if (!fuelRecord) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Carregando...</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dar Baixa no Pagamento</DialogTitle>
          <DialogDescription>
            Confirme o pagamento do abastecimento e anexe o comprovante
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="bg-slate-900/50 p-3 rounded-lg border border-white/10">
            <div className="text-sm space-y-1">
              <p className="text-muted-foreground">Aeronave:</p>
              <p className="font-medium text-foreground">
                {fuelRecord?.aeronave?.registration || 'N/A'} - {fuelRecord?.local || 'N/A'}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Valor: R$ {fuelRecord?.valor_total || '0,00'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-date" className="text-foreground">
              <Calendar className="inline h-4 w-4 mr-1" />
              Data do Pagamento
            </Label>
            <Input
              id="payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="bg-slate-900/50 border-white/10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-method" className="text-foreground">
              <CreditCard className="inline h-4 w-4 mr-1" />
              Forma de Pagamento
            </Label>
            <select
              id="payment-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/50 border border-white/10 rounded-md text-foreground"
            >
              <option value="">Selecione uma forma de pagamento</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="cartao_credito">Cartão de Crédito</option>
              <option value="cartao_debito">Cartão de Débito</option>
              <option value="transferencia">Transferência Bancária</option>
              <option value="pix">PIX</option>
              <option value="boleto">Boleto</option>
              <option value="outro">Outro</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="receipt" className="text-foreground">
              <FileUp className="inline h-4 w-4 mr-1" />
              Comprovante (Opcional)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="receipt"
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="bg-slate-900/50 border-white/10 flex-1"
              />
            </div>
            {receiptFileName && (
              <p className="text-xs text-emerald-400">{receiptFileName}</p>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !paymentDate || !paymentMethod}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500"
            >
              {loading ? "Registrando..." : "Registrar Pagamento"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
