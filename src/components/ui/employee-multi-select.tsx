import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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

export interface EmployeeOption {
  id: string
  label: string
}

interface EmployeeMultiSelectProps {
  options: EmployeeOption[]
  value?: string[]
  onValueChange: (value: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
  maxSelected?: number
}

export function EmployeeMultiSelect({
  options,
  value = [],
  onValueChange,
  placeholder = "Selecione um colaborador...",
  searchPlaceholder = "Pesquisar colaborador...",
  emptyText = "Nenhum resultado encontrado.",
  className,
  disabled = false,
  maxSelected,
}: EmployeeMultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  const selectedOptions = options.filter((option) => value.includes(option.id))
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchValue.toLowerCase())
  )

  const toggleOption = (optionId: string) => {
    const newValue = value.includes(optionId)
      ? value.filter((id) => id !== optionId)
      : [...value, optionId]
    
    if (maxSelected && newValue.length > maxSelected && !value.includes(optionId)) {
      return
    }
    
    onValueChange(newValue)
  }

  const removeOption = (optionId: string) => {
    onValueChange(value.filter((id) => id !== optionId))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-auto min-h-[44px] py-2",
            className
          )}
          disabled={disabled}
        >
          <div className="flex flex-wrap gap-2 flex-1 text-left">
            {selectedOptions.length > 0 ? (
              selectedOptions.map((option) => (
                <div
                  key={option.id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-sm"
                >
                  <Check className="h-3 w-3" />
                  {option.label}
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      removeOption(option.id)
                    }}
                    className="ml-1 cursor-pointer hover:bg-primary/20 rounded p-0.5"
                    role="button"
                    tabIndex={0}
                  >
                    <X className="h-3 w-3" />
                  </div>
                </div>
              ))
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  onSelect={() => toggleOption(option.id)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={value.includes(option.id)}
                    onCheckedChange={() => toggleOption(option.id)}
                    className="h-4 w-4"
                  />
                  <span className="flex-1">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
