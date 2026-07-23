import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select as RegularSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useContasBancarias } from "@/hooks/useContasBancarias";
import { toast } from "sonner";
import { Upload, FileText, X, Users, RefreshCcw } from "lucide-react";
import { format } from "date-fns";

interface PaymentContaLike {
  id?: string;
  valor?: number | string | null;
  categoria?: string | null;
  categoria_id?: string | null;
  fornecedor_nome?: string | null;
  fornecedor_favorito_id?: string | null;
  cliente_id?: string | null;
  aeronave_id?: string | null;
  aeronave_registro?: string | null;
  numero?: string | null;
  numero_doc?: string | null;
  descricao?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  movimentacao_id?: string | null;
  clientes?: { razao_social?: string | null } | null;
  socios?: Array<{ name?: string | null; nome?: string | null }> | { name?: string | null; nome?: string | null } | null;
}

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta: PaymentContaLike | null;
  onPaid: () => void;
}

interface RateioRow {
  id: string;
  cliente_id: string | null;
  clientes_nome: string | null;
  socio_id: string | null;
  socios_nome: string | null;
  valor_rateado: number | null;
  valor_pago_real: number | null;
}

type SupabaseQuery = ReturnType<typeof supabase.from>;

type TravelReportSummary = {
  numero_relatorio: string | null;
  total_valor: number | null;
  total_trip: number | null;
  nome_tripulante: string | null;
  total_trip2: number | null;
  nome_tripulante_2: string | null;
};

export function PaymentDialog({ open, onOpenChange, conta, onPaid }: PaymentDialogProps) {
  const { user } = useAuth();
  const { data: contasBancarias = [] } = useContasBancarias();
  const [dataPagamento, setDataPagamento] = useState(format(new Date(), "yyyy-MM-dd"));
  const [banco, setBanco] = useState("");
  const [metodoPagamento, setMetodoPagamento] = useState("");
  const [pagoPor, setPagoPor] = useState("");
  const [valorPago, setValorPago] = useState<string>("");
  const [comprovanteUrl, setComprovanteUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rateioRows, setRateioRows] = useState<RateioRow[]>([]);
  const [rateioValues, setRateioValues] = useState<Record<string, string>>({});
  const [travelReport, setTravelReport] = useState<TravelReportSummary | null>(null);
  // NOVO: indica se a despesa precisa ser reembolsada para o caixa share
  const [necessitaReembolso, setNecessitaReembolso] = useState(false);
  // NOVO: modo de pagamento informado manualmente pelo usuário no momento do
  // registro — permite corrigir/confirmar se foi um rateio entre clientes ou
  // um pagamento único, independente do que o sistema detectou automaticamente.
  const [modoPagamento, setModoPagamento] = useState<"rateio" | "unico">("unico");

  const normalizeRateioValue = (value: string | number | null | undefined) => {
    const numberValue = Number(String(value ?? "").replace(",", "."));
    if (!Number.isFinite(numberValue)) return "0.00";
    return numberValue.toFixed(2);
  };

  const handleRateioValueChange = (rowId: string, value: string) => {
    const sanitized = value.replace(/[^0-9,.-]/g, "");
    setRateioValues((prev) => ({ ...prev, [rowId]: sanitized }));
  };

  const handleRateioValueBlur = (rowId: string) => {
    setRateioValues((prev) => ({ ...prev, [rowId]: normalizeRateioValue(prev[rowId] ?? "0") }));
  };

  // Carrega rateio_despesas vinculados a esta conta e o resumo do relatório de viagem (quando aplicável)
  useEffect(() => {
    if (!open || !conta?.id) {
      setRateioRows([]);
      setRateioValues({});
      setTravelReport(null);
      setNecessitaReembolso(false);
      return;
    }

    (async () => {
      // Uma conta a pagar pode ter gerado VÁRIAS linhas em "movimentacoes"
      // (uma por cliente/sócio do rateio, além de uma possível linha
      // agregada de caixa share). "contas_apagar.movimentacao_id" guarda
      // só UMA dessas linhas, então usá-lo sozinho faz o rateio aparecer
      // incompleto (só o último cliente vinculado). O vínculo confiável
      // com TODAS as linhas é "movimentacoes.contas_apagar_id = conta.id".
      const { data: movsVinculadas, error: movsError } = await (supabase as any)
        .from("movimentacoes")
        .select("id")
        .eq("contas_apagar_id", conta.id);
      if (movsError) {
        console.error("Erro ao buscar movimentações vinculadas à conta:", movsError);
      }

      const despesaIds = Array.from(
        new Set(
          [
            conta.id,
            conta.movimentacao_id,
            ...(movsVinculadas || []).map((m: any) => m.id),
          ].filter(Boolean) as string[]
        )
      );

      const { data: rateioData, error: rateioError } = await (supabase as any)
        .from("rateio_despesas")
        .select("id, cliente_id, clientes_nome, socio_id, socios_nome, valor_rateado, valor_pago_real")
        .in("despesa_id", despesaIds);
      if (rateioError) {
        console.error("Erro ao carregar rateio:", rateioError);
        setRateioRows([]);
      } else {
        const rows = (rateioData || []) as RateioRow[];
        setRateioRows(rows);
        const defaults: Record<string, string> = {};
        rows.forEach((r) => {
          defaults[r.id] = normalizeRateioValue(r.valor_pago_real ?? r.valor_rateado ?? 0);
        });
        setRateioValues(defaults);
        // Preenche o modo automaticamente com o que foi detectado, mas o
        // usuário pode mudar manualmente na tela antes de confirmar.
        setModoPagamento(rows.length > 0 ? "rateio" : "unico");
      }

      const reportReferenceId = conta?.reference_id?.trim() || null;
      const descricao = String(conta?.descricao || "");
      const numeroDoc = String(conta?.numero || conta?.numero_doc || "");
      const extractNumeroRelatorio = (input: string): string | null => {
        const rvMatch = input.match(/RV[- ]?([A-Z0-9\-/]+)/i);
        if (rvMatch?.[1]) return rvMatch[1];
        const viagemMatch = input.match(/Reembolso Viagem\s+(.+?)\s+-\s+/i);
        if (viagemMatch?.[1]) return viagemMatch[1].trim();
        const docMatch = input.match(/^(.+?)(?:-T[12])?$/i);
        return docMatch?.[1] || null;
      };
      const numeroRelatorio = extractNumeroRelatorio(numeroDoc) || extractNumeroRelatorio(descricao);
      const referenceType = String(conta?.reference_type || "").toLowerCase();
      const isTravelExpenseCategory = Boolean(
        reportReferenceId ||
        referenceType.includes("travel_report") ||
        referenceType.includes("travel_expense_report") ||
        String(conta?.categoria || "").toUpperCase().includes("VIAGEM") ||
        descricao.toUpperCase().includes("RV ") ||
        numeroRelatorio
      );

      if (isTravelExpenseCategory) {
        let query: any = (supabase as any)
          .from("travel_expense_reports")
          .select("numero_relatorio, total_valor, total_trip, nome_tripulante, total_trip2, nome_tripulante_2");

        if (reportReferenceId) {
          query = query.eq("id", reportReferenceId);
        } else if (numeroRelatorio) {
          query = query.eq("numero_relatorio", numeroRelatorio);
        }

        const { data: reportData, error: reportError } = await query.maybeSingle();
        if (!reportError && reportData) {
          setTravelReport(reportData as TravelReportSummary);
        } else {
          if (reportError) console.warn("Erro ao carregar resumo do relatório de viagem:", reportError);
          setTravelReport(null);
        }
      } else {
        setTravelReport(null);
      }
    })();
  }, [open, conta?.id, conta?.movimentacao_id, conta?.reference_id, conta?.reference_type, conta?.categoria, conta?.descricao, conta?.numero_doc]);

  const rateioTotal = useMemo(
    () =>
      Object.values(rateioValues).reduce(
        (acc, v) => acc + Number(normalizeRateioValue(v || "0")),
        0
      ),
    [rateioValues]
  );

  const sociosList = useMemo(() => {
    if (!conta?.socios) return [] as Array<{ name?: string | null; nome?: string | null }>;
    return Array.isArray(conta.socios) ? conta.socios : [conta.socios];
  }, [conta?.socios]);

  const pagadoresOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    const seen = new Set<string>();
    const add = (value: string | null | undefined, label: string) => {
      const v = value?.trim();
      if (!v || seen.has(v)) return;
      seen.add(v);
      options.push({ value: v, label });
    };
    add(conta?.clientes?.razao_social, `Cliente: ${conta?.clientes?.razao_social}`);
    sociosList.forEach((s) => add(s?.nome ?? s?.name, `Sócio: ${s?.nome ?? s?.name}`));
    rateioRows.forEach((r) => {
      if (r.clientes_nome) add(r.clientes_nome, `Cliente: ${r.clientes_nome}`);
      if (r.socios_nome) add(r.socios_nome, `Sócio: ${r.socios_nome}`);
    });
    return options;
  }, [conta?.clientes?.razao_social, conta?.socios, rateioRows]);

  useEffect(() => {
    if (conta?.valor != null) setValorPago(String(conta.valor));
  }, [conta?.id, conta?.valor]);

  useEffect(() => {
    if (pagadoresOptions.length > 0) {
      const clienteNome = conta?.clientes?.razao_social?.trim();
      setPagoPor(clienteNome || pagadoresOptions[0].value);
    } else {
      setPagoPor("");
    }
  }, [conta?.id, conta?.clientes?.razao_social, pagadoresOptions]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const timestamp = Date.now();
      const sanitized = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_").substring(0, 100);
      const ext = sanitized.split(".").pop();
      const fileName = `comprovante_${timestamp}_${conta?.id || "unknown"}.${ext}`;
      const { error: upErr } = await supabase.storage.from("nfs-share-recebidas").upload(fileName, file);
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("nfs-share-recebidas").getPublicUrl(fileName);
      setComprovanteUrl(data.publicUrl);
      toast.success("Comprovante enviado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar");
    } finally {
      setUploading(false);
    }
  };

  const gerarReembolsosCaixaShare = async (categoriaId: string | null) => {
    const hoje = format(new Date(), "yyyy-MM-dd");

    const valoresPorCliente = new Map<string, number>();

    if (rateioRows.length > 0) {
      const socioIdsParaResolver = Array.from(
        new Set(
          rateioRows
            .filter((row) => !row.cliente_id && row.socio_id)
            .map((row) => row.socio_id as string)
        )
      );

      const socioParaCliente = new Map<string, string>();
      if (socioIdsParaResolver.length > 0) {
        const { data: sociosData, error: sociosError } = await supabase
          .from("socios")
          .select("id, cliente_id")
          .in("id", socioIdsParaResolver);
        if (sociosError) {
          console.error("Erro ao resolver cliente do sócio:", sociosError);
        } else {
          (sociosData || []).forEach((s: any) => socioParaCliente.set(s.id, s.cliente_id));
        }
      }

      rateioRows.forEach((row) => {
        const valorRow = Number(normalizeRateioValue(rateioValues[row.id] ?? "0")) || 0;
        if (!valorRow) return;
        const clienteId = row.cliente_id || (row.socio_id ? socioParaCliente.get(row.socio_id) : null);
        if (!clienteId) return;
        valoresPorCliente.set(
          clienteId,
          Number(((valoresPorCliente.get(clienteId) || 0) + valorRow).toFixed(2))
        );
      });
    } else if (conta?.cliente_id) {
      valoresPorCliente.set(conta.cliente_id, Number((parseFloat(valorPago) || 0).toFixed(2)));
    }

    if (valoresPorCliente.size === 0) {
      toast.warning("Reembolso não gerado: nenhum cliente vinculado a esta despesa.");
      return;
    }

    const clienteIds = Array.from(valoresPorCliente.keys());
    const { data: clientesData, error: clientesError } = await supabase
      .from("clientes")
      .select("id, razao_social, cnpj")
      .in("id", clienteIds);
    if (clientesError) {
      console.error("Erro ao buscar dados dos clientes:", clientesError);
    }
    const clienteInfo = new Map<string, { razao_social: string | null; cnpj: string | null }>();
    (clientesData || []).forEach((c: any) => clienteInfo.set(c.id, { razao_social: c.razao_social, cnpj: c.cnpj }));

    let algumGerado = false;

    for (const [clienteId, valor] of valoresPorCliente.entries()) {
      if (!valor || valor <= 0) continue;

      const info = clienteInfo.get(clienteId);
      if (!info?.cnpj) {
        toast.warning(`Reembolso não gerado para ${info?.razao_social || "cliente"}: CNPJ não cadastrado.`);
        continue;
      }

      const numeroReembolso = `REEMB-${(conta!.id || "").slice(0, 8)}-${clienteId.slice(0, 8)}-${Date.now()}`;

      const { data: novaContaReceber, error: errContaReceber } = await (supabase.from("contas_areceber") as unknown as SupabaseQuery)
        .insert([{
          numero: numeroReembolso,
          cliente_nome: info.razao_social || "Cliente",
          cliente_cnpj: info.cnpj,
          data_criacao: hoje,
          data_vencimento: hoje,
          valor,
          categoria: "Reembolso Caixa Share",
          categoria_id: categoriaId,
          descricao: `Reembolso caixa share - ${conta!.fornecedor_nome || conta!.descricao || ""}`,
          status: "pendente",
          cliente_id: clienteId,
          reference_type: "reembolso_caixa_share",
          reference_id: conta!.id,
          criado_por: user?.id,
        }])
        .select("id")
        .single();

      if (errContaReceber || !novaContaReceber) {
        console.error("Erro ao gerar conta a receber de reembolso:", errContaReceber);
        toast.error(`Erro ao gerar reembolso para ${info.razao_social || "cliente"}`);
        continue;
      }

      const { error: errMov } = await (supabase.from("movimentacoes") as unknown as SupabaseQuery).insert([{
        descricao: `Reembolso caixa share - ${conta!.fornecedor_nome || conta!.descricao || ""}`,
        tipo: "receita",
        categoria_id: categoriaId,
        valor,
        data_competencia: hoje,
        data_vencimento: hoje,
        clientes_id: clienteId,
        status: "pendente",
        contas_areceber_id: (novaContaReceber as any).id,
        tipo_caixa: "share",
        criado_por: user?.id,
      }]);

      if (errMov) {
        console.error("Erro ao gerar movimentação de reembolso:", errMov);
      } else {
        algumGerado = true;
      }
    }

    if (algumGerado) {
      toast.success("Reembolso(s) gerado(s) no contas a receber do caixa share!");
    }
  };

  const handleConfirm = async () => {
    if (!banco) return toast.error("Selecione um banco");
    if (!metodoPagamento) return toast.error("Selecione o método de pagamento");
    if (!dataPagamento) return toast.error("Informe a data do pagamento");

    const hasRateio = modoPagamento === "rateio" && rateioRows.length > 0;
    const valorNum = hasRateio ? rateioTotal : parseFloat(valorPago);
    if (!valorNum || valorNum <= 0) return toast.error("Informe um valor válido");

    setSaving(true);
    try {
      const { error: updErr } = await (supabase.from("contas_apagar") as unknown as SupabaseQuery)
        .update({
          status: "paga",
          data_pagamento: dataPagamento,
          banco_pagamento: banco,
          valor_pago: valorNum,
          comprovante_pagamento_url: comprovanteUrl || null,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", conta!.id);
      if (updErr) throw updErr;

      if (conta!.movimentacao_id) {
        await (supabase.from("movimentacoes") as unknown as SupabaseQuery)
          .update({ status: "pago", data_pagamento: dataPagamento, valor: valorNum })
          .eq("id", conta!.movimentacao_id);
      }

      if (hasRateio) {
        // Rateio: cada participante paga a sua parte (valores editados na tela).
        for (const row of rateioRows) {
          const valorRow = Number(normalizeRateioValue(rateioValues[row.id] ?? "0")) || 0;
          const pagador = row.socios_nome || row.clientes_nome || pagoPor || null;
          await (supabase.from("rateio_despesas") as unknown as SupabaseQuery)
            .update({
              status: "pago",
              data_pagamento: dataPagamento,
              forma_pagamento: metodoPagamento || null,
              valor_pago_real: Number(valorRow.toFixed(2)),
              comprovante_url: comprovanteUrl || null,
              pago_por: pagador,
              atualizado_em: new Date().toISOString(),
            })
            .eq("id", row.id);
        }
      } else if (rateioRows.length > 0) {
        // Existia rateio, mas o usuário informou que foi um único pagador
        // cobrindo o valor total. Fecha as linhas de rateio mantendo o
        // valor original de cada uma, mas atribuindo o pagador único.
        for (const row of rateioRows) {
          const valorRow = Number(normalizeRateioValue(row.valor_pago_real ?? row.valor_rateado ?? 0)) || 0;
          await (supabase.from("rateio_despesas") as unknown as SupabaseQuery)
            .update({
              status: "pago",
              data_pagamento: dataPagamento,
              forma_pagamento: metodoPagamento || null,
              valor_pago_real: Number(valorRow.toFixed(2)),
              comprovante_url: comprovanteUrl || null,
              pago_por: pagoPor || null,
              atualizado_em: new Date().toISOString(),
            })
            .eq("id", row.id);
        }
      }

      if (conta?.reference_type?.toLowerCase() === "abastecimento" && conta?.reference_id) {
        const socioNomeAbastecimento = rateioRows.find((row) => row.socios_nome?.trim())?.socios_nome?.trim() || null;
        await (supabase.from("abastecimentos") as unknown as SupabaseQuery)
          .update({
            status_pagamento: "pago",
            data_pagamento: dataPagamento,
            forma_pagamento: metodoPagamento || null,
            comprovante_pagamento: comprovanteUrl || null,
            comprovante_url: comprovanteUrl || null,
            socio_nome: socioNomeAbastecimento,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conta.reference_id);
      }

      let categoriaId = conta!.categoria_id || null;
      if (!categoriaId && conta!.categoria) {
        const { data: catData } = await supabase
          .from("categorias_movimentacao")
          .select("id")
          .eq("nome", conta!.categoria)
          .limit(1);
        categoriaId = catData?.[0]?.id || null;
      }
      if (categoriaId) {
        await (supabase.from("controle_bancario") as unknown as SupabaseQuery).insert([{
          data: dataPagamento,
          tipo_movimento: "saida",
          categoria_id: categoriaId,
          descricao: `${conta!.categoria} - ${conta!.fornecedor_nome}`,
          valor: valorNum,
          banco_pagamento: banco,
          status: "pago",
          fornecedores_favoritos_id: conta!.fornecedor_favorito_id || null,
          client_id: conta!.cliente_id || null,
          aeronave_id: conta!.aeronave_id || null,
          aeronave_registro: conta!.aeronave_registro || null,
          comprovante_url: comprovanteUrl || null,
          grupo_categoria: conta!.categoria,
          criado_por: user?.id,
          numero_documento: conta!.numero || null,
          referencia: conta!.id,
        }]);
      }

      if (necessitaReembolso) {
        try {
          await gerarReembolsosCaixaShare(categoriaId);
        } catch (reembolsoErr: any) {
          console.error("Erro ao gerar reembolso do caixa share:", reembolsoErr);
          toast.error("Pagamento registrado, mas houve erro ao gerar o reembolso do caixa share.");
        }
      }

      toast.success("Pagamento registrado com sucesso!");
      onPaid();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar pagamento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>
        {conta && (
          <div className="space-y-4 py-2">
            <div className="p-3 bg-muted/40 rounded-lg border border-border/50">
              <p className="text-sm font-semibold">{conta.fornecedor_nome}</p>
              <p className="text-xs text-muted-foreground">
                Valor original: R$ {Number(String(conta.valor ?? 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>

            {travelReport ? (
              <div className="space-y-2 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-sm">
                <div className="font-semibold text-sky-300">Relatório de Viagem</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-sky-100">
                  <div>Número do relatório: {travelReport.numero_relatorio || "—"}</div>
                  <div>Total do relatório: R$ {Number(travelReport.total_valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                  <div>Tripulante 1: {travelReport.nome_tripulante || "—"}</div>
                  <div>Valor Trip 1: R$ {Number(travelReport.total_trip || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                  {travelReport.nome_tripulante_2 ? (
                    <>
                      <div>Tripulante 2: {travelReport.nome_tripulante_2}</div>
                      <div>Valor Trip 2: R$ {Number(travelReport.total_trip2 || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
            {rateioRows.length > 0 && (
              <div>
                <label className="text-sm font-semibold mb-1 block">Como esta conta foi paga? *</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={modoPagamento === "rateio" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setModoPagamento("rateio")}
                    className="flex-1"
                  >
                    Rateio entre clientes
                  </Button>
                  <Button
                    type="button"
                    variant={modoPagamento === "unico" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setModoPagamento("unico")}
                    className="flex-1"
                  >
                    Pago por um só
                  </Button>
                </div>
              </div>
            )}

            {modoPagamento === "rateio" && rateioRows.length > 0 ? (
              <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/[0.03] p-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-primary">
                  <Users className="h-3.5 w-3.5" />
                  Rateio — valor pago por cada participante
                </div>
                <div className="space-y-2">
                  {rateioRows.map((row) => {
                    const nomeCliente = row.clientes_nome?.trim() || null;
                    const nomeSocio = row.socios_nome?.trim() || null;
                    const etiqueta = nomeSocio || nomeCliente || "Participante";
                    const metadados = [nomeCliente ? `Cliente: ${nomeCliente}` : null, nomeSocio ? `Sócio: ${nomeSocio}` : null].filter(Boolean);
                    const valorAtual = Number((row.valor_pago_real ?? row.valor_rateado ?? 0).toFixed(2));
                    return (
                      <div key={row.id} className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2 items-center">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{etiqueta}</div>
                          {metadados.length > 0 && (
                            <div className="text-[10px] text-muted-foreground truncate">{metadados.join(" • ")}</div>
                          )}
                          <div className="text-[10px] text-muted-foreground uppercase">
                            {nomeSocio ? "Sócio" : nomeCliente ? "Cliente" : "Participante"} • rateado: R$ {valorAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={rateioValues[row.id] ?? ""}
                          onChange={(e) => handleRateioValueChange(row.id, e.target.value)}
                          onBlur={() => handleRateioValueBlur(row.id)}
                          className="h-9"
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs pt-2 border-t border-border/50">
                  <span className="text-muted-foreground">Total pago</span>
                  <span className="font-bold">R$ {rateioTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            ) : (
              <div>
                <label className="text-sm font-semibold mb-1 block">Valor Pago *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorPago}
                  onChange={(e) => setValorPago(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold mb-1 block">Data do Pagamento *</label>
                <Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">Banco *</label>
                <RegularSelect value={banco} onValueChange={setBanco}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {contasBancarias.length === 0 && (
                      <SelectItem value="__none__" disabled>Nenhuma conta cadastrada</SelectItem>
                    )}
                    {contasBancarias.map((c) => (
                      <SelectItem key={c.id} value={c.banco || c.id}>
                        {c.banco}{c.numero_conta ? ` - ${c.numero_conta}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </RegularSelect>
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">Método *</label>
                <RegularSelect value={metodoPagamento} onValueChange={setMetodoPagamento}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                    <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </RegularSelect>
              </div>

              <div>
                <label className="text-sm font-semibold mb-1 block flex items-center gap-1">
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Necessita de reembolso para o caixa share?
                </label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={necessitaReembolso ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNecessitaReembolso(true)}
                    className="flex-1"
                  >
                    Sim
                  </Button>
                  <Button
                    type="button"
                    variant={!necessitaReembolso ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNecessitaReembolso(false)}
                    className="flex-1"
                  >
                    Não
                  </Button>
                </div>
                {necessitaReembolso && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {rateioRows.length > 0
                      ? "Será gerado um contas a receber por cliente, no valor rateado pago por cada um."
                      : "Será gerado um contas a receber no valor integral pago, para o cliente desta despesa."}
                  </p>
                )}
              </div>

              {modoPagamento === "unico" && (
                <div>
                  <label className="text-sm font-semibold mb-1 block">Pago por</label>
                  <RegularSelect value={pagoPor} onValueChange={setPagoPor}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {pagadoresOptions.length === 0 && (
                        <SelectItem value="__none__" disabled>Nenhum pagador</SelectItem>
                      )}
                      {pagadoresOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </RegularSelect>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold mb-1 block">Comprovante</label>
              {comprovanteUrl ? (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border border-border/50">
                  <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                  <a href={comprovanteUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex-1 truncate">Comprovante anexado</a>
                  <Button variant="ghost" size="sm" onClick={() => setComprovanteUrl("")} className="h-6 w-6 p-0"><X className="h-3 w-3" /></Button>
                </div>
              ) : (
                <>
                  <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleUpload} disabled={uploading} className="hidden" id="comprovante-upload" />
                  <Button variant="outline" onClick={() => document.getElementById("comprovante-upload")?.click()} disabled={uploading} className="w-full">
                    <Upload className="h-4 w-4 mr-2" />{uploading ? "Enviando..." : "Anexar Comprovante"}
                  </Button>
                </>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="w-full sm:w-auto">Cancelar</Button>
              <Button onClick={handleConfirm} disabled={saving} className="w-full sm:w-auto bg-green-600 hover:bg-green-700">
                {saving ? "Processando..." : "Confirmar Pagamento"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
