import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface ControlledSelectProps extends Omit<React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>, 'children'> {
  value: string | undefined | null
  onValueChange: (value: string) => void
  placeholder?: string
  children: React.ReactNode
  triggerClassName?: string
  contentClassName?: string
}

const ControlledSelect = React.forwardRef<HTMLButtonElement, ControlledSelectProps>(
  ({ value, onValueChange, placeholder, children, triggerClassName, contentClassName, ...props }, ref) => {
    const displayValue = value || placeholder || "Selecione..."
    
    return (
      <SelectPrimitive.Root
        value={value || ''}
        onValueChange={onValueChange}
        {...props}
      >
        <SelectPrimitive.Trigger
          ref={ref}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
            !value && "text-muted-foreground",
            triggerClassName
          )}
        >
          <span className="truncate">{displayValue}</span>
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-4 w-4 opacity-80" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className={cn(
              "relative z-[10000] max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
              contentClassName
            )}
            position="popper"
          >
            <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
              <ChevronDown className="h-4 w-4 rotate-180" />
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport className="p-1 h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]">
              {children}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
              <ChevronDown className="h-4 w-4" />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    )
  }
)
ControlledSelect.displayName = "ControlledSelect"

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm text-foreground outline-none hover:bg-muted focus:bg-muted focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectGroup = SelectPrimitive.Group
const SelectLabel = SelectPrimitive.Label
const SelectSeparator = SelectPrimitive.Separator

export {
  ControlledSelect,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
}
