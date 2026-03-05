import React from "react";
import { FileText, ExternalLink, Plane, Building2 } from "lucide-react";
import { BoletoCopiaCola } from "./BoletoCopiaCola";
import { format } from "date-fns";

interface Props {
  conta: any;
}

export function ContaPagarExpandedDetails({ conta }: Props) {
  const parseLocalDate = (dateString: string): Date | null => {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  return (
    <div className="px-6 py-5 bg-muted/30 border-t border-border/50 space-y-4 animate-in fade-in slide-in-from-top-1">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Bloco: Identificação */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Documento Interno</p>
          <p className="text-sm font-medium">{conta.numero_doc || "Não informado"}</p>
          {conta.banco && <p className="text-xs text-muted-foreground">Banco: {conta.banco}</p>}
        </div>

        {/* Bloco: Aeronave e Cliente */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Vínculo</p>
          <div className="flex items-center gap-1.5 text-sm">
            <Plane className="h-3.5 w-3.5 text-primary" />
            <span>{conta.aeronave_registro || "Geral / Sem prefixo"}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            <span className="truncate">{conta.clients?.company_name || "Administrativo"}</span>
          </div>
        </div>

        {/* Bloco: Dados DECEA */}
        {conta.numero_documento_decea && (
          <div className="space-y-1 border-l pl-4 border-amber-500/20">
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-tight">Dados DECEA</p>
            <p className="text-xs">Doc: {conta.numero_documento_decea}</p>
            <p className="text-xs text-muted-foreground">Comp: {conta.competencia_decea || "-"}</p>
          </div>
        )}

        {/* Bloco: Dados Infraero */}
        {conta.numero_documento_infraero && (
          <div className="space-y-1 border-l pl-4 border-blue-500/20">
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tight">Dados Infraero</p>
            <p className="text-xs">Doc: {conta.numero_documento_infraero}</p>
            <p className="text-xs text-muted-foreground">Comp: {conta.competencia_infraero || "-"}</p>
          </div>
        )}
      </div>

      {/* Observações */}
      {conta.observacoes && (
        <div className="p-3 bg-background/50 rounded-lg border border-border/30">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Observações Internas</p>
          <p className="text-xs leading-relaxed">{conta.observacoes}</p>
        </div>
      )}

      {/* Código de barras */}
      {conta.codigo_barras && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Linha Digitável / Boleto</p>
          <BoletoCopiaCola codigoBarras={conta.codigo_barras} />
          {conta.vencimento_boleto && (
            <p className="text-[10px] text-orange-500 font-medium italic">
              Vencimento original do boleto: {format(parseLocalDate(conta.vencimento_boleto)!, "dd/MM/yyyy")}
            </p>
          )}
        </div>
      )}

      {/* Botões de Anexos / Links */}
      <div className="flex flex-wrap gap-2 pt-2">
        {conta.boleto_url && (
          <a href={conta.boleto_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-md text-[11px] font-semibold hover:bg-primary/20 transition-all border border-primary/20">
            <FileText className="h-3.5 w-3.5" /> BOLETO
          </a>
        )}
        {conta.nf_url && (
          <a href={conta.nf_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 rounded-md text-[11px] font-semibold hover:bg-blue-500/20 transition-all border border-blue-500/20">
            <FileText className="h-3.5 w-3.5" /> NOTA FISCAL
          </a>
        )}
        {conta.decea_url && (
          <a href={conta.decea_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-700 rounded-md text-[11px] font-semibold hover:bg-amber-500/20 transition-all border border-amber-500/20">
            <FileText className="h-3.5 w-3.5" /> DOC DECEA
          </a>
        )}
        {conta.infraero_url && (
          <a href={conta.infraero_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 text-sky-700 rounded-md text-[11px] font-semibold hover:bg-sky-500/20 transition-all border border-sky-500/20">
            <FileText className="h-3.5 w-3.5" /> DOC INFRAERO
          </a>
        )}
        {conta.comprovante_pagamento_url && (
          <a href={conta.comprovante_pagamento_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-700 rounded-md text-[11px] font-semibold hover:bg-green-500/20 transition-all border border-green-500/20">
            <FileText className="h-3.5 w-3.5" /> COMPROVANTE
          </a>
        )}
      </div>
    </div>
  );
}
