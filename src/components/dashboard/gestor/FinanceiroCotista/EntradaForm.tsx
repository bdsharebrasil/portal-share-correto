// @ts-nocheck — erros de tipagem pré-existentes (colunas legadas fora dos types gerados)
import { Layout } from "@/components/layout/Layout";
import { useNavigate, useParams } from "react-router-dom";
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
  Loader2,
  Calendar as CalendarIcon,
  ArrowUpRight,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import AnexosDinamicosField, { type AnexoLinha } from "./AnexosDinamicosField";

type Socio = {
  id: string;
  nome: string;
  cpf?: string | null;
  percentual_participacao?: number | null;
  percentual?: number;
};

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

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

interface EntradaFormProps {
  clienteId?: string;
  clienteNome?: string;
  aeronaveId?: string | null;
  aeronaveRegistro?: string | null;
  socios?: Socio[];
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

export default function EntradaForm(props: EntradaFormProps) {
  const isModalContext = props.isModal === true;
  const { clienteId: paramClienteId, aeronaveId: paramAeronaveId } = useParams<{ clienteId: string; aeronaveId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const clienteId = props.clienteId || paramClienteId;
  const aeronaveIdParam = props.aeronaveId || paramAeronaveId;
  const clienteNomeProp = props.clienteNome;
  const sociosProp = props.socios;

  // Buscar dados do cliente
  const { data: cliente, isLoading: loadingCliente } = useQuery({
    queryKey: ["cliente-entrada", clienteId],
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
    queryKey: ["aeronave-entrada", aeronaveIdParam],
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

  // Buscar sócios
  const { data: sociosData } = useQuery({
    queryKey: ["socios-cliente-entrada", clienteId],
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
  const [valor, setValor] = useState("");
  const [dataCompetencia, setDataCompetencia] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [dataPagamento, setDataPagamento] = useState("");
  const [cotistaPagador, setCotistaPagador] = useState("");
  const [status, setStatus] = useState<"pago" | "pendente">("pago");
  const [observacoes, setObservacoes] = useState("");
  const [formaPgto, setFormaPgto] = useState("");
  const [anexos, setAnexos] = useState<AnexoLinha[]>([]);
  const [saving, setSaving] = useState(false);

  // Aeronaves
  const { data: clienteAeronaves = [] } = useQuery({
    queryKey: ["cliente-aeronaves-entrada", clienteId],
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
    queryKey: ["todas-aeronaves-entrada"],
    queryFn: async () => {
      const { data } = await supabase
        .from("aeronave")
        .select("id, matricula, modelo")
        .order("matricula");
      return (data ?? []) as Array<{ id: string; matricula: string; modelo: string }>;
    },
  });

  const [aeronaveSelected, setAeronaveSelected] = useState<string>(aeronaveIdParam ?? "");

  const valorNum = Number(valor.replace(",", ".")) || 0;

  async function handleSave() {
    if (anexos.some((anexo) => anexo.uploading)) return toast.error("Aguarde o envio dos anexos");
    if (!descricao.trim()) return toast.error("Informe a descrição");
    if (valorNum <= 0) return toast.error("Valor deve ser maior que zero");
    if (!cotistaPagador) return toast.error("Selecione o cotista que pagou");

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const cotista = socios.find((s) => s.id === cotistaPagador);
      if (!cotista) throw new Error("Cotista não encontrado");

      // Para entradas, converter 'pago' para 'recebido'
      const rateioStatus = status === "pago" ? "recebido" : status;

      // Criar lançamento como ENTRADA
      const movPayload: any = {
        descricao: descricao.trim(),
        tipo: "entrada",
        tipo_caixa: "cliente",
        valor_rateado: valorNum,
        data_emissao: dataCompetencia,
        data_pagamento: status === "pago" ? (dataPagamento || dataCompetencia) : null,
        client_id: clienteId,
        socio_id: cotistaPagador,
        status: rateioStatus,
        observacoes: observacoes || null,
        forma_pagamento: formaPgto || null,
        comprovante_url: anexos.find((anexo) => anexo.tipo === "comprovante")?.url || anexos[0]?.url || null,
        criado_por: user?.id ?? null,
        reference_type: "entrada_cotista",
      };

      const { data: movData, error: movError } = await supabase
        .from("movimentacoes")
        .insert(movPayload)
        .select("id")
        .single();

      if (movError) throw movError;

      const movId = movData.id;

      // Criar rateio com 1 linha só para o cotista pagador com seu percentual
      const rateioPayload = {
        despesa_id: movId,
        fonte_despesa: "movimentacoes",
        tipo_rateio: "ENTRADA",
        fluxo: "ENTRADA",
        cliente_id: clienteId,
        clientes_nome: clienteNomeProp || clienteData?.razao_social,
        socio_id: cotistaPagador,
        socios_nome: cotista.nome,
        percentual_sociedade: Number(cotista.percentual_participacao ?? 100),
        valor_total_despesa: valorNum,
        valor_rateado: valorNum,
        valor_pago_real: valorNum,
        status: rateioStatus,
        descricao_despesa: descricao,
        data_pagamento: status === "pago" ? (dataPagamento || dataCompetencia) : null,
        pago_por: cotistaPagador,
        pago_por_tipo: "SOCIO",
        pago_por_id: cotistaPagador,
        // Entradas/depósitos nunca são "pago diretamente"
        pago_diretamente: false,
        forma_pagamento: formaPgto || null,
        comprovante_url: anexos.find((anexo) => anexo.tipo === "comprovante")?.url || anexos[0]?.url || null,
        periodicidade: "EVENTUAL",
        observacoes: observacoes || null,
      };

      const { error: rateioError } = await supabase
        .from("rateio_despesas")
        .insert(rateioPayload);

      if (rateioError) throw rateioError;

      qc.invalidateQueries({ queryKey: ["financeiro-cotista-detalhe"] });

      toast.success("Entrada registrada com sucesso");

      navigate(`/financeiro/financeiro-cotistas/${clienteId}`);
    } catch (e: any) {
      toast.error("Erro: " + (e.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  }

  const handleCancel = () => {
    navigate(`/financeiro/financeiro-cotistas/${clienteId}`);
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
        </div>
      </Layout>
    );
  }

  const cotistasOptions = socios.map((s) => ({
    id: s.id,
    label: `${s.nome}${s.cpf ? ` · ${s.cpf}` : ""}`,
  }));

  const formContent = (
    <div className="space-y-6">
      <Section title="Informações da Entrada" hint="Descrição e detalhes do valor recebido">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <Field label="Descrição" required>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: Aporte capital / Reembolso / Contribuição extra"
                className="h-11 rounded-xl"
              />
            </Field>
          </div>

          <Field label="Valor (R$)" required>
            <Input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              className="h-11 rounded-xl text-right font-mono"
            />
          </Field>

          <Field label="Cotista que pagou" required>
            <SearchableCombobox
              items={cotistasOptions}
              value={cotistaPagador}
              onChange={(v) => setCotistaPagador(v)}
              placeholder="Selecione o cotista..."
              searchPlaceholder="Buscar cotista..."
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
        </div>
      </Section>

      <Section title="Documentos e observações" hint="Anexe comprovantes, recibos ou documentos de apoio.">
        <AnexosDinamicosField anexos={anexos} onChange={setAnexos} storagePrefix={`entradas-cotista/${clienteId || "novo"}`} />
        <Textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={3}
          placeholder="Notas adicionais sobre a entrada..."
          className="rounded-xl"
        />
      </Section>

      <div className={`flex items-center justify-end gap-3 ${!isModalContext ? 'sticky bottom-4 bg-background/80 backdrop-blur-md p-4 rounded-2xl border border-border/40 shadow-2xl' : ''}`}>
        <Button variant="outline" onClick={handleCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !cotistaPagador || !descricao.trim() || valorNum <= 0}
          className="gap-2 min-w-[200px]"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Registrar Entrada
        </Button>
      </div>
    </div>
  );

  if (isModalContext) {
    return formContent;
  }

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
            <span className="text-foreground font-medium">Nova Entrada</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-card/80 to-card/30 backdrop-blur-xl border border-border/50 shadow-2xl">
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-96 h-96 bg-success/10 rounded-full blur-3xl opacity-50 pointer-events-none" />

          <div className="p-8 md:p-10 relative z-10">
            <div className="flex flex-col md:flex-row md:items-start gap-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-background to-muted/30 border border-border/50 shadow-inner flex items-center justify-center shrink-0 overflow-hidden ring-4 ring-background/50">
                <ArrowUpRight className="h-10 w-10 text-success" />
              </div>

              <div className="flex-1 space-y-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                      Registrar Entrada
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
                </div>
              </div>
            </div>
          </div>
        </div>

        {formContent}
      </div>
    </Layout>
  );
}
