import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, X } from "lucide-react";

interface FilterComboboxProps {
  title: string;
  options: string[];
  selectedValues: Set<string>;
  onSelectionChange: (value: string) => void;
  onClear: () => void;
}

export function FilterCombobox({
  title,
  options,
  selectedValues,
  onSelectionChange,
  onClear,
}: FilterComboboxProps) {
  const [open, setOpen] = useState(false);

  const handleSelectAll = () => {
    if (selectedValues.size === options.length) {
      onClear();
    } else {
      options.forEach(option => {
        if (!selectedValues.has(option)) {
          onSelectionChange(option);
        }
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between bg-background/50 border-border/60 text-foreground hover:bg-muted/40 h-10"
        >
          <span className="text-xs font-medium truncate">
            {selectedValues.size === 0
              ? title
              : `${title} (${selectedValues.size})`}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-3 bg-card border-border/50 backdrop-blur-xl" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">{title}</p>
            {selectedValues.size > 0 && (
              <button
                onClick={onClear}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Limpar
              </button>
            )}
          </div>

          {options.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="w-full text-left px-2 py-1.5 rounded text-xs font-medium text-primary hover:bg-muted/30 transition-colors"
            >
              {selectedValues.size === options.length
                ? "Desselecionar Todas"
                : "Selecionar Todas"}
            </button>
          )}

          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {options.length > 0 ? (
              options.map(option => (
                <label
                  key={option}
                  className="flex items-center gap-3 cursor-pointer px-2 py-1.5 hover:bg-muted/20 rounded transition-colors"
                >
                  <Checkbox
                    checked={selectedValues.has(option)}
                    onCheckedChange={() => onSelectionChange(option)}
                    className="h-4 w-4"
                  />
                  <span className="text-xs text-foreground/80 truncate">{option}</span>
                </label>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nenhuma opção disponível
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
