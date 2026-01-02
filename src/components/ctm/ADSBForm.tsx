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
import type { AirworthinessDirective, ServiceBulletin } from '@/types/maintenance';

const adsbSchema = z.object({
  number: z.string().min(1, 'Número é obrigatório'),
  title: z.string().min(5, 'Título é obrigatório'),
  issueDate: z.string().min(1, 'Data de emissão é obrigatória'),
  dueDate: z.string().optional(),
  description: z.string().min(10, 'Descrição é obrigatória'),
  status: z.enum(['pendente', 'em_progresso', 'concluido']),
  completionDate: z.string().optional(),
  observations: z.string().optional(),
});

type ADSBFormData = z.infer<typeof adsbSchema>;

interface ADSBFormProps {
  aircraftId: string;
  type: 'ad' | 'sb';
  onSuccess: (item: AirworthinessDirective | ServiceBulletin) => void;
  onCancel: () => void;
}

export function ADSBForm({ aircraftId, type, onSuccess, onCancel }: ADSBFormProps) {
  const [submitting, setSubmitting] = useState(false);

  const isAD = type === 'ad';
  const tableName = isAD ? 'airworthiness_directives' : 'service_bulletins';
  const fieldPrefix = isAD ? 'ad' : 'sb';
  const title = isAD ? 'Airworthiness Directive' : 'Service Bulletin';
  const numberLabel = isAD ? 'Número AD' : 'Número SB';

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ADSBFormData>({
    resolver: zodSchema,
    defaultValues: {
      issueDate: new Date().toISOString().split('T')[0],
      status: 'pendente',
    },
  });

  const onSubmit = async (data: ADSBFormData) => {
    try {
      setSubmitting(true);

      const insertData = {
        aircraft_id: aircraftId,
        [`${fieldPrefix}_number`]: data.number,
        title: data.title,
        issue_date: data.issueDate,
        due_date: data.dueDate || null,
        description: data.description,
        status: data.status,
        completion_date: data.completionDate || null,
        observations: data.observations || null,
      };

      const { data: newItem, error } = await supabase
        .from(tableName)
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;

      toast.success(`${title} registrado com sucesso`);
      reset();

      if (isAD) {
        onSuccess({
          id: newItem.id,
          aircraftId: newItem.aircraft_id,
          adNumber: newItem.ad_number,
          title: newItem.title,
          issueDate: newItem.issue_date,
          effectiveDate: newItem.issue_date,
          dueDate: newItem.due_date,
          description: newItem.description,
          status: newItem.status,
          completionDate: newItem.completion_date,
          observations: newItem.observations,
          createdAt: newItem.created_at,
        } as AirworthinessDirective);
      } else {
        onSuccess({
          id: newItem.id,
          aircraftId: newItem.aircraft_id,
          sbNumber: newItem.sb_number,
          title: newItem.title,
          issueDate: newItem.issue_date,
          dueDate: newItem.due_date,
          description: newItem.description,
          status: newItem.status,
          completionDate: newItem.completion_date,
          observations: newItem.observations,
          createdAt: newItem.created_at,
        } as ServiceBulletin);
      }
    } catch (error: any) {
      toast.error(`Erro ao registrar ${title}: ` + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{numberLabel}</Label>
              <Input
                placeholder={isAD ? "Ex: AD-2025-001" : "Ex: SB-2025-001"}
                {...register('number')}
                className={errors.number ? 'border-red-500' : ''}
              />
              {errors.number && (
                <p className="text-xs text-red-500">{errors.number.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <select
                {...register('status')}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="pendente">Pendente</option>
                <option value="em_progresso">Em Progresso</option>
                <option value="concluido">Concluído</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Data de Emissão</Label>
              <Input
                type="date"
                {...register('issueDate')}
                className={errors.issueDate ? 'border-red-500' : ''}
              />
              {errors.issueDate && (
                <p className="text-xs text-red-500">{errors.issueDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Data de Vencimento (Opcional)</Label>
              <Input type="date" {...register('dueDate')} />
            </div>

            {errors.status?.message && (
              <p className="text-xs text-red-500">{errors.status.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              placeholder="Título ou resumo"
              {...register('title')}
              className={errors.title ? 'border-red-500' : ''}
            />
            {errors.title && (
              <p className="text-xs text-red-500">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              placeholder="Descrição detalhada"
              {...register('description')}
              className={errors.description ? 'border-red-500' : ''}
              rows={4}
            />
            {errors.description && (
              <p className="text-xs text-red-500">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Data de Conclusão (se concluído)</Label>
            <Input type="date" {...register('completionDate')} />
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
          Registrar {title}
        </Button>
      </div>
    </form>
  );
}

const zodSchema = zodResolver(adsbSchema);
