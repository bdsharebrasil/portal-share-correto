import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-between bg-gray-700 border-gray-600 text-white hover:bg-gray-600",
            selectedValues.size > 0 && "border-blue-500"
          )}
        >
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm font-medium">{title}</span>
            {selectedValues.size > 0 && (
              <Badge variant="secondary" className="bg-blue-600 text-white ml-2">
                {selectedValues.size}
              </Badge>
            )}
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-gray-700 border-gray-600">
        <div className="p-3">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {options.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-4">
                Nenhuma opção disponível
              </div>
            ) : (
              options.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-600 transition-colors"
                >
                  <Checkbox
                    checked={selectedValues.has(option)}
                    onCheckedChange={() => onSelectionChange(option)}
                    className="h-5 w-5"
                  />
                  <span className="text-gray-200 text-sm flex-1">{option}</span>
                </label>
              ))
            )}
          </div>
          {selectedValues.size > 0 && (
            <div className="border-t border-gray-600 mt-3 pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onClear();
                }}
                className="w-full text-gray-300 hover:text-white hover:bg-gray-600 gap-2"
              >
                <X className="h-4 w-4" />
                Limpar
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
