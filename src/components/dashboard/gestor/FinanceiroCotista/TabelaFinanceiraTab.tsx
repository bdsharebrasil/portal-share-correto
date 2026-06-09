import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Download,
  FileText,
  Search,
} from "lucide-react";

interface DespesaUnificada {
  id: string;
  origem: "conciliacao" | "direto";
  data: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  descricao: string;
  categoria: string | null;
  valor_total: number;
  valor_rateado: number;
  pago_por: string;
  pago_por_tipo: string | null;
  pago_diretamente: boolean;
  forma_pagamento: string | null;
  fornecedor: string | null;
  numero_doc: string | null;
  numero_nf: string | null;
  numero_boleto: string | null;
  numero_recibo: string | null;
  status: string | null;
  observacoes: string | null;
  aeronave_id: string | null;
  aeronave_registro: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  socio_id: string | null;
  socio_nome: string | null;
  comprovante_url: string | null;
  recibo_url: string | null;
  nf_url: string | null;
  boleto_url: string | null;
  fluxo?: "entrada" | "saida";
  tipo_rateio?: string | null;
  percentual_uso?: number | null;
  valor_pago_real?: number | null;
  fornecedor_nome?: string | null;
}

interface Cotista {
  id: string;
  nome: string;
  percentual: number;
}

interface TabelaFinanceiraTabProps {
  despesas: DespesaUnificada[];
  cotistas: Cotista[];
  aeronaveLabel?: string;
}

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n || 0);

const formatDate = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function TabelaFinanceiraTab({
  despesas,
  cotistas,
  aeronaveLabel,
}: TabelaFinanceiraTabProps) {
  const hoje = new Date();
  const [mesSelecionado, setMesSelecionado] = useState<number>(hoje.getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState<number>(hoje.getFullYear());
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");

  const anos = Array.from({ length: 6 }, (_, i) => hoje.getFullYear() - i);

  // Categorias únicas
  const categoriasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    despesas.forEach((d) => {
      if (d.categoria) set.add(d.categoria);
    });
    return Array.from(set).sort();
  }, [despesas]);

  // Agrupar por categoria + fornecedor (para juntar despesas iguais)
  const chaveAgrupamento = (d: DespesaUnificada) => {
    return [d.categoria || "Sem categoria", d.fornecedor || "Sem fornecedor"].join("||");
  };

  // Filtrar e agrupar despesas
  const despesasAgrupadas = useMemo(() => {
    const q = filtroTexto.trim().toLowerCase();
    const mapa = new Map<string, DespesaUnificada[]>();

    despesas.forEach((d) => {
      // Filtro de mês/ano
      const data = new Date(d.data || d.data_vencimento || new Date());
      const mes = data.getMonth() + 1;
      const ano = data.getFullYear();

      if (mes !== mesSelecionado || ano !== anoSelecionado) return;

      // Filtro de categoria
      if (filtroCategoria !== "todas" && (d.categoria || "") !== filtroCategoria) return;

      // Filtro de texto
      if (q) {
        const txt = [d.descricao, d.fornecedor, d.numero_doc, d.numero_nf].join(" ").toLowerCase();
        if (!txt.includes(q)) return;
      }

      const chave = chaveAgrupamento(d);
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(d);
    });

    return Array.from(mapa.entries()).map(([chave, items]) => ({
      chave,
      categoria: items[0].categoria || "Sem categoria",
      fornecedor: items[0].fornecedor || "Sem fornecedor",
      itens: items,
      valorTotal: items.reduce((sum, d) => sum + d.valor_total, 0),
      valorRateado: items.reduce((sum, d) => sum + d.valor_rateado, 0),
    }));
  }, [despesas, mesSelecionado, anoSelecionado, filtroTexto, filtroCategoria]);

  const totalGeral = useMemo(
    () => despesasAgrupadas.reduce((sum, g) => sum + g.valorTotal, 0),
    [despesasAgrupadas]
  );

  return (
    <div className="space-y-4">
      {/* Header + Filtros */}
      <div className="rounded-2xl bg-card/40 backdrop-blur-md border border-border/40 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">Gestão Financeira</h2>
              <p className="text-xs text-muted-foreground">
                {MESES[mesSelecionado - 1]}/{anoSelecionado}
                {aeronaveLabel ? ` · ${aeronaveLabel}` : ""}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
              Total do Período
            </p>
            <p className="text-2xl font-bold font-mono text-foreground">
              {formatBRL(totalGeral)}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2.5">
          <Select value={String(mesSelecionado)} onValueChange={(v) => setMesSelecionado(Number(v))}>
            <SelectTrigger className="w-40 h-10 bg-background/60 border-border/50 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(anoSelecionado)} onValueChange={(v) => setAnoSelecionado(Number(v))}>
            <SelectTrigger className="w-28 h-10 bg-background/60 border-border/50 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anos.map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-56 h-10 bg-background/60 border-border/50 rounded-xl">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {categoriasDisponiveis.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição, fornecedor, documento..."
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              className="pl-9 h-10 bg-background/60 border-border/50 rounded-xl"
            />
          </div>

          <Button
            variant="outline"
            className="h-10 rounded-xl bg-background/60 border-border/50 gap-2 px-3"
            title="Exportar para PDF"
          >
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Tabela Financeira */}
      <div className="rounded-2xl bg-card/40 backdrop-blur-md border border-border/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border/40">
                <th className="px-4 py-3 text-left font-semibold text-foreground/80">Data</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground/80">Categoria</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground/80">Fornecedor</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground/80">Descrição</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground/80">Documento</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground/80">Pagador</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground/80">Valor Total</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground/80">Rateado</th>
                <th className="px-4 py-3 text-center font-semibold text-foreground/80">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {despesasAgrupadas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhuma despesa encontrada no período.
                  </td>
                </tr>
              ) : (
                despesasAgrupadas.map((grupo) => (
                  <GrupoLinhas key={grupo.chave} grupo={grupo} />
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-muted/20 border-t border-border/40">
                <td colSpan={6} className="px-4 py-3 text-right font-semibold text-foreground">
                  TOTAL:
                </td>
                <td className="px-4 py-3 text-right font-bold font-mono text-foreground">
                  {formatBRL(totalGeral)}
                </td>
                <td className="px-4 py-3 text-right font-bold font-mono text-foreground">
                  {formatBRL(despesasAgrupadas.reduce((sum, g) => sum + g.valorRateado, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function GrupoLinhas({ grupo }: { grupo: any }) {
  const [expandido, setExpandido] = useState(false);

  return (
    <>
      <tr
        className="hover:bg-primary/5 cursor-pointer transition-colors border-b border-border/20"
        onClick={() => setExpandido(!expandido)}
      >
        <td className="px-4 py-3 text-sm text-muted-foreground">
          {formatDate(grupo.itens[0].data || grupo.itens[0].data_vencimento)}
        </td>
        <td className="px-4 py-3">
          <Badge variant="outline" className="text-xs">
            {grupo.categoria}
          </Badge>
        </td>
        <td className="px-4 py-3 text-sm font-medium text-foreground">
          {grupo.fornecedor}
        </td>
        <td className="px-4 py-3 text-sm text-foreground/80">
          {grupo.itens.length > 1 ? (
            <span className="text-muted-foreground">
              {grupo.itens.length} lançamento(s) agrupado(s)
            </span>
          ) : (
            grupo.itens[0].descricao
          )}
        </td>
        <td className="px-4 py-3 text-sm font-mono text-cyan-500 font-bold">
          {grupo.itens[0].numero_doc || grupo.itens[0].numero_nf || "—"}
        </td>
        <td className="px-4 py-3 text-sm">
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              grupo.itens[0].pago_por_tipo === "CLIENTE"
                ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                : "border-border text-muted-foreground"
            )}
          >
            {grupo.itens[0].pago_por}
          </Badge>
        </td>
        <td className="px-4 py-3 text-right font-bold font-mono text-foreground">
          {formatBRL(grupo.valorTotal)}
        </td>
        <td className="px-4 py-3 text-right font-bold font-mono text-foreground/80">
          {formatBRL(grupo.valorRateado)}
        </td>
        <td className="px-4 py-3 text-center">
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              (grupo.itens[0].status || "").toLowerCase() === "pago"
                ? "border-success/40 text-success bg-success/10"
                : "border-amber-500/40 text-amber-400 bg-amber-500/10"
            )}
          >
            {grupo.itens[0].status || "Pendente"}
          </Badge>
        </td>
        <td className="px-4 py-3 text-center">
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform inline",
              expandido && "rotate-180"
            )}
          />
        </td>
      </tr>

      {expandido && grupo.itens.length > 1 && (
        <>
          {grupo.itens.map((item, idx) => (
            <tr key={item.id} className="bg-muted/10 hover:bg-primary/5 transition-colors">
              <td className="px-4 py-2 text-xs text-muted-foreground pl-8">
                {formatDate(item.data || item.data_vencimento)}
              </td>
              <td colSpan={2} className="px-4 py-2 text-xs text-muted-foreground">
                {item.socio_nome || item.cliente_nome || "—"}
              </td>
              <td className="px-4 py-2 text-xs text-muted-foreground">
                {item.descricao}
              </td>
              <td className="px-4 py-2 text-xs font-mono text-cyan-500">
                {item.numero_doc || item.numero_nf || "—"}
              </td>
              <td className="px-4 py-2 text-xs">
                {item.percentual_uso && (
                  <span className="text-amber-500 font-bold">Uso: {item.percentual_uso}%</span>
                )}
              </td>
              <td className="px-4 py-2 text-right font-mono text-sm text-foreground">
                {formatBRL(item.valor_total)}
              </td>
              <td className="px-4 py-2 text-right font-mono text-sm text-foreground/80">
                {formatBRL(item.valor_rateado)}
              </td>
              <td />
            </tr>
          ))}
        </>
      )}
    </>
  );
}
