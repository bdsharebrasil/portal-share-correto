import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Fuel, Clock, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SolicitacaoPagamentoModal } from "@/components/dashboard/financeiro/SolicitacaoPagamentoModal";

const db = supabase as any;

const brl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Aviso no dashboard financeiro: abastecimentos gerados no checklist de pré-voo
 * que ainda estão pendentes de conclusão financeira.
 */
type ModoSolicitacao = "SHARE" | "REEMBOLSO" | "DIRETO";

export function AbastecimentosPendentesAlert({
  isExpanded,
  onCountChange,
}: {
  isExpanded: boolean;
  onCountChange: (count: number) => void;
}) {

  const [modoDialogOpen, setModoDialogOpen] = useState(false);
  const [abastecimentoSelecionado, setAbastecimentoSelecionado] = useState<any>(null);
  const [pagamentoModalOpen, setPagamentoModalOpen] = useState(false);
  const [modoSelecionado, setModoSelecionado] = useState<ModoSolicitacao | null>(null);

  const { data: pendentes = [] } = useQuery({
    queryKey: ["abastecimentos-pendentes-pre-voo"],
    queryFn: async () => {
      const { data: checklists, error } = await db
        .from("checklists_pre_voo")
        .select("abastecimento_id")
        .not("abastecimento_id", "is", null);
      if (error) return [];
      const ids = (checklists || []).map((c: any) => c.abastecimento_id).filter(Boolean);
      if (ids.length === 0) return [];
      const { data } = await db
        .from("abastecimentos")
        .select("id, trecho, data, numero_voo, valor_total, status, tipo_faturamento, prazo, id_clientes, aeronave_id, data_vencimento_boleto, nf, nota_url, boleto_url, comanda, comanda_url, comprovante_pagamento, comprovante_url, clientes:id_clientes(razao_social)")
        .in("id", ids)
        .neq("status", "pago")
        .order("data", { ascending: false });
      return (data || []) as any[];
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    onCountChange(pendentes.length);
  }, [onCountChange, pendentes.length]);

  if (!isExpanded || pendentes.length === 0) return null;

  const handleAbrirProgramacao = (abastecimento: any) => {
    setAbastecimentoSelecionado(abastecimento);
    setModoDialogOpen(true);
  };

  const handleSelecionarModo = (modo: ModoSolicitacao) => {
    setModoSelecionado(modo);
    setModoDialogOpen(false);
    setPagamentoModalOpen(true);
  };

  const handlePagamentoModalClose = () => {
    setPagamentoModalOpen(false);
    setAbastecimentoSelecionado(null);
    setModoSelecionado(null);
  };

  return (
    <>
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 backdrop-blur-md md:rounded-2xl md:p-5">
        <div className="flex items-start gap-3 md:gap-4">
          <div className="flex-shrink-0 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 md:rounded-xl md:p-3">
            <Fuel className="h-5 w-5 text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold uppercase tracking-wide text-amber-400">
              Abastecimentos aguardando conclusão financeira
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {pendentes.length} abastecimento(s) registrados no checklist de pré-voo precisam de programação de pagamento.
            </p>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {pendentes.slice(0, 4).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleAbrirProgramacao(a)}
                  className="group rounded-xl border border-amber-500/10 bg-white/[0.02] p-3 text-left transition-all hover:border-amber-500/40 hover:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium uppercase text-foreground group-hover:text-amber-400">
                        {a.trecho || "Trecho —"}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {a.clientes?.razao_social || "Cliente —"} · {brl(a.valor_total)}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] uppercase text-amber-400">
                      <Clock className="h-3 w-3" /> {a.status || "pendente"}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleAbrirProgramacao(null)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 px-3 py-1.5 text-xs font-semibold uppercase text-amber-400 transition-colors hover:bg-amber-500/10"
            >
              <FileText className="h-3.5 w-3.5" />
              Anexar nota fiscal e programar pagamento
            </button>
          </div>
        </div>
      </div>

      {/* Dialog para seleção de modo */}
      <Dialog open={modoDialogOpen} onOpenChange={setModoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar modo de pagamento</DialogTitle>
            <DialogDescription>
              Escolha como este abastecimento será processado financeiramente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => handleSelecionarModo("REEMBOLSO")}
              className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-left transition hover:border-amber-500/60 hover:bg-amber-500/20"
            >
              <p className="font-semibold text-amber-500">Reembolso Share</p>
              <p className="mt-1 text-xs text-muted-foreground">
                A Share paga adiantado e cobra o reembolso do cliente após a baixa.
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleSelecionarModo("DIRETO")}
              className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-left transition hover:border-violet-500/60 hover:bg-violet-500/20"
            >
              <p className="font-semibold text-violet-500">Envio Cliente Direto</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Despesa paga diretamente pelo cliente. Não passa pelo caixa Share.
              </p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de programação de pagamento */}
      {modoSelecionado && (
        <SolicitacaoPagamentoModal
          open={pagamentoModalOpen}
          onOpenChange={handlePagamentoModalClose}
          initialData={{
            modo: modoSelecionado,
            reference_type: "abastecimento",
            reference_id: abastecimentoSelecionado?.id,
            numero_voo: abastecimentoSelecionado?.numero_voo,
            tipo_despesa_label: "COMBUSTÍVEIS",
            valor_total_despesa: abastecimentoSelecionado?.valor_total,
            descricao: abastecimentoSelecionado?.trecho,
            cliente_id: abastecimentoSelecionado?.id_clientes,
            aeronave_id: abastecimentoSelecionado?.aeronave_id,
            data_emissao: abastecimentoSelecionado?.data,
            data_vencimento: abastecimentoSelecionado?.data_vencimento_boleto || abastecimentoSelecionado?.data,
            numero_nf: abastecimentoSelecionado?.nf,
            nf_url: abastecimentoSelecionado?.nota_url,
            boleto_url: abastecimentoSelecionado?.boleto_url,
            comanda_url: abastecimentoSelecionado?.comanda_url,
            comprovante_url: abastecimentoSelecionado?.comprovante_pagamento || abastecimentoSelecionado?.comprovante_url,
          }}
        />
      )}
    </>
  );
}
