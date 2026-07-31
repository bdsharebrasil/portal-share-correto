import { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EnviarEmailClienteDialog, type AnexoEmail } from "./EnviarEmailClienteDialog";

interface Props {
  clienteId?: string | null;
  assuntoSugerido?: string;
  mensagemSugerida?: string;
  anexos?: AnexoEmail[];
  tipo?: string;
  referenceType?: string;
  referenceIds?: string[];
  label?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
  disabled?: boolean;
  onEnviado?: () => void;
  /** Impede que o clique propague (útil dentro de listas clicáveis) */
  stopPropagation?: boolean;
}

/**
 * Botão manual de envio de e-mail ao cliente.
 * Nunca abre sozinho — o usuário precisa clicar para revisar/ajustar antes de enviar.
 */
export function EnviarEmailClienteButton({
  clienteId,
  assuntoSugerido = "",
  mensagemSugerida = "",
  anexos = [],
  tipo = "documento",
  referenceType = "documento",
  referenceIds = [],
  label = "Enviar por e-mail",
  size = "sm",
  variant = "outline",
  className = "",
  disabled = false,
  onEnviado,
  stopPropagation = false,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        className={`gap-2 ${className}`}
        title="Enviar por e-mail ao cliente"
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation();
          setOpen(true);
        }}
      >
        <Mail className="h-4 w-4" />
        {size !== "icon" && label}
      </Button>

      <EnviarEmailClienteDialog
        open={open}
        onOpenChange={setOpen}
        clienteId={clienteId}
        assuntoSugerido={assuntoSugerido}
        mensagemSugerida={mensagemSugerida}
        anexos={anexos}
        tipo={tipo}
        referenceType={referenceType}
        referenceIds={referenceIds}
        onEnviado={onEnviado}
      />
    </>
  );
}

export default EnviarEmailClienteButton;
