import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxItem {
  id: string;
  label: string;
}

interface SearchableComboboxProps {
  items: ComboboxItem[];
  value: string;
  onChange: (value: string, label: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export function SearchableCombobox({
  items,
  value,
  onChange,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum item encontrado.",
  icon,
  disabled
}: SearchableComboboxProps) {
  const [open, setOpen] = React.useState(false)

  // Encontra o item selecionado
  const selectedItem = items.find((item) => item.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between h-10 px-3 bg-background hover:bg-accent/50 transition-colors",
            "border-border/60 shadow-sm rounded-lg",
            // Tipografia mais elegante dependendo do estado
            !value ? "text-muted-foreground font-normal" : "text-foreground font-medium"
          )}
        >
          <div className="flex items-center gap-2 truncate">
            {icon && <span className="flex-shrink-0 text-muted-foreground/70">{icon}</span>}
            <span className="truncate text-sm tracking-tight">
              {selectedItem ? selectedItem.label : placeholder}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] sm:w-[400px] p-0 rounded-xl shadow-lg border-border/50" align="start">
        <Command className="overflow-hidden rounded-xl">
          <div className="flex items-center border-b border-border/50 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput 
              placeholder={searchPlaceholder} 
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0 focus:ring-0" 
            />
          </div>
          <CommandList className="max-h-[220px] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-muted-foreground/20">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.label} // O buscador olha para essa string
                  onSelect={() => {
                    onChange(item.id, item.label)
                    setOpen(false)
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary transition-colors"
                >
                  <Check
                    className={cn(
                      "mr-1 h-4 w-4 transition-all",
                      value === item.id ? "opacity-100 text-primary scale-100" : "opacity-0 scale-75"
                    )}
                  />
                  <span className={cn(
                    "truncate",
                    value === item.id ? "font-semibold" : "font-medium text-foreground/80"
                  )}>
                    {item.label}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
