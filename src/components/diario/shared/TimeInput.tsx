import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isValidTimeFormat } from '@/utils/timeUtils';
import { cn } from '@/lib/utils';

interface TimeInputProps {
  /**
   * Label a exibir
   */
  label: string;
  /**
   * Valor atual em formato HH:MM
   */
  value: string;
  /**
   * Callback ao alterar valor
   */
  onChange: (value: string) => void;
  /**
   * Campo é obrigatório?
   */
  required?: boolean;
  /**
   * Desabilitar input
   */
  disabled?: boolean;
  /**
   * Exibir erro
   */
  error?: string;
  /**
   * Classe CSS customizada
   */
  className?: string;
  /**
   * Ícone adicional (opcional)
   */
  icon?: React.ReactNode;
  /**
   * Dica (placeholder)
   */
  placeholder?: string;
}

export const TimeInput: React.FC<TimeInputProps> = ({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  error,
  className,
  icon,
  placeholder = 'HH:MM',
}) => {
  const isInvalid = error || (value && !isValidTimeFormat(value));

  return (
    <div className={cn('space-y-2', className)}>
      <Label className={cn('flex items-center gap-2 text-xs uppercase text-slate-500', {
        'text-red-500': isInvalid,
      })}>
        {icon}
        <span>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </span>
      </Label>

      <Input
        type="time"
        step="60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'font-mono text-center',
          {
            'bg-red-50 border-red-300 focus:ring-red-500': isInvalid,
            'opacity-50 cursor-not-allowed': disabled,
          }
        )}
        aria-label={label}
        aria-invalid={!!isInvalid}
      />

      {error && (
        <p className="text-xs text-red-500 mt-1">
          ⚠️ {error}
        </p>
      )}
    </div>
  );
};

/**
 * Variante compacta para grids
 */
export const CompactTimeInput: React.FC<TimeInputProps> = (props) => {
  return <TimeInput {...props} className="space-y-1" />;
};

/**
 * Grupo de inputs de tempo para bloco (AC, COR, DEP, POU)
 */
interface TimeInputGroupProps {
  acTime: string;
  onAcTimeChange: (value: string) => void;
  corTime: string;
  onCorTimeChange: (value: string) => void;
  depTime: string;
  onDepTimeChange: (value: string) => void;
  pouTime: string;
  onPouTimeChange: (value: string) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}

export const TimeInputGroup: React.FC<TimeInputGroupProps> = ({
  acTime,
  onAcTimeChange,
  corTime,
  onCorTimeChange,
  depTime,
  onDepTimeChange,
  pouTime,
  onPouTimeChange,
  disabled = false,
  errors = {},
}) => {
  return (
    <div className="grid grid-cols-4 gap-2">
      <CompactTimeInput
        label="AC"
        value={acTime}
        onChange={onAcTimeChange}
        required
        disabled={disabled}
        error={errors['ac_time']}
      />
      <CompactTimeInput
        label="DEP"
        value={depTime}
        onChange={onDepTimeChange}
        required
        disabled={disabled}
        error={errors['dep_time']}
      />
      <CompactTimeInput
        label="POU"
        value={pouTime}
        onChange={onPouTimeChange}
        required
        disabled={disabled}
        error={errors['pou_time']}
      />
      <CompactTimeInput
        label="COR"
        value={corTime}
        onChange={onCorTimeChange}
        required
        disabled={disabled}
        error={errors['cor_time']}
      />
    </div>
  );
};
