import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePickerCalendar } from "@/components/ui/date-picker-calendar";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { CalendarIcon, Search, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

interface Cotista { id: string; nome: string; percentual: number; }

interface CentroLancamentosProps {
  aeronaveId: string;
  cotistas: Cotista[];
  aeronaveLabel?: string;
}

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const TIPOS_RATEIO = ["FIXO", "VARIAVEL_POR_HORA", "VARIAVEL_POR_VOO", "EXTRA"] as const;
const PERIODICIDADES = ["MENSAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL", "EVENTUAL"] as const;

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s.length <= 10 ? s + "T00:00:00" : s);
  return format(d, "dd/MM/yyyy");
};

interface GrupoLancamento {
  chave: string;
  despesa_id: string | null;
  ids: string[]; // rateio ids
  data_pagamento: string | null;
  data_vencimento: string | null;
  numero_doc: string | null;
  fornecedor_nome: string | null;
  descricao_despesa: string | null;
  categoria_custo: string | null;
  tipo_rateio: string | null;
  periodicidade: string | null;
  fluxo: string | null;
  pago_por: string | null;
  valor_total_despesa: number;
  rateiosPorCotista: Map<string, any>; // cliente_id -> rateio row
}

export function CentroLancamentos({ aeronaveId, cotistas, aeronaveLabel }: CentroLancamentosProps) {
  const qc = useQueryClient();
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [busca, setBusca] = useState("");

  // Rateios da aeronave
  const { data: rateios = [], isLoading } = useQuery({
    queryKey: ["centro-lancamentos", aeronaveId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("rateio_despesas")
        .select("*")
        .eq("aeronave_id", aeronaveId)
        .order("data_pagamento", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!aeronaveId,
  });

  // Fornecedores (favoritos + combustível)
  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-combo"],
    queryFn: async () => {
      const [fav, comb] = await Promise.all([
        supabase.from("fornecedores_favoritos" as any).select("id, nome_completo").order("nome_completo"),
        supabase.from("fornecedores_combustivel" as any).select("id, nome_fornecedor").order("nome_fornecedor"),
      ]);
      const items: { id: string; label: string }[] = [];
      (fav.data || []).forEach((f: any) => items.push({ id: f.nome_completo, label: f.nome_completo }));
      (comb.data || []).forEach((f: any) => items.push({ id: f.nome_fornecedor, label: f.nome_fornecedor }));
      // Dedup por label
      const map = new Map<string, { id: string; label: string }>();
      items.forEach((i) => i.label && map.set(i.label, i));
      return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    },
  });

  // Categorias (movimentacao + expense_configu)
  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-combo"],
    queryFn: async () => {
      const [cm, ec] = await Promise.all([
        supabase.from("categorias_movimentacao" as any).select("nome").eq("ativo", true).order("nome"),
        supabase.from("expense_configu" as any).select("expense_type").order("expense_type"),
      ]);
      const set = new Set<string>();
      (cm.data || []).forEach((c: any) => c.nome && set.add(String(c.nome).toUpperCase()));
      (ec.data || []).forEach((c: any) => c.expense_type && set.add(String(c.expense_type).toUpperCase()));
      return Array.from(set).sort().map((n) => ({ id: n, label: n }));
    },
  });

  // Agrupamento por despesa_id (ou id se avulso)
  const grupos = useMemo<GrupoLancamento[]>(() => {
    const map = new Map<string, GrupoLancamento>();
    (rateios as any[]).forEach((r: any) => {
      const chave = r.despesa_id || r.id;
      if (!map.has(chave)) {
        map.set(chave, {
          chave,
          despesa_id: r.despesa_id || null,
          ids: [],
          data_pagamento: r.data_pagamento,
          data_vencimento: r.data_vencimento,
          numero_doc: r.numero_doc,
          fornecedor_nome: r.fornecedor_nome,
          descricao_despesa: r.descricao_despesa,
          categoria_custo: r.categoria_custo,
          tipo_rateio: r.tipo_rateio,
          periodicidade: r.periodicidade,
          fluxo: r.fluxo,
          pago_por: r.pago_por,
          valor_total_despesa: Number(r.valor_total_despesa) || 0,
          rateiosPorCotista: new Map(),
        });
      }
      const g = map.get(chave)!;
      g.ids.push(r.id);
      if (r.cliente_id) {
        g.rateiosPorCotista.set(r.cliente_id, r);
      }
      if (r.socio_id) {
        g.rateiosPorCotista.set(r.socio_id, r);
      }
    });
    return Array.from(map.values());
  }, [rateios]);

  // Filtro mês/ano/busca
  const gruposFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return grupos.filter((g) => {
      const ref = g.data_pagamento || g.data_vencimento;
      if (ref) {
        const d = new Date(ref + "T00:00:00");
        if (d.getMonth() + 1 !== mes || d.getFullYear() !== ano) return false;
      } else {
        return false;
      }
      if (q) {
        const t = [g.descricao_despesa, g.fornecedor_nome, g.numero_doc, g.categoria_custo]
          .filter(Boolean).join(" ").toLowerCase();
        if (!t.includes(q)) return false;
      }
      return true;
    });
  }, [grupos, mes, ano, busca]);

  const totalPeriodo = gruposFiltrados.reduce((s, g) => s + g.valor_total_despesa, 0);
  const anos = Array.from({ length: 6 }, (_, i) => hoje.getFullYear() - i);

  // Update helper — aplica em todas as linhas do mesmo lançamento
  async function updateGrupo(g: GrupoLancamento, patch: Record<string, any>) {
    const { error } = await (supabase as any)
      .from("rateio_despesas")
      .update(patch)
      .in("id", g.ids);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Atualizado");
    qc.invalidateQueries({ queryKey: ["centro-lancamentos", aeronaveId] });
  }

  return (
    <div className="space-y-4">
      {/* Header + filtros */}
      <div className="rounded-2xl bg-card/40 backdrop-blur-md border border-border/40 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">Centro de Lançamentos</h2>
              <p className="text-xs text-muted-foreground">
                {MESES[mes - 1]}/{ano}
                {aeronaveLabel ? ` · ${aeronaveLabel}` : ""}
                {" · "}{gruposFiltrados.length} lançamento(s)
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
              Total do Período
            </p>
            <p className="text-2xl font-bold font-mono">{formatBRL(totalPeriodo)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="w-40 h-10 bg-background/60 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-28 h-10 bg-background/60 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição, fornecedor, documento, categoria..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-10 bg-background/60 rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-2xl bg-card/40 backdrop-blur-md border border-border/40 overflow-hidden">
        {/* Scroll horizontal superior sincronizado */}
        <div
          ref={topScrollRef}
          onScroll={() => {
            if (bottomScrollRef.current && topScrollRef.current) {
              bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
            }
          }}
          className="overflow-x-auto overflow-y-hidden border-b border-border/40 bg-muted/20 sticky top-0 z-20"
          style={{ scrollbarGutter: "stable" }}
        >
          <div style={{ width: tableWidth, height: 1 }} />
        </div>
        <div
          ref={bottomScrollRef}
          onScroll={() => {
            if (topScrollRef.current && bottomScrollRef.current) {
              topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
            }
          }}
          className="overflow-x-auto"
        >
          <table ref={tableRef} className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border/40 text-[11px]">
                <th className="px-3 py-2.5 text-left font-semibold w-28">Data</th>
                <th className="px-3 py-2.5 text-left font-semibold w-32">Doc</th>
                <th className="px-3 py-2.5 text-left font-semibold min-w-[180px]">Fornecedor</th>
                <th className="px-3 py-2.5 text-left font-semibold min-w-[200px]">Descrição</th>
                <th className="px-3 py-2.5 text-left font-semibold min-w-[180px]">Categoria</th>
                <th className="px-3 py-2.5 text-left font-semibold w-40">Tipo de Rateio</th>
                <th className="px-3 py-2.5 text-left font-semibold w-32">Periodicidade</th>
                <th className="px-3 py-2.5 text-center font-semibold w-20">Fluxo</th>
                <th className="px-3 py-2.5 text-left font-semibold w-32">Pago Por</th>
                {cotistas.map((c) => (
                  <th key={c.id} colSpan={2} className="px-3 py-2.5 text-center font-semibold border-l border-border/40 min-w-[180px]">
                    <div className="text-[11px] font-semibold truncate">{c.nome || c.id}</div>
                    <div className="text-[9px] text-muted-foreground font-normal">{c.percentual}% cota</div>
                  </th>
                ))}
              </tr>
              <tr className="bg-muted/20 border-b border-border/40 text-[10px] text-muted-foreground">
                <th colSpan={9} />
                {cotistas.map((c) => (
                  <Fragment key={c.id}>
                    <th className="px-2 py-1 text-center border-l border-border/40 font-medium">% Uso</th>
                    <th className="px-2 py-1 text-right font-medium">Rateio</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {isLoading ? (
                <tr><td colSpan={9 + cotistas.length * 2} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
              ) : gruposFiltrados.length === 0 ? (
                <tr><td colSpan={9 + cotistas.length * 2} className="px-4 py-8 text-center text-muted-foreground">Nenhum lançamento no período.</td></tr>
              ) : (
                gruposFiltrados.map((g) => (
                  <LinhaGrupo
                    key={g.chave}
                    g={g}
                    cotistas={cotistas}
                    fornecedores={fornecedores}
                    categorias={categorias}
                    onUpdate={(patch) => updateGrupo(g, patch)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LinhaGrupo({
  g, cotistas, fornecedores, categorias, onUpdate,
}: {
  g: GrupoLancamento;
  cotistas: Cotista[];
  fornecedores: { id: string; label: string }[];
  categorias: { id: string; label: string }[];
  onUpdate: (patch: Record<string, any>) => Promise<void> | void;
}) {
  const [openDate, setOpenDate] = useState(false);
  const [doc, setDoc] = useState(g.numero_doc || "");
  const [desc, setDesc] = useState(g.descricao_despesa || "");

  useEffect(() => { setDoc(g.numero_doc || ""); }, [g.numero_doc]);
  useEffect(() => { setDesc(g.descricao_despesa || ""); }, [g.descricao_despesa]);

  const dataRef = g.data_pagamento || g.data_vencimento;

  return (
    <tr className="hover:bg-primary/5 transition-colors">
      {/* Data */}
      <td className="px-2 py-2">
        <Popover open={openDate} onOpenChange={setOpenDate}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5 w-full justify-start font-normal">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs">{fmtDate(dataRef)}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0 border-0 z-[9999]">
            <DatePickerCalendar
              value={dataRef ? new Date(dataRef + "T00:00:00") : undefined}
              onChange={(d) => {
                if (!d) return;
                const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                onUpdate({ data_pagamento: iso, data_vencimento: iso });
                setOpenDate(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </td>

      {/* Doc */}
      <td className="px-2 py-2">
        <Input
          value={doc}
          onChange={(e) => setDoc(e.target.value)}
          onBlur={() => { if (doc !== (g.numero_doc || "")) onUpdate({ numero_doc: doc || null }); }}
          className="h-8 text-xs font-mono"
        />
      </td>

      {/* Fornecedor */}
      <td className="px-2 py-2">
        <SearchableCombobox
          items={fornecedores}
          value={g.fornecedor_nome || ""}
          onChange={(_id, label) => onUpdate({ fornecedor_nome: label })}
          placeholder="Fornecedor"
          searchPlaceholder="Buscar fornecedor..."
          allowFreeText
        />
      </td>

      {/* Descrição */}
      <td className="px-2 py-2">
        <Input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => { if (desc !== (g.descricao_despesa || "")) onUpdate({ descricao_despesa: desc }); }}
          className="h-8 text-xs"
        />
      </td>

      {/* Categoria */}
      <td className="px-2 py-2">
        <SearchableCombobox
          items={categorias}
          value={g.categoria_custo || ""}
          onChange={(_id, label) => onUpdate({ categoria_custo: label })}
          placeholder="Categoria"
          searchPlaceholder="Buscar categoria..."
          allowFreeText
        />
      </td>

      {/* Tipo de Rateio */}
      <td className="px-2 py-2">
        <Select value={g.tipo_rateio || ""} onValueChange={(v) => onUpdate({ tipo_rateio: v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {TIPOS_RATEIO.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </td>

      {/* Periodicidade */}
      <td className="px-2 py-2">
        <Select value={(g.periodicidade || "").toUpperCase()} onValueChange={(v) => onUpdate({ periodicidade: v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {PERIODICIDADES.map((p) => <SelectItem key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</SelectItem>)}
          </SelectContent>
        </Select>
      </td>

      {/* Fluxo */}
      <td className="px-2 py-2 text-center">
        <Badge variant="outline" className={cn("text-[10px]",
          (g.fluxo || "").toUpperCase().includes("ENTRA")
            ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
            : "border-rose-500/40 text-rose-400 bg-rose-500/10"
        )}>
          {g.fluxo || "—"}
        </Badge>
      </td>

      {/* Pago Por */}
      <td className="px-2 py-2">
        <span className="text-xs font-medium">{g.pago_por || "—"}</span>
      </td>

      {/* Colunas por cotista */}
      {cotistas.map((c) => {
        const r = g.rateiosPorCotista.get(c.id);
        const pctUso = r ? (Number(r.percentual_uso) || Number(r.percentual_sociedade) || 0) : 0;
        const rateado = r ? Number(r.valor_rateado) || 0 : 0;
        return (
          <Fragment key={c.id}>
            <td className="px-2 py-2 text-center border-l border-border/40 text-xs font-medium text-amber-500">
              {r ? `${pctUso.toFixed(2)}%` : "—"}
            </td>
            <td className="px-2 py-2 text-right font-mono text-xs">
              {r ? (
                <div className="text-right">
                  <div>{formatBRL(rateado)}</div>
                  {Number(r.valor_pago_real || 0) > 0 && (
                    <div className="text-[10px] text-muted-foreground">Pago: {formatBRL(Number(r.valor_pago_real || 0))}</div>
                  )}
                </div>
              ) : "—"}
            </td>
          </Fragment>
        );
      })}
    </tr>
  );
}
