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
  allowFreeText?: boolean;
  className?: string;
  popoverClassName?: string;
}

export function SearchableCombobox({
  items,
  value,
  onChange,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum item encontrado.",
  icon,
  disabled,
  allowFreeText = false,
  className,
  popoverClassName,
}: SearchableComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  // Encontra o item selecionado
  const selectedItem = items.find((item) => item.id === value)

  // Filtra items baseado no searchValue
  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(searchValue.toLowerCase())
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between h-11 px-3 bg-background hover:bg-accent/50 transition-colors touch-manipulation",
            "border-border/60 shadow-sm rounded-lg lg:h-10",
            className,
            // Tipografia mais elegante dependendo do estado
            !value ? "text-muted-foreground font-normal" : "text-foreground font-medium"
          )}
        >
          <div className="flex items-center gap-2 truncate">
            {icon && <span className="flex-shrink-0 text-muted-foreground/70">{icon}</span>}
            <span className="truncate text-base tracking-tight lg:text-sm">
              {selectedItem ? selectedItem.label : (value ? value : placeholder)}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("z-[10000] max-h-[calc(100dvh-1rem)] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl border-border/50 bg-popover p-0 text-popover-foreground shadow-lg", popoverClassName)} align="start" side="bottom">
        <Command className="max-h-[calc(100dvh-1rem)] overflow-hidden rounded-xl bg-popover text-popover-foreground" shouldFilter={false}>
          <div className="flex items-center border-b border-border/50 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchValue}
              onValueChange={setSearchValue}
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0 focus:ring-0 lg:h-11 lg:text-sm"
            />
          </div>
          <CommandList className="max-h-[min(50dvh,320px)] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 lg:max-h-[min(220px,calc(100dvh-9rem))]">
            {filteredItems.length === 0 && !allowFreeText && (
              <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </CommandEmpty>
            )}
            {filteredItems.length === 0 && allowFreeText && searchValue.trim() && (
              <CommandEmpty className="py-2" />
            )}
            <CommandGroup>
              {filteredItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.label}
                  onSelect={() => {
                    onChange(item.id, item.label)
                    setSearchValue("")
                    setOpen(false)
                  }}
                  className="flex min-h-[2.75rem] items-center gap-2 px-3 py-2.5 text-sm rounded-lg cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary transition-colors touch-manipulation"
                >
                  <Check
                    className={cn(
                      "mr-1 h-4 w-4 shrink-0 transition-all",
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
              {allowFreeText && filteredItems.length === 0 && searchValue.trim() && (
                <CommandItem
                  value={searchValue}
                  onSelect={() => {
                    onChange(searchValue, searchValue)
                    setSearchValue("")
                    setOpen(false)
                  }}
                  className="flex min-h-[2.75rem] items-center gap-2 px-3 py-2.5 text-sm rounded-lg cursor-pointer bg-primary/5 text-primary hover:bg-primary/10 transition-colors touch-manipulation"
                >
                  <Check className="mr-1 h-4 w-4 shrink-0 opacity-0 scale-75" />
                  <span className="truncate font-medium">
                    ➕ Usar: <strong>{searchValue}</strong>
                  </span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
