import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Users } from 'lucide-react';
import { FlightCategory } from '../types';

interface FlightCategorySelectorProps {
  value: FlightCategory;
  onChange: (category: FlightCategory) => void;
  disabled?: boolean;
}

export function FlightCategorySelector({
  value,
  onChange,
  disabled = false
}: FlightCategorySelectorProps) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        Responsável pelos Custos
      </Label>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={value === 'cliente' ? 'default' : 'outline'}
          className="flex-1 h-11 text-xs sm:text-sm"
          onClick={() => onChange('cliente')}
          disabled={disabled}
        >
          Cliente
        </Button>
        <Button
          type="button"
          variant={value === 'rateio' ? 'default' : 'outline'}
          className="flex-1 h-11 text-xs sm:text-sm"
          onClick={() => onChange('rateio')}
          disabled={disabled}
        >
          Rateio
        </Button>
        <Button
          type="button"
          variant={value === 'emprestimo' ? 'default' : 'outline'}
          className="flex-1 h-11 text-xs sm:text-sm bg-amber-600/20 border-amber-500/30 hover:bg-amber-600/30"
          onClick={() => onChange('emprestimo')}
          disabled={disabled}
        >
          Empréstimo
        </Button>
      </div>
    </div>
  );
}
