import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, X } from 'lucide-react';

interface CrewMember {
  id: string;
  full_name: string;
  canac: string;
}

interface SICComboBoxManualProps {
  value?: string;           // sic_canac (UUID) or empty string
  sicName?: string;         // sic_name (manual text) or empty string
  crew: CrewMember[];
  onChange: (sicCanac: string | null, sicName?: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
}

export function SICComboBoxManual({
  value = '',
  sicName = '',
  crew,
  onChange,
  placeholder = "Selecione ou digite SIC...",
  disabled = false,
  label = "Copiloto (SIC)"
}: SICComboBoxManualProps) {
  // Normalizar valores para garantir que nunca sejam null/undefined
  const normalizedValue = value ?? '';
  const normalizedSicName = sicName ?? '';
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [manualMode, setManualMode] = useState(!!sicName && !value);
  const [manualInput, setManualInput] = useState(sicName ?? '');

  // Sincronizar estados com props quando mudam
  useEffect(() => {
    if (normalizedSicName && !normalizedValue) {
      setManualMode(true);
      setManualInput(normalizedSicName);
    } else {
      setManualMode(false);
      if (!normalizedValue && !normalizedSicName) {
        setManualInput('');
      }
    }
  }, [normalizedValue, normalizedSicName]);

  // Filtrar crew members baseado na busca
  const filteredCrew = useMemo(() => {
    if (!searchValue) return crew;
    return crew.filter(c =>
      c.full_name.toLowerCase().includes(searchValue.toLowerCase()) ||
      c.canac.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [crew, searchValue]);

  // Determinar o texto exibido no botão
  const displayText = useMemo(() => {
    if (manualMode && manualInput) {
      return manualInput;
    }
    if (normalizedValue) {
      const selected = crew.find(c => c.id === normalizedValue);
      return selected ? `${selected.full_name} (${selected.canac})` : placeholder;
    }
    return placeholder;
  }, [normalizedValue, manualMode, manualInput, crew, placeholder]);

  // Determinar o tipo de badge
  const badgeType = useMemo(() => {
    if (manualMode && manualInput) return 'manual';
    if (normalizedValue) return 'selected';
    return null;
  }, [normalizedValue, manualMode, manualInput]);

  const handleSelectCrew = (crewId: string) => {
    onChange(crewId, null);
    setManualMode(false);
    setManualInput('');
    setSearchValue('');
    setOpen(false);
  };

  const handleManualMode = () => {
    setManualMode(true);
    setSearchValue('');
  };

  const handleSaveManual = () => {
    if (manualInput.trim()) {
      onChange(null, manualInput.trim());
      setOpen(false);
    }
  };

  const handleClear = () => {
    onChange(null, null);
    setManualMode(false);
    setManualInput('');
    setSearchValue('');
  };

  const handleManualInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualInput(e.target.value);
  };

  return (
    <div className="space-y-2 w-full">
      {label && <Label className="text-[9px] uppercase text-slate-500 ml-1 block">{label}</Label>}
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            disabled={disabled}
            className={cn(
              "w-full justify-between h-10 bg-slate-950 border-slate-800 text-white hover:bg-slate-900",
              !displayText && "text-slate-400"
            )}
          >
            <div className="flex items-center gap-2 flex-1 truncate">
              <span className="truncate text-left">{displayText}</span>
              {badgeType === 'selected' && (
                <Badge variant="default" className="ml-auto flex-shrink-0 text-xs">
                  Crew
                </Badge>
              )}
              {badgeType === 'manual' && (
                <Badge variant="secondary" className="ml-auto flex-shrink-0 text-xs bg-orange-500/20 text-orange-400 border-orange-500/30">
                  Manual
                </Badge>
              )}
            </div>
            <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-slate-950 border-slate-800" align="start">
          {!manualMode ? (
            <Command className="bg-slate-950">
              <CommandInput
                placeholder="Buscar piloto por nome ou CANAC..."
                value={searchValue}
                onValueChange={setSearchValue}
                className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-500"
              />
              <CommandList>
                {filteredCrew.length === 0 && searchValue.length > 0 ? (
                  <CommandEmpty>
                    <div className="py-2 px-2 text-center">
                      <p className="text-sm text-slate-400 mb-2">Nenhum piloto encontrado</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleManualMode}
                        className="w-full h-8 text-xs border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                      >
                        + Adicionar manualmente
                      </Button>
                    </div>
                  </CommandEmpty>
                ) : (
                  <>
                    <CommandGroup>
                      <CommandItem
                        value="none"
                        onSelect={() => handleClear()}
                        className="cursor-pointer hover:bg-slate-800"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            !value && !manualInput ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <X className="mr-2 h-4 w-4 text-slate-500" />
                        <span className="text-slate-400">Nenhum SIC</span>
                      </CommandItem>
                    </CommandGroup>

                    {filteredCrew.length > 0 && (
                      <CommandGroup heading="Pilotos cadastrados">
                        {filteredCrew.map((crew_member) => (
                          <CommandItem
                            key={crew_member.id}
                            value={crew_member.full_name}
                            onSelect={() => handleSelectCrew(crew_member.id)}
                            className="cursor-pointer hover:bg-slate-800"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                value === crew_member.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span>{crew_member.full_name}</span>
                            <span className="ml-auto text-xs text-slate-500 font-mono">
                              {crew_member.canac}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}

                    {crew.length > 0 && (
                      <CommandGroup>
                        <CommandItem
                          value="manual"
                          onSelect={handleManualMode}
                          className="cursor-pointer hover:bg-slate-800 text-orange-400"
                        >
                          <span className="mr-2">+</span>
                          Adicionar manualmente (sem cadastro)
                        </CommandItem>
                      </CommandGroup>
                    )}
                  </>
                )}
              </CommandList>
            </Command>
          ) : (
            // Manual input mode - two separate fields
            <div className="p-3 space-y-3 bg-slate-950 border-slate-800">
              <div>
                <p className="text-xs font-semibold text-orange-400 mb-2">Preenchimento Manual</p>
                <p className="text-xs text-slate-500 mb-3">
                  Insira o nome e CANAC do copiloto (sem criar cadastro)
                </p>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-[8px] uppercase text-slate-500 font-bold">Nome Completo *</label>
                  <Input
                    placeholder="Ex: João Silva"
                    value={manualInput.split(' - ')[0] || ''}
                    onChange={(e) => {
                      const name = e.target.value;
                      const canac = manualInput.split(' - ')[1] || '';
                      setManualInput(canac ? `${name} - ${canac}` : name);
                    }}
                    className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 h-9 text-sm"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-[8px] uppercase text-slate-500 font-bold">CANAC *</label>
                  <Input
                    placeholder="Ex: ABC1234"
                    value={manualInput.split(' - ')[1] || ''}
                    onChange={(e) => {
                      const canac = e.target.value.toUpperCase();
                      const name = manualInput.split(' - ')[0] || '';
                      setManualInput(name ? `${name} - ${canac}` : canac);
                    }}
                    className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 h-9 text-sm uppercase"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManualMode(false)}
                  className="flex-1 h-8 text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveManual}
                  disabled={!manualInput.trim() || !manualInput.includes(' - ')}
                  className="flex-1 h-8 text-xs bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
                >
                  Confirmar
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <p className="text-xs text-slate-600 ml-1">
        {manualMode && manualInput
          ? "SIC será inserido manualmente (não vinculado a crew)"
          : normalizedValue
            ? "SIC vinculado ao cadastro de pilotos"
            : "Campo opcional - deixe em branco se não houver SIC"}
      </p>
    </div>
  );
}
