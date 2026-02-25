import React from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface BoletoCopiColaProps {
  codigoBarras: string;
}

export function BoletoCopiaCola({ codigoBarras }: BoletoCopiColaProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(codigoBarras);
      setCopied(true);
      toast.success("Código de barras copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  if (!codigoBarras) return null;

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 px-3 py-2 bg-muted/60 rounded-lg border border-border/50 hover:bg-muted transition-colors cursor-pointer w-full text-left"
      title="Clique para copiar"
    >
      <code className="text-xs font-mono text-foreground flex-1 truncate">
        {codigoBarras}
      </code>
      {copied ? (
        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
      ) : (
        <Copy className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      )}
    </button>
  );
}
