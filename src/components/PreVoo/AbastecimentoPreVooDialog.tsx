import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";

import AnexosDinamicosField, {
  type AnexoLinha,
} from "@/components/dashboard/gestor/FinanceiroCotista/AnexosDinamicosField";

import { supabase } from "@/integrations/supabase/client";
import { useClientesCombo } from "@/hooks/useClientesCombo";
import { useAerodromes } from "@/hooks/useAerodromes";
import { useFuelSuppliers } from "@/hooks/useFuelSuppliers";

import { toast } from "sonner";
import { cn } from "@/lib/utils";

import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  FileCheck2,
  FileText,
  Fuel,
  Info,
  Loader2,
  MapPin,
  Paperclip,
  Plane,
  Receipt,
  Upload,
  Users,
  X,
} from "lucide-react";

const db = supabase as any;

const TIPOS_COMBUSTIVEL = [
  { id: "AVGAS", label: "AVGAS" },
  { id: "JET A1", label: "JET A1" },
];

const TIPOS_FATURAMENTO = [
  { id: "BOLETO", label: "BOLETO" },
  { id: "NOTA FISCAL FATURADO", label: "NOTA FISCAL FATURADO" },
  { id: "NOTA FISCAL A VISTA", label: "NOTA FISCAL A VISTA" },
  { id: "FATURADO RECIBO", label: "FATURADO RECIBO" },
  { id: "PIX", label: "PIX" },
  { id: "CARTAO", label: "CARTÃO" },
  { id: "OUTRO", label: "OUTRO" },
];

const FATURADOS = [
  "BOLETO",
  "NOTA FISCAL FATURADO",
  "FATURADO RECIBO",
];

const A_VISTA = [
  "NOTA FISCAL A VISTA",
  "PIX",
  "CARTAO",
];

const brl = (v: number) =>
  v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultClienteId?: string | null;
  defaultAeronaveId?: string | null;
  defaultData?: string;
  onSaved: (abastecimentoId: string) => void;
}

type StepId =
  | "operacao"
  | "combustivel"
  | "comanda"
  | "faturamento"
  | "observacoes";

const STEPS: {
  id: StepId;
  title: string;
  shortTitle: string;
  description: string;
  icon: any;
}[] = [
  {
    id: "operacao",
    title: "Operação",
    shortTitle: "Operação",
    description: "Cliente, aeronave, data e trecho",
    icon: Plane,
  },
  {
    id: "combustivel",
    title: "Combustível",
    shortTitle: "Combustível",
    description: "Produto, fornecedor, volume e preço",
    icon: Fuel,
  },
  {
    id: "comanda",
    title: "Comanda",
    shortTitle: "Comanda",
    description: "Identificação e comprovante",
    icon: Receipt,
  },
  {
    id: "faturamento",
    title: "Faturamento",
    shortTitle: "Faturamento",
    description: "Pagamento, prazo e anexos",
    icon: CreditCard,
  },
  {
    id: "observacoes",
    title: "Observações",
    shortTitle: "Notas",
    description: "Informações adicionais",
    icon: FileText,
  },
];

function StepCard({
  number,
  title,
  description,
  icon: Icon,
  active,
  completed,
  locked,
  onClick,
}: {
  number: number;
  title: string;
  description: string;
  icon: any;
  active: boolean;
  completed: boolean;
  locked?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onClick}
      className={cn(
        "group flex min-w-0 flex-1 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all",
        active
          ? "border-primary/30 bg-primary/10"
          : completed
            ? "border-emerald-500/20 bg-emerald-500/[0.05]"
            : "border-border/60 bg-background/50 hover:bg-muted/40",
        locked && "cursor-not-allowed opacity-50"
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          active
            ? "bg-primary text-primary-foreground"
            : completed
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-muted text-muted-foreground"
        )}
      >
        {completed ? (
          <Check className="h-4 w-4" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-[9px] font-bold uppercase tracking-[0.14em]",
              active
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            {String(number).padStart(2, "0")}
          </span>

          <span className="truncate text-xs font-bold text-foreground">
            {title}
          </span>
        </div>

        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {description}
        </p>
      </div>
    </button>
  );
}

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: any;
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </p>

        <h3 className="mt-1 text-lg font-bold tracking-tight text-foreground">
          {title}
        </h3>

        {description && (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

function FieldLabel({
  children,
  required = false,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <Label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
      {required && (
        <span className="ml-1 text-primary">*</span>
      )}
    </Label>
  );
}

export function AbastecimentoPreVooDialog({
  open,
  onOpenChange,
  defaultClienteId,
  defaultAeronaveId,
  defaultData,
  onSaved,
}: Props) {
  const { clientes } = useClientesCombo();
  const { aerodromes } = useAerodromes();
  const { data: fornecedores = [] } = useFuelSuppliers();

  const [clienteId, setClienteId] = useState(
    defaultClienteId || ""
  );

  const [socioNome, setSocioNome] = useState("");

  const [aeronaveId, setAeronaveId] = useState(
    defaultAeronaveId || ""
  );

  const [data, setData] = useState(
    defaultData ||
      new Date().toISOString().split("T")[0]
  );

  const [trechoOrigem, setTrechoOrigem] = useState("");
  const [trechoDestino, setTrechoDestino] = useState("");
  const [local, setLocal] = useState("");

  const [tipoCombustivel, setTipoCombustivel] =
    useState("");

  const [abastecedorId, setAbastecedorId] =
    useState("");

  const [abastecedor, setAbastecedor] =
    useState("");

  const [valorUnitario, setValorUnitario] =
    useState("");

  const [litros, setLitros] = useState("");

  const [comanda, setComanda] = useState("");

  const [comandaUrl, setComandaUrl] =
    useState<string | null>(null);

  const [uploadingComanda, setUploadingComanda] =
    useState(false);

  const [tipoFaturamento, setTipoFaturamento] =
    useState("");

  const [prazo, setPrazo] = useState("");

  const [dataPagamento, setDataPagamento] =
    useState("");

  const [pagoPor, setPagoPor] =
    useState("SHARE BRASIL");

  const [observacao, setObservacao] = useState("");

  const [anexos, setAnexos] =
    useState<AnexoLinha[]>([]);

  const [avisoFechado, setAvisoFechado] =
    useState(false);

  const [salvando, setSalvando] =
    useState(false);

  const [step, setStep] =
    useState<StepId>("operacao");

  /*
   * =========================================================
   * RESET AO ABRIR
   * =========================================================
   */
  useEffect(() => {
    if (!open) return;

    setClienteId(defaultClienteId || "");
    setSocioNome("");

    setAeronaveId(defaultAeronaveId || "");

    setData(
      defaultData ||
        new Date().toISOString().split("T")[0]
    );

    setTrechoOrigem("");
    setTrechoDestino("");
    setLocal("");

    setTipoCombustivel("");
    setAbastecedorId("");
    setAbastecedor("");

    setValorUnitario("");
    setLitros("");

    setComanda("");
    setComandaUrl(null);
    setUploadingComanda(false);

    setTipoFaturamento("");
    setPrazo("");
    setDataPagamento("");

    setPagoPor("SHARE BRASIL");

    setObservacao("");
    setAnexos([]);

    setAvisoFechado(false);
    setSalvando(false);

    setStep("operacao");
  }, [
    open,
    defaultClienteId,
    defaultAeronaveId,
    defaultData,
  ]);

  /*
   * =========================================================
   * CONSULTAS
   * =========================================================
   */
  const { data: aeronaves = [] } = useQuery({
    queryKey: ["abast-aeronaves"],
    queryFn: async () => {
      const { data, error } = await db
        .from("aeronave")
        .select("id, matricula, modelo")
        .order("matricula");

      if (error) throw error;

      return (data || []) as {
        id: string;
        matricula: string;
        modelo: string | null;
      }[];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: socios = [] } = useQuery({
    queryKey: ["abast-socios", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await db
        .from("socios")
        .select("id, nome")
        .eq("clientes_id", clienteId)
        .order("nome");

      if (error) throw error;

      return (data || []) as {
        id: string;
        nome: string;
      }[];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: cotistas = [] } = useQuery({
    queryKey: ["abast-cotistas", aeronaveId],
    enabled: !!aeronaveId,
    queryFn: async () => {
      const { data, error } = await db
        .from("cotistas_aeronave")
        .select(
          "id, id_clientes, clientes:id_clientes(razao_social)"
        )
        .eq("id_aeronave", aeronaveId);

      if (error) throw error;

      return (data || []) as any[];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: ultimoLancamento } = useQuery({
    queryKey: [
      "abast-ultimo-lancamento",
      aeronaveId,
    ],
    enabled: !!aeronaveId,
    queryFn: async () => {
      const { data, error } = await db
        .from("lancamentos_diario_bordo")
        .select(
          "aerodromo_partida, aerodromo_chegada, data_registro, trecho"
        )
        .eq("aeronave_id", aeronaveId)
        .order("data_registro", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (error) return null;

      return data as any;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  /*
   * =========================================================
   * REGRAS
   * =========================================================
   */
  const vooEmprestado = useMemo(() => {
    if (
      !clienteId ||
      !aeronaveId ||
      cotistas.length === 0
    ) {
      return false;
    }

    return !cotistas.some(
      (c: any) =>
        c.id_clientes === clienteId
    );
  }, [
    clienteId,
    aeronaveId,
    cotistas,
  ]);

  const litrosNum =
    Number(
      String(litros).replace(",", ".")
    ) || 0;

  const unitNum =
    Number(
      String(valorUnitario).replace(",", ".")
    ) || 0;

  const valorTotal =
    litrosNum * unitNum;

  const isFaturado =
    FATURADOS.includes(
      tipoFaturamento
    );

  const isAVista =
    A_VISTA.includes(
      tipoFaturamento
    );

  const aerodromeItems = useMemo(
    () =>
      aerodromes.map((a: any) => ({
        id: a.designativo,
        label: `${a.designativo} — ${a.nome}`,
      })),
    [aerodromes]
  );

  const pagoPorItems = useMemo(() => {
    const base = [
      {
        id: "SHARE BRASIL",
        label: "SHARE BRASIL",
      },
    ];

    cotistas.forEach((c: any) => {
      const nome =
        c.clientes?.razao_social;

      if (nome) {
        base.push({
          id: nome,
          label: nome,
        });
      }
    });

    return base;
  }, [cotistas]);

  /*
   * =========================================================
   * STATUS DAS ETAPAS
   * =========================================================
   */
  const completedSteps = useMemo(() => {
    const completed = new Set<StepId>();

    if (
      clienteId &&
      aeronaveId &&
      data &&
      trechoOrigem &&
      trechoDestino &&
      local
    ) {
      completed.add("operacao");
    }

    if (
      tipoCombustivel &&
      abastecedorId &&
      litrosNum > 0 &&
      unitNum > 0
    ) {
      completed.add("combustivel");
    }

    if (
      comanda ||
      comandaUrl
    ) {
      completed.add("comanda");
    }

    if (
      tipoFaturamento &&
      (
        (isFaturado && prazo) ||
        (isAVista && dataPagamento) ||
        (!isFaturado && !isAVista)
      )
    ) {
      completed.add("faturamento");
    }

    if (observacao.trim()) {
      completed.add("observacoes");
    }

    return completed;
  }, [
    clienteId,
    aeronaveId,
    data,
    trechoOrigem,
    trechoDestino,
    local,
    tipoCombustivel,
    abastecedorId,
    litrosNum,
    unitNum,
    comanda,
    comandaUrl,
    tipoFaturamento,
    isFaturado,
    isAVista,
    prazo,
    dataPagamento,
    observacao,
  ]);

  const stepIndex = STEPS.findIndex(
    (item) => item.id === step
  );

  const currentStep =
    STEPS[stepIndex] || STEPS[0];

  /*
   * =========================================================
   * UPLOAD COMANDA
   * =========================================================
   */
  const handleComandaUpload = async (
    file: File
  ) => {
    setUploadingComanda(true);

    try {
      const ext = (
        file.name.split(".").pop() ||
        "bin"
      ).toLowerCase();

      const path = `abastecimentos/comandas/${crypto.randomUUID()}.${ext}`;

      const { error } =
        await supabase.storage
          .from("client-documents")
          .upload(
            path,
            file,
            {
              upsert: true,
            }
          );

      if (error) throw error;

      const publicUrl =
        supabase.storage
          .from("client-documents")
          .getPublicUrl(path)
          .data.publicUrl;

      setComandaUrl(publicUrl);

      toast.success(
        "Imagem da comanda enviada."
      );
    } catch (e: any) {
      toast.error(
        `Erro no upload da comanda: ${
          e.message ?? e
        }`
      );
    } finally {
      setUploadingComanda(false);
    }
  };

  const urlPorTipo = (
    tipo: string
  ) =>
    anexos.find(
      (a) =>
        a.tipo === tipo &&
        a.url
    )?.url ?? null;

  /*
   * =========================================================
   * VALIDAÇÃO
   * =========================================================
   */
  const validateStep = (
    targetStep: StepId
  ) => {
    if (targetStep === "operacao") {
      if (!clienteId) {
        toast.error(
          "Selecione o cliente."
        );
        return false;
      }

      if (!aeronaveId) {
        toast.error(
          "Selecione a aeronave."
        );
        return false;
      }

      if (!data) {
        toast.error(
          "Informe a data."
        );
        return false;
      }

      if (!trechoOrigem || !trechoDestino) {
        toast.error(
          "Informe a origem e o destino."
        );
        return false;
      }

      if (!local) {
        toast.error(
          "Informe o local do abastecimento."
        );
        return false;
      }
    }

    if (targetStep === "combustivel") {
      if (!tipoCombustivel) {
        toast.error(
          "Selecione o tipo de combustível."
        );
        return false;
      }

      if (!abastecedorId) {
        toast.error(
          "Selecione o fornecedor."
        );
        return false;
      }

      if (litrosNum <= 0) {
        toast.error(
          "Informe a quantidade de litros."
        );
        return false;
      }

      if (unitNum <= 0) {
        toast.error(
          "Informe o valor unitário."
        );
        return false;
      }
    }

    if (targetStep === "faturamento") {
      if (!tipoFaturamento) {
        toast.error(
          "Selecione o tipo de faturamento."
        );
        return false;
      }

      if (
        isFaturado &&
        !prazo
      ) {
        toast.error(
          "Informe o prazo do faturamento."
        );
        return false;
      }

      if (
        isAVista &&
        !dataPagamento
      ) {
        toast.error(
          "Informe a data do pagamento."
        );
        return false;
      }
    }

    return true;
  };

  /*
   * =========================================================
   * NAVEGAÇÃO
   * =========================================================
   */
  const goNext = () => {
    if (
      !validateStep(step)
    ) {
      return;
    }

    const nextIndex =
      Math.min(
        stepIndex + 1,
        STEPS.length - 1
      );

    setStep(
      STEPS[nextIndex].id
    );
  };

  const goPrevious = () => {
    const previousIndex =
      Math.max(
        stepIndex - 1,
        0
      );

    setStep(
      STEPS[previousIndex].id
    );
  };

  const handleStepClick = (
    target: StepId
  ) => {
    const targetIndex =
      STEPS.findIndex(
        (item) =>
          item.id === target
      );

    if (
      targetIndex <= stepIndex
    ) {
      setStep(target);
      return;
    }

    if (
      targetIndex ===
      stepIndex + 1
    ) {
      goNext();
      return;
    }

    toast.info(
      "Avance pelas etapas para liberar esta seção."
    );
  };

  /*
   * =========================================================
   * SALVAMENTO
   * =========================================================
   */
  const handleSalvar = async () => {
    if (!clienteId) {
      setStep("operacao");
      return toast.error(
        "Selecione o cliente."
      );
    }

    if (!aeronaveId) {
      setStep("operacao");
      return toast.error(
        "Selecione a aeronave."
      );
    }

    if (
      !trechoOrigem ||
      !trechoDestino
    ) {
      setStep("operacao");
      return toast.error(
        "Informe o trecho."
      );
    }

    if (!local) {
      setStep("operacao");
      return toast.error(
        "Informe o local."
      );
    }

    if (
      litrosNum <= 0 ||
      unitNum <= 0
    ) {
      setStep("combustivel");
      return toast.error(
        "Informe litros e valor unitário."
      );
    }

    if (!tipoFaturamento) {
      setStep("faturamento");
      return toast.error(
        "Selecione o tipo de faturamento."
      );
    }

    if (
      isFaturado &&
      !prazo
    ) {
      setStep("faturamento");
      return toast.error(
        "Informe o prazo do faturamento."
      );
    }

    if (
      isAVista &&
      !dataPagamento
    ) {
      setStep("faturamento");
      return toast.error(
        "Informe a data do pagamento."
      );
    }

    if (
      anexos.some(
        (a) => a.uploading
      ) ||
      uploadingComanda
    ) {
      toast.error(
        "Aguarde o envio dos anexos."
      );
      return;
    }

    setSalvando(true);

    try {
      const {
        data: authData,
      } =
        await supabase.auth.getUser();

      const userId =
        authData?.user?.id ??
        null;

      let criadoPor =
        authData?.user?.email ??
        null;

      if (userId) {
        const { data: perfil } =
          await db
            .from("user_profiles")
            .select(
              "full_name, display_name"
            )
            .eq("id", userId)
            .maybeSingle();

        criadoPor =
          perfil?.full_name ||
          perfil?.display_name ||
          criadoPor;
      }

      const nfAnexo =
        anexos.find(
          (a) =>
            a.tipo === "nf"
        );

      const comprovante =
        urlPorTipo(
          "comprovante"
        );

      const payload: Record<
        string,
        any
      > = {
        id_clientes:
          clienteId,

        socio_nome:
          socioNome || null,

        aeronave_id:
          aeronaveId,

        voo_emprestado:
          vooEmprestado,

        data,

        trecho:
          `${trechoOrigem} x ${trechoDestino}`,

        local,

        tipo_combustivel:
          tipoCombustivel ||
          null,

        abastecedor_id:
          abastecedorId ||
          null,

        abastecedor:
          abastecedor ||
          null,

        litros:
          litrosNum,

        valor_unitario:
          unitNum,

        comanda:
          comanda || null,

        comanda_url:
          comandaUrl ||
          urlPorTipo("comanda"),

        tipo_faturamento:
          tipoFaturamento,

        prazo:
          isFaturado
            ? prazo
            : null,

        status:
          isFaturado
            ? "pendente"
            : isAVista
              ? "pago"
              : "pendente",

        data_pagamento:
          isAVista
            ? dataPagamento
            : null,

        comprovante_pagamento:
          isAVista
            ? comprovante
            : null,

        comprovante_url:
          comprovante,

        nota_url:
          urlPorTipo("nf"),

        nf:
          nfAnexo?.numero ||
          null,

        boleto_url:
          urlPorTipo("boleto"),

        pago_por:
          pagoPor || null,

        observacao:
          observacao || null,

        criado_por:
          criadoPor,
      };

      const {
        data: inserted,
        error,
      } = await db
        .from("abastecimentos")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;

      toast.success(
        "Abastecimento registrado com sucesso."
      );

      onSaved(inserted.id);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(
        e.message ||
          "Erro ao registrar abastecimento."
      );
    } finally {
      setSalvando(false);
    }
  };

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent
        className={cn(
          "flex max-h-[96vh] w-[calc(100vw-1rem)] flex-col overflow-hidden border-border/60 bg-background p-0 shadow-2xl",
          "sm:max-w-6xl"
        )}
      >
        {/* =====================================================
            HEADER
        ===================================================== */}
        <DialogHeader className="shrink-0 border-b border-border/60 bg-card px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-4">

            <div className="flex min-w-0 items-start gap-3">

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <Fuel className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-primary">
                  Operação de solo
                </div>

                <DialogTitle className="text-xl font-black tracking-tight sm:text-2xl">
                  Registro de abastecimento
                </DialogTitle>

                <DialogDescription className="mt-1 max-w-2xl text-xs leading-5 sm:text-sm">
                  Registre o abastecimento para vincular o
                  lançamento ao checklist de pré-voo.
                </DialogDescription>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onOpenChange(false)
              }
              disabled={salvando}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* RESUMO */}
          <div className="mt-4 grid gap-2 sm:grid-cols-3">

            <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                Aeronave
              </p>

              <p className="mt-1 truncate text-xs font-bold">
                {aeronaves.find(
                  (a) =>
                    a.id ===
                    aeronaveId
                )?.matricula ||
                  "Não selecionada"}
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                Cliente
              </p>

              <p className="mt-1 truncate text-xs font-bold">
                {clientes.find(
                  (c) =>
                    c.id ===
                    clienteId
                )?.razao_social ||
                  "Não selecionado"}
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                Valor estimado
              </p>

              <p className="mt-1 text-xs font-black text-emerald-500">
                {brl(valorTotal)}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* =====================================================
            STEP NAVIGATION
        ===================================================== */}
        <div className="shrink-0 border-b border-border/60 bg-card/95 px-3 py-3 sm:px-5">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {STEPS.map(
              (
                item,
                index
              ) => (
                <StepCard
                  key={item.id}
                  number={index + 1}
                  title={item.shortTitle}
                  description={item.description}
                  icon={item.icon}
                  active={
                    step === item.id
                  }
                  completed={completedSteps.has(
                    item.id
                  )}
                  locked={
                    index >
                    stepIndex + 1
                  }
                  onClick={() =>
                    handleStepClick(
                      item.id
                    )
                  }
                />
              )
            )}
          </div>
        </div>

        {/* =====================================================
            CONTENT
        ===================================================== */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-background">
          <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">

            {/* =================================================
                OPERAÇÃO
            ================================================= */}
            {step === "operacao" && (
              <div className="space-y-4">

                <div className="rounded-[24px] border border-border/60 bg-card p-5 shadow-sm sm:p-6">
                  <SectionHeader
                    icon={Plane}
                    eyebrow="Etapa 01"
                    title="Dados da operação"
                    description="Defina quem está utilizando a aeronave e em qual operação o combustível será lançado."
                  />

                  <div className="grid gap-4 md:grid-cols-2">

                    <div>
                      <FieldLabel required>
                        Cliente
                      </FieldLabel>

                      <SearchableCombobox
                        items={clientes.map(
                          (c) => ({
                            id: c.id,
                            label: c.razao_social,
                          })
                        )}
                        value={clienteId}
                        onChange={(id) => {
                          setClienteId(id);
                          setSocioNome("");
                        }}
                        placeholder="Selecione o cliente"
                        icon={
                          <Users className="h-4 w-4" />
                        }
                      />
                    </div>

                    {socios.length > 0 && (
                      <div>
                        <FieldLabel>
                          Sócio
                        </FieldLabel>

                        <SearchableCombobox
                          items={socios.map(
                            (s) => ({
                              id: s.nome,
                              label: s.nome,
                            })
                          )}
                          value={
                            socioNome
                          }
                          onChange={(
                            id
                          ) =>
                            setSocioNome(
                              id
                            )
                          }
                          placeholder="Selecione o sócio"
                        />
                      </div>
                    )}

                    <div>
                      <FieldLabel required>
                        Aeronave
                      </FieldLabel>

                      <SearchableCombobox
                        items={aeronaves.map(
                          (a) => ({
                            id: a.id,
                            label:
                              `${a.matricula}${
                                a.modelo
                                  ? ` — ${a.modelo}`
                                  : ""
                              }`,
                          })
                        )}
                        value={
                          aeronaveId
                        }
                        onChange={(
                          id
                        ) =>
                          setAeronaveId(
                            id
                          )
                        }
                        placeholder="Selecione a aeronave"
                        icon={
                          <Plane className="h-4 w-4" />
                        }
                      />

                      {aeronaveId &&
                        clienteId && (
                          <div
                            className={cn(
                              "mt-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px]",
                              vooEmprestado
                                ? "border-amber-500/20 bg-amber-500/[0.06] text-amber-500"
                                : "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-500"
                            )}
                          >
                            {vooEmprestado ? (
                              <AlertTriangle className="h-3.5 w-3.5" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}

                            <span>
                              {vooEmprestado
                                ? "Voo de empréstimo — aeronave não pertence ao cliente."
                                : "Aeronave vinculada ao cliente selecionado."}
                            </span>
                          </div>
                        )}
                    </div>

                    <div>
                      <FieldLabel required>
                        Data
                      </FieldLabel>

                      <div className="relative">
                        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                        <Input
                          type="date"
                          value={data}
                          onChange={(e) =>
                            setData(
                              e.target
                                .value
                            )
                          }
                          className="h-11 rounded-xl pl-10"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {ultimoLancamento &&
                  !avisoFechado && (
                    <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-4">
                      <div className="flex items-start gap-3">

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
                          <Info className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-sky-500">
                            Último lançamento no diário de bordo
                          </p>

                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            O último trecho registrado
                            para esta aeronave foi{" "}
                            <strong className="text-foreground">
                              {ultimoLancamento.aerodromo_partida ||
                                "—"}{" "}
                              ×{" "}
                              {ultimoLancamento.aerodromo_chegada ||
                                "—"}
                            </strong>{" "}
                            em{" "}
                            <strong className="text-foreground">
                              {ultimoLancamento.data_registro
                                ? new Date(
                                    `${ultimoLancamento.data_registro}T12:00:00`
                                  ).toLocaleDateString(
                                    "pt-BR"
                                  )
                                : "—"}
                            </strong>
                            .
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setAvisoFechado(
                              true
                            )
                          }
                          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-background/60 hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                <div className="rounded-[24px] border border-border/60 bg-card p-5 shadow-sm sm:p-6">
                  <SectionHeader
                    icon={MapPin}
                    eyebrow="Trecho"
                    title="Origem, destino e local"
                    description="Informe o trecho da operação e o ponto onde o combustível foi abastecido."
                  />

                  <div className="grid gap-4 md:grid-cols-3">

                    <div>
                      <FieldLabel required>
                        Aeródromo de origem
                      </FieldLabel>

                      <SearchableCombobox
                        items={
                          aerodromeItems
                        }
                        value={
                          trechoOrigem
                        }
                        onChange={(
                          id
                        ) =>
                          setTrechoOrigem(
                            id
                          )
                        }
                        placeholder="Origem"
                        allowFreeText
                      />
                    </div>

                    <div>
                      <FieldLabel required>
                        Aeródromo de destino
                      </FieldLabel>

                      <SearchableCombobox
                        items={
                          aerodromeItems
                        }
                        value={
                          trechoDestino
                        }
                        onChange={(
                          id
                        ) =>
                          setTrechoDestino(
                            id
                          )
                        }
                        placeholder="Destino"
                        allowFreeText
                      />
                    </div>

                    <div>
                      <FieldLabel required>
                        Local do abastecimento
                      </FieldLabel>

                      <Input
                        value={local}
                        onChange={(e) =>
                          setLocal(
                            e.target
                              .value
                          )
                        }
                        placeholder="Ex.: SBCY"
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  {trechoOrigem &&
                    trechoDestino && (
                      <div className="mt-5 flex items-center justify-center gap-3 rounded-2xl border border-primary/10 bg-primary/[0.04] px-4 py-4">

                        <span className="rounded-xl bg-background px-4 py-2 text-sm font-black">
                          {trechoOrigem}
                        </span>

                        <ArrowRight className="h-4 w-4 text-primary" />

                        <span className="rounded-xl bg-background px-4 py-2 text-sm font-black">
                          {trechoDestino}
                        </span>
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* =================================================
                COMBUSTÍVEL
            ================================================= */}
            {step === "combustivel" && (
              <div className="space-y-4">

                <div className="rounded-[24px] border border-border/60 bg-card p-5 shadow-sm sm:p-6">
                  <SectionHeader
                    icon={Fuel}
                    eyebrow="Etapa 02"
                    title="Dados do combustível"
                    description="Informe o produto utilizado, fornecedor, quantidade e valor."
                  />

                  <div className="grid gap-4 md:grid-cols-2">

                    <div>
                      <FieldLabel required>
                        Tipo de combustível
                      </FieldLabel>

                      <SearchableCombobox
                        items={
                          TIPOS_COMBUSTIVEL
                        }
                        value={
                          tipoCombustivel
                        }
                        onChange={(id) => {
                          setTipoCombustivel(
                            id
                          );

                          if (
                            abastecedorId
                          ) {
                            const fornecedor =
                              fornecedores.find(
                                (
                                  x
                                ) =>
                                  x.id ===
                                  abastecedorId
                              );

                            if (
                              fornecedor
                            ) {
                              const preco =
                                id ===
                                "JET A1"
                                  ? fornecedor.preco_jet
                                  : fornecedor.preco_avgas;

                              if (
                                preco
                              ) {
                                setValorUnitario(
                                  String(
                                    preco
                                  )
                                );
                              }
                            }
                          }
                        }}
                        placeholder="AVGAS ou JET A1"
                        icon={
                          <Fuel className="h-4 w-4" />
                        }
                      />
                    </div>

                    <div>
                      <FieldLabel required>
                        Fornecedor
                      </FieldLabel>

                      <SearchableCombobox
                        items={fornecedores.map(
                          (f) => ({
                            id: f.id,
                            label:
                              `${f.nome_fornecedor}${
                                f.codigo_icao
                                  ? ` — ${f.codigo_icao}`
                                  : ""
                              }`,
                          })
                        )}
                        value={
                          abastecedorId
                        }
                        onChange={(
                          id,
                          label
                        ) => {
                          setAbastecedorId(
                            id
                          );

                          setAbastecedor(
                            label.split(
                              " — "
                            )[0]
                          );

                          const fornecedor =
                            fornecedores.find(
                              (
                                x
                              ) =>
                                x.id ===
                                id
                            );

                          if (
                            fornecedor
                          ) {
                            const preco =
                              tipoCombustivel ===
                              "JET A1"
                                ? fornecedor.preco_jet
                                : fornecedor.preco_avgas;

                            if (
                              preco
                            ) {
                              setValorUnitario(
                                String(
                                  preco
                                )
                              );
                            }
                          }
                        }}
                        placeholder="Selecione o fornecedor"
                      />
                    </div>

                    <div>
                      <FieldLabel>
                        Abastecedor
                      </FieldLabel>

                      <Input
                        value={
                          abastecedor
                        }
                        onChange={(e) =>
                          setAbastecedor(
                            e.target
                              .value
                          )
                        }
                        placeholder="Nome do abastecedor"
                        className="h-11 rounded-xl"
                      />
                    </div>

                    <div>
                      <FieldLabel required>
                        Litros
                      </FieldLabel>

                      <Input
                        value={litros}
                        onChange={(e) =>
                          setLitros(
                            e.target
                              .value
                          )
                        }
                        inputMode="decimal"
                        placeholder="0,00"
                        className="h-11 rounded-xl text-right tabular-nums"
                      />
                    </div>

                    <div>
                      <FieldLabel required>
                        Valor unitário
                      </FieldLabel>

                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          R$
                        </span>

                        <Input
                          value={
                            valorUnitario
                          }
                          onChange={(e) =>
                            setValorUnitario(
                              e.target
                                .value
                            )
                          }
                          inputMode="decimal"
                          placeholder="0,00"
                          className="h-11 rounded-xl pl-10 text-right tabular-nums"
                        />
                      </div>
                    </div>
                  </div>

                  {/* TOTAL */}
                  <div className="mt-6 overflow-hidden rounded-[22px] border border-emerald-500/20 bg-emerald-500/[0.05]">

                    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">

                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                          <CircleDollarSign className="h-5 w-5" />
                        </div>

                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-500">
                            Total do abastecimento
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {litrosNum > 0
                              ? `${litrosNum.toLocaleString(
                                  "pt-BR"
                                )} L × ${brl(unitNum)}`
                              : "Informe litros e valor unitário"}
                          </p>
                        </div>
                      </div>

                      <p className="text-3xl font-black tracking-tight text-emerald-500 tabular-nums">
                        {brl(valorTotal)}
                      </p>
                    </div>
                  </div>

                  {abastecedorId &&
                    tipoCombustivel && (
                      <div className="mt-4 flex items-center gap-2 rounded-xl border border-primary/10 bg-primary/[0.04] px-3 py-2.5 text-[11px] text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-primary" />

                        <span>
                          Preço do{" "}
                          <strong className="text-foreground">
                            {tipoCombustivel}
                          </strong>{" "}
                          carregado a partir do fornecedor selecionado.
                        </span>
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* =================================================
                COMANDA
            ================================================= */}
            {step === "comanda" && (
              <div className="space-y-4">

                <div className="rounded-[24px] border border-border/60 bg-card p-5 shadow-sm sm:p-6">
                  <SectionHeader
                    icon={Receipt}
                    eyebrow="Etapa 03"
                    title="Comanda do abastecimento"
                    description="Identifique a comanda e, quando disponível, anexe a imagem ou PDF correspondente."
                  />

                  <div className="grid gap-5 md:grid-cols-2">

                    <div>
                      <FieldLabel>
                        Número da comanda
                      </FieldLabel>

                      <Input
                        value={comanda}
                        onChange={(e) =>
                          setComanda(
                            e.target
                              .value
                          )
                        }
                        placeholder="Digite o número da comanda"
                        className="h-11 rounded-xl"
                      />

                      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                        Use o número exatamente como consta no comprovante do abastecimento.
                      </p>
                    </div>

                    <div>
                      <FieldLabel>
                        Comprovante da comanda
                      </FieldLabel>

                      {comandaUrl ? (
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">

                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                              <FileCheck2 className="h-5 w-5" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-emerald-500">
                                Comprovante enviado
                              </p>

                              <a
                                href={
                                  comandaUrl
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 block truncate text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                              >
                                Abrir arquivo
                              </a>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setComandaUrl(
                                  null
                                )
                              }
                              className="rounded-lg p-2 text-muted-foreground transition hover:bg-background hover:text-rose-500"
                              title="Remover arquivo"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex min-h-[124px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background/50 px-5 text-center transition hover:border-primary/30 hover:bg-primary/[0.03]">

                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            {uploadingComanda ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <Upload className="h-5 w-5" />
                            )}
                          </div>

                          <span className="mt-3 text-xs font-semibold">
                            {uploadingComanda
                              ? "Enviando arquivo..."
                              : "Enviar comprovante"}
                          </span>

                          <span className="mt-1 text-[10px] text-muted-foreground">
                            PDF, JPG, JPEG, PNG ou WEBP
                          </span>

                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            className="hidden"
                            disabled={
                              uploadingComanda
                            }
                            onChange={(
                              e
                            ) => {
                              const file =
                                e.target.files?.[0];

                              if (
                                file
                              ) {
                                handleComandaUpload(
                                  file
                                );
                              }

                              e.currentTarget.value =
                                "";
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =================================================
                FATURAMENTO
            ================================================= */}
            {step === "faturamento" && (
              <div className="space-y-4">

                <div className="rounded-[24px] border border-border/60 bg-card p-5 shadow-sm sm:p-6">
                  <SectionHeader
                    icon={CreditCard}
                    eyebrow="Etapa 04"
                    title="Faturamento e pagamento"
                    description="Defina como o abastecimento será liquidado e vincule os documentos financeiros."
                  />

                  <div className="grid gap-4 md:grid-cols-2">

                    <div>
                      <FieldLabel required>
                        Tipo de faturamento
                      </FieldLabel>

                      <SearchableCombobox
                        items={
                          TIPOS_FATURAMENTO
                        }
                        value={
                          tipoFaturamento
                        }
                        onChange={(
                          id
                        ) =>
                          setTipoFaturamento(
                            id
                          )
                        }
                        placeholder="Selecione o tipo"
                        icon={
                          <CreditCard className="h-4 w-4" />
                        }
                      />
                    </div>

                    <div>
                      <FieldLabel>
                        Pago por
                      </FieldLabel>

                      <SearchableCombobox
                        items={
                          pagoPorItems
                        }
                        value={pagoPor}
                        onChange={(
                          id
                        ) =>
                          setPagoPor(
                            id
                          )
                        }
                        placeholder="Selecione quem pagou"
                        icon={
                          <Building2 className="h-4 w-4" />
                        }
                      />
                    </div>

                    {isFaturado && (
                      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4 md:col-span-2">

                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <FieldLabel required>
                              Prazo do faturamento
                            </FieldLabel>

                            <Input
                              type="date"
                              value={prazo}
                              onChange={(e) =>
                                setPrazo(
                                  e.target
                                    .value
                                )
                              }
                              className="h-11 rounded-xl"
                            />
                          </div>

                          <div className="flex items-center gap-3 rounded-xl border border-amber-500/10 bg-background/50 px-4">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />

                            <p className="text-[11px] leading-5 text-muted-foreground">
                              Este lançamento será registrado com status{" "}
                              <strong className="text-amber-500">
                                pendente
                              </strong>
                              .
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {isAVista && (
                      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4 md:col-span-2">

                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <FieldLabel required>
                              Data do pagamento
                            </FieldLabel>

                            <Input
                              type="date"
                              value={
                                dataPagamento
                              }
                              onChange={(e) =>
                                setDataPagamento(
                                  e.target
                                    .value
                                )
                              }
                              className="h-11 rounded-xl"
                            />
                          </div>

                          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/10 bg-background/50 px-4">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />

                            <p className="text-[11px] leading-5 text-muted-foreground">
                              Este lançamento será registrado com status{" "}
                              <strong className="text-emerald-500">
                                pago
                              </strong>
                              .
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-border/60 bg-card p-5 shadow-sm sm:p-6">
                  <SectionHeader
                    icon={Paperclip}
                    eyebrow="Documentos"
                    title="Anexos financeiros"
                    description="Associe nota fiscal, boleto ou comprovante ao lançamento."
                  />

                  <AnexosDinamicosField
                    anexos={anexos}
                    onChange={setAnexos}
                    storagePrefix={`abastecimentos/${
                      clienteId ||
                      "sem-cliente"
                    }`}
                  />
                </div>
              </div>
            )}

            {/* =================================================
                OBSERVAÇÕES
            ================================================= */}
            {step === "observacoes" && (
              <div className="space-y-4">

                <div className="rounded-[24px] border border-border/60 bg-card p-5 shadow-sm sm:p-6">
                  <SectionHeader
                    icon={FileText}
                    eyebrow="Etapa 05"
                    title="Observações"
                    description="Adicione qualquer informação complementar relevante para o abastecimento."
                  />

                  <Textarea
                    value={observacao}
                    onChange={(e) =>
                      setObservacao(
                        e.target
                          .value
                      )
                    }
                    placeholder="Ex.: abastecimento parcial, condição especial, observação da operação..."
                    className="min-h-[180px] rounded-2xl bg-background/50 p-4"
                  />
                </div>

                {/* RESUMO FINAL */}
                <div className="rounded-[24px] border border-primary/15 bg-primary/[0.04] p-5 sm:p-6">

                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>

                    <div>
                      <h3 className="font-bold">
                        Revisão do abastecimento
                      </h3>

                      <p className="text-xs text-muted-foreground">
                        Confira os principais dados antes de salvar.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

                    <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        Aeronave
                      </p>
                      <p className="mt-1 text-sm font-bold">
                        {aeronaves.find(
                          (a) =>
                            a.id ===
                            aeronaveId
                        )?.matricula ||
                          "—"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        Trecho
                      </p>
                      <p className="mt-1 text-sm font-bold">
                        {trechoOrigem ||
                          "—"}{" "}
                        →{" "}
                        {trechoDestino ||
                          "—"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        Combustível
                      </p>
                      <p className="mt-1 text-sm font-bold">
                        {tipoCombustivel ||
                          "—"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        Quantidade
                      </p>
                      <p className="mt-1 text-sm font-bold">
                        {litrosNum
                          ? `${litrosNum.toLocaleString(
                              "pt-BR"
                            )} L`
                          : "—"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        Faturamento
                      </p>
                      <p className="mt-1 truncate text-sm font-bold">
                        {tipoFaturamento ||
                          "—"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-500">
                        Valor total
                      </p>
                      <p className="mt-1 text-lg font-black text-emerald-500">
                        {brl(
                          valorTotal
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =====================================================
            FOOTER
        ===================================================== */}
        <DialogFooter className="shrink-0 border-t border-border/60 bg-card/95 px-4 py-3 backdrop-blur-xl sm:px-5">

          <div className="flex w-full flex-col gap-3">

            <div className="flex items-center justify-between gap-3">

              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">
                  {currentStep.title}
                </p>

                <p className="text-[10px] text-muted-foreground">
                  Etapa {stepIndex + 1} de{" "}
                  {STEPS.length}
                </p>
              </div>

              <div className="hidden items-center gap-1.5 sm:flex">
                {STEPS.map(
                  (item) => (
                    <span
                      key={item.id}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        step === item.id
                          ? "w-8 bg-primary"
                          : completedSteps.has(
                                item.id
                              )
                            ? "w-4 bg-emerald-500"
                            : "w-4 bg-muted"
                      )}
                    />
                  )
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  onOpenChange(false)
                }
                disabled={salvando}
                className="h-11 rounded-xl sm:min-w-32"
              >
                Cancelar
              </Button>

              <div className="grid grid-cols-2 gap-2 sm:flex">

                {stepIndex > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={
                      goPrevious
                    }
                    disabled={salvando}
                    className="h-11 rounded-xl"
                  >
                    Voltar
                  </Button>
                )}

                {stepIndex <
                STEPS.length - 1 ? (
                  <Button
                    type="button"
                    onClick={
                      goNext
                    }
                    disabled={
                      salvando
                    }
                    className="h-11 rounded-xl px-6"
                  >
                    Continuar
                    <ChevronDown className="ml-2 h-4 w-4 -rotate-90" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={
                      handleSalvar
                    }
                    disabled={
                      salvando
                    }
                    className="h-11 rounded-xl px-6 sm:min-w-56"
                  >
                    {salvando ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}

                    {salvando
                      ? "Salvando..."
                      : "Salvar abastecimento"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}