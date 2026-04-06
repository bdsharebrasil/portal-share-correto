import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCTMServiceOrders, CTMServiceOrder } from '@/hooks/useCTMServiceOrders';
import { useCTMBudgetTracking } from '@/hooks/useCTMBudgetTracking';

interface CTMBudgetFromOASProps {
  oasId: string;
  onClose: () => void;
  onSuccess?: (budgetId: string) => void;
}

export function CTMBudgetFromOAS({ oasId, onClose, onSuccess }: CTMBudgetFromOASProps) {
  const { generateBudgetFromOAS } = useCTMServiceOrders();
  const { createBudgetVersion } = useCTMBudgetTracking();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [oasData, setOasData] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    observacoes: '',
  });

  useEffect(() => {
    loadOASData();
  }, [oasId]);

  const loadOASData = async () => {
    try {
      setLoading(true);

      // Get OAS data
      const { data: oas, error: oasError } = await (supabase as any)
        .from('service_orders')
        .select('*')
        .eq('id', oasId)
        .single();

      if (oasError) throw oasError;
      setOasData(oas);

      // Get services
      const { data: svcData, error: svcError } = await (supabase as any)
        .from('ctm_services')
        .select('*')
        .eq('service_order_id', oasId);

      if (svcError) throw svcError;
      setServices(svcData || []);

      // Get parts
      const { data: partData, error: partError } = await (supabase as any)
        .from('ctm_parts')
        .select('*')
        .eq('service_order_id', oasId);

      if (partError) throw partError;
      setParts(partData || []);

      // Pre-fill form
      setFormData({
        titulo: `Orçamento - OAS ${oas.numero}`,
        descricao: oas.objetivo || oas.observacoes || `Orçamento derivado da ordem de serviço ${oas.numero}`,
        observacoes: '',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar dados';
      console.error('Error loading OAS data:', errorMessage);
      toast.error('Erro ao carregar dados da OAS');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Generate budget from OAS
      const newBudget = await generateBudgetFromOAS(oasId);

      if (!newBudget) {
        throw new Error('Falha ao gerar orçamento');
      }

      // Update budget with form data
      const { error: updateError } = await (supabase as any)
        .from('ctm_budgets')
        .update({
          description: formData.titulo + ' - ' + (formData.descricao || ''),
          notes: formData.observacoes,
        })
        .eq('id', newBudget.id);

      if (updateError) throw updateError;

      // Create initial version record
      await createBudgetVersion(newBudget.id, {
        titulo: formData.titulo,
        descricao: formData.descricao,
        total_estimado: oasData?.total_geral || 0,
        status: 'draft',
      });

      toast.success('Orçamento gerado com sucesso a partir da OAS!');
      onSuccess?.(newBudget.id);
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Error creating budget:', errorMessage);
      toast.error('Erro ao gerar orçamento');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={true} onOpenChange={() => !submitting && onClose()}>
        <DialogContent className="bg-slate-900 border-white/10 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerando Orçamento da OAS</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="relative h-8 w-8">
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={() => !submitting && onClose()}>
      <DialogContent className="bg-slate-900 border-white/10 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-cyan-400" />
            Gerar Orçamento a partir da OAS
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Info Card */}
          <Card className="bg-cyan-500/10 border-cyan-500/20">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-cyan-200">
                  <p className="font-semibold mb-1">Dados extraídos da OAS</p>
                  <ul className="text-xs space-y-1 text-cyan-100/80">
                    <li>✓ Total Estimado: R$ {(oasData?.total_geral || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</li>
                    <li>✓ Serviços: {services.length} item(ns)</li>
                    <li>✓ Peças: {parts.length} item(ns)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* OAS Summary */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white">Resumo da OAS</h3>
            <div className="grid grid-cols-2 gap-3 bg-slate-800/30 border border-white/5 rounded-lg p-4">
              <div>
                <p className="text-xs text-slate-400">Número</p>
                <p className="font-mono text-sm font-semibold text-cyan-300">{oasData?.numero}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Tipo Manutenção</p>
                <p className="text-sm font-semibold text-white">{oasData?.tipo_manutencao}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Objetivo</p>
                <p className="text-sm text-slate-300">{oasData?.objetivo || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Status</p>
                <Badge variant="outline" className="text-xs">{oasData?.situacao}</Badge>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="titulo" className="text-xs text-slate-300">
                Título do Orçamento
              </Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                className="mt-1 bg-slate-800/50 border-white/10 text-white"
                required
              />
            </div>

            <div>
              <Label htmlFor="descricao" className="text-xs text-slate-300">
                Descrição
              </Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                className="mt-1 bg-slate-800/50 border-white/10 text-white min-h-24"
              />
            </div>

            <div>
              <Label htmlFor="observacoes" className="text-xs text-slate-300">
                Observações (Opcional)
              </Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                className="mt-1 bg-slate-800/50 border-white/10 text-white min-h-20"
              />
            </div>
          </div>

          {/* Footer */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-cyan-600 hover:bg-cyan-700 gap-2"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Gerar Orçamento
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
