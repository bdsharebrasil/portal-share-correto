import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AutocompleteOption {
  id: string;
  label: string;
}

interface AutocompleteInputProps {
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

export function AutocompleteInput({
  value,
  onChange,
  options,
  placeholder = 'Digite para buscar...',
  isLoading = false,
  label,
  className,
  disabled = false,
  onSelect,
}: AutocompleteInputProps) {
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

    const searchTerm = value.toLowerCase();
    const filtered = options.filter((opt) =>
      opt.label.toLowerCase().includes(searchTerm)
    );
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
      {label && <label className="text-sm font-medium mb-1 block">{label}</label>}
      
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className="pr-10"
        />

        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            title="Limpar"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-input rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Carregando opções...
            </div>
          ) : filteredOptions.length > 0 ? (
            <div className="py-1">
              {filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelectOption(option)}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-accent transition-colors"
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : value.trim() ? (
            <div className="p-4 text-sm text-muted-foreground">
              Nenhuma opção encontrada. Você pode usar o texto digitado "{value}"
            </div>
          ) : (
            <div className="p-4 text-sm text-muted-foreground">
              Digite para buscar entre as opções disponíveis
            </div>
          )}
        </div>
      )}
    </div>
  );
}
