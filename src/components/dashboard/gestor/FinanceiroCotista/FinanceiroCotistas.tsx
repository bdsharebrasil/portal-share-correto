import { Layout } from "@/components/layout/Layout";
import { useNavigate } from "react-router-dom";
import { useClientesCotistas } from "@/hooks/useFinanceiroCotista";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plane, Users, ChevronRight, Search, X } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { SociosDetailCard } from "./SociosDetailCard";

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function FinanceiroCotistas() {
  const navigate = useNavigate();
  const { data: clientes = [], isLoading } = useClientesCotistas();
  const [search, setSearch] = useState("");
  const [aba, setAba] = useState<"cotistas" | "sociedade">("cotistas");
  const [clientesComSocios, setClientesComSocios] = useState<Set<string>>(new Set());
  const [clienteSelecionado, setClienteSelecionado] = useState<any>(null);

  // Carregar clientes que têm sócios
  const carregarClientesComSocios = async () => {
    try {
      const { data, error } = await supabase
        .from("socios_cliente")
        .select("cliente_id");

      if (error) throw error;

      const ids = new Set((data || []).map((s: any) => s.cliente_id));
      setClientesComSocios(ids);
    } catch (err) {
      console.error("Erro ao carregar clientes com sócios:", err);
    }
  };

  // Carrega dados de sócios ao montar o componente
  useEffect(() => {
    carregarClientesComSocios();
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();

    let resultado = clientes;

    // Filtrar pela aba selecionada
    if (aba === "sociedade") {
      resultado = resultado.filter((c: any) => clientesComSocios.has(c.id));
    }

    // Aplicar filtro de busca
    if (!s) return resultado;

    return resultado.filter((c: any) =>
      [c.razao_social, c.proprietario, c.cnpj]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(s))
    );
  }, [clientes, search, aba, clientesComSocios]);

  // Quando está visualizando sócios, mostra o card de detalhes
  if (clienteSelecionado && aba === "sociedade") {
    return (
      <Layout>
        <div className="space-y-6">
          <button
            onClick={() => setClienteSelecionado(null)}
            className="flex items-center gap-2 text-foreground hover:text-primary transition-colors group w-fit"
          >
            <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Voltar</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center overflow-hidden">
              {clienteSelecionado.url_logo ? (
                <img
                  src={clienteSelecionado.url_logo}
                  alt={clienteSelecionado.razao_social}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Users className="h-7 w-7 text-primary" />
              )}
            </div>
            <div>
              <p className="text-xs text-primary font-medium uppercase tracking-widest">
                Sociedade de Cotistas
              </p>
              <h1 className="text-3xl font-bold text-foreground">
                {clienteSelecionado.razao_social || "Cliente"}
              </h1>
              {clienteSelecionado.cnpj && (
                <p className="text-sm text-muted-foreground mt-1">
                  CNPJ: {clienteSelecionado.cnpj}
                </p>
              )}
            </div>
          </div>

          {/* Card de Sócios */}
          <SociosDetailCard 
            clienteId={clienteSelecionado.id}
            clienteNome={clienteSelecionado.razao_social || "Cliente"}
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-foreground hover:text-primary transition-colors group w-fit"
        >
          <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm">Voltar</span>
        </button>

        <header className="flex flex-col gap-2">
          <p className="text-xs text-primary font-medium uppercase tracking-widest">
            Financeiro
          </p>
          <h1 className="text-3xl font-bold text-foreground">
            Financeiro Cotistas
          </h1>
          <p className="text-sm text-muted-foreground">
            Selecione um cliente cotista para visualizar despesas, balanço entre
            sócios e relatórios da aeronave compartilhada.
          </p>
        </header>

        {/* Abas */}
        <div className="flex gap-2 border-b border-border">
          <button
            onClick={() => setAba("cotistas")}
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
              aba === "cotistas"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Cotistas
          </button>
          <button
            onClick={() => setAba("sociedade")}
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
              aba === "sociedade"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Sociedade de Cotistas
          </button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por razão social, proprietário ou CNPJ"
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="bg-card/50 animate-pulse h-40" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="bg-card/50">
            <CardContent className="p-10 text-center text-muted-foreground">
              {aba === "cotistas"
                ? "Nenhum cliente cotista encontrado."
                : "Nenhum cliente com sociedade de cotistas encontrado."}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c: any) => (
              <button
                key={c.id}
                onClick={() => {
                  if (aba === "sociedade") {
                    setClienteSelecionado(c);
                  } else {
                    navigate(`/financeiro/financeiro-cotistas/${c.id}`);
                  }
                }}
                className="text-left bg-card/60 backdrop-blur-sm rounded-xl border border-border hover:border-primary/60 hover:bg-card transition-all duration-200 group p-5 flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center overflow-hidden shrink-0">
                    {c.url_logo ? (
                      <img
                        src={c.url_logo}
                        alt={c.razao_social}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Users className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {c.razao_social || "Sem razão social"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.proprietario || c.cnpj || "—"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {c.aeronaves.slice(0, 3).map((a: any) => (
                    <Badge
                      key={a.id_aeronave}
                      variant="secondary"
                      className="gap-1 text-xs"
                    >
                      <Plane className="h-3 w-3" />
                      {a.aeronave?.matricula || "—"} ·{" "}
                      {a.percentual_sociedade}%
                    </Badge>
                  ))}
                  {c.aeronaves.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{c.aeronaves.length - 3}
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

    </Layout>
  );
}

