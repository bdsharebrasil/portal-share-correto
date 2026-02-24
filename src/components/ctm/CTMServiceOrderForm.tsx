import React, { useState, useEffect } from 'react';
import { CTMServiceOrder, CTMMaintenanceCategory } from '@/hooks/useCTMServiceOrders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';

interface CTMServiceOrderFormProps {
  order: CTMServiceOrder | null;
  categories: CTMMaintenanceCategory[];
  aircraftId: string;
  onSave: (data: Partial<CTMServiceOrder>) => Promise<void>;
  onCancel: () => void;
}

export function CTMServiceOrderForm({
  order,
  categories,
  aircraftId,
  onSave,
  onCancel,
}: CTMServiceOrderFormProps) {
  const [formData, setFormData] = useState<Partial<CTMServiceOrder>>({
    aircraft_id: aircraftId,
    numero: '',
    objetivo: '',
    status: 'pendente',
    estimated_hours: 0,
    total_mao_obra: 0,
    total_pecas: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (order) {
      setFormData({ ...order });
    }
  }, [order]);

  const handleChange = (field: keyof CTMServiceOrder, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.numero) {
      alert('Por favor, preencha o número da ordem');
      return;
    }
    setLoading(true);
    try {
      await onSave(formData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-2xl font-bold">
          {order ? 'Editar Ordem de Serviço' : 'Criar Ordem de Serviço'}
        </h2>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
            <CardDescription>
              Preencha os detalhes da ordem de serviço
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="numero">Número da Ordem*</Label>
                <Input
                  id="numero"
                  placeholder="Ex: OS-2024-001"
                  value={formData.numero || ''}
                  onChange={(e) => handleChange('numero', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="objetivo">Objetivo</Label>
                <Select
                  value={formData.objetivo || ''}
                  onValueChange={(value) => handleChange('objetivo', value)}
                >
                  <SelectTrigger id="objetivo">
                    <SelectValue placeholder="Selecione o objetivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CÉLULA">Célula</SelectItem>
                    <SelectItem value="MOTOR">Motor</SelectItem>
                    <SelectItem value="AVIONICS">Aviônicos</SelectItem>
                    <SelectItem value="ESTRUTURA">Estrutura</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo_manutencao">Tipo de Manutenção</Label>
                <Select
                  value={formData.tipo_manutencao || ''}
                  onValueChange={(value) => handleChange('tipo_manutencao', value as any)}
                >
                  <SelectTrigger id="tipo_manutencao">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PREVENTIVA">Preventiva</SelectItem>
                    <SelectItem value="CORRETIVA">Corretiva</SelectItem>
                    <SelectItem value="REVISÃO">Revisão</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status || 'pendente'}
                  onValueChange={(value) => handleChange('status', value as any)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assigned_to">Atribuído a</Label>
                <Input
                  id="assigned_to"
                  placeholder="Nome do responsável"
                  value={formData.assigned_to || ''}
                  onChange={(e) => handleChange('assigned_to', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="oficina_nome">Oficina</Label>
                <Input
                  id="oficina_nome"
                  placeholder="Nome da oficina"
                  value={formData.oficina_nome || ''}
                  onChange={(e) => handleChange('oficina_nome', e.target.value)}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                placeholder="Descrição detalhada da ordem de serviço"
                value={formData.observacoes || ''}
                onChange={(e) => handleChange('observacoes', e.target.value)}
                rows={4}
              />
            </div>

            {/* Dates and Costs */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="data_entrada">Data de Entrada</Label>
                <Input
                  id="data_entrada"
                  type="date"
                  value={
                    formData.data_entrada
                      ? new Date(formData.data_entrada).toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(e) => handleChange('data_entrada', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_saida">Data de Saída</Label>
                <Input
                  id="data_saida"
                  type="date"
                  value={
                    formData.data_saida
                      ? new Date(formData.data_saida).toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(e) => handleChange('data_saida', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimated_hours">Horas Estimadas</Label>
                <Input
                  id="estimated_hours"
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="0"
                  value={formData.estimated_hours || ''}
                  onChange={(e) => handleChange('estimated_hours', parseFloat(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="horas_celula">Horas Célula</Label>
                <Input
                  id="horas_celula"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="0"
                  value={formData.horas_celula || ''}
                  onChange={(e) => handleChange('horas_celula', parseFloat(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="total_mao_obra">Custo de Mão de Obra (R$)</Label>
                <Input
                  id="total_mao_obra"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.total_mao_obra || ''}
                  onChange={(e) => handleChange('total_mao_obra', parseFloat(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="total_pecas">Custo de Peças (R$)</Label>
                <Input
                  id="total_pecas"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.total_pecas || ''}
                  onChange={(e) => handleChange('total_pecas', parseFloat(e.target.value))}
                />
              </div>
            </div>

            {/* Total Cost Display */}
            {(formData.total_mao_obra || formData.total_pecas) && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Custo Total</p>
                <p className="text-2xl font-bold">
                  R$ {((formData.total_mao_obra || 0) + (formData.total_pecas || 0)).toFixed(2)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex gap-4 justify-end mt-6">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" className="gap-2" disabled={loading}>
            <Save className="w-4 h-4" />
            {loading ? 'Salvando...' : 'Salvar Ordem'}
          </Button>
        </div>
      </form>
    </div>
  );
}
