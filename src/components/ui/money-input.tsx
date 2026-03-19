import * as React from "react";
import { cn } from "@/lib/utils";

interface MoneyInputProps extends Omit<React.ComponentProps<"input">, "type"> {
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (value: string) => void;
}

const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, onChange, onValueChange, value, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState<string>(
      formatDisplayValue(String(value || ""))
    );

    // Quando o valor de fora muda, atualiza o display
    React.useEffect(() => {
      setDisplayValue(formatDisplayValue(String(value || "")));
    }, [value]);

    function formatDisplayValue(val: string): string {
      if (!val) return "";
      // Remove qualquer caractere que não seja número ou ponto/vírgula
      const cleaned = val.replace(/[^\d,.-]/g, "");
      return cleaned;
    }

    function parseMoneyValue(displayVal: string): string {
      if (!displayVal) return "";
      // Remove espaços
      let cleaned = displayVal.trim();
      // Substitui vírgula por ponto para armazenamento
      cleaned = cleaned.replace(",", ".");
      // Remove múltiplos pontos, mantém apenas o último
      const parts = cleaned.split(".");
      if (parts.length > 2) {
        cleaned = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
      }
      return cleaned;
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let inputValue = e.target.value;

      // Permite apenas dígitos, vírgula e ponto
      inputValue = inputValue.replace(/[^\d,.-]/g, "");

      setDisplayValue(inputValue);

      // Converte para formato padrão (ponto) para armazenamento
      const numericValue = parseMoneyValue(inputValue);

      // Cria um evento sintético com o valor convertido para o onChange
      if (onChange) {
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: numericValue,
          },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }

      // Também dispara callback separado se fornecido
      if (onValueChange) {
        onValueChange(numericValue);
      }
    };

    return (
      <input
        type="text"
        inputMode="decimal"
        className={cn(
          "flex w-full rounded-md border border-input bg-background text-foreground px-3 py-2 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-smooth",
          className
        )}
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        placeholder="0,00"
        {...props}
      />
    );
  }
);

MoneyInput.displayName = "MoneyInput";

export { MoneyInput };
