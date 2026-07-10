// @ts-nocheck
import { Layout } from "@/components/layout/Layout";
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  ArrowLeft,
  Building,
  Plane,
  Users,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Paperclip,
  UploadCloud,
  Lock,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { syncCotistaReembolsoMirror, deleteCotistaReembolsoMirror } from "@/lib/cotistaFinanceSync";
import { useEffect, useMemo, useState } from "react";

type GrupoCusto = "FIXO" | "VARIAVEL" | "EXTRA";

type Socio = {
  id: string;
  nome: string;
  cpf?: string | null;
  percentual_participacao?: number | null;
  percentual?: number;
};

type RateioInput = {
  socio_id: string;
  socio_nome: string;
  socio_cpf: string | null;
  percentual: number;
  valor_pago_real: number;
};

type AnexoTipo = "comprovante" | "recibo" | "nf" | "boleto";
type AnexoItem = {
  id: string;
  tipo: AnexoTipo;
  url: string | null;
  file: File | null;
  uploading: boolean;
};

const GRUPOS = [
  { id: "FIXO", label: "FIXO" },
  { id: "VARIAVEL_POR_HORA", label: "VARIÁVEL POR HORA" },
  { id: "VARIAVEL_POR_VOO", label: "VARIÁVEL POR VOO" },
  { id: "EXTRA", label: "EXTRA" },
];

const STATUS_OPTIONS = [
  { id: "pago", label: "Pago" },
  { id: "pendente", label: "Pendente" },
];

const FORMA_PGTO = [
  { id: "PIX", label: "PIX" },
  { id: "TED", label: "TED / Transferência" },
  { id: "BOLETO", label: "Boleto" },
  { id: "DINHEIRO", label: "Dinheiro" },
  { id: "CARTAO", label: "Cartão" },
];

const PERIODICIDADE = [
  { id: "MENSAL", label: "Mensal" },
  { id: "TRIMESTRAL", label: "Trimestral" },
  { id: "SEMESTRAL", label: "Semestral" },
  { id: "ANUAL", label: "Anual" },
  { id: "EVENTUAL", label: "Eventual" },
];

const TIPO_ANEXO = [
  { id: "comprovante", label: "Comprovante" },
  { id: "recibo", label: "Recibo" },
  { id: "nf", label: "Nota Fiscal" },
  { id: "boleto", label: "Boleto" },
];

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

interface LancamentoFormProps {
  clienteId?: string;
  clienteNome?: string;
  aeronaveId?: string | null;
  aeronaveRegistro?: string | null;
  socios?: Socio[];
  editing?: any | null;
  onSaved?: () => void;
  onCancel?: () => void;
  isModal?: boolean;
}

function DateField({
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState(
    value ? format(new Date(value + "T12:00:00"), "dd/MM/yyyy") : ""
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setInputValue(value ? format(new Date(value + "T12:00:00"), "dd/MM/yyyy") : "");
  }, [value]);

  const dateValue = value ? new Date(value + "T12:00:00") : undefined;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 8) v = v.slice(0, 8);
    if (v.length >= 5) v = v.slice(0, 2) + "/" + v.slice(2, 4) + "/" + v.slice(4);
    else if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
    setInputValue(v);

    if (v.length === 10) {
      const [dd, mm, yyyy] = v.split("/");
      const parsed = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
      if (!isNaN(parsed.getTime())) {
        onChange(format(parsed, "yyyy-MM-dd"));
      }
    } else if (v.length === 0) {
      onChange("");
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, "yyyy-MM-dd"));
      setInputValue(format(date, "dd/MM/yyyy"));
      setOpen(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="h-11 rounded-xl border-border/70 text-sm flex-1"
        maxLength={10}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-xl border-border/70 flex-shrink-0"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-[9999]" align="end" sideOffset={4}>
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={handleCalendarSelect}
            locale={ptBR}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="bg-card/60 backdrop-blur-md border-border/40 shadow-lg">
      <CardContent className="p-6 space-y-6">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}

export default function LancamentoForm(props: LancamentoFormProps) {
  const isModalContext = props.isModal === true;
  
  // Props do contexto (página)
  const { clienteId: paramClienteId, aeronaveId: paramAeronaveId } = useParams<{ clienteId: string; aeronaveId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  
  // Resolver clienteId e aeronaveId
  const clienteId = props.clienteId || paramClienteId;
  const aeronaveIdParam = props.aeronaveId || paramAeronaveId;
  const clienteNomeProp = props.clienteNome;
  const sociosProp = props.socios;
  const editingProp = props.editing;
  const onSavedProp = props.onSaved;
  const onCancelProp = props.onCancel;
  
  const despesaPrefill = (location.state as any)?.despesaPrefill ?? null;
  const editingId = searchParams.get("editing");

  // Buscar dados do cliente
  const { data: cliente, isLoading: loadingCliente } = useQuery({
    queryKey: ["cliente-lancamento", clienteId],
    enabled: !!clienteId && !isModalContext,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, razao_social, cnpj, url_logo, status")
        .eq("id", clienteId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const clienteData = isModalContext ? { razao_social: clienteNomeProp, status: "ativo" } : cliente;

  // Buscar dados da aeronave
  const { data: aeronave } = useQuery({
    queryKey: ["aeronave-lancamento", aeronaveIdParam],
    enabled: !!aeronaveIdParam && !isModalContext,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aeronave")
        .select("id, matricula, modelo, fabricante")
        .eq("id", aeronaveIdParam)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Buscar lançamento se editando
  const { data: lancamentoEditando } = useQuery({
    queryKey: ["lancamento-edit", editingId],
    enabled: !!editingId && !isModalContext,
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
      return data;
    },
  });

  const editingFinal = editingProp || (() => {
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
        aeronave_id: p.aeronave_id ?? aeronaveIdParam ?? null,
        client_id: p.cliente_id ?? clienteId ?? null,
        forma_pagamento: p.forma_pagamento ?? "",
        periodicidade: "EVENTUAL",
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

  // Buscar sócios
  const { data: sociosData } = useQuery({
    queryKey: ["socios-cliente-lanc", clienteId],
    enabled: !!clienteId && !isModalContext,
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

  const socios = sociosProp || sociosData || [];

  // Form state
  const [descricao, setDescricao] = useState("");
  const [grupo, setGrupo] = useState<GrupoCusto>("FIXO");
  const [valor, setValor] = useState("");
  const [dataCompetencia, setDataCompetencia] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [dataVencimento, setDataVencimento] = useState("");
  const [dataPagamento, setDataPagamento] = useState("");
  const [pagador, setPagador] = useState<string>("EMPRESA");
  const [status, setStatus] = useState<"pago" | "pendente">("pago");
  const [observacoes, setObservacoes] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [categoriaCusto, setCategoriaCusto] = useState("");
  const [formaPgto, setFormaPgto] = useState("");
  const [periodicidade, setPeriodicidade] = useState("EVENTUAL");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [numeroNf, setNumeroNf] = useState("");
  const [numeroBoleto, setNumeroBoleto] = useState("");
  const [numeroRecibo, setNumeroRecibo] = useState("");
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [rateios, setRateios] = useState<RateioInput[]>([]);
  const [anexos, setAnexos] = useState<AnexoItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [aeronaveSelected, setAeronaveSelected] = useState<string>(aeronaveIdParam ?? "");

  // Aeronaves
  const { data: clienteAeronaves = [] } = useQuery({
    queryKey: ["cliente-aeronaves", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data } = await supabase
        .from("cotistas_aeronave")
        .select("id_aeronave, aeronave!id_aeronave(id, matricula, modelo)")
        .eq("id_clientes", clienteId);
      return (data ?? []) as Array<{
        id_aeronave: string;
        aeronave: { id: string; matricula: string; modelo: string } | null;
      }>;
    },
  });

  const { data: todasAeronaves = [] } = useQuery({
    queryKey: ["todas-aeronaves"],
    queryFn: async () => {
      const { data } = await supabase
        .from("aeronave")
        .select("id, matricula, modelo")
        .eq("ativo", true)
        .order("matricula");
      return (data ?? []) as Array<{ id: string; matricula: string; modelo: string }>;
    },
  });

  // Categorias
  const { data: categorias } = useQuery({
    queryKey: ["categorias-mov-cotista"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("categorias_movimentacao")
        .select("id, nome, tipo, grupo_categoria")
        .eq("tipo", "despesa")
        .eq("ativo", true)
        .not("grupo_categoria", "in", '("FOLHA DE PAGAMENTO","DESPESAS EMPRESA","DESPESAS PARTICULARES","BANCO","TED")')
        .order("nome");
      return (data ?? []) as Array<{ id: string; nome: string; grupo_categoria: string | null }>;
    },
  });

  // Init from editing
  useEffect(() => {
    if (editingFinal) {
      setDescricao(editingFinal.descricao ?? "");
      setGrupo((editingFinal.grupo_custo as GrupoCusto) ?? "FIXO");
      setValor(String(editingFinal.valor ?? ""));
      setDataCompetencia(editingFinal.data_competencia ?? format(new Date(), "yyyy-MM-dd"));
      setDataPagamento(editingFinal.data_pagamento ?? "");
      setStatus((editingFinal.status as any) === "pago" ? "pago" : "pendente");
      setObservacoes(editingFinal.observacoes ?? "");
      setFornecedorNome(editingFinal.fornecedor_nome ?? "");
      setAeronaveSelected(editingFinal.aeronave_id ?? aeronaveIdParam ?? "");
      setFormaPgto(editingFinal.forma_pagamento ?? "");
      setPeriodicidade(editingFinal.periodicidade ?? "EVENTUAL");
      setDataVencimento(editingFinal.data_vencimento ?? "");
      setNumeroDoc(editingFinal.numero_doc ?? "");
      setNumeroNf(editingFinal.numero_nf ?? "");
      setNumeroBoleto(editingFinal.numero_boleto ?? "");
      setNumeroRecibo(editingFinal.numero_recibo ?? "");

      const initialAnexos: AnexoItem[] = [];
      if (editingFinal.comprovante_url)
        initialAnexos.push({ id: crypto.randomUUID(), tipo: "comprovante", url: editingFinal.comprovante_url, file: null, uploading: false });
      if (editingFinal.recibo_url)
        initialAnexos.push({ id: crypto.randomUUID(), tipo: "recibo", url: editingFinal.recibo_url, file: null, uploading: false });
      if (editingFinal.nf_url)
        initialAnexos.push({ id: crypto.randomUUID(), tipo: "nf", url: editingFinal.nf_url, file: null, uploading: false });
      if (editingFinal.boleto_url)
        initialAnexos.push({ id: crypto.randomUUID(), tipo: "boleto", url: editingFinal.boleto_url, file: null, uploading: false });
      setAnexos(initialAnexos);

      (async () => {
        const { data: rs } = await (supabase as any)
          .from("rateio_despesas")
          .select(
            "socio_id, socios_nome, percentual_sociedade, valor_pago_real, pago_por, fluxo, categoria_custo"
          )
          .eq("despesa_id", editingFinal.id);

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

        if (carregados.length) {
          setRateios(carregados);
          const first = (rs ?? [])[0];
          if (first?.fluxo === "cliente") setPagador("CLIENTE");
          else if (first?.fluxo === "empresa") setPagador("EMPRESA");
          else {
            const pagou = (rs ?? []).find((r: any) => Number(r.valor_pago_real ?? 0) > 0);
            setPagador(pagou ? pagou.socio_id : "EMPRESA");
          }
          if (first) {
            setCategoriaCusto(first.categoria_custo ?? "");
          }
        } else {
          seedFromSocios();
        }
      })();
    } else {
      seedFromSocios();
    }
    function seedFromSocios() {
      setRateios(
        socios.map((s) => ({
          socio_id: s.id,
          socio_nome: s.nome,
          socio_cpf: s.cpf,
          percentual: Number(s.percentual_participacao ?? 0),
          valor_pago_real: 0,
        }))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingFinal, socios]);

  const valorNum = Number(valor.replace(",", ".")) || 0;

  useEffect(() => {
    if (pagador === "CLIENTE" && rateios.length > 0) {
      const pct = rateios.length === 3 ? 33.3333 : +(100 / rateios.length).toFixed(4);
      
      setRateios((rs) => rs.map((r) => {
        return { 
          ...r, 
          percentual: pct, 
          valor_pago_real: 0,
        };
      }));
    } else if (pagador === "EMPRESA") {
      setRateios((rs) => rs.map((r) => ({ ...r, valor_pago_real: 0 })));
    } else {
      setRateios((rs) =>
        rs.map((r) => ({
          ...r,
          valor_pago_real: pagador === r.socio_id ? valorNum : 0,
        }))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagador, valor, rateios.length]);

  const somaPct = useMemo(
    () => rateios.reduce((s, r) => s + (Number(r.percentual) || 0), 0),
    [rateios]
  );
  const somaPago = useMemo(
    () => rateios.reduce((s, r) => s + (Number(r.valor_pago_real) || 0), 0),
    [rateios]
  );
  const pctOk = Math.abs(somaPct - 100) < 0.05;
  const algumNeg = rateios.some((r) => Number(r.percentual) < 0);
  const pagoExcede = somaPago > valorNum + 0.01;

  const isClienteRateio = pagador === "CLIENTE";

  function setPct(idx: number, v: string) {
    if (isClienteRateio) return;
    const n = Number(v.replace(",", ".")) || 0;
    setRateios((rs) => rs.map((r, i) => (i === idx ? { ...r, percentual: n } : r)));
  }
  function distribuirIgualmente() {
    if (!rateios.length) return;
    const p = +(100 / rateios.length).toFixed(2);
    setRateios((rs) => rs.map((r) => ({ ...r, percentual: p })));
  }

  function addAnexo() {
    setAnexos((a) => [
      ...a,
      { id: crypto.randomUUID(), tipo: "comprovante", url: null, file: null, uploading: false },
    ]);
  }
  function removeAnexo(id: string) {
    setAnexos((a) => a.filter((x) => x.id !== id));
  }
  function setAnexoTipo(id: string, tipo: AnexoTipo) {
    setAnexos((a) => a.map((x) => (x.id === id ? { ...x, tipo } : x)));
  }
  async function uploadAnexo(id: string, file: File) {
    setAnexos((a) => a.map((x) => (x.id === id ? { ...x, file, uploading: true } : x)));
    try {
      const ext = file.name.split(".").pop();
      const path = `cotistas/${clienteId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("documentos").upload(path, file, {
        upsert: false,
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("documentos").getPublicUrl(path);
      setAnexos((a) => a.map((x) => (x.id === id ? { ...x, url: pub.publicUrl, uploading: false } : x)));
      toast.success("Anexo enviado");
    } catch (e: any) {
      toast.error("Falha no upload: " + e.message);
      setAnexos((a) => a.map((x) => (x.id === id ? { ...x, uploading: false } : x)));
    }
  }

  function getAnexoUrls() {
    const map: Record<AnexoTipo, string | null> = {
      comprovante: null,
      recibo: null,
      nf: null,
      boleto: null,
    };
    anexos.forEach((a) => {
      if (a.url) map[a.tipo] = a.url;
    });
    return {
      comprovante_url: map.comprovante,
      recibo_url: map.recibo,
      nf_url: map.nf,
      boleto_url: map.boleto,
    };
  }

  async function ensureCategoria(): Promise<string | null> {
    if (categoriaId) return categoriaId;
    const nome = `Rateio - ${grupo}`;
    const { data: existing } = await (supabase as any)
      .from("categorias_movimentacao")
      .select("id")
      .eq("nome", nome)
      .maybeSingle();
    if (existing?.id) return existing.id;
    const { data: created } = await (supabase as any)
      .from("categorias_movimentacao")
      .insert({
        nome,
        tipo: "despesa",
        grupo_categoria: grupo,
        ativo: true,
      })
      .select("id")
      .single();
    return created?.id ?? null;
  }

  async function refreshPartnerAccount(socioId: string, socioNome: string, socioCpf: string | null) {
    if (!socioCpf) return;
    const { data: txs } = await (supabase as any)
      .from("partner_transactions")
      .select("tipo, valor")
      .eq("clientes_id", clienteId)
      .eq("socio_cpf", socioCpf);

    let totalDep = 0;
    let totalGasto = 0;
    (txs ?? []).forEach((t: any) => {
      const v = Number(t.valor) || 0;
      if (t.tipo === "deposit" || t.tipo === "credit") totalDep += v;
      else if (t.tipo === "debit" || t.tipo === "withdrawal") totalGasto += v;
    });
    const saldo = totalDep - totalGasto;

    const { data: existing } = await (supabase as any)
      .from("partner_accounts")
      .select("id")
      .eq("clientes_id", clienteId)
      .eq("socio_cpf", socioCpf)
      .maybeSingle();

    if (existing?.id) {
      await (supabase as any)
        .from("partner_accounts")
        .update({ total_depositado: totalDep, total_gasto: totalGasto, saldo_atual: saldo })
        .eq("id", existing.id);
    } else {
      await (supabase as any).from("partner_accounts").insert({
        clientes_id: clienteId,
        socio_cpf: socioCpf,
        socio_nome: socioNome,
        socios_id: socioId,
        total_depositado: totalDep,
        total_gasto: totalGasto,
        saldo_atual: saldo,
      });
    }
  }

  async function handleSave() {
    if (!descricao.trim()) return toast.error("Informe a descrição");
    if (valorNum <= 0) return toast.error("Valor deve ser maior que zero");
    if (!rateios.length) return toast.error("Cliente não tem cotistas cadastrados");
    if (algumNeg) return toast.error("Percentuais negativos não são permitidos");
    if (!pctOk) return toast.error(`Soma dos percentuais é ${somaPct.toFixed(2)}% (deve ser 100%)`);
    if (pagoExcede) return toast.error("Soma dos valores pagos excede o valor total");

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const pagadorSocio = pagador !== "EMPRESA" && pagador !== "CLIENTE"
        ? rateios.find((r) => r.socio_id === pagador)
        : null;

      let pagoPor: string;
      let pagoPorTipo: string;
      let pagoPorId: string | null = null;

      if (pagador === "EMPRESA") {
        pagoPor = "EMPRESA";
        pagoPorTipo = "EMPRESA";
        pagoPorId = null;
      } else if (pagador === "CLIENTE") {
        pagoPor = clienteId;
        pagoPorTipo = "CLIENTE";
        pagoPorId = clienteId;
      } else {
        pagoPor = pagadorSocio?.id ?? pagadorSocio?.socio_nome ?? "";
        pagoPorTipo = "SOCIO";
        pagoPorId = pagadorSocio?.id ?? null;
      }

      const fornecedor = fornecedorNome.trim() || "EMPRESA";

      const fluxo =
        pagador === "EMPRESA" ? "empresa" :
        pagador === "CLIENTE" ? "cliente" : "direto";

      const anexoUrls = getAnexoUrls();
      const catId = await ensureCategoria();

      const movPayload: any = {
        descricao: descricao.trim(),
        tipo: "despesa",
        grupo_custo: grupo,
        valor: valorNum,
        data_competencia: dataCompetencia,
        data_vencimento: dataVencimento || dataCompetencia,
        data_pagamento: status === "pago" ? (dataPagamento || dataCompetencia) : null,
        client_id: clienteId,
        aeronave_id: aeronaveSelected || aeronaveIdParam,
        fornecedor_nome: fornecedor,
        forma_pagamento: formaPgto || null,
        numero_doc: numeroDoc || null,
        numero_nf: numeroNf || null,
        numero_boleto: numeroBoleto || null,
        comprovante_url: anexoUrls.comprovante_url,
        nf_url: anexoUrls.nf_url,
        boleto_url: anexoUrls.boleto_url,
        status,
        observacoes: observacoes || null,
        reembolsavel: pagador === "EMPRESA",
        reembolso_quitado: false,
        pago_diretamente: pagador !== "EMPRESA",
        criado_por: user?.id ?? null,
        categoria_id: catId,
        reference_type: "rateio_despesa",
      };

      let movId: string;
      if (editingFinal) {
        const { error } = await (supabase as any)
          .from("movimentacoes")
          .update(movPayload)
          .eq("id", editingFinal.id);
        if (error) throw error;
        movId = editingFinal.id;
        await (supabase as any)
          .from("partner_transactions")
          .delete()
          .eq("referencia_id", movId)
          .eq("tipo_referencia", "movimentacao_rateio");
        await (supabase as any).from("rateio_despesas").delete().eq("despesa_id", movId);
      } else {
        const { data: ins, error } = await (supabase as any)
          .from("movimentacoes")
          .insert({ ...movPayload, reference_id: null })
          .select("id")
          .single();
        if (error) throw error;
        movId = ins.id;
        await (supabase as any)
          .from("movimentacoes")
          .update({ reference_id: movId })
          .eq("id", movId);
      }

      const aeroSelecionada = clienteAeronaves.find((a) => a.id_aeronave === aeronaveSelected)?.aeronave;
      const rateioRows = rateios.map((r) => ({
        despesa_id: movId,
        fonte_despesa: "movimentacoes",
        tipo_rateio: grupo,
        cliente_id: clienteId,
        clientes_nome: clienteNomeProp || clienteData?.razao_social,
        aeronave_id: aeronaveSelected || aeronaveIdParam,
        aeronave_registro: aeroSelecionada?.matricula || props.aeronaveRegistro,
        socio_id: r.socio_id,
        socios_nome: r.socio_nome,
        percentual_sociedade: r.percentual,
        valor_total_despesa: valorNum,
        valor_rateado: +((valorNum * r.percentual) / 100).toFixed(2),
        valor_pago_real: r.valor_pago_real,
        status,
        descricao_despesa: descricao,
        categoria_id: catId,
        categoria_custo: categoriaCusto || null,
        data_vencimento: dataVencimento || dataCompetencia,
        data_pagamento: status === "pago" ? (dataPagamento || dataCompetencia) : null,
        pago_por: pagoPor,
        pago_por_tipo: pagoPorTipo,
        pago_por_id: pagoPorId,
        pago_diretamente: pagador !== "EMPRESA",
        fluxo,
        forma_pagamento: formaPgto || null,
        periodicidade: periodicidade || "EVENTUAL",
        fornecedor_nome: fornecedor,
        numero_doc: numeroDoc || null,
        numero_nf: numeroNf || null,
        numero_boleto: numeroBoleto || null,
        numero_recibo: numeroRecibo || null,
        comprovante_url: anexoUrls.comprovante_url,
        recibo_url: anexoUrls.recibo_url,
        nf_url: anexoUrls.nf_url,
        boleto_url: anexoUrls.boleto_url,
        observacoes: observacoes || null,
      }));
      const { error: e2 } = await (supabase as any).from("rateio_despesas").insert(rateioRows);
      if (e2) throw e2;

      if (status === "pago" && pagador !== "CLIENTE") {
        const debitRows = rateios
          .filter((r) => r.socio_cpf && r.percentual > 0)
          .map((r) => {
            const valorDebito = +((valorNum * r.percentual) / 100).toFixed(2);
            return {
              clientes_id: clienteId,
              socio_cpf: r.socio_cpf!,
              socio_nome: r.socio_nome,
              tipo: "debit",
              valor: valorDebito,
              saldo_antes: 0,
              saldo_depois: 0,
              descricao: `${descricao} (rateio ${r.percentual}%)`,
              tipo_referencia: "movimentacao_rateio",
              referencia_id: movId,
              data_pagamento: dataPagamento || dataCompetencia,
              status: "confirmado",
              criado_por: user?.id ?? null,
            };
          });
        if (debitRows.length) {
          await (supabase as any).from("partner_transactions").insert(debitRows);
        }
      }

      await syncCotistaReembolsoMirror({
        movId,
        clienteId,
        clienteNome: clienteNomeProp || clienteData?.razao_social,
        aeronaveId: aeronaveIdParam,
        pagador,
        valorTotal: valorNum,
        data: dataCompetencia,
        status,
        descricao,
        criadoPor: user?.id ?? null,
      });

      for (const r of rateios) {
        if (r.socio_cpf) await refreshPartnerAccount(r.socio_id, r.socio_nome, r.socio_cpf);
      }

      qc.invalidateQueries({ queryKey: ["financeiro-cotista-detalhe"] });
      
      toast.success(editingFinal ? "Lançamento atualizado" : "Lançamento criado");
      
      if (onSavedProp) {
        onSavedProp();
      } else {
        navigate(`/financeiro/financeiro-cotistas/${clienteId}`);
      }
    } catch (e: any) {
      toast.error("Erro: " + (e.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  }

  const handleCancel = () => {
    if (onCancelProp) {
      onCancelProp();
    } else {
      navigate(`/financeiro/financeiro-cotistas/${clienteId}`);
    }
  };

  if (!isModalContext && loadingCliente) {
    return (
      <Layout>
        <div className="animate-pulse space-y-6 max-w-7xl mx-auto">
          <div className="h-4 w-32 bg-muted/50 rounded-full" />
          <div className="h-48 bg-card/40 backdrop-blur-md rounded-2xl border border-border/40" />
        </div>
      </Layout>
    );
  }

  if (!isModalContext && !clienteData) {
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

  const pagadorOptions = [
    { id: "EMPRESA", label: "Empresa (Share Brasil) — paga e cobra reembolso dos sócios" },
    { id: "CLIENTE", label: `Cliente (${clienteNomeProp || clienteData?.razao_social}) — rateio igualitário automático entre sócios` },
    ...socios.map((s) => ({ id: s.id, label: `Sócio: ${s.nome}` })),
  ];

  const categoriaOptions = (categorias ?? []).map((c) => ({
    id: c.id,
    label: c.grupo_categoria ? `${c.nome}  ·  ${c.grupo_categoria}` : c.nome,
  }));

  const formContent = (
    <div className="space-y-6">
      <Section title="Identificação" hint="Descrição, grupo de custo e categoria contábil">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <Field label="Descrição" required>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: Hangaragem outubro / Manutenção 100h / DARF DAS"
                className="h-11 rounded-xl"
              />
            </Field>
          </div>

          <Field label="Grupo de custo" required>
            <SearchableCombobox
              items={GRUPOS}
              value={grupo}
              onChange={(v) => setGrupo(v as GrupoCusto)}
              placeholder="Selecione o grupo"
            />
          </Field>

          <Field label="Categoria">
            <SearchableCombobox
              items={categoriaOptions}
              value={categoriaId}
              onChange={(v) => setCategoriaId(v)}
              placeholder="Buscar categoria..."
              searchPlaceholder="Digite para filtrar..."
            />
          </Field>

          <Field label="Categoria de custo (texto livre)">
            <Input
              value={categoriaCusto}
              onChange={(e) => setCategoriaCusto(e.target.value)}
              placeholder="Ex.: Manutenção, Combustível..."
              className="h-11 rounded-xl"
            />
          </Field>

          <Field label="Periodicidade">
            <SearchableCombobox
              items={PERIODICIDADE}
              value={periodicidade}
              onChange={(v) => setPeriodicidade(v)}
              placeholder="Selecione"
            />
          </Field>
        </div>
      </Section>

      <Section title="Valores e Pagamento">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Field label="Valor total (R$)" required>
            <Input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              className="h-11 rounded-xl text-right font-mono"
            />
          </Field>

          <Field label="Pagador" required>
            <SearchableCombobox
              items={pagadorOptions}
              value={pagador}
              onChange={(v) => setPagador(v)}
              placeholder="Quem pagou?"
              searchPlaceholder="Buscar..."
            />
          </Field>

          <Field label="Status">
            <SearchableCombobox
              items={STATUS_OPTIONS}
              value={status}
              onChange={(v) => setStatus(v as any)}
              placeholder="Status"
            />
          </Field>

          <Field label="Data competência" required>
            <DateField value={dataCompetencia} onChange={setDataCompetencia} />
          </Field>

          <Field label="Data vencimento">
            <DateField value={dataVencimento} onChange={setDataVencimento} />
          </Field>

          <Field label="Data pagamento">
            <DateField value={dataPagamento} onChange={setDataPagamento} />
          </Field>

          <Field label="Forma de pagamento">
            <SearchableCombobox
              items={FORMA_PGTO}
              value={formaPgto}
              onChange={(v) => setFormaPgto(v)}
              placeholder="PIX, TED, Boleto..."
            />
          </Field>

          <Field label="Fornecedor (opcional)">
            <Input
              value={fornecedorNome}
              onChange={(e) => setFornecedorNome(e.target.value)}
              placeholder="Nome do fornecedor"
              className="h-11 rounded-xl"
            />
          </Field>

          <Field label="Aeronave" required>
            {clienteAeronaves.length === 0 ? (
              <div className="text-sm text-muted-foreground p-3 rounded-xl bg-muted/20 border border-border/40">
                Nenhuma aeronave cadastrada para este cotista.
              </div>
            ) : (
              <SearchableCombobox
                items={[
                  ...clienteAeronaves.map((a) => ({
                    id: a.id_aeronave,
                    label: `${a.aeronave?.matricula || "?"} — ${a.aeronave?.modelo || ""}`,
                  })),
                  { id: "__separator__", label: "" },
                  ...todasAeronaves
                    .filter((t) => !clienteAeronaves.some((c) => c.id_aeronave === t.id))
                    .map((a) => ({
                      id: a.id,
                      label: `${a.matricula} (emprestada) — ${a.modelo}`,
                    })),
                ]}
                value={aeronaveSelected}
                onChange={setAeronaveSelected}
                placeholder="Selecione a aeronave..."
                searchPlaceholder="Buscar por matrícula ou modelo..."
              />
            )}
          </Field>
        </div>
      </Section>

      <Section title="Documentos fiscais" hint="Números de documentos, notas fiscais, boletos e recibos relacionados">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Field label="Nº Documento">
            <Input value={numeroDoc} onChange={(e) => setNumeroDoc(e.target.value)} className="h-11 rounded-xl" />
          </Field>
          <Field label="Nº Nota Fiscal">
            <Input value={numeroNf} onChange={(e) => setNumeroNf(e.target.value)} className="h-11 rounded-xl" />
          </Field>
          <Field label="Nº Boleto">
            <Input value={numeroBoleto} onChange={(e) => setNumeroBoleto(e.target.value)} className="h-11 rounded-xl" />
          </Field>
          <Field label="Nº Recibo">
            <Input value={numeroRecibo} onChange={(e) => setNumeroRecibo(e.target.value)} className="h-11 rounded-xl" />
          </Field>
        </div>
      </Section>

      <Section title="Anexos" hint="Adicione comprovantes, recibos, notas fiscais ou boletos. Cada tipo grava em sua coluna correspondente.">
        <div className="space-y-3">
          {anexos.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border/60 rounded-xl">
              Nenhum anexo adicionado.
            </div>
          )}
          {anexos.map((a) => (
            <div
              key={a.id}
              className="grid grid-cols-12 gap-3 items-center p-3 rounded-xl border border-border/40 bg-muted/20"
            >
              <div className="col-span-12 md:col-span-3">
                <SearchableCombobox
                  items={TIPO_ANEXO}
                  value={a.tipo}
                  onChange={(v) => setAnexoTipo(a.id, v as AnexoTipo)}
                  placeholder="Tipo"
                />
              </div>
              <div className="col-span-12 md:col-span-7">
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-2"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    {a.file?.name ?? a.url.split("/").pop()}
                  </a>
                ) : (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    <UploadCloud className="h-4 w-4" />
                    {a.uploading ? "Enviando..." : "Selecionar arquivo"}
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadAnexo(a.id, f);
                      }}
                    />
                  </label>
                )}
              </div>
              <div className="col-span-12 md:col-span-2 flex justify-end">
                <Button type="button" variant="ghost" size="icon" onClick={() => removeAnexo(a.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addAnexo} className="w-full gap-2 rounded-xl">
            <Plus className="h-4 w-4" /> Adicionar anexo
          </Button>
        </div>
      </Section>

      <Section
        title="Rateio por cotista"
        hint={
          isClienteRateio
            ? "Cliente pagou — rateio igualitário automático (100/N) entre todos os sócios."
            : "Defina o % de cada cotista. A soma deve ser 100%."
        }
      >
        {isClienteRateio && (
          <Badge variant="outline" className="border-cyan-500/40 text-cyan-400 gap-1.5">
            <Lock className="h-3 w-3" /> Rateio igualitário automático
          </Badge>
        )}

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Sócios cadastrados: <strong className="text-foreground">{rateios.length}</strong>
          </div>
          {!isClienteRateio && (
            <Button type="button" variant="outline" size="sm" onClick={distribuirIgualmente}>
              Dividir igualmente
            </Button>
          )}
        </div>

        {!rateios.length ? (
          <div className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border/60 rounded-xl">
            Cliente não tem cotistas cadastrados.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-3 text-[10px] uppercase tracking-wider text-muted-foreground px-3">
              <div className="col-span-5">Cotista</div>
              <div className="col-span-2 text-right">% Rateio</div>
              <div className="col-span-2 text-right">Valor rateado</div>
              <div className="col-span-3 text-right">Pago real (R$)</div>
            </div>
            {rateios.map((r, idx) => {
              const devido = +((valorNum * r.percentual) / 100).toFixed(2);
              return (
                <div
                  key={r.socio_id}
                  className="grid grid-cols-12 gap-3 items-center bg-muted/20 hover:bg-muted/30 rounded-xl p-3 transition-colors"
                >
                  <div className="col-span-5 text-sm font-medium truncate">
                    {r.socio_nome}
                    {r.socio_cpf && (
                      <span className="block text-[10px] text-muted-foreground font-mono">{r.socio_cpf}</span>
                    )}
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={r.percentual}
                      onChange={(e) => setPct(idx, e.target.value)}
                      disabled={isClienteRateio}
                      className="h-9 text-right rounded-lg"
                    />
                  </div>
                  <div className="col-span-2 text-right text-sm font-mono tabular-nums">
                    {fmtBRL(devido)}
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      step="0.01"
                      value={r.valor_pago_real}
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(",", ".")) || 0;
                        setRateios((rs) => rs.map((x, i) => (i === idx ? { ...x, valor_pago_real: n } : x)));
                      }}
                      disabled={pagador !== r.socio_id && pagador !== "EMPRESA" && !isClienteRateio}
                      className="h-9 text-right rounded-lg"
                    />
                  </div>
                </div>
              );
            })}

            <div
              className={`flex items-center justify-between mt-3 p-3 rounded-xl border text-sm ${
                pctOk
                  ? "bg-success/10 border-success/30 text-success"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-500"
              }`}
            >
              <div className="flex items-center gap-2">
                {pctOk ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                <span>
                  Soma percentuais: <strong>{somaPct.toFixed(2)}%</strong>
                  {!pctOk && ` — falta ${(100 - somaPct).toFixed(2)}%`}
                </span>
              </div>
              <div className="text-xs">
                Total pago: <strong>{fmtBRL(somaPago)}</strong> / {fmtBRL(valorNum)}
                {pagoExcede && <span className="ml-2 text-destructive">excede!</span>}
              </div>
            </div>
          </div>
        )}
      </Section>

      <Section title="Observações">
        <Textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={3}
          placeholder="Notas adicionais sobre o lançamento..."
          className="rounded-xl"
        />
      </Section>

      <div className={`flex items-center justify-end gap-3 ${!isModalContext ? 'sticky bottom-4 bg-background/80 backdrop-blur-md p-4 rounded-2xl border border-border/40 shadow-2xl' : ''}`}>
        <Button variant="outline" onClick={handleCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !pctOk || pagoExcede || algumNeg || !aeronaveSelected}
          className="gap-2 min-w-[200px]"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {editingFinal ? "Salvar alterações" : "Criar lançamento"}
        </Button>
      </div>
    </div>
  );

  // Se é modal, retorna apenas o conteúdo do formulário
  if (isModalContext) {
    return formContent;
  }

  // Se é página, retorna com Layout
  return (
    <Layout>
      <div className="space-y-8 max-w-7xl mx-auto pb-12">
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
              {clienteData?.razao_social}
            </span>
            <span>/</span>
            <span className="text-foreground font-medium">
              {editingFinal ? "Editar Lançamento" : "Novo Lançamento"}
            </span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-card/80 to-card/30 backdrop-blur-xl border border-border/50 shadow-2xl">
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-50 pointer-events-none" />

          <div className="p-8 md:p-10 relative z-10">
            <div className="flex flex-col md:flex-row md:items-start gap-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-background to-muted/30 border border-border/50 shadow-inner flex items-center justify-center shrink-0 overflow-hidden ring-4 ring-background/50">
                {clienteData?.url_logo ? (
                  <img
                    src={clienteData.url_logo}
                    alt={clienteData.razao_social}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-transparent">
                    {(clienteData?.razao_social || "—").slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                      {editingFinal ? "Editar Lançamento" : "Novo Lançamento"}
                    </h1>
                    <Badge
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        clienteData?.status === "ativo"
                          ? "bg-success/10 text-success border-success/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]"
                          : "bg-muted/50 text-muted-foreground border-border"
                      }`}
                    >
                      {clienteData?.status || "—"}
                    </Badge>
                  </div>
                  <p className="text-sm font-mono text-muted-foreground/80 tracking-widest">
                    Cliente: {clienteData?.razao_social}
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

        {formContent}
      </div>
    </Layout>
  );
}
