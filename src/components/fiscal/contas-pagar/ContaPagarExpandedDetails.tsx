import React from "react";
import { FileText, ExternalLink } from "lucide-react";
import { BoletoCopiaCola } from "./BoletoCopiaCola";

interface Props {
  conta: any;
}

export function ContaPagarExpandedDetails({ conta }: Props) {
  return (
    <div className="px-6 py-4 bg-muted/20 border-t border-border/30 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Conta pagamento fornecedor */}
        {conta.conta_pagamento_fornecedor && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Conta Pagamento</p>
            <p className="text-sm">{conta.conta_pagamento_fornecedor}</p>
          </div>
        )}

        {/* Observações */}
        {conta.observacoes && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Observações</p>
            <p className="text-sm">{conta.observacoes}</p>
          </div>
        )}

        {/* DECEA */}
        {conta.numero_documento_decea && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase">DECEA/Infraero</p>
            <p className="text-sm">Doc: {conta.numero_documento_decea} | Comp: {conta.competencia_decea || "-"}</p>
          </div>
        )}

        {/* Período apuração */}
        {conta.periodo_apuracao && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Período Apuração</p>
            <p className="text-sm">{conta.periodo_apuracao}</p>
          </div>
        )}
      </div>

      {/* Código de barras */}
      {conta.codigo_barras && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Código de Barras</p>
          <BoletoCopiaCola codigoBarras={conta.codigo_barras} />
        </div>
      )}

      {/* Anexos */}
      <div className="flex flex-wrap gap-3">
        {conta.boleto_url && (
          <a href={conta.boleto_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg border border-border/50 text-xs hover:bg-muted/80 transition-colors">
            <FileText className="h-3.5 w-3.5 text-primary" /> Boleto <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {conta.nf_url && (
          <a href={conta.nf_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg border border-border/50 text-xs hover:bg-muted/80 transition-colors">
            <FileText className="h-3.5 w-3.5 text-blue-500" /> Nota Fiscal <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {conta.arquivo_pdf_url && (
          <a href={conta.arquivo_pdf_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg border border-border/50 text-xs hover:bg-muted/80 transition-colors">
            <FileText className="h-3.5 w-3.5 text-orange-500" /> Documento <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {conta.documento_url && (
          <a href={conta.documento_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg border border-border/50 text-xs hover:bg-muted/80 transition-colors">
            <FileText className="h-3.5 w-3.5 text-purple-500" /> Documento Imposto <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {conta.comprovante_pagamento_url && (
          <a href={conta.comprovante_pagamento_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 rounded-lg border border-green-500/20 text-xs hover:bg-green-500/15 transition-colors">
            <FileText className="h-3.5 w-3.5 text-green-500" /> Comprovante Pgto <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}
