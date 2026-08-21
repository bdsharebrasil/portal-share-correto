import { Fragment, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  HandCoins,
  Landmark,
  Paperclip,
  Pencil,
  Plane,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import {
  CLIENTE_DGA_ID,
  dateOf,
  isDga,
  isDgaCotistaOutOfPocket,
  isDgaPaidByBank,
  isEntrada,
  periodOf,
  valueOf,
} from "@/utils/financeiroRules";
import { deleteMovimentacao } from "@/services/financeiroService";
import NovaDespesaClienteForm from "@/components/dashboard/gestor/financeiro-share/NovaDespesaClienteForm";
import EditLancamentoModal from "@/components/dashboard/gestor/financeiro-share/EditLancamentoModal";

type CampoOrdenacao = "data" | "valor" | "categoria" | "status";
type Direcao = "asc" | "desc";
type ModoData = "pagamento" | "vencimento";

const ANEXO_CAMPOS: { campo: string; label: string }[] = [
  { campo: "comprovante_url", label: "Comprovante" },
  { campo: "recibo_url", label: "Recibo" },
  { campo: "nf_url", label: "Nota fiscal" },
  { campo: "boleto_url", label: "Boleto" },
  { campo: "demonstrativo_url", label: "Demonstrativo" },
  { campo: "relatorio_url", label: "Relatório" },
  { campo: "comanda_url", label: "Comanda" },
];

const STATUS_STYLE: Record<string, string> = {
  PAGO: "bg-emerald-500/15 text-emerald-400",
  RECEBIDO: "bg-emerald-500/15 text-emerald-400",
  REEMBOLSADO: "bg-emerald-500/15 text-emerald-400",
  ENTRADA: "bg-sky-500/15 text-sky-400",
  APORTE: "bg-sky-500/15 text-sky-400",
  PENDENTE: "bg-amber-500/15 text-amber-400",
  AGUARDANDO_REEMBOLSO: "bg-amber-500/15 text-amber-400",
  PARCIAL: "bg-orange-500/15 text-orange-400",
  ATRASADO: "bg-red-500/15 text-red-400",
  VENCIDO: "bg-red-500/15 text-red-400",
  SAIDA: "bg-slate-500/15 text-muted-foreground",
  DESPESA: "bg-slate-500/15 text-muted-foreground",
};

function formatarPeriodo(periodo: string) {
  const [ano, mes] = periodo.split("-");
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${meses[Number(mes) - 1]} / ${ano}`;
}

function nomeCategoria(m: any) {
  return String(m.categoria_nome || "Sem categoria").trim() || "Sem categoria";
}

function formatarData(valor: any) {
  if (!valor) return "—";
  return new Date(`${String(valor).slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR");
}

// Retorna a data do lançamento de acordo com o modo de visualização escolhido (pagamento ou vencimento).
function dataPorModo(m: any, modo: "pagamento" | "vencimento") {
  return modo === "vencimento" ? m.data_vencimento : m.data_pagamento;
}

// Junta os principais campos textuais em uma string única para a busca livre.
function textoBuscavel(m: any): string {
  return [
    m.descricao,
    m.descricao_despesa,
    m.socios_nome,
    m.pago_por,
    m.categoria_nome,
    m.fornecedor_nome,
    m.numero_voo,
    m.status,
    m.numero_nf,
    m.numero_boleto,
    m.numero_doc,
    m.numero_recibo,
    m.clientes_nome,
    m.forma_pagamento,
    m.conta_bancaria,
    m.observacoes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function anexosDe(m: any) {
  return ANEXO_CAMPOS.map(({ campo, label }) => ({ label, url: m[campo] })).filter((a) => a.url);
}

function extensaoDe(url: string) {
  return String(url).split("?")[0].split(".").pop()?.toLowerCase() || "";
}
function ehImagem(url: string) {
  return ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extensaoDe(url));
}
function ehPdf(url: string) {
  return extensaoDe(url) === "pdf";
}

// Normaliza um valor digitado (aceita "1.234,56", "1234,56" ou "1234.56") para comparação numérica.
function parseValorDigitado(texto: string): number | null {
  const limpo = texto.trim().replace(/\./g, "").replace(",", ".");
  if (!limpo) return null;
  const numero = Number(limpo);
  return Number.isFinite(numero) ? numero : null;
}

// Cor de acordo com o tipo de movimentação: entrada (verde), despesa paga pelo banco (vermelho) ou paga por cotista (âmbar).
function tipoCor(m: any) {
  if (isEntrada(m)) return { texto: "text-emerald-400", barra: "bg-emerald-500" };
  if (isDgaCotistaOutOfPocket(m)) return { texto: "text-amber-400", barra: "bg-amber-500" };
  return { texto: "text-red-400", barra: "bg-red-500" };
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = String(status || "").toUpperCase().trim();
  if (!s) return <span className="text-muted-foreground">—</span>;
  const classe = STATUS_STYLE[s] || "bg-muted text-muted-foreground";
  const rotulo = s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${classe}`}>{rotulo}</span>;
}

function CampoDetalhe({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm ${destaque ? "font-bold text-violet-200" : "font-semibold"}`}>{valor}</div>
    </div>
  );
}

export default function DgaSituacao({
  movimentacoes,
  rateios = [],
  socios,
  onChanged,
}: {
  movimentacoes: any[];
  rateios?: any[];
  socios: any[];
  onChanged?: () => void;
}) {
  const [showNova, setShowNova] = useState(false);
  const [detalhe, setDetalhe] = useState<{ titulo: string; itens: any[] } | null>(null);
  const [anexosItem, setAnexosItem] = useState<any | null>(null);
  const [anexoAtivo, setAnexoAtivo] = useState<{ label: string; url: string } | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [mesSelecionado, setMesSelecionado] = useState("");
  const [editMovId, setEditMovId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  // No DGA, pendências devem ser agrupadas pela data de vencimento por padrão.
  // Pagamento continua disponível para conferência de lançamentos quitados.
  const [modoData, setModoData] = useState<ModoData>("vencimento");
  const [campoOrdenacao, setCampoOrdenacao] = useState<CampoOrdenacao>("data");
  const [direcao, setDirecao] = useState<Direcao>("desc");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const dga = useMemo(() => {
    const movimentacoesDga = movimentacoes.filter(isDga);
    const idsMovimentacoes = new Set(movimentacoes.map((m) => String(m.id)));
    const abastecimentosSemMovimentacao = rateios
      .filter((r) => String(r.fonte_despesa || "").toLowerCase() === "abastecimento")
      .filter((r) => String(r.cliente_id || "") === CLIENTE_DGA_ID)
      .filter((r) => !idsMovimentacoes.has(String(r.despesa_id)))
      .map((r) => ({
        ...r,
        id: r.despesa_id || r.id,
        clientes_id: r.cliente_id,
        clientes_nome: r.clientes_nome,
        tipo_caixa: "cliente",
        fluxo: "despesa",
        descricao: r.descricao_despesa,
        valor_rateado: r.valor_rateado,
        data_pagamento: r.data_pagamento,
        data_vencimento: r.data_vencimento,
        status: r.status,
        _fromRateio: true,
      }));

    return [...movimentacoesDga, ...abastecimentosSemMovimentacao]
      .filter((m) => String(m.status || "").toLowerCase() !== "cancelado");
  }, [movimentacoes, rateios]);
  const entradas = dga.filter(isEntrada).reduce((s, m) => s + valueOf(m), 0);
  const despesasBancoList = dga.filter(isDgaPaidByBank);
  const cotistasList = dga.filter(isDgaCotistaOutOfPocket);
  const saidasBanco = despesasBancoList.reduce((s, m) => s + valueOf(m), 0);
  const saidasCotistas = cotistasList.reduce((s, m) => s + valueOf(m), 0);
  const saldo = entradas - saidasBanco;

  const cotistas = useMemo(() => {
    const cotistaMap = new Map<string, number>();
    cotistasList.forEach((m) => {
      const key = m.socio_id || m.socios_nome || "Cotista não identificado";
      cotistaMap.set(key, (cotistaMap.get(key) || 0) + valueOf(m));
    });
    return Array.from(cotistaMap.entries())
      .map(([id, total]) => ({ id, total, nome: socios.find((s) => s.id === id)?.nome || id }))
      .sort((a, b) => b.total - a.total);
  }, [cotistasList, socios]);

  const mensal = useMemo(() => {
    const map = new Map<string, any>();
    for (const m of dga) {
      const periodo = periodOf(dataPorModo(m, modoData));
      if (!periodo) continue;
      if (!map.has(periodo)) map.set(periodo, { periodo, aportes: 0, despesasBanco: 0, pagoCotistas: 0 });
      const row = map.get(periodo);
      if (isEntrada(m)) row.aportes += valueOf(m);
      else if (isDgaCotistaOutOfPocket(m)) row.pagoCotistas += valueOf(m);
      else row.despesasBanco += valueOf(m);
    }
    return Array.from(map.values()).sort((a, b) => b.periodo.localeCompare(a.periodo));
  }, [dga, modoData]);

  const periodos = useMemo(() => mensal.map((row) => row.periodo), [mensal]);

  // Resultado do período em exibição: se houver mês selecionado, calcula apenas dele; caso contrário usa o saldo geral.
  const resultadoExibido = useMemo(() => {
    if (!mesSelecionado) return { label: "Saldo geral", valor: saldo };
    const row = mensal.find((r) => r.periodo === mesSelecionado);
    const valor = row ? row.aportes - row.despesasBanco : 0;
    return { label: `Resultado de ${formatarPeriodo(mesSelecionado)}`, valor };
  }, [mesSelecionado, mensal, saldo]);

  const valorDigitado = useMemo(() => parseValorDigitado(busca), [busca]);

  const extratoFiltrado = useMemo(
    () =>
      dga
        .filter((m) => !mesSelecionado || periodOf(dataPorModo(m, modoData)) === mesSelecionado)
        .filter((m) => {
          const termo = busca.trim().toLowerCase();
          if (!termo) return true;

          // Busca livre: descrição, sócio, categoria, fornecedor, voo, status, documentos etc.
          if (textoBuscavel(m).includes(termo)) return true;

          // Busca por valor: compara ignorando o separador de milhar, então "9000" encontra "9.000,00".
          const valor = valueOf(m);
          const valorSemSeparador = formatBRL(valor).toLowerCase().replace(/\./g, "");
          const termoSemSeparador = termo.replace(/\./g, "");
          if (valorSemSeparador.includes(termoSemSeparador)) return true;

          // Também aceita o valor digitado como número (com ou sem casas decimais).
          if (valorDigitado !== null && Math.abs(valor - valorDigitado) < 0.005) return true;

          return false;
        }),
    [dga, mesSelecionado, busca, valorDigitado, modoData],
  );

  const extratoOrdenado = useMemo(() => {
    const sinal = direcao === "asc" ? 1 : -1;
    return [...extratoFiltrado].sort((a, b) => {
      if (campoOrdenacao === "valor") return (valueOf(a) - valueOf(b)) * sinal;
      if (campoOrdenacao === "categoria") return nomeCategoria(a).localeCompare(nomeCategoria(b)) * sinal;
      if (campoOrdenacao === "status") return String(a.status || "").localeCompare(String(b.status || "")) * sinal;
      return String(dataPorModo(a, modoData) || "").localeCompare(String(dataPorModo(b, modoData) || "")) * sinal;
    });
  }, [extratoFiltrado, campoOrdenacao, direcao, modoData]);

  const idsVisiveis = useMemo(() => extratoOrdenado.map((m) => m.id), [extratoOrdenado]);
  const totalSelecionado = useMemo(
    () => extratoOrdenado.filter((m) => selecionados.has(m.id)).reduce((s, m) => s + valueOf(m), 0),
    [extratoOrdenado, selecionados],
  );
  const todosSelecionados = idsVisiveis.length > 0 && idsVisiveis.every((id) => selecionados.has(id));

  const alternarSelecaoTodos = () => {
    setSelecionados(() => (todosSelecionados ? new Set() : new Set(idsVisiveis)));
  };

  const alternarSelecao = (id: string) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  const alternarExpandido = (id: string) => {
    setExpandidos((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  const alternarDirecao = (campo: CampoOrdenacao) => {
    if (campo === campoOrdenacao) {
      setDirecao((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setCampoOrdenacao(campo);
      setDirecao(campo === "valor" ? "desc" : "asc");
    }
  };

  const abrirDetalhe = (titulo: string, filtro: (m: any) => boolean) =>
    setDetalhe({
      titulo,
      itens: dga.filter(filtro).sort((a, b) => String(dateOf(b) || "").localeCompare(String(dateOf(a) || ""))),
    });

  const excluir = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta movimentação DGA?")) return;
    try {
      await deleteMovimentacao(id);
      toast.success("Movimentação excluída.");
      setSelecionados((prev) => {
        const novo = new Set(prev);
        novo.delete(id);
        return novo;
      });
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir movimentação.");
    }
  };

  const excluirSelecionados = async () => {
    if (selecionados.size === 0) return;
    if (!confirm(`Deseja realmente excluir ${selecionados.size} movimentação(ões) selecionada(s)?`)) return;
    try {
      await Promise.all(Array.from(selecionados).map((id) => deleteMovimentacao(id)));
      toast.success(`${selecionados.size} movimentação(ões) excluída(s).`);
      setSelecionados(new Set());
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir movimentações selecionadas.");
    }
  };

  const SortButton = ({ campo, label }: { campo: CampoOrdenacao; label: string }) => {
    const ativo = campoOrdenacao === campo;
    return (
      <button
        onClick={() => alternarDirecao(campo)}
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition ${
          ativo ? "bg-violet-500/15 text-violet-300" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        }`}
      >
        {label}
        {ativo ? (
          direcao === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-violet-500/10 p-3"><Building2 className="h-5 w-5 text-violet-400" /></div>
            <div>
              <div className="text-xs uppercase tracking-wider text-violet-300/70">Entidade independente</div>
              <h2 className="text-xl font-bold">DGA</h2>
              <p className="mt-1 text-sm text-muted-foreground">Despesas e aportes vinculados ao caixa DGA.</p>
            </div>
          </div>
          <button onClick={() => setShowNova((value) => !value)} className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
            <Plus className="mr-1 inline h-3.5 w-3.5" /> Nova movimentação DGA
          </button>
        </div>
      </div>

      {showNova && (
        <NovaDespesaClienteForm
          modo="dga"
          onCancel={() => setShowNova(false)}
          onSaved={() => { setShowNova(false); onChanged?.(); }}
        />
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Kpi label="Saldo bancário" value={saldo} icon={Landmark} />
        <Kpi label="Aportes" value={entradas} icon={Landmark} onClick={() => abrirDetalhe("Aportes DGA", isEntrada)} />
        <Kpi label="Despesas banco DGA" value={saidasBanco} icon={Building2} onClick={() => abrirDetalhe("Despesas pagas pelo banco DGA", isDgaPaidByBank)} />
        <Kpi label="Pago por cotistas" value={saidasCotistas} icon={Users} onClick={() => abrirDetalhe("Despesas pagas por cotistas", isDgaCotistaOutOfPocket)} />
        <Kpi label="A acertar com cotistas" value={saidasCotistas} icon={HandCoins} onClick={() => abrirDetalhe("A acertar com cotistas", isDgaCotistaOutOfPocket)} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
        <div className="flex flex-col gap-4 border-b border-border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-bold">Extrato DGA</div>
              <div className="text-xs text-muted-foreground">Clique em uma linha para ver o rateio e o pagamento. Use o lápis para editar.</div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={mesSelecionado}
                onChange={(e) => setMesSelecionado(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos os meses</option>
                {periodos.map((periodo) => <option key={periodo} value={periodo}>{formatarPeriodo(periodo)}</option>)}
              </select>

              <div className="flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2">
                <span className="text-[10px] uppercase tracking-wider text-violet-300/70">{resultadoExibido.label}</span>
                <span className={`text-sm font-bold ${resultadoExibido.valor < 0 ? "text-red-400" : "text-violet-200"}`}>
                  {formatBRL(resultadoExibido.valor)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground">Ver por</span>
              <div className="inline-flex overflow-hidden rounded-md border border-border">
                <button
                  onClick={() => setModoData("pagamento")}
                  className={`px-2.5 py-1 text-[11px] font-semibold transition ${
                    modoData === "pagamento" ? "bg-violet-500/20 text-violet-300" : "text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  Pagamento
                </button>
                <button
                  onClick={() => setModoData("vencimento")}
                  className={`px-2.5 py-1 text-[11px] font-semibold transition ${
                    modoData === "vencimento" ? "bg-violet-500/20 text-violet-300" : "text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  Vencimento
                </button>
              </div>

              <span className="ml-3 mr-1 text-[10px] uppercase tracking-wider text-muted-foreground">Ordenar por</span>
              <SortButton campo="data" label="Data" />
              <SortButton campo="valor" label="Valor" />
              <SortButton campo="categoria" label="Categoria" />
              <SortButton campo="status" label="Status" />
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="digite sua busca.."
                className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Entrada</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Despesa </span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Despesa (pago direto cotista)</span>
          </div>

          {selecionados.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2">
              <div className="text-xs font-semibold text-amber-300">
                {selecionados.size} selecionado(s) · soma {formatBRL(totalSelecionado)}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setSelecionados(new Set())} className="rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted/40">
                  Limpar seleção
                </button>
                <button onClick={() => void excluirSelecionados()} className="inline-flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/25">
                  <Trash2 className="h-3.5 w-3.5" /> Excluir selecionados
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="w-9 px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={todosSelecionados}
                    onChange={alternarSelecaoTodos}
                    className="h-3.5 w-3.5 accent-violet-500"
                    aria-label="Selecionar todos"
                  />
                </th>
                <th className="w-2 px-0 py-3"></th>
                <th className="w-6 px-1 py-3"></th>
                <th className="px-3 py-3 text-left">
                  Data <span className="normal-case text-violet-300">({modoData === "pagamento" ? "pagamento" : "vencimento"})</span>
                </th>
                <th className="px-3 py-3 text-left">Descrição</th>
                <th className="px-3 py-3 text-left">Categoria</th>
                <th className="px-3 py-3 text-left">Voo</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Pago por</th>
                <th className="px-3 py-3 text-center">Anexos</th>
                <th className="px-3 py-3 text-right">Valor</th>
                <th className="px-3 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {extratoOrdenado.map((m) => {
                const cor = tipoCor(m);
                const anexos = anexosDe(m);
                const temRateio = m.percentual_sociedade != null && Number(m.percentual_sociedade) < 100;
                const vencePendente = ["PENDENTE", "AGUARDANDO_REEMBOLSO", "ATRASADO", "VENCIDO"].includes(
                  String(m.status || "").toUpperCase(),
                ) && m.data_vencimento;
                const expandido = expandidos.has(m.id);

                return (
                  <Fragment key={m.id}>
                  <tr
                    className={`cursor-pointer border-t border-border/60 hover:bg-muted/20 ${selecionados.has(m.id) ? "bg-violet-500/[0.05]" : ""} ${expandido ? "bg-muted/20" : ""}`}
                    onClick={() => alternarExpandido(m.id)}
                  >
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selecionados.has(m.id)}
                        onChange={() => alternarSelecao(m.id)}
                        className="h-3.5 w-3.5 accent-violet-500"
                        aria-label="Selecionar lançamento"
                      />
                    </td>
                    <td className="px-0 py-3"><span className={`block h-6 w-1 rounded-full ${cor.barra}`} /></td>
                    <td className="px-1 py-3 text-muted-foreground">
                      {expandido ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <div>{formatarData(dataPorModo(m, modoData))}</div>
                      {!dataPorModo(m, modoData) && (
                        <div className="text-[10px] text-muted-foreground">sem {modoData}</div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold">{m.descricao || m.descricao_despesa || "—"}</div>
                      {(m.fornecedor_nome || temRateio) && (
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {m.fornecedor_nome && <span>{m.fornecedor_nome}</span>}
                          {m.fornecedor_nome && temRateio && <span> · </span>}
                          {temRateio && (
                            <span>Rateio {Number(m.percentual_sociedade)}% · {formatBRL(m.valor_rateado ?? valueOf(m))}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{nomeCategoria(m)}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {m.numero_voo ? (
                        <span className="inline-flex items-center gap-1"><Plane className="h-3 w-3" /> {m.numero_voo}</span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={m.status} />
                      {vencePendente && (
                        <div className="mt-0.5 text-[10px] text-muted-foreground">Vence {formatarData(m.data_vencimento)}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{m.socios_nome || m.pago_por || "—"}</td>
                    <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      {anexos.length > 0 ? (
                        <button
                          onClick={() => (anexos.length === 1 ? setAnexoAtivo(anexos[0]) : setAnexosItem(m))}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-violet-300 hover:bg-violet-500/10"
                          title={`${anexos.length} anexo(s)`}
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-semibold">{anexos.length}</span>
                        </button>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className={`px-3 py-3 text-right font-bold tabular-nums ${cor.texto}`}>{formatBRL(valueOf(m))}</td>
                    <td className="px-3 py-3 text-right">
                      <button aria-label="Editar" className="mr-1 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={(e) => { e.stopPropagation(); setEditMovId(m.id); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button aria-label="Excluir" className="rounded p-1.5 text-red-400 hover:bg-red-500/10" onClick={(e) => { e.stopPropagation(); void excluir(m.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                  {expandido && (
                    <tr className="border-t border-border/60 bg-muted/10">
                      <td colSpan={12} className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-violet-300/70">Rateio e pagamento</div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                          <CampoDetalhe label="Quem pagou" valor={m.socios_nome || m.clientes_nome || m.pago_por || "—"} />
                          <CampoDetalhe label="Valor rateado" valor={m.valor_rateado != null ? formatBRL(Number(m.valor_rateado)) : "—"} destaque />
                          <CampoDetalhe label="Valor pago real" valor={m.valor_pago_real != null ? formatBRL(Number(m.valor_pago_real)) : "—"} destaque />
                          <CampoDetalhe label="Valor total" valor={m.valor_total != null ? formatBRL(Number(m.valor_total)) : "—"} />
                          <CampoDetalhe label="Tipo de rateio" valor={m.tipo_rateio || "—"} />
                          <CampoDetalhe label="Forma de pagamento" valor={m.forma_pagamento || "—"} />
                          <CampoDetalhe label="Periodicidade" valor={m.periodicidade || "—"} />
                          <CampoDetalhe label="% de uso" valor={m.percentual_uso != null ? `${Number(m.percentual_uso)}%` : "—"} />
                          <CampoDetalhe label="% sociedade" valor={m.percentual_sociedade != null ? `${Number(m.percentual_sociedade)}%` : "—"} />
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {extratoOrdenado.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {busca.trim() ? "Nenhum lançamento encontrado para essa busca." : "Nenhum lançamento para o período."}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
        <div className="flex items-center gap-2 border-b border-border p-4"><Users className="h-4 w-4 text-violet-400" /><div className="font-bold">Acertos pendentes com cotistas</div></div>
        <div className="divide-y divide-border/60">{cotistas.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">Nenhum pagamento pessoal de cotista identificado.</div> : cotistas.map((c) => <div key={c.id} className="flex items-center justify-between px-4 py-3"><div><div className="font-semibold">{c.nome}</div><div className="text-xs text-muted-foreground">Pago diretamente pelo cotista</div></div><div className="text-lg font-bold text-amber-400">{formatBRL(c.total)}</div></div>)}</div>
      </div>

      {detalhe && <DetalheModal titulo={detalhe.titulo} itens={detalhe.itens} onClose={() => setDetalhe(null)} />}
      {anexosItem && (
        <AnexosModal
          item={anexosItem}
          onClose={() => setAnexosItem(null)}
          onSelecionar={(a) => { setAnexosItem(null); setAnexoAtivo(a); }}
        />
      )}
      {anexoAtivo && <VisualizadorAnexo anexo={anexoAtivo} onClose={() => setAnexoAtivo(null)} />}
      {editMovId && <EditLancamentoModal movId={editMovId} onClose={() => setEditMovId(null)} onSaved={() => { setEditMovId(null); onChanged?.(); }} />}
    </div>
  );
}

function DetalheModal({ titulo, itens, onClose }: { titulo: string; itens: any[]; onClose: () => void }) {
  const total = itens.reduce((s, m) => s + valueOf(m), 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">{titulo}</h3>
            <div className="text-xs text-muted-foreground">{itens.length} lançamento(s) · total {formatBRL(total)}</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full text-xs">
            <tbody>
              {itens.map((m) => (
                <tr key={m.id} className="border-t border-border/60">
                  <td className="whitespace-nowrap px-4 py-3">{formatarData(dateOf(m))}</td>
                  <td className="px-4 py-3 font-semibold">{m.descricao || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{nomeCategoria(m)}</td>
                  <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                  <td className="px-4 py-3 text-right font-bold">{formatBRL(valueOf(m))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {itens.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">Nenhum lançamento.</div>}
        </div>
      </div>
    </div>
  );
}

function AnexosModal({
  item,
  onClose,
  onSelecionar,
}: {
  item: any;
  onClose: () => void;
  onSelecionar: (anexo: { label: string; url: string }) => void;
}) {
  const anexos = anexosDe(item);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">Anexos</h3>
            <div className="text-xs text-muted-foreground">{item.descricao || item.descricao_despesa || "Lançamento DGA"}</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="divide-y divide-border/60">
          {anexos.map((a) => (
            <button
              key={a.label}
              onClick={() => onSelecionar(a)}
              className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm hover:bg-muted/30"
            >
              <Paperclip className="h-3.5 w-3.5 text-violet-400" />
              <span className="font-semibold">{a.label}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">Ver</span>
            </button>
          ))}
          {anexos.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Nenhum anexo disponível.</div>}
        </div>
      </div>
    </div>
  );
}

// Visualizador central: mostra o anexo (imagem ou PDF) sobre a tela, sem depender de abrir nova aba.
function VisualizadorAnexo({ anexo, onClose }: { anexo: { label: string; url: string }; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><Paperclip className="h-3.5 w-3.5 text-violet-400" /> {anexo.label}</div>
          <div className="flex items-center gap-1">
            <a
              href={anexo.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Abrir em nova guia"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto bg-black/20 p-3">
          {ehImagem(anexo.url) ? (
            <img src={anexo.url} alt={anexo.label} className="max-h-[78vh] max-w-full rounded-lg object-contain" />
          ) : ehPdf(anexo.url) ? (
            <iframe src={anexo.url} title={anexo.label} className="h-[78vh] w-full rounded-lg bg-white" />
          ) : (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-muted-foreground">
              <Paperclip className="h-6 w-6" />
              <span>Este tipo de arquivo não pode ser exibido aqui.</span>
              <a href={anexo.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
                <ExternalLink className="h-3.5 w-3.5" /> Abrir em nova guia
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, onClick }: { label: string; value: number; icon: any; onClick?: () => void }) {
  const Wrapper: any = onClick ? "button" : "div";
  return (
    <Wrapper onClick={onClick} className={`rounded-xl border border-border bg-card/60 p-3 text-left ${onClick ? "transition hover:border-violet-500/40 hover:bg-violet-500/[0.06]" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-violet-400" />
      </div>
      <div className="mt-1 text-lg font-bold">{formatBRL(value)}</div>
      {onClick && <div className="mt-0.5 text-[10px] text-violet-300/70">ver lançamentos</div>}
    </Wrapper>
  );
}