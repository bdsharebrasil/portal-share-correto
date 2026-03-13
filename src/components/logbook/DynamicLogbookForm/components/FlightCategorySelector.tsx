import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Users } from 'lucide-react';
import type { FlightCategory } from '../types';

interface FlightCategorySelectorProps {
  value: FlightCategory;
  onChange: (category: FlightCategory) => void;
  onCategoryChange?: (category: FlightCategory) => void;
}

export function FlightCategorySelector({ value, onChange, onCategoryChange }: FlightCategorySelectorProps) {
  const handleChange = (category: FlightCategory) => {
    onChange(category);
    onCategoryChange?.(category);
  };

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
          onClick={() => handleChange('cliente')}
        >
          Cliente
        </Button>
        <Button
          type="button"
          variant={value === 'rateio' ? 'default' : 'outline'}
          className="flex-1 h-11 text-xs sm:text-sm"
          onClick={() => handleChange('rateio')}
        >
          Rateio
        </Button>
        <Button
          type="button"
          variant={value === 'emprestimo' ? 'default' : 'outline'}
          className="flex-1 h-11 text-xs sm:text-sm bg-amber-600/20 border-amber-500/30 hover:bg-amber-600/30"
          onClick={() => handleChange('emprestimo')}
        >
          Empréstimo
        </Button>
      </div>
    </div>
  );
}
