import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AutocompleteOption {
  id: string;
  label: string;
}

interface AutocompleteInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: AutocompleteOption[];
  placeholder?: string;
  isLoading?: boolean;
  label?: string;
  className?: string;
  disabled?: boolean;
  onSelect?: (option: AutocompleteOption) => void;
}

export const AutocompleteInput = forwardRef<HTMLInputElement, AutocompleteInputProps>(({
  value,
  onChange,
  options,
  placeholder = 'Digite para buscar...',
  isLoading = false,
  label,
  className,
  disabled = false,
  onSelect,
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<AutocompleteOption[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtrar opções quando o valor muda
  useEffect(() => {
    if (!value.trim()) {
      setFilteredOptions(options);
      return;
    }

    const searchTerm = value.toLowerCase().trim();
    const filtered = options
      .map((opt) => {
        const label = opt.label.toLowerCase();
        let priority = 0;

        // Priorizar correspondências exatas no designativo
        const designativo = label.split(' - ')[0];
        if (designativo === searchTerm) {
          priority = 100;
        } else if (designativo.startsWith(searchTerm)) {
          priority = 50;
        } else if (label.includes(searchTerm)) {
          priority = 10;
        }

        return { opt, priority };
      })
      .filter((item) => item.priority > 0)
      .sort((a, b) => b.priority - a.priority)
      .map((item) => item.opt);

    setFilteredOptions(filtered);
  }, [value, options]);

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    setIsOpen(true);
  };

  const handleSelectOption = (option: AutocompleteOption) => {
    onChange(option.label);
    setIsOpen(false);
    if (onSelect) {
      onSelect(option);
    }
  };

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {label && <label className="text-xs font-black text-slate-500 uppercase mb-2 block">{label}</label>}

      <div className="relative">
        <Input
          ref={ref || inputRef}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className="pr-10 bg-slate-950 border-slate-800 text-white font-mono text-sm uppercase"
        />

        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            title="Limpar"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-sky-500 border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-slate-400">
              Carregando opções...
            </div>
          ) : filteredOptions.length > 0 ? (
            <div className="py-1">
              {filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelectOption(option)}
                  className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-sky-500/20 hover:text-sky-400 transition-colors font-mono uppercase"
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : value.trim() ? (
            <div className="p-4 text-sm text-slate-500">
              Nenhuma opção encontrada. Você pode usar o texto digitado "{value}"
            </div>
          ) : (
            <div className="p-4 text-sm text-slate-500">
              Digite para buscar entre as opções disponíveis
            </div>
          )}
        </div>
      )}
    </div>
  );
});

AutocompleteInput.displayName = 'AutocompleteInput';
