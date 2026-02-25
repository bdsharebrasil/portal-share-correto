// components/EditFlightDialog.tsx
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FlightEntry } from '../types';
import { Edit, Loader2 } from 'lucide-react';

interface EditFlightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: FlightEntry | null;
  onSave: (updatedEntry: Partial<FlightEntry>) => Promise<void>;
  isSaving: boolean;
}

export function EditFlightDialog({
  open,
  onOpenChange,
  entry,
  onSave,
  isSaving,
}: EditFlightDialogProps) {
  const [formData, setFormData] = useState<Partial<FlightEntry>>({});

  useEffect(() => {
    if (entry) {
      setFormData({
        fuel_added: entry.fuel_added,
        passengers: entry.passengers,
        cargo_kg: entry.cargo_kg,
        occurrences: entry.occurrences,
        discrepancies: entry.discrepancies,
        remarks: entry.remarks,
      });
    }
  }, [entry]);

  const handleSave = async () => {
    await onSave(formData);
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Editar Registro de Voo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Informações não editáveis */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <p className="text-sm">
              <span className="font-semibold">Rota:</span>{' '}
              <span className="font-mono">{entry.departure_aerodrome} → {entry.arrival_aerodrome}</span>
            </p>
            <p className="text-sm">
              <span className="font-semibold">Data:</span>{' '}
              {new Date(entry.entry_date).toLocaleDateString('pt-BR')}
            </p>
            <p className="text-sm">
              <span className="font-semibold">PIC:</span> {entry.pic_canac}
            </p>
          </div>

          {/* Campos editáveis */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Combustível (L)</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.fuel_added ?? 0}
                onChange={(e) =>
                  setFormData({ ...formData, fuel_added: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Passageiros</Label>
              <Input
                type="number"
                value={formData.passengers ?? 0}
                onChange={(e) =>
                  setFormData({ ...formData, passengers: parseInt(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Carga (kg)</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.cargo_kg ?? 0}
                onChange={(e) =>
                  setFormData({ ...formData, cargo_kg: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ocorrências</Label>
            <Textarea
              value={formData.occurrences ?? ''}
              onChange={(e) => setFormData({ ...formData, occurrences: e.target.value })}
              rows={3}
              placeholder="Descreva ocorrências durante o voo..."
            />
          </div>

          <div className="space-y-2">
            <Label>Discrepâncias</Label>
            <Textarea
              value={formData.discrepancies ?? ''}
              onChange={(e) => setFormData({ ...formData, discrepancies: e.target.value })}
              rows={3}
              placeholder="Descreva discrepâncias da aeronave..."
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.remarks ?? ''}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              rows={3}
              placeholder="Observações gerais..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Alterações'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}