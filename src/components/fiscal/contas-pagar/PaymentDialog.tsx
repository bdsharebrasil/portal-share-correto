import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select as RegularSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Upload, FileText, X } from "lucide-react";
import { format } from "date-fns";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta: any;
  bancos: { id: string; label: string }[];
  onPaid: () => void;
}

export function PaymentDialog({ open, onOpenChange, conta, bancos, onPaid }: PaymentDialogProps) {
  const { user } = useAuth();
  const [dataPagamento, setDataPagamento] = useState(format(new Date(), "yyyy-MM-dd"));
  const [banco, setBanco] = useState("");
  const [metodoPagamento, setMetodoPagamento] = useState("");
  const [prazo, setPrazo] = useState("");
  const [comprovanteUrl, setComprovanteUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const timestamp = Date.now();
      const sanitizedFileName = file.name
        .replace(/[^a-zA-Z0-9.\-_]/g, "_")
        .substring(0, 100);
      const fileExt = sanitizedFileName.split('.').pop();
      const fileName = `comprovante_${timestamp}_${conta?.id || 'unknown'}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("nfs-share-recebidas").upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("nfs-share-recebidas").getPublicUrl(fileName);
      setComprovanteUrl(data.publicUrl);
      toast.success("Comprovante enviado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar");
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!banco) { toast.error("Selecione um banco"); return; }
    if (!metodoPagamento) { toast.error("Selecione o método de pagamento"); return; }
    if (!prazo) { toast.error("Selecione o prazo"); return; }
    if (!dataPagamento) { toast.error("Informe a data do pagamento"); return; }
    setSaving(true);
    try {
      // 1. Update contas_apagar
      const { error: updateError } = await (supabase.from("contas_apagar") as any)
        .update({
          status: "paga",
          data_pagamento: dataPagamento,
          banco_pagamento: banco,
          comprovante_pagamento_url: comprovanteUrl || null,
          atualizado_em: new Date().toISOString()
        })
        .eq("id", conta.id);
      if (updateError) throw updateError;

      // 2. Insert into controle_bancario
      // Find categoria_id for the right group
      let categoriaId = conta.categoria_id || null;
      if (!categoriaId) {
        const { data: catData } = await supabase
          .from("categorias_movimentacao")
          .select("id")
          .eq("nome", conta.categoria)
          .limit(1);
        categoriaId = catData?.[0]?.id || null;
      }

      if (categoriaId) {
        await (supabase.from("controle_bancario") as any).insert([{
          data: dataPagamento,
          tipo_movimento: "saida",
          categoria_id: categoriaId,
          descricao: `${conta.categoria} - ${conta.fornecedor_nome}`,
          valor: parseFloat(conta.valor),
          conta_banco: banco,
          status: "pago",
          fornecedores_favoritos_id: conta.fornecedor_favorito_id || null,
          client_id: conta.client_id || null,
          aeronave_id: conta.aeronave_id || null,
          aeronave_registro: conta.aeronave_registro || null,
          comprovante_url: comprovanteUrl || null,
          grupo_categoria: conta.categoria,
          criado_por: user?.id,
          numero_documento: conta.numero || null,
          referencia: conta.id
        }]);
      }

      toast.success("Pagamento registrado com sucesso!");
      onPaid();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar pagamento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>
        {conta && (
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted/40 rounded-lg border border-border/50">
              <p className="text-sm font-semibold">{conta.fornecedor_nome}</p>
              <p className="text-lg font-bold text-red-500">R$ {parseFloat(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <label className="text-sm font-semibold mb-1 block">Data do Pagamento *</label>
              <Input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-semibold mb-1 block">Banco *</label>
              <RegularSelect value={banco} onValueChange={setBanco}>
                <SelectTrigger><SelectValue placeholder="Selecione o banco..." /></SelectTrigger>
                <SelectContent>
                  {bancos.map(b => <SelectItem key={b.id} value={b.label}>{b.label}</SelectItem>)}
                </SelectContent>
              </RegularSelect>
            </div>
            <div>
              <label className="text-sm font-semibold mb-1 block">Método de Pagamento *</label>
              <RegularSelect value={metodoPagamento} onValueChange={setMetodoPagamento}>
                <SelectTrigger><SelectValue placeholder="Selecione o método..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                  <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </RegularSelect>
            </div>
            <div>
              <label className="text-sm font-semibold mb-1 block">Prazo *</label>
              <RegularSelect value={prazo} onValueChange={setPrazo}>
                <SelectTrigger><SelectValue placeholder="Selecione o prazo..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="extra">Extra</SelectItem>
                </SelectContent>
              </RegularSelect>
            </div>
            <div>
              <label className="text-sm font-semibold mb-1 block">Comprovante</label>
              {comprovanteUrl ? (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border border-border/50">
                  <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                  <a href={comprovanteUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex-1 truncate">Comprovante anexado</a>
                  <Button variant="ghost" size="sm" onClick={() => setComprovanteUrl("")} className="h-6 w-6 p-0"><X className="h-3 w-3" /></Button>
                </div>
              ) : (
                <>
                  <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleUpload} disabled={uploading} className="hidden" id="comprovante-upload" />
                  <Button variant="outline" onClick={() => document.getElementById('comprovante-upload')?.click()} disabled={uploading} className="w-full">
                    <Upload className="h-4 w-4 mr-2" />{uploading ? "Enviando..." : "Anexar Comprovante"}
                  </Button>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleConfirm} disabled={saving} className="bg-green-600 hover:bg-green-700">
                {saving ? "Processando..." : "Confirmar Pagamento"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
