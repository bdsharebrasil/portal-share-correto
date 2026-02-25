import * as React from "react"
import { Check, ChevronsUpDown, Building2, Search } from "lucide-react"
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

interface Client {
  id: string;
  name: string; // ou company_name, dependendo de como vem do seu banco
}

interface ClientComboboxProps {
  clients: Client[];
  value: string;
  onChange: (value: string, clientName: string) => void;
  disabled?: boolean;
}

export function ClientCombobox({ clients, value, onChange, disabled }: ClientComboboxProps) {
  const [open, setOpen] = React.useState(false)

  // Encontra o cliente selecionado para mostrar no botão
  const selectedClient = clients.find((client) => client.id === value)

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
            // Ajuste de tipografia: Fonte mais limpa, peso médio se tiver selecionado
            !value ? "text-muted-foreground font-normal" : "text-foreground font-medium"
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground/70" />
            <span className="truncate text-sm tracking-tight">
              {selectedClient ? selectedClient.name : "Selecione um cliente..."}
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
              placeholder="Buscar cliente pelo nome..." 
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0 focus:ring-0" 
            />
          </div>
          <CommandList className="max-h-[220px] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-muted-foreground/20">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado.
            </CommandEmpty>
            <CommandGroup>
              {clients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={client.name} // O Command usa o value internamente para a busca (texto)
                  onSelect={() => {
                    onChange(client.id, client.name)
                    setOpen(false)
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary transition-colors"
                >
                  <Check
                    className={cn(
                      "mr-1 h-4 w-4 transition-all",
                      value === client.id ? "opacity-100 text-primary scale-100" : "opacity-0 scale-75"
                    )}
                  />
                  <span className={cn(
                    "truncate",
                    value === client.id ? "font-semibold" : "font-medium text-foreground/80"
                  )}>
                    {client.name}
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
