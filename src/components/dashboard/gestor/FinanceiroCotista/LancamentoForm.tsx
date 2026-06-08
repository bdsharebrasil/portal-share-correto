import { Layout } from "@/components/layout/Layout";
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Building,
  Plane,
  Users,
} from "lucide-react";
import { LancamentoFormInline } from "./LancamentoFormInline";

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n || 0);

export default function LancamentoForm() {
  const { clienteId, aeronaveId } = useParams<{ clienteId: string; aeronaveId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const despesaPrefill = (location.state as any)?.despesaPrefill ?? null;

  const editingId = searchParams.get("editing");

  // Buscar dados do cliente
  const { data: cliente, isLoading: loadingCliente } = useQuery({
    queryKey: ["cliente-lancamento", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, razao_social, cnpj, url_logo")
        .eq("id", clienteId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Buscar dados da aeronave se fornecida
  const { data: aeronave } = useQuery({
    queryKey: ["aeronave-lancamento", aeronaveId],
    enabled: !!aeronaveId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aeronave")
        .select("id, matricula, modelo, fabricante")
        .eq("id", aeronaveId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Buscar dados do lançamento se estiver editando (movimentações tradicionais).
  // Quando o registro não existe em "movimentacoes" (ex: vindo da conciliação ou
  // despesa direta), usamos o prefill passado via location.state para que o
  // formulário abra com TODOS os dados existentes preenchidos.
  const { data: lancamentoEditando } = useQuery({
    queryKey: ["lancamento-edit", editingId],
    enabled: !!editingId,
    queryFn: async () => {
      const { data } = await supabase
        .from("movimentacoes")
        .select(`
          id, descricao, tipo, grupo_custo, valor, data_competencia,
          data_pagamento, fornecedor_nome, status, observacoes,
          aeronave_id, client_id
        `)
        .eq("id", editingId)
        .maybeSingle();
      return data; // pode ser null → cairemos no prefill
    },
  });

  // Monta o "editing" final mesclando o que veio do banco (se existir) com o prefill
  const editingFinal = (() => {
    if (!editingId) return null;
    if (lancamentoEditando) return lancamentoEditando;
    if (despesaPrefill) {
      const p = despesaPrefill;
      return {
        id: p.id,
        descricao: p.descricao ?? "",
        tipo: "despesa",
        grupo_custo: p.grupo_custo ?? "FIXO",
        valor: p.valor_total ?? p.valor ?? 0,
        data_competencia: p.data ?? p.data_vencimento ?? null,
        data_pagamento: p.data_pagamento ?? null,
        data_vencimento: p.data_vencimento ?? null,
        fornecedor_nome: p.fornecedor ?? null,
        status: p.status ?? "pendente",
        observacoes: p.observacoes ?? "",
        aeronave_id: p.aeronave_id ?? aeronaveId ?? null,
        client_id: p.cliente_id ?? clienteId ?? null,
        forma_pagamento: p.forma_pagamento ?? "",
        periodicidade: "unica",
        numero_doc: p.numero_doc ?? "",
        numero_nf: p.numero_nf ?? "",
        numero_boleto: p.numero_boleto ?? "",
        numero_recibo: p.numero_recibo ?? "",
        comprovante_url: p.comprovante_url ?? null,
        recibo_url: p.recibo_url ?? null,
        nf_url: p.nf_url ?? null,
        boleto_url: p.boleto_url ?? null,
      };
    }
    return null;
  })();


  // Buscar sócios do cliente
  const { data: socios } = useQuery({
    queryKey: ["socios-cliente-lanc", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("socios")
        .select("id, nome, cpf, percentual_participacao")
        .eq("cliente_id", clienteId)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

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
          <p className="text-lg font-medium text-foreground tracking-tight">Cliente não encontrado</p>
          <p className="text-sm text-muted-foreground">O cadastro pode ter sido removido ou o ID é inválido.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 max-w-7xl mx-auto pb-12">
        {/* Navegação Topo */}
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

        {/* Header com informações do contexto */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-card/80 to-card/30 backdrop-blur-xl border border-border/50 shadow-2xl">
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-50 pointer-events-none" />

          <div className="p-8 md:p-10 relative z-10">
            <div className="flex flex-col md:flex-row md:items-start gap-8">
              {/* Logo do Cliente */}
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-background to-muted/30 border border-border/50 shadow-inner flex items-center justify-center shrink-0 overflow-hidden ring-4 ring-background/50">
                {cliente.url_logo ? (
                  <img
                    src={cliente.url_logo}
                    alt={cliente.razao_social}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-transparent">
                    {(cliente.razao_social || "—").slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Informações */}
              <div className="flex-1 space-y-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                      {editingId ? "Editar Lançamento" : "Novo Lançamento"}
                    </h1>
                    <Badge
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        cliente.status === "ativo"
                          ? "bg-success/10 text-success border-success/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]"
                          : "bg-muted/50 text-muted-foreground border-border"
                      }`}
                    >
                      {cliente.status || "—"}
                    </Badge>
                  </div>
                  <p className="text-sm font-mono text-muted-foreground/80 tracking-widest">
                    Cliente: {cliente.razao_social}
                  </p>
                  {aeronave && (
                    <div className="flex items-center gap-2 mt-2">
                      <Plane className="h-4 w-4 text-primary/70" />
                      <span className="text-sm text-muted-foreground">
                        Aeronave: {aeronave.matricula} - {aeronave.modelo}
                      </span>
                    </div>
                  )}
                </div>

                {/* Informações dos sócios */}
                {socios && socios.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/40 border border-border/50 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5 text-primary/70" />
                      {socios.length} sócio{socios.length !== 1 ? "s" : ""} cadastrado{socios.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Formulário inline (não-Dialog) */}
        <LancamentoFormInline
          clienteId={clienteId!}
          clienteNome={cliente.razao_social ?? ""}
          aeronaveId={aeronaveId ?? null}
          aeronaveRegistro={aeronave?.matricula ?? null}
          socios={socios ?? []}
          editing={lancamentoEditando}
          onCancel={() => navigate(`/financeiro/financeiro-cotistas/${clienteId}`)}
          onSaved={() => {
            navigate(`/financeiro/financeiro-cotistas/${clienteId}`);
          }}
        />
      </div>
    </Layout>
  );
}
