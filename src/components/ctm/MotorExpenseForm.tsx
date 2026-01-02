import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { MotorExpense } from '@/types/maintenance';

const motorExpenseSchema = z.object({
  motorSide: z.enum(['LH', 'RH', 'both']),
  type: z.enum(['overhaul', 'repair', 'maintenance', 'inspection']),
  description: z.string().min(5, 'Descrição é obrigatória'),
  motorHours: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Horas de motor deve ser um número'),
  cost: z.string().regex(/^\d+(\.\d{2})?$/, 'Custo deve ser um valor válido'),
  supplier: z.string().optional(),
  date: z.string().min(1, 'Data é obrigatória'),
  observations: z.string().optional(),
});

type MotorExpenseFormData = z.infer<typeof motorExpenseSchema>;

interface MotorExpenseFormProps {
  aircraftId: string;
  onSuccess: (expense: MotorExpense) => void;
  onCancel: () => void;
}

const typeLabels = {
  overhaul: 'Overhaul',
  repair: 'Reparo',
  maintenance: 'Manutenção',
  inspection: 'Inspeção',
};

const motorSideLabels = {
  LH: 'Motor Esquerdo (LH)',
  RH: 'Motor Direito (RH)',
  both: 'Ambos os Motores',
};

export function MotorExpenseForm({ aircraftId, onSuccess, onCancel }: MotorExpenseFormProps) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<MotorExpenseFormData>({
    resolver: zodResolver(motorExpenseSchema),
    defaultValues: {
      motorSide: 'LH',
      type: 'maintenance',
      date: new Date().toISOString().split('T')[0],
    },
  });

  const onSubmit = async (data: MotorExpenseFormData) => {
    try {
      setSubmitting(true);

      const motorExpenseData = {
        aircraft_id: aircraftId,
        motor_side: data.motorSide,
        type: data.type,
        description: data.description,
        motor_hours: parseFloat(data.motorHours),
        cost: parseFloat(data.cost),
        supplier: data.supplier || null,
        date: data.date,
        observations: data.observations || null,
      };

      const { data: newExpense, error } = await supabase
        .from('motor_expenses')
        .insert([motorExpenseData])
        .select()
        .single();

      if (error) throw error;

      toast.success('Gasto de motor registrado com sucesso');
      reset();

      onSuccess({
        id: newExpense.id,
        aircraftId: newExpense.aircraft_id,
        motorSide: newExpense.motor_side,
        type: newExpense.type,
        description: newExpense.description,
        motorHours: newExpense.motor_hours,
        cost: newExpense.cost,
        supplier: newExpense.supplier,
        date: newExpense.date,
        observations: newExpense.observations,
        createdAt: newExpense.created_at,
      });
    } catch (error: any) {
      toast.error('Erro ao registrar gasto: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Novo Gasto de Motor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Motor</Label>
              <select
                {...register('motorSide')}
                className="w-full px-3 py-2 border rounded-md"
              >
                {Object.entries(motorSideLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Despesa</Label>
              <select
                {...register('type')}
                className="w-full px-3 py-2 border rounded-md"
              >
                {Object.entries(typeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
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
              <Label>Horas de Motor</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="Ex: 123.5"
                {...register('motorHours')}
                className={errors.motorHours ? 'border-red-500' : ''}
              />
              {errors.motorHours && (
                <p className="text-xs text-red-500">{errors.motorHours.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Custo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Ex: 5000.00"
                {...register('cost')}
                className={errors.cost ? 'border-red-500' : ''}
              />
              {errors.cost && <p className="text-xs text-red-500">{errors.cost.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Fornecedor (Opcional)</Label>
              <Input
                placeholder="Ex: Empresa XYZ"
                {...register('supplier')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              placeholder="Descreva o trabalho realizado"
              {...register('description')}
              className={errors.description ? 'border-red-500' : ''}
              rows={3}
            />
            {errors.description && (
              <p className="text-xs text-red-500">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Observações (Opcional)</Label>
            <Textarea
              placeholder="Notas adicionais"
              {...register('observations')}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting} className="gap-2">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Registrar Gasto
        </Button>
      </div>
    </form>
  );
}
