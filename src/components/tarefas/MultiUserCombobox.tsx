import React, { useState } from "react";
import { Check as CheckIcon, ChevronsUpDown, Search } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Combobox de múltipla seleção: busca por nome e marca vários usuários
 * com checkbox, sem fechar o popover a cada clique.
 */
export function MultiUserCombobox({
  items,
  value,
  onChange,
  placeholder = "Selecionar responsáveis...",
  searchPlaceholder = "Buscar usuário...",
  emptyMessage = "Nenhum usuário encontrado.",
}: {
  items: { id: string; label: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const filteredItems = items.filter((item) => item.label.toLowerCase().includes(searchValue.toLowerCase()));

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const selectedLabels = items.filter((item) => value.includes(item.id)).map((item) => item.label);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "campo-afundado h-10 w-full justify-between rounded-lg border-noite-600 bg-noite-900/60 px-3 font-normal text-noite-200 hover:bg-noite-800",
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            {selectedLabels.length === 0 ? (
              <span className="truncate text-noite-400">{placeholder}</span>
            ) : selectedLabels.length <= 2 ? (
              <span className="truncate text-sm">{selectedLabels.join(", ")}</span>
            ) : (
              <span className="truncate text-sm">
                {selectedLabels[0]} +{selectedLabels.length - 1}
              </span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[10000] w-[var(--radix-popover-trigger-width)] rounded-xl border-noite-600 bg-noite-850 p-0 shadow-lg"
        align="start"
        side="bottom"
      >
        <Command className="overflow-hidden rounded-xl bg-noite-850" shouldFilter={false}>
          <div className="flex items-center border-b border-noite-700 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-noite-400" />
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchValue}
              onValueChange={setSearchValue}
              className="flex h-11 w-full rounded-md border-0 bg-transparent py-3 text-sm text-noite-100 outline-none placeholder:text-noite-400 focus:ring-0"
            />
          </div>
          <CommandList className="max-h-[220px] overflow-y-auto p-1">
            {filteredItems.length === 0 && (
              <CommandEmpty className="py-6 text-center text-sm text-noite-400">{emptyMessage}</CommandEmpty>
            )}
            <CommandGroup>
              {filteredItems.map((item) => {
                const checked = value.includes(item.id);
                return (
                  <CommandItem
                    key={item.id}
                    value={item.label}
                    onSelect={() => toggle(item.id)}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-noite-200 transition-colors aria-selected:bg-azul-500/15"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                        checked ? "border-azul-500 bg-azul-500" : "border-noite-600",
                      )}
                    >
                      {checked && <CheckIcon className="h-3 w-3 text-white" />}
                    </span>
                    <span className={cn("truncate", checked ? "font-semibold text-noite-100" : "font-medium text-noite-300")}>
                      {item.label}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {selectedLabels.length > 0 && (
            <div className="flex items-center justify-between border-t border-noite-700 px-3 py-2">
              <span className="text-[11px] text-noite-400">{selectedLabels.length} selecionado(s)</span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[11px] text-noite-400 transition hover:text-noite-100"
              >
                Limpar
              </button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}