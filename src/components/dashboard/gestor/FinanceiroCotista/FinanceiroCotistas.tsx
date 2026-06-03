import { Layout } from "@/components/layout/Layout";
import { useNavigate } from "react-router-dom";
import { useClientesCotistas } from "@/hooks/useFinanceiroCotista";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plane, Users, ChevronRight, Search, X, Bell } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function FinanceiroCotistas() {
  const navigate = useNavigate();
  const { data: clientes = [], isLoading } = useClientesCotistas();
  const [search, setSearch] = useState("");
  const [aba, setAba] = useState<"cotistas" | "sociedade">("cotistas");
  const [clientesComSocios, setClientesComSocios] = useState<Set<string>>(new Set());

  // Carregar clientes que têm sócios
  const carregarClientesComSocios = async () => {
    try {
      const { data, error } = await supabase
        .from("socios")
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
    if (aba === "cotistas") {
      // Na aba Cotistas: mostrar clientes que NÃO têm sócios
      resultado = resultado.filter((c: any) => !clientesComSocios.has(c.id));
    } else if (aba === "sociedade") {
      // Na aba Sociedade: mostrar clientes que TÊM sócios
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
              <Card key={`skeleton-${i}`} className="bg-card/50 animate-pulse h-40" />
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
                onClick={() => navigate(`/financeiro/financeiro-cotistas/${c.id}`)}
                className="text-left bg-gradient-to-b from-slate-800 to-slate-900 backdrop-blur-sm rounded-2xl border border-slate-700 hover:border-primary/50 hover:from-slate-700 hover:to-slate-800 transition-all duration-200 group p-6 flex flex-col gap-4 relative overflow-hidden"
              >
                {/* Header com logo, título e ícones */}
                <div className="flex items-start gap-4 justify-between">
                  <div className="w-14 h-14 rounded-lg bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
                    {c.url_logo ? (
                      <img
                        src={c.url_logo}
                        alt={c.razao_social}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Users className="h-7 w-7 text-white" />
                    )}
                  </div>

                  <div className="flex gap-2">
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 rounded-full border border-slate-600 hover:border-slate-500 hover:bg-slate-700/50 transition-all cursor-pointer"
                    >
                      <Bell className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                </div>

                {/* Título e subtítulo */}
                <div className="flex-1">
                  <p className="font-bold text-white text-lg leading-tight">
                    {c.razao_social || "Sem razão social"}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    {c.proprietario || c.cnpj || "—"}
                  </p>
                </div>

                {/* Divisor */}
                <div className="h-px bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700"></div>

                {/* Seção de participação ativa */}
                <div className="text-sm text-slate-300">
                  Participação ativa em {c.aeronaves.length} aeronave{c.aeronaves.length !== 1 ? "s" : ""}
                </div>

                {/* Botões das aeronaves */}
                <div className="flex flex-col gap-2 pt-2">
                  {c.aeronaves.slice(0, 2).map((a: any) => (
                    <div
                      key={a.id_aeronave}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 bg-slate-700/30 hover:bg-slate-700/50 transition-all text-left group/btn cursor-pointer"
                    >
                      <Plane className="h-4 w-4 text-slate-300 shrink-0" />
                      <span className="text-sm font-medium text-slate-200">
                        {a.aeronave?.matricula || "—"} · {a.percentual_sociedade}%
                      </span>
                    </div>
                  ))}
                  {c.aeronaves.length > 2 && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 bg-slate-700/30 hover:bg-slate-700/50 transition-all text-left cursor-pointer"
                    >
                      <Plane className="h-4 w-4 text-slate-300 shrink-0" />
                      <span className="text-sm font-medium text-slate-200">
                        +{c.aeronaves.length - 2} aeronave{c.aeronaves.length - 2 !== 1 ? "s" : ""}
                      </span>
                    </div>
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
