import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, Loader2 } from 'lucide-react';

interface MarcarPagoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: 'despesa_direta' | 'reembolso' | 'combustivel';
  itemId: string;
  onSuccess: () => void;
}

const FORMAS_PAGAMENTO = [
  { value: 'pix', label: 'PIX' },
  { value: 'transferencia', label: 'Transferência Bancária' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'cartao_debito', label: 'Cartão de Débito' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cheque', label: 'Cheque' },
];

export function MarcarPagoDialog({ open, onOpenChange, tipo, itemId, onSuccess }: MarcarPagoDialogProps) {
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);
  const [formaPagamento, setFormaPagamento] = useState('pix');
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setComprovanteFile(e.target.files[0]);
    }
  };

  const uploadComprovante = async (file: File): Promise<string | null> => {
    const timestamp = Date.now();
    const sanitizedFileName = file.name
      .replace(/[^a-zA-Z0-9.\-_]/g, "_")
      .substring(0, 100);
    const fileExt = sanitizedFileName.split(".").pop();
    const fileName = `comprovantes/${itemId}/${timestamp}.${fileExt}`;
    const { error } = await supabase.storage
      .from('client-documents')
      .upload(fileName, file);

    if (error) {
      console.error('Erro ao fazer upload:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('client-documents')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      let comprovanteUrl: string | null = null;
      
      if (comprovanteFile) {
        comprovanteUrl = await uploadComprovante(comprovanteFile);
      }

      if (tipo === 'despesa_direta') {
        const { error } = await supabase
          .from('despesas_cliente_direto')
          .update({
            status: 'pagamento_validado',
            data_pagamento: dataPagamento,
            forma_pagamento: formaPagamento,
            comprovante_pagamento_url: comprovanteUrl,
            atualizado_em: new Date().toISOString()
          })
          .eq('id', itemId);
        if (error) throw error;
      } else if (tipo === 'reembolso') {
        const { error } = await supabase
          .from('conciliacoes_bancarias')
          .update({
            status: 'reembolsado',
            data_reembolso: dataPagamento,
            forma_pagamento: formaPagamento,
            comprovante_url: comprovanteUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', itemId);
        if (error) throw error;
      } else if (tipo === 'combustivel') {
        const { error } = await supabase
          .from('abastecimentos')
          .update({
            status_pagamento: 'pago',
            updated_at: new Date().toISOString()
          })
          .eq('id', itemId);
        if (error) throw error;
      }

      toast.success('Pagamento registrado com sucesso');
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Erro ao registrar pagamento:', error);
      toast.error('Erro ao registrar pagamento');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setDataPagamento(new Date().toISOString().split('T')[0]);
    setFormaPagamento('pix');
    setComprovanteFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
          <DialogDescription>
            Preencha os dados do pagamento para confirmar
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="dataPagamento">Data do Pagamento</Label>
            <Input
              id="dataPagamento"
              type="data"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="formaPagamento">Forma de Pagamento</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO.map((forma) => (
                  <SelectItem key={forma.value} value={forma.value}>
                    {forma.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="comprovante">Comprovante de Pagamento</Label>
            <div className="flex items-center gap-2">
              <Input
                id="comprovante"
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="flex-1"
              />
            </div>
            {comprovanteFile && (
              <p className="text-xs text-muted-foreground">
                Arquivo: {comprovanteFile.name}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Confirmar Pagamento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
