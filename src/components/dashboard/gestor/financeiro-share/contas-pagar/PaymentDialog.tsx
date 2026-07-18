import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select as RegularSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useContasBancarias } from "@/hooks/useContasBancarias";
import { toast } from "sonner";
import { Upload, FileText, X } from "lucide-react";
import { format } from "date-fns";

interface SocioOption { name?: string | null; nome?: string | null; }
interface ClienteOption { razao_social?: string | null; }
type SupabaseQuery = ReturnType<typeof supabase.from>;

interface PaymentContaLike {
  id?: string;
  valor?: number | string | null;
  categoria?: string | null;
  categoria_id?: string | null;
  fornecedor_nome?: string | null;
  fornecedor_favorito_id?: string | null;
  cliente_id?: string | null;
  aeronave_id?: string | null;
  aeronave_registro?: string | null;
  numero?: string | null;
  movimentacao_id?: string | null;
  clientes?: ClienteOption | null;
  socios?: SocioOption[] | null;
}
interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta: PaymentContaLike | null;
  onPaid: () => void;
}

export function PaymentDialog({ open, onOpenChange, conta, onPaid }: PaymentDialogProps) {
  const { user } = useAuth();
  const { data: contasBancarias = [] } = useContasBancarias();
  const [dataPagamento, setDataPagamento] = useState(format(new Date(), "yyyy-MM-dd"));
  const [banco, setBanco] = useState("");
  const [metodoPagamento, setMetodoPagamento] = useState("");
  const [pagoPor, setPagoPor] = useState("");
  const [valorPago, setValorPago] = useState<string>("");
  const [comprovanteUrl, setComprovanteUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const pagadoresOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    const seen = new Set<string>();

    const addOption = (value: string | null | undefined, label: string) => {
      const normalizedValue = value?.trim();
      if (!normalizedValue) return;
      if (seen.has(normalizedValue)) return;
      seen.add(normalizedValue);
      options.push({ value: normalizedValue, label });
    };

    addOption(conta?.clientes?.razao_social, `Cliente: ${conta?.clientes?.razao_social}`);
    (Array.isArray(conta?.socios) ? conta.socios : []).forEach((socio) => {
      addOption(socio?.nome ?? socio?.name, `Sócio: ${socio?.nome ?? socio?.name}`);
    });

    return options;
  }, [conta?.clientes?.razao_social, conta?.socios]);

  useEffect(() => {
    if (conta?.valor != null) {
      setValorPago(String(conta.valor));
    }
  }, [conta?.id, conta?.valor]);

  useEffect(() => {
    if (pagadoresOptions.length > 0) {
      const clienteNome = conta?.clientes?.razao_social?.trim();
      setPagoPor(clienteNome || pagadoresOptions[0].value);
      return;
    }
    setPagoPor("");
  }, [conta?.id, conta?.clientes?.razao_social, pagadoresOptions]);

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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao enviar";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!banco) { toast.error("Selecione um banco"); return; }
    if (!metodoPagamento) { toast.error("Selecione o método de pagamento"); return; }
    if (!dataPagamento) { toast.error("Informe a data do pagamento"); return; }
    const valorNum = parseFloat(valorPago);
    if (!valorNum || valorNum <= 0) { toast.error("Informe um valor válido"); return; }
    setSaving(true);
    try {
      const { error: updateError } = await (supabase.from("contas_apagar") as unknown as SupabaseQuery)
        .update({
          status: "paga",
          data_pagamento: dataPagamento,
          banco_pagamento: banco,
          valor_pago: valorNum,
          comprovante_pagamento_url: comprovanteUrl || null,
          atualizado_em: new Date().toISOString()
        })
        .eq("id", conta.id);
      if (updateError) throw updateError;

      if (conta.movimentacao_id) {
        const { error: movError } = await (supabase.from("movimentacoes") as unknown as SupabaseQuery)
          .update({ status: "pago", data_pagamento: dataPagamento, valor: valorNum })
          .eq("id", conta.movimentacao_id);
        if (movError) throw movError;

        const { error: rateioError } = await (supabase.from("rateio_despesas") as unknown as SupabaseQuery)
          .update({
            status: "pago",
            data_pagamento: dataPagamento,
            forma_pagamento: metodoPagamento || null,
            valor_pago_real: valorNum,
            comprovante_url: comprovanteUrl || null,
            pago_por: pagoPor || null,
            atualizado_em: new Date().toISOString(),
          })
          .eq("despesa_id", conta.movimentacao_id);
        if (rateioError) throw rateioError;
      }

      // Fallback: also try to update rateio_despesas linked by contas_apagar.id
      // (covers cases where the source record used contas_apagar.id as despesa_id)
      await (supabase.from("rateio_despesas") as unknown as SupabaseQuery)
        .update({
          status: "pago",
          data_pagamento: dataPagamento,
          forma_pagamento: metodoPagamento || null,
          valor_pago_real: valorNum,
          comprovante_url: comprovanteUrl || null,
          pago_por: pagoPor || null,
          atualizado_em: new Date().toISOString(),
        })
        .eq("despesa_id", conta.id);

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
        await (supabase.from("controle_bancario") as unknown as SupabaseQuery).insert([{
          data: dataPagamento,
          tipo_movimento: "saida",
          categoria_id: categoriaId,
          descricao: `${conta.categoria} - ${conta.fornecedor_nome}`,
          valor: valorNum,
          banco_pagamento: banco,
          status: "pago",
          fornecedores_favoritos_id: conta.fornecedor_favorito_id || null,
          client_id: conta.cliente_id || null,
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao registrar pagamento";
      toast.error(message);
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
              <p className="text-xs text-muted-foreground">
                Valor original: R$ {Number(String(conta.valor ?? 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold mb-1 block">Valor Pago *</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={valorPago}
                onChange={e => setValorPago(e.target.value)}
                placeholder="0,00"
              />
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
                  {contasBancarias.length === 0 && (
                    <SelectItem value="__none__" disabled>Nenhuma conta cadastrada</SelectItem>
                  )}
                  {contasBancarias.map((c) => (
                    <SelectItem key={c.id} value={c.banco || c.id}>
                      {c.banco}{c.numero_conta ? ` - ${c.numero_conta}` : ""}
                    </SelectItem>
                  ))}
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
              <label className="text-sm font-semibold mb-1 block">Pago por</label>
              <RegularSelect value={pagoPor} onValueChange={setPagoPor}>
                <SelectTrigger><SelectValue placeholder="Selecione o pagador..." /></SelectTrigger>
                <SelectContent>
                  {pagadoresOptions.length === 0 && (
                    <SelectItem value="__none__" disabled>Nenhum pagador disponível</SelectItem>
                  )}
                  {pagadoresOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
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
