import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, User } from "lucide-react";
import { ClienteComSocios } from "@/hooks/useSocioBalanco";

interface SocioSelectorProps {
  clientes: ClienteComSocios[];
  clienteId: string;
  socioId: string | undefined;
  onClienteChange: (clienteId: string) => void;
  onSocioChange: (socioId: string | undefined) => void;
  isLoading?: boolean;
}

export function SocioSelector({
  clientes,
  clienteId,
  socioId,
  onClienteChange,
  onSocioChange,
  isLoading,
}: SocioSelectorProps) {
  // Encontrar cliente atual
  const clienteAtual = clientes.find((c) => c.id === clienteId);

  // Construir valor combinado para o select: "clienteId" ou "clienteId:socioId"
  const valorAtual = socioId ? `${clienteId}:${socioId}` : clienteId;

  const handleChange = (value: string) => {
    if (value.includes(":")) {
      // Sócio individual selecionado
      const [newClienteId, newSocioId] = value.split(":");
      if (newClienteId !== clienteId) {
        onClienteChange(newClienteId);
      }
      onSocioChange(newSocioId);
    } else {
      // Cliente completo selecionado (todos os sócios)
      onClienteChange(value);
      onSocioChange(undefined);
    }
  };

  return (
    <Select value={valorAtual} onValueChange={handleChange} disabled={isLoading}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Selecione cliente ou sócio">
          {clienteAtual && (
            <div className="flex items-center gap-2">
              {socioId ? (
                <>
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">
                    {clienteAtual.socios.find((s) => s.id === socioId)?.nome ||
                      "Sócio"}
                  </span>
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {clienteAtual.socios
                      .find((s) => s.id === socioId)
                      ?.percentual.toFixed(1)}
                    %
                  </Badge>
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">
                    {clienteAtual.company_name || clienteAtual.proprietario}
                  </span>
                  {clienteAtual.temMultiplosSocios && (
                    <Badge variant="outline" className="ml-1 text-xs">
                      {clienteAtual.socios.length} sócios
                    </Badge>
                  )}
                </>
              )}
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[400px]">
        {clientes.map((cliente) => (
          <React.Fragment key={cliente.id}>
            {/* Item do Cliente (consolidado) */}
            <SelectItem value={cliente.id} className="py-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-medium">
                  {cliente.company_name || cliente.proprietario}
                </span>
                {cliente.temMultiplosSocios && (
                  <Badge variant="outline" className="ml-1 text-xs">
                    Consolidado
                  </Badge>
                )}
              </div>
            </SelectItem>

            {/* Itens dos sócios individuais (com indentação) */}
            {cliente.temMultiplosSocios &&
              cliente.socios.map((socio) => (
                <SelectItem
                  key={socio.id}
                  value={`${cliente.id}:${socio.id}`}
                  className="py-2 pl-8"
                >
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{socio.nome}</span>
                    <Badge
                      variant="secondary"
                      className="ml-1 text-xs font-normal"
                    >
                      {socio.percentual.toFixed(1)}%
                    </Badge>
                    {socio.cpf && (
                      <span className="text-xs text-muted-foreground ml-1">
                        CPF: {socio.cpf.slice(-4).padStart(socio.cpf.length, "*")}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
          </React.Fragment>
        ))}
      </SelectContent>
    </Select>
  );
}
