import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { PhotoUploadSection } from './PhotoUploadSection';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import type { RAS } from '@/types/maintenance';

const rasFormSchema = z.object({
  serviceOrderNumber: z.string().min(1, 'Número de OS é obrigatório'),
  maintenanceCenter: z.string().min(1, 'Centro de manutenção é obrigatório'),
  maintenanceType: z.enum(['corretiva', 'preventiva', 'revisao']),
  responsibleMechanic: z.string().min(1, 'Mecânico responsável é obrigatório'),
  date: z.string().min(1, 'Data é obrigatória'),
  completionDate: z.string().optional(),
  description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
  inspectionDetails: z.string().min(10, 'Detalhes técnicos são obrigatórios'),
  status: z.enum(['pendente', 'em_andamento', 'concluido']),
  totalCost: z.string().regex(/^\d+(\.\d{2})?$/, 'Formato de valor inválido'),
  motorHours: z.string().optional(),
  observations: z.string().optional(),
});

type RASFormData = z.infer<typeof rasFormSchema>;

interface RASFormProps {
  aircraftId: string;
  onSuccess: (ras: RAS) => void;
  onCancel: () => void;
  existingRAS?: RAS;
}

export function RASForm({ aircraftId, onSuccess, onCancel, existingRAS }: RASFormProps) {
  const [photos, setPhotos] = useState<any[]>([]);
  const [costItems, setCostItems] = useState<any[]>([{ description: '', quantity: 1, unitValue: 0 }]);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<RASFormData>({
    resolver: zodResolver(rasFormSchema),
    defaultValues: existingRAS
      ? {
          serviceOrderNumber: existingRAS.serviceOrderNumber,
          maintenanceCenter: existingRAS.maintenanceCenter,
          maintenanceType: existingRAS.maintenanceType as any,
          responsibleMechanic: existingRAS.responsibleMechanic,
          date: existingRAS.date,
          completionDate: existingRAS.completionDate,
          description: existingRAS.description,
          inspectionDetails: existingRAS.inspectionDetails,
          status: existingRAS.status as any,
          totalCost: existingRAS.totalCost.toString(),
          motorHours: existingRAS.motorHours?.toString(),
          observations: existingRAS.observations,
        }
      : undefined,
  });

  const handleAddCostItem = () => {
    setCostItems([...costItems, { description: '', quantity: 1, unitValue: 0 }]);
  };

  const handleRemoveCostItem = (index: number) => {
    setCostItems(costItems.filter((_, i) => i !== index));
  };

  const handleCostItemChange = (index: number, field: string, value: any) => {
    const updated = [...costItems];
    updated[index] = { ...updated[index], [field]: value };
    setCostItems(updated);
  };

  const onSubmit = async (data: RASFormData) => {
    try {
      setSubmitting(true);

      // Upload photos to Supabase Storage
      const uploadedPhotos = [];
      for (const photo of photos) {
        if (photo.file) {
          const fileName = `ras/${aircraftId}/${Date.now()}_${photo.file.nome}`;
          const { error: uploadError } = await supabase.storage
            .from('maintenance-photos')
            .upload(fileName, photo.file);

          if (uploadError) throw uploadError;

          const { data: publicUrl } = supabase.storage
            .from('maintenance-photos')
            .getPublicUrl(fileName);

          uploadedPhotos.push({
            url: publicUrl.publicUrl,
            description: photo.description,
          });
        } else if (photo.url) {
          uploadedPhotos.push({
            url: photo.url,
            description: photo.description,
          });
        }
      }

      // Calculate total cost
      const totalCost = costItems.reduce((sum, item) => sum + (item.quantity * item.unitValue), 0);

      // Prepare RAS data
      const rasData = {
        aeronave_id: aircraftId,
        service_order_number: data.serviceOrderNumber,
        maintenance_center: data.maintenanceCenter,
        maintenance_type: data.maintenanceType,
        responsible_mechanic: data.responsibleMechanic,
        date: data.date,
        completion_date: data.completionDate || null,
        description: data.description,
        inspection_details: data.inspectionDetails,
        status: data.status,
        total_cost: parseFloat(data.totalCost),
        motor_hours: data.motorHours ? parseFloat(data.motorHours) : null,
        observations: data.observations || null,
        photos: uploadedPhotos,
        cost_items: costItems,
      };

      // Insert or update
      let rasId = existingRAS?.id;

      if (existingRAS) {
        const { error } = await supabase
          .from('ras')
          .update(rasData as any)
          .eq('id', rasId);

        if (error) throw error;
      } else {
        const { data: newRAS, error } = await (supabase as any)
          .from('ras')
          .insert([rasData as any])
          .select()
          .single();

        if (error) throw error;
        rasId = newRAS.id;
      }

      toast.success(existingRAS ? 'RAS atualizado com sucesso' : 'RAS criado com sucesso');
      reset();
      setPhotos([]);
      setCostItems([{ description: '', quantity: 1, unitValue: 0 }]);

      // Fetch the created/updated RAS
      const { data: savedRAS } = await (supabase as any)
        .from('ras')
        .select('*')
        .eq('id', rasId)
        .single();

      if (savedRAS) {
        onSuccess({
          id: savedRAS.id,
          aeronaveId: savedRAS.aeronave_id,
          serviceOrderNumber: savedRAS.service_order_number,
          maintenanceCenter: savedRAS.maintenance_center,
          maintenanceType: savedRAS.maintenance_type,
          responsibleMechanic: savedRAS.responsible_mechanic,
          date: savedRAS.date,
          completionDate: savedRAS.completion_date,
          description: savedRAS.description,
          inspectionDetails: savedRAS.inspection_details,
          status: savedRAS.status,
          totalCost: savedRAS.total_cost,
          photos: savedRAS.photos || [],
          costItems: savedRAS.cost_items || [],
          motorHours: savedRAS.motor_hours,
          observations: savedRAS.observations,
          createdAt: savedRAS.created_at,
          updatedAt: savedRAS.updated_at,
        });
      }
    } catch (error: any) {
      console.error('Error saving RAS:', error);
      toast.error('Erro ao salvar RAS: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informações Básicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número de OS</Label>
                <Input
                  placeholder="Ex: 71/2025"
                  {...register('serviceOrderNumber')}
                  className={errors.serviceOrderNumber ? 'border-red-500' : ''}
                />
                {errors.serviceOrderNumber && (
                  <p className="text-xs text-red-500">{errors.serviceOrderNumber.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Centro de Manutenção</Label>
                <Input
                  placeholder="Ex: Hangar União"
                  {...register('maintenanceCenter')}
                  className={errors.maintenanceCenter ? 'border-red-500' : ''}
                />
                {errors.maintenanceCenter && (
                  <p className="text-xs text-red-500">{errors.maintenanceCenter.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Tipo de Manutenção</Label>
                <select
                  {...register('maintenanceType')}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="corretiva">Corretiva</option>
                  <option value="preventiva">Preventiva</option>
                  <option value="revisao">Revisão</option>
                </select>
                {errors.maintenanceType && (
                  <p className="text-xs text-red-500">{errors.maintenanceType.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Mecânico Responsável</Label>
                <Input
                  placeholder="Nome do mecânico"
                  {...register('responsibleMechanic')}
                  className={errors.responsibleMechanic ? 'border-red-500' : ''}
                />
                {errors.responsibleMechanic && (
                  <p className="text-xs text-red-500">{errors.responsibleMechanic.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  {...register('date')}
                  className={errors.date ? 'border-red-500' : ''}
                />
                {errors.date && <p className="text-xs text-red-500">{errors.date.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Data de Conclusão (Opcional)</Label>
                <Input type="date" {...register('completionDate')} />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  {...register('status')}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="pendente">Pendente</option>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="concluido">Concluído</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Horas de Motor (Opcional)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Ex: 123.5"
                  {...register('motorHours')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inspection Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detalhes da Inspeção</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descreva os trabalhos realizados"
                className={errors.description ? 'border-red-500' : ''}
                {...register('description')}
                rows={4}
              />
              {errors.description && (
                <p className="text-xs text-red-500">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Detalhes Técnicos</Label>
              <Textarea
                placeholder="Informações técnicas detalhadas"
                className={errors.inspectionDetails ? 'border-red-500' : ''}
                {...register('inspectionDetails')}
                rows={4}
              />
              {errors.inspectionDetails && (
                <p className="text-xs text-red-500">{errors.inspectionDetails.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Observações (Opcional)</Label>
              <Textarea
                placeholder="Notas adicionais"
                {...register('observations')}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Cost Breakdown */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-lg">Breakdown de Custos</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddCostItem}
            >
              + Adicionar Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {costItems.map((item, index) => (
              <div key={index} className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label className="text-xs">Descrição</Label>
                  <Input
                    placeholder="Ex: Pneu principal"
                    value={item.description}
                    onChange={(e) => handleCostItemChange(index, 'description', e.target.value)}
                  />
                </div>
                <div className="w-20">
                  <Label className="text-xs">Qtd</Label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleCostItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="w-32">
                  <Label className="text-xs">Valor Unit.</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={item.unitValue}
                    onChange={(e) => handleCostItemChange(index, 'unitValue', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="w-24">
                  <Label className="text-xs">Subtotal</Label>
                  <Input
                    disabled
                    value={(item.quantity * item.unitValue).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  />
                </div>
                {costItems.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveCostItem(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}

            <div className="flex justify-end pt-4 border-t">
              <div className="text-right">
                <p className="text-sm text-muted-foreground mb-2">Total</p>
                <Input
                  type="text"
                  disabled
                  value={`R$ ${costItems
                    .reduce((sum, item) => sum + item.quantity * item.unitValue, 0)
                    .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  className="w-40 text-right font-bold"
                />
                <input
                  type="hidden"
                  {...register('totalCost')}
                  value={costItems.reduce((sum, item) => sum + item.quantity * item.unitValue, 0).toFixed(2)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Photos */}
        <PhotoUploadSection photos={photos} onPhotosChange={setPhotos} />

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting} className="gap-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {existingRAS ? 'Atualizar' : 'Criar'} RAS
          </Button>
        </div>
      </form>
    </div>
  );
}
