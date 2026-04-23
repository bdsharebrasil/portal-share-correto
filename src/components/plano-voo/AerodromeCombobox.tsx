import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Check, ChevronsUpDown, Search, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { Aerodromo } from '@/hooks/useAerodromes';

interface AerodromeComboboxProps {
  aerodromes: Aerodromo[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function AerodromeCombobox({
  aerodromes,
  value,
  onChange,
  placeholder = 'Selecione o aeródromo...',
  disabled = false,
  className,
}: AerodromeComboboxProps) {
  const [open, setOpen] = useState(false);

  const selectedAerodrome = useMemo(
    () => aerodromes.find((a) => a.designativo === value),
    [aerodromes, value]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between bg-background border-border text-foreground font-normal h-10',
            !value && 'text-muted-foreground',
            className
          )}
        >
          {selectedAerodrome ? (
            <span className="flex items-center gap-2 truncate">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="font-mono font-semibold">{selectedAerodrome.designativo}</span>
              <span className="text-muted-foreground truncate">- {selectedAerodrome.name}</span>
            </span>
          ) : (
            <span>{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar por ICAO ou nome..." />
          <CommandList>
            <CommandEmpty>Nenhum aeródromo encontrado.</CommandEmpty>
            <CommandGroup className="max-h-[280px] overflow-y-auto">
              {aerodromes.map((ad) => (
                <CommandItem
                  key={ad.id}
                  value={`${ad.designativo} ${ad.nome}`}
                  onSelect={() => {
                    onChange(ad.designativo === value ? '' : ad.designativo);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === ad.designativo ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="font-mono font-semibold mr-2">{ad.designativo}</span>
                  <span className="text-muted-foreground truncate">{ad.nome}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
