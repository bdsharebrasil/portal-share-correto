import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Building, Plane, Users, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  LancamentoFormFields,
  validateLancamento,
  type LancamentoState,
  type RateioInput,
  type Socio,
  type GrupoCusto,
} from "./LancamentoFormFields";
import { saveLancamento } from "./LancamentosTab";

function emptyState(socios: Socio[]): LancamentoState {
  return {
    descricao: "",
    tipo: "despesa",
    grupo: "FIXO",
    valor: "",
    data: new Date().toISOString().slice(0, 10),
    pagador: "EMPRESA",
    status: "pago",
    observacoes: "",
    rateios: socios.map((s) => ({
      socio_id: s.id,
      socio_nome: s.nome,
      socio_cpf: s.cpf,
      percentual: Number(s.percentual_participacao ?? 0),
      valor_pago_real: 0,
    })),
    reembolsavel: false,
    anexoUrl: "",
    numeroDocumento: "",
  };
}

export default function LancamentoForm() {
  const { clienteId, aeronaveId } = useParams<{ clienteId: string; aeronaveId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editingId = searchParams.get("editing");

  const [state, setState] = useState<LancamentoState>(() => emptyState([]));
  const [saving, setSaving] = useState(false);

  // Cliente
  const { data: cliente, isLoading: loadingCliente } = useQuery({
    queryKey: ["cliente-lancamento", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, razao_social, cnpj, url_logo, status")
        .eq("id", clienteId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Aeronave (CORRIGIDO: tabela é "aeronave", não "aeronaves")
  const { data: aeronave } = useQuery({
    queryKey: ["aeronave-lancamento", aeronaveId],
    enabled: !!aeronaveId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aeronave")
        .select("id, matricula, modelo, fabricante")
        .eq("id", aeronaveId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Sócios
  const { data: socios } = useQuery({
    queryKey: ["socios-cliente-lanc", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("socios_cliente")
        .select("id, nome, cpf, percentual_participacao")
        .eq("cliente_id", clienteId)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Socio[];
    },
  });

  // Lançamento sendo editado
  const { data: lancamentoEditando } = useQuery({
    queryKey: ["lancamento-edit", editingId],
    enabled: !!editingId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("movimentacoes")
        .select(`
          id, descricao, tipo, grupo_custo, valor, data_competencia,
          data_pagamento, fornecedor_nome, status, observacoes,
          aeronave_id, clientes_id, reembolsavel, numero_doc, comprovante_url
        `)
        .eq("id", editingId)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  // Inicializar form
  useEffect(() => {
    if (!socios) return;
    if (editingId && lancamentoEditando) {
      (async () => {
        const { data: rs } = await (supabase as any)
          .from("rateio_despesas")
          .select("socio_id, socios_nome, percentual_sociedade, valor_pago_real, pago_por")
          .eq("despesa_id", editingId);

        const carregados: RateioInput[] = (rs ?? []).map((r: any) => {
          const s = socios.find((x) => x.id === r.socio_id);
          return {
            socio_id: r.socio_id,
            socio_nome: r.socios_nome ?? s?.nome ?? "",
            socio_cpf: s?.cpf ?? null,
            percentual: Number(r.percentual_sociedade ?? 0),
            valor_pago_real: Number(r.valor_pago_real ?? 0),
          };
        });

        const pagou = (rs ?? []).find((r: any) => Number(r.valor_pago_real ?? 0) > 0);
        const pagador = pagou ? pagou.socio_id : "EMPRESA";

        setState({
          descricao: lancamentoEditando.descricao,
          tipo: (lancamentoEditando.tipo as any) ?? "despesa",
          grupo: (lancamentoEditando.grupo_custo as GrupoCusto) ?? "FIXO",
          valor: String(lancamentoEditando.valor),
          data: lancamentoEditando.data_competencia,
          pagador,
          status: (lancamentoEditando.status as any) === "pago" ? "pago" : "pendente",
          observacoes: lancamentoEditando.observacoes ?? "",
          rateios: carregados.length ? carregados : emptyState(socios).rateios,
          reembolsavel: !!lancamentoEditando.reembolsavel,
          anexoUrl: lancamentoEditando.comprovante_url ?? "",
          numeroDocumento: lancamentoEditando.numero_doc ?? "",
        });
      })();
    } else if (!editingId) {
      setState(emptyState(socios));
    }
  }, [socios, editingId, lancamentoEditando]);

  async function handleSave() {
    const err = validateLancamento(state);
    if (err) {
      toast.error(err);
      return;
    }
    if (!aeronaveId) {
      toast.error("Aeronave não informada");
      return;
    }
    setSaving(true);
    try {
      await saveLancamento({
        state,
        clienteId: clienteId!,
        clienteNome: cliente?.razao_social ?? undefined,
        aeronaveId,
        editingId: editingId ?? undefined,
      });
      toast.success(editingId ? "Lançamento atualizado" : "Lançamento criado");
      navigate(`/financeiro/financeiro-cotistas/${clienteId}`);
    } catch (e: any) {
      toast.error("Erro: " + (e.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  }

  if (loadingCliente) {
    return (
      <Layout>
        <div className="animate-pulse space-y-6 max-w-7xl mx-auto">
          <div className="h-4 w-32 bg-muted/50 rounded-full" />
          <div className="h-48 bg-card/40 backdrop-blur-md rounded-2xl border border-border/40" />
        </div>
      </Layout>
    );
  }

  if (!cliente) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center">
            <Building className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium text-foreground tracking-tight">
            Cliente não encontrado
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 max-w-5xl mx-auto pb-12">
        {/* Navegação topo */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => navigate(-1)}
            className="group flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all duration-300 w-fit"
          >
            <div className="p-1.5 rounded-lg bg-background/50 border border-border/40 group-hover:border-border transition-colors">
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            </div>
            <span className="text-sm font-medium tracking-tight">Voltar</span>
          </button>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span
              className="hover:text-primary cursor-pointer transition-colors"
              onClick={() => navigate("/financeiro/financeiro-cotistas")}
            >
              Gestão Financeira
            </span>
            <span>/</span>
            <span
              className="hover:text-primary cursor-pointer transition-colors"
              onClick={() => navigate(`/financeiro/financeiro-cotistas/${clienteId}`)}
            >
              {cliente.razao_social}
            </span>
            <span>/</span>
            <span className="text-foreground font-medium">
              {editingId ? "Editar Lançamento" : "Novo Lançamento"}
            </span>
          </div>
        </div>

        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-card/80 to-card/30 backdrop-blur-xl border border-border/50 shadow-2xl">
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-50 pointer-events-none" />

          <div className="p-6 md:p-8 relative z-10">
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-background to-muted/30 border border-border/50 shadow-inner flex items-center justify-center shrink-0 overflow-hidden ring-4 ring-background/50">
                {cliente.url_logo ? (
                  <img
                    src={cliente.url_logo}
                    alt={cliente.razao_social ?? ""}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-transparent">
                    {(cliente.razao_social || "—").slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                      {editingId ? "Editar Lançamento" : "Novo Lançamento"}
                    </h1>
                    <Badge
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        cliente.status === "ativo"
                          ? "bg-success/10 text-success border-success/20"
                          : "bg-muted/50 text-muted-foreground border-border"
                      }`}
                    >
                      {cliente.status || "—"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Cliente: {cliente.razao_social}
                  </p>
                  {aeronave && (
                    <div className="flex items-center gap-2 mt-2">
                      <Plane className="h-4 w-4 text-primary/70" />
                      <span className="text-sm text-muted-foreground">
                        Aeronave: {aeronave.matricula} — {aeronave.modelo}
                      </span>
                    </div>
                  )}
                </div>

                {socios && socios.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/40 border border-border/50 text-xs text-muted-foreground w-fit">
                    <Users className="h-3.5 w-3.5 text-primary/70" />
                    {socios.length} sócio{socios.length !== 1 ? "s" : ""} cadastrado
                    {socios.length !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Formulário inline */}
        <Card className="bg-card/60 border-border">
          <CardHeader>
            <CardTitle className="text-base">Dados do lançamento</CardTitle>
          </CardHeader>
          <CardContent>
            <LancamentoFormFields
              state={state}
              setState={setState}
              socios={socios ?? []}
              clienteId={clienteId!}
              clienteNome={cliente.razao_social ?? undefined}
              aeronaveId={aeronaveId ?? null}
            />

            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-border/40">
              <Button
                variant="outline"
                onClick={() =>
                  navigate(`/financeiro/financeiro-cotistas/${clienteId}`)
                }
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {editingId ? "Salvar alterações" : "Criar lançamento"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
