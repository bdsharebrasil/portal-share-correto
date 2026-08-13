import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SearchableCombobox,
} from "@/components/ui/SearchableCombobox";

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
  ExternalLink,
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
  {
    id: "NOTA FISCAL FATURADO",
    label: "NOTA FISCAL FATURADO",
  },
  {
    id: "NOTA FISCAL A VISTA",
    label: "NOTA FISCAL A VISTA",
  },
  {
    id: "FATURADO RECIBO",
    label: "FATURADO RECIBO",
  },
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
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  defaultClienteId?: string | null;
  defaultAeronaveId?: string | null;
  defaultData?: string;

  /*
   * NOVO:
   * Quando preenchido, o diálogo abre o abastecimento
   * existente em modo de visualização.
   */
  abastecimentoId?: string | null;

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
    description: "Cliente, aeronave e trecho",
    icon: Plane,
  },
  {
    id: "combustivel",
    title: "Combustível",
    shortTitle: "Combustível",
    description: "Produto, volume e preço",
    icon: Fuel,
  },
  {
    id: "comanda",
    title: "Comanda",
    shortTitle: "Comanda",
    description: "Identificação e arquivo",
    icon: Receipt,
  },
  {
    id: "faturamento",
    title: "Faturamento",
    shortTitle: "Faturamento",
    description: "Pagamento e documentos",
    icon: CreditCard,
  },
  {
    id: "observacoes",
    title: "Notas",
    shortTitle: "Notas",
    description: "Informações adicionais",
    icon: FileText,
  },
];

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
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4.5 w-4.5" />
      </div>

      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.17em] text-primary">
          {eyebrow}
        </p>

        <h3 className="mt-0.5 text-base font-bold text-foreground">
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
        "group flex min-w-[145px] flex-1 items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all",
        active
          ? "border-primary/30 bg-primary/10"
          : completed
            ? "border-emerald-500/20 bg-emerald-500/[0.04]"
            : "border-border/60 bg-background/40 hover:bg-muted/40",
        locked && "cursor-not-allowed opacity-40"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          active
            ? "bg-primary text-primary-foreground"
            : completed
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-muted text-muted-foreground"
        )}
      >
        {completed ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Icon className="h-3.5 w-3.5" />
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            {String(number).padStart(2, "0")}
          </span>

          <span
            className={cn(
              "truncate text-[11px] font-bold",
              active
                ? "text-primary"
                : "text-foreground"
            )}
          >
            {title}
          </span>
        </div>

        <p className="truncate text-[9px] text-muted-foreground">
          {description}
        </p>
      </div>
    </button>
  );
}

function InfoBox({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-background/50 px-3 py-2.5",
        className
      )}
    >
      <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>

      <div className="mt-1 text-sm font-semibold text-foreground">
        {value}
      </div>
    </div>
  );
}

export function AbastecimentoPreVooDialog({
  open,
  onOpenChange,
  defaultClienteId,
  defaultAeronaveId,
  defaultData,
  abastecimentoId,
  onSaved,
}: Props) {
  const isViewing = !!abastecimentoId;

  const { clientes } = useClientesCombo();
  const { aerodromes } = useAerodromes();
  const { data: fornecedores = [] } =
    useFuelSuppliers();

  const [clienteId, setClienteId] = useState(
    defaultClienteId || ""
  );

  const [socioNome, setSocioNome] =
    useState("");

  const [aeronaveId, setAeronaveId] =
    useState(
      defaultAeronaveId || ""
    );

  const [data, setData] = useState(
    defaultData ||
      new Date()
        .toISOString()
        .split("T")[0]
  );

  const [trechoOrigem, setTrechoOrigem] =
    useState("");

  const [trechoDestino, setTrechoDestino] =
    useState("");

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

  const [comanda, setComanda] =
    useState("");

  const [comandaUrl, setComandaUrl] =
    useState<string | null>(null);

  const [
    uploadingComanda,
    setUploadingComanda,
  ] = useState(false);

  const [
    tipoFaturamento,
    setTipoFaturamento,
  ] = useState("");

  const [prazo, setPrazo] = useState("");
  const [dataPagamento, setDataPagamento] =
    useState("");

  const [pagoPor, setPagoPor] =
    useState("SHARE BRASIL");

  const [observacao, setObservacao] =
    useState("");

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
   * BUSCA DO ABASTECIMENTO EXISTENTE
   * =========================================================
   */
  const {
    data: abastecimentoExistente,
    isLoading: carregandoAbastecimento,
  } = useQuery({
    queryKey: [
      "prevoo-abastecimento-detalhes",
      abastecimentoId,
    ],
    enabled:
      open && !!abastecimentoId,

    queryFn: async () => {
      const { data, error } = await db
        .from("abastecimentos")
        .select("*")
        .eq("id", abastecimentoId)
        .maybeSingle();

      if (error) throw error;

      return data as any;
    },

    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  /*
   * =========================================================
   * CONSULTAS AUXILIARES
   * =========================================================
   */
  const { data: aeronaves = [] } =
    useQuery({
      queryKey: ["abast-aeronaves"],
      queryFn: async () => {
        const { data, error } =
          await db
            .from("aeronave")
            .select(
              "id, matricula, modelo"
            )
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

  const { data: socios = [] } =
    useQuery({
      queryKey: [
        "abast-socios",
        clienteId,
      ],
      enabled: !!clienteId,
      queryFn: async () => {
        const { data, error } =
          await db
            .from("socios")
            .select(
              "id, nome"
            )
            .eq(
              "clientes_id",
              clienteId
            )
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

  const { data: cotistas = [] } =
    useQuery({
      queryKey: [
        "abast-cotistas",
        aeronaveId,
      ],
      enabled: !!aeronaveId,
      queryFn: async () => {
        const { data, error } =
          await db
            .from("cotistas_aeronave")
            .select(
              "id, id_clientes, clientes:id_clientes(razao_social)"
            )
            .eq(
              "id_aeronave",
              aeronaveId
            );

        if (error) throw error;

        return (data || []) as any[];
      },
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    });

  const {
    data: ultimoLancamento,
  } = useQuery({
    queryKey: [
      "abast-ultimo-lancamento",
      aeronaveId,
    ],
    enabled: !!aeronaveId,
    queryFn: async () => {
      const { data, error } =
        await db
          .from(
            "lancamentos_diario_bordo"
          )
          .select(
            "aerodromo_partida, aerodromo_chegada, data_registro, trecho"
          )
          .eq(
            "aeronave_id",
            aeronaveId
          )
          .order(
            "data_registro",
            {
              ascending: false,
            }
          )
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
   * POPULA O FORMULÁRIO QUANDO É EDIÇÃO/VISUALIZAÇÃO
   * =========================================================
   */
  useEffect(() => {
    if (
      !open ||
      !abastecimentoExistente
    ) {
      return;
    }

    const registro =
      abastecimentoExistente;

    setClienteId(
      registro.id_clientes ||
        defaultClienteId ||
        ""
    );

    setSocioNome(
      registro.socio_nome ||
        ""
    );

    setAeronaveId(
      registro.aeronave_id ||
        defaultAeronaveId ||
        ""
    );

    setData(
      registro.data ||
        defaultData ||
        new Date()
          .toISOString()
          .split("T")[0]
    );

    const trecho =
      registro.trecho ||
      "";

    const parts =
      trecho
        .split(" x ")
        .map(
          (part: string) =>
            part.trim()
        );

    setTrechoOrigem(
      parts[0] || ""
    );

    setTrechoDestino(
      parts[1] || ""
    );

    setLocal(
      registro.local || ""
    );

    setTipoCombustivel(
      registro.tipo_combustivel ||
        ""
    );

    setAbastecedorId(
      registro.abastecedor_id ||
        ""
    );

    setAbastecedor(
      registro.abastecedor ||
        ""
    );

    setValorUnitario(
      registro.valor_unitario != null
        ? String(
            registro.valor_unitario
          )
        : ""
    );

    setLitros(
      registro.litros != null
        ? String(registro.litros)
        : ""
    );

    setComanda(
      registro.comanda ||
        ""
    );

    setComandaUrl(
      registro.comanda_url ||
        null
    );

    setTipoFaturamento(
      registro.tipo_faturamento ||
        ""
    );

    setPrazo(
      registro.prazo ||
        registro.data_vencimento_boleto ||
        ""
    );

    setDataPagamento(
      registro.data_pagamento ||
        ""
    );

    setPagoPor(
      registro.pago_por ||
        registro.forma_pagamento ||
        "SHARE BRASIL"
    );

    setObservacao(
      registro.observacao ||
        ""
    );

    setStep("operacao");
    setAvisoFechado(false);
  }, [
    open,
    abastecimentoExistente,
    defaultClienteId,
    defaultAeronaveId,
    defaultData,
  ]);

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
        c.id_clientes ===
        clienteId
    );
  }, [
    clienteId,
    aeronaveId,
    cotistas,
  ]);

  const litrosNum =
    Number(
      String(litros).replace(
        ",",
        "."
      )
    ) || 0;

  const unitNum =
    Number(
      String(
        valorUnitario
      ).replace(
        ",",
        "."
      )
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

  const aerodromeItems =
    useMemo(
      () =>
        aerodromes.map(
          (a: any) => ({
            id: a.designativo,
            label: `${a.designativo} — ${a.nome}`,
          })
        ),
      [aerodromes]
    );

  const pagoPorItems =
    useMemo(() => {
      const base = [
        {
          id: "SHARE BRASIL",
          label: "SHARE BRASIL",
        },
      ];

      cotistas.forEach(
        (c: any) => {
          const nome =
            c.clientes
              ?.razao_social;

          if (nome) {
            base.push({
              id: nome,
              label: nome,
            });
          }
        }
      );

      return base;
    }, [cotistas]);

  /*
   * =========================================================
   * UPLOAD
   * =========================================================
   */
  const handleComandaUpload =
    async (file: File) => {
      setUploadingComanda(true);

      try {
        const ext =
          (
            file.name
              .split(".")
              .pop() ||
            "bin"
          ).toLowerCase();

        const path =
          `abastecimentos/comandas/${crypto.randomUUID()}.${ext}`;

        const { error } =
          await supabase.storage
            .from(
              "client-documents"
            )
            .upload(
              path,
              file,
              {
                upsert: true,
              }
            );

        if (error) {
          throw error;
        }

        const publicUrl =
          supabase.storage
            .from(
              "client-documents"
            )
            .getPublicUrl(
              path
            )
            .data.publicUrl;

        setComandaUrl(
          publicUrl
        );

        toast.success(
          "Comprovante enviado."
        );
      } catch (e: any) {
        toast.error(
          `Erro no upload: ${
            e.message ?? e
          }`
        );
      } finally {
        setUploadingComanda(
          false
        );
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
   * STEPS
   * =========================================================
   */
  const completedSteps =
    useMemo(() => {
      const set =
        new Set<StepId>();

      if (
        clienteId &&
        aeronaveId &&
        data &&
        trechoOrigem &&
        trechoDestino &&
        local
      ) {
        set.add(
          "operacao"
        );
      }

      if (
        tipoCombustivel &&
        abastecedorId &&
        litrosNum > 0 &&
        unitNum > 0
      ) {
        set.add(
          "combustivel"
        );
      }

      if (
        comanda ||
        comandaUrl
      ) {
        set.add(
          "comanda"
        );
      }

      if (
        tipoFaturamento &&
        (
          (
            isFaturado &&
            prazo
          ) ||
          (
            isAVista &&
            dataPagamento
          ) ||
          (
            !isFaturado &&
            !isAVista
          )
        )
      ) {
        set.add(
          "faturamento"
        );
      }

      if (
        observacao.trim()
      ) {
        set.add(
          "observacoes"
        );
      }

      return set;
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

  const stepIndex =
    STEPS.findIndex(
      (item) =>
        item.id === step
    );

  const currentStep =
    STEPS[stepIndex] ||
    STEPS[0];

  const validateStep = (
    targetStep: StepId
  ) => {
    if (isViewing) {
      return true;
    }

    if (
      targetStep ===
      "operacao"
    ) {
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

      if (
        !trechoOrigem ||
        !trechoDestino
      ) {
        toast.error(
          "Informe origem e destino."
        );
        return false;
      }

      if (!local) {
        toast.error(
          "Informe o local."
        );
        return false;
      }
    }

    if (
      targetStep ===
      "combustivel"
    ) {
      if (!tipoCombustivel) {
        toast.error(
          "Selecione o combustível."
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
          "Informe os litros."
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

    if (
      targetStep ===
      "faturamento"
    ) {
      if (
        !tipoFaturamento
      ) {
        toast.error(
          "Selecione o faturamento."
        );
        return false;
      }

      if (
        isFaturado &&
        !prazo
      ) {
        toast.error(
          "Informe o prazo."
        );
        return false;
      }

      if (
        isAVista &&
        !dataPagamento
      ) {
        toast.error(
          "Informe a data de pagamento."
        );
        return false;
      }
    }

    return true;
  };

  const goNext = () => {
    if (
      !validateStep(step)
    ) {
      return;
    }

    const next =
      Math.min(
        stepIndex + 1,
        STEPS.length - 1
      );

    setStep(
      STEPS[next].id
    );
  };

  const goPrevious = () => {
    const prev =
      Math.max(
        stepIndex - 1,
        0
      );

    setStep(
      STEPS[prev].id
    );
  };

  /*
   * =========================================================
   * SALVAR NOVO
   * =========================================================
   */
  const handleSalvar =
    async () => {
      if (isViewing) {
        onOpenChange(false);
        return;
      }

      if (
        !clienteId ||
        !aeronaveId ||
        !trechoOrigem ||
        !trechoDestino ||
        !local
      ) {
        setStep(
          "operacao"
        );

        toast.error(
          "Complete os dados da operação."
        );

        return;
      }

      if (
        litrosNum <= 0 ||
        unitNum <= 0
      ) {
        setStep(
          "combustivel"
        );

        toast.error(
          "Informe litros e valor unitário."
        );

        return;
      }

      if (
        !tipoFaturamento
      ) {
        setStep(
          "faturamento"
        );

        toast.error(
          "Selecione o faturamento."
        );

        return;
      }

      if (
        isFaturado &&
        !prazo
      ) {
        setStep(
          "faturamento"
        );

        toast.error(
          "Informe o prazo."
        );

        return;
      }

      if (
        isAVista &&
        !dataPagamento
      ) {
        setStep(
          "faturamento"
        );

        toast.error(
          "Informe a data do pagamento."
        );

        return;
      }

      if (
        anexos.some(
          (a) =>
            a.uploading
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
          const {
            data: perfil,
          } = await db
            .from(
              "user_profiles"
            )
            .select(
              "full_name, display_name"
            )
            .eq(
              "id",
              userId
            )
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
            socioNome ||
            null,

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
            comanda ||
            null,

          comanda_url:
            comandaUrl ||
            urlPorTipo(
              "comanda"
            ),

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
            urlPorTipo(
              "boleto"
            ),

          pago_por:
            pagoPor ||
            null,

          observacao:
            observacao ||
            null,

          criado_por:
            criadoPor,
        };

        const {
          data: inserted,
          error,
        } = await db
          .from(
            "abastecimentos"
          )
          .insert(
            payload
          )
          .select("id")
          .single();

        if (error) {
          throw error;
        }

        toast.success(
          "Abastecimento registrado."
        );

        onSaved(
          inserted.id
        );

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
   * LOADING VISUALIZAÇÃO
   * =========================================================
   */
  const carregando =
    isViewing &&
    carregandoAbastecimento;

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
          "flex w-[calc(100vw-1rem)] flex-col overflow-hidden border-border/60 bg-background p-0 shadow-2xl",
          "max-h-[94vh]",
          "sm:max-w-[1100px]"
        )}
      >
        {/* =================================================
            HEADER COMPACTO
        ================================================= */}
        <DialogHeader className="shrink-0 border-b border-border/60 bg-card px-4 py-3 sm:px-5">

          <div className="flex items-center justify-between gap-4">

            <div className="flex min-w-0 items-center gap-3">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {isViewing ? (
                  <FileCheck2 className="h-5 w-5" />
                ) : (
                  <Fuel className="h-5 w-5" />
                )}
              </div>

              <div className="min-w-0">

                <div className="flex flex-wrap items-center gap-2">

                  <DialogTitle className="text-base font-black tracking-tight sm:text-lg">
                    {isViewing
                      ? "Abastecimento registrado"
                      : "Registrar abastecimento"}
                  </DialogTitle>

                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em]",
                      isViewing
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-primary/10 text-primary"
                    )}
                  >
                    {isViewing
                      ? "Visualização"
                      : "Operação de solo"}
                  </span>
                </div>

                <DialogDescription className="mt-0.5 truncate text-[11px]">
                  {isViewing
                    ? `Registro ${abastecimentoId}`
                    : "Registre o abastecimento vinculado ao checklist de pré-voo."}
                </DialogDescription>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onOpenChange(
                  false
                )
              }
              disabled={
                salvando
              }
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* RESUMO SUPERIOR COMPACTO */}
          <div className="mt-3 grid grid-cols-3 gap-2">

            <InfoBox
              label="Aeronave"
              value={
                aeronaves.find(
                  (a) =>
                    a.id ===
                    aeronaveId
                )?.matricula ||
                "—"
              }
            />

            <InfoBox
              label="Cliente"
              value={
                clientes.find(
                  (c) =>
                    c.id ===
                    clienteId
                )?.razao_social ||
                "—"
              }
            />

            <InfoBox
              label="Total"
              value={
                <span className="text-emerald-500">
                  {brl(
                    abastecimentoExistente?.valor_total ??
                      valorTotal
                  )}
                </span>
              }
            />
          </div>
        </DialogHeader>

        {/* =================================================
            VISUALIZAÇÃO DO REGISTRO
        ================================================= */}
        {isViewing ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-background">
            <div className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-5">

              {carregando ? (
                <div className="flex min-h-[430px] items-center justify-center">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>

                    <div>
                      <p className="text-sm font-semibold">
                        Carregando abastecimento
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Buscando os dados registrados...
                      </p>
                    </div>
                  </div>
                </div>
              ) : !abastecimentoExistente ? (
                <div className="flex min-h-[430px] items-center justify-center">
                  <div className="max-w-sm text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                      <AlertTriangle className="h-5 w-5" />
                    </div>

                    <p className="mt-4 font-bold">
                      Abastecimento não encontrado
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      O registro não foi localizado no banco de dados.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* STATUS */}
                  <div className="flex flex-col gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">

                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>

                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-500">
                          Registro localizado
                        </p>

                        <p className="mt-1 text-sm font-bold">
                          Abastecimento registrado em{" "}
                          {abastecimentoExistente.data
                            ? new Date(
                                `${abastecimentoExistente.data}T12:00:00`
                              ).toLocaleDateString(
                                "pt-BR"
                              )
                            : "—"}
                        </p>
                      </div>
                    </div>

                    <span
                      className={cn(
                        "w-fit rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider",
                        abastecimentoExistente.status ===
                          "pago"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-amber-500/10 text-amber-500"
                      )}
                    >
                      {abastecimentoExistente.status ||
                        "pendente"}
                    </span>
                  </div>

                  {/* OPERAÇÃO */}
                  <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
                    <SectionHeader
                      icon={Plane}
                      eyebrow="Operação"
                      title="Dados da operação"
                    />

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                      <InfoBox
                        label="Cliente"
                        value={
                          abastecimentoExistente.id_clientes
                            ? clientes.find(
                                (c) =>
                                  c.id ===
                                  abastecimentoExistente.id_clientes
                              )?.razao_social ||
                              "—"
                            : "—"
                        }
                      />

                      <InfoBox
                        label="Aeronave"
                        value={
                          aeronaves.find(
                            (a) =>
                              a.id ===
                              abastecimentoExistente.aeronave_id
                          )?.matricula ||
                          "—"
                        }
                      />

                      <InfoBox
                        label="Data"
                        value={
                          abastecimentoExistente.data
                            ? new Date(
                                `${abastecimentoExistente.data}T12:00:00`
                              ).toLocaleDateString(
                                "pt-BR"
                              )
                            : "—"
                        }
                      />

                      <InfoBox
                        label="Local"
                        value={
                          abastecimentoExistente.local ||
                          "—"
                        }
                      />
                    </div>

                    <div className="mt-3 rounded-xl border border-primary/10 bg-primary/[0.04] p-4">

                      <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        Trecho
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-3">

                        <span className="rounded-xl bg-background px-3 py-2 text-sm font-black">
                          {(
                            abastecimentoExistente.trecho ||
                            "—"
                          )
                            .split(
                              " x "
                            )[0] ||
                            "—"}
                        </span>

                        <ArrowRight className="h-4 w-4 text-primary" />

                        <span className="rounded-xl bg-background px-3 py-2 text-sm font-black">
                          {(
                            abastecimentoExistente.trecho ||
                            "—"
                          )
                            .split(
                              " x "
                            )[1] ||
                            "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* COMBUSTÍVEL */}
                  <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
                    <SectionHeader
                      icon={Fuel}
                      eyebrow="Abastecimento"
                      title="Dados do combustível"
                    />

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                      <InfoBox
                        label="Combustível"
                        value={
                          abastecimentoExistente.tipo_combustivel ||
                          "—"
                        }
                      />

                      <InfoBox
                        label="Fornecedor"
                        value={
                          abastecimentoExistente.abastecedor ||
                          "—"
                        }
                      />

                      <InfoBox
                        label="Litros"
                        value={
                          abastecimentoExistente.litros != null
                            ? `${Number(
                                abastecimentoExistente.litros
                              ).toLocaleString(
                                "pt-BR"
                              )} L`
                            : "—"
                        }
                      />

                      <InfoBox
                        label="Valor unitário"
                        value={
                          brl(
                            abastecimentoExistente.valor_unitario
                          )
                        }
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-4">

                      <div className="flex items-center gap-3">
                        <CircleDollarSign className="h-5 w-5 text-emerald-500" />

                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-500">
                            Valor total
                          </p>

                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {abastecimentoExistente.litros != null &&
                            abastecimentoExistente.valor_unitario != null
                              ? `${Number(
                                  abastecimentoExistente.litros
                                ).toLocaleString(
                                  "pt-BR"
                                )} L × ${brl(
                                  abastecimentoExistente.valor_unitario
                                )}`
                              : ""}
                          </p>
                        </div>
                      </div>

                      <span className="text-2xl font-black text-emerald-500">
                        {brl(
                          abastecimentoExistente.valor_total
                        )}
                      </span>
                    </div>

                    {abastecimentoExistente.abastecedor && (
                      <div className="mt-3 text-xs text-muted-foreground">
                        Abastecedor:{" "}
                        <strong className="text-foreground">
                          {
                            abastecimentoExistente.abastecedor
                          }
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* COMANDA */}
                  <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
                    <SectionHeader
                      icon={Receipt}
                      eyebrow="Documento operacional"
                      title="Comanda"
                    />

                    <div className="grid gap-3 sm:grid-cols-2">

                      <InfoBox
                        label="Número"
                        value={
                          abastecimentoExistente.comanda ||
                          "Não informado"
                        }
                      />

                      {abastecimentoExistente.comanda_url ? (
                        <a
                          href={
                            abastecimentoExistente.comanda_url
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 transition hover:bg-primary/[0.08]"
                        >
                          <div className="flex items-center gap-3">
                            <FileCheck2 className="h-5 w-5 text-primary" />

                            <div>
                              <p className="text-xs font-bold">
                                Comprovante da comanda
                              </p>

                              <p className="text-[10px] text-muted-foreground">
                                Abrir arquivo
                              </p>
                            </div>
                          </div>

                          <ExternalLink className="h-4 w-4 text-primary" />
                        </a>
                      ) : (
                        <InfoBox
                          label="Arquivo"
                          value="Não anexado"
                        />
                      )}
                    </div>
                  </div>

                  {/* FATURAMENTO */}
                  <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
                    <SectionHeader
                      icon={CreditCard}
                      eyebrow="Financeiro"
                      title="Faturamento e pagamento"
                    />

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                      <InfoBox
                        label="Tipo"
                        value={
                          abastecimentoExistente.tipo_faturamento ||
                          "—"
                        }
                      />

                      <InfoBox
                        label="Pago por"
                        value={
                          abastecimentoExistente.pago_por ||
                          abastecimentoExistente.forma_pagamento ||
                          "—"
                        }
                      />

                      <InfoBox
                        label="Prazo"
                        value={
                          abastecimentoExistente.prazo
                            ? new Date(
                                `${abastecimentoExistente.prazo}T12:00:00`
                              ).toLocaleDateString(
                                "pt-BR"
                              )
                            : "—"
                        }
                      />

                      <InfoBox
                        label="Pagamento"
                        value={
                          abastecimentoExistente.data_pagamento
                            ? new Date(
                                `${abastecimentoExistente.data_pagamento}T12:00:00`
                              ).toLocaleDateString(
                                "pt-BR"
                              )
                            : "Não pago"
                        }
                      />
                    </div>

                    <div className="mt-4">
                      <AnexosDinamicosField
                        anexos={[]}
                        onChange={() => undefined}
                        storagePrefix="abastecimentos/view"
                      />
                    </div>
                  </div>

                  {/* OBSERVAÇÃO */}
                  {abastecimentoExistente.observacao && (
                    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">

                      <SectionHeader
                        icon={FileText}
                        eyebrow="Notas"
                        title="Observação"
                      />

                      <div className="rounded-xl border border-border/60 bg-background/50 p-4 text-sm leading-6 text-muted-foreground">
                        {
                          abastecimentoExistente.observacao
                        }
                      </div>
                    </div>
                  )}

                  {/* META */}
                  <div className="grid gap-3 sm:grid-cols-2">

                    <InfoBox
                      label="Criado por"
                      value={
                        abastecimentoExistente.criado_por ||
                        "—"
                      }
                    />

                    <InfoBox
                      label="ID do registro"
                      value={
                        <span className="break-all font-mono text-xs">
                          {
                            abastecimentoExistente.id
                          }
                        </span>
                      }
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /*
           * =================================================
           * FORMULÁRIO DE CRIAÇÃO
           * =================================================
           */
          <>
            <div className="shrink-0 border-b border-border/60 bg-card px-3 py-2.5 sm:px-4">
              <div className="flex gap-2 overflow-x-auto pb-0.5">
                {STEPS.map(
                  (
                    item,
                    index
                  ) => (
                    <StepCard
                      key={item.id}
                      number={index + 1}
                      title={
                        item.shortTitle
                      }
                      description={
                        item.description
                      }
                      icon={
                        item.icon
                      }
                      active={
                        step ===
                        item.id
                      }
                      completed={completedSteps.has(
                        item.id
                      )}
                      locked={
                        index >
                        stepIndex +
                          1
                      }
                      onClick={() =>
                        setStep(
                          item.id
                        )
                      }
                    />
                  )
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-background">
              <div className="mx-auto w-full max-w-5xl p-4 sm:p-5">

                {/* OPERAÇÃO */}
                {step ===
                  "operacao" && (
                  <div className="space-y-4">

                    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
                      <SectionHeader
                        icon={Plane}
                        eyebrow="Etapa 01"
                        title="Dados da operação"
                        description="Defina cliente, aeronave, data e trecho."
                      />

                      <div className="grid gap-4 md:grid-cols-2">

                        <div>
                          <FieldLabel required>
                            Cliente
                          </FieldLabel>

                          <SearchableCombobox
                            items={clientes.map(
                              (
                                c
                              ) => ({
                                id: c.id,
                                label:
                                  c.razao_social,
                              })
                            )}
                            value={
                              clienteId
                            }
                            onChange={(
                              id
                            ) => {
                              setClienteId(
                                id
                              );
                              setSocioNome(
                                ""
                              );
                            }}
                            placeholder="Selecione o cliente"
                            icon={
                              <Users className="h-4 w-4" />
                            }
                          />
                        </div>

                        {socios.length >
                          0 && (
                          <div>
                            <FieldLabel>
                              Sócio
                            </FieldLabel>

                            <SearchableCombobox
                              items={socios.map(
                                (
                                  s
                                ) => ({
                                  id:
                                    s.nome,
                                  label:
                                    s.nome,
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
                              (
                                a
                              ) => ({
                                id:
                                  a.id,
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
                        </div>

                        <div>
                          <FieldLabel required>
                            Data
                          </FieldLabel>

                          <div className="relative">
                            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                            <Input
                              type="date"
                              value={
                                data
                              }
                              onChange={(
                                e
                              ) =>
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

                    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
                      <SectionHeader
                        icon={MapPin}
                        eyebrow="Trecho"
                        title="Origem, destino e local"
                        description="Informe o trecho e onde o abastecimento aconteceu."
                      />

                      <div className="grid gap-4 md:grid-cols-3">

                        <div>
                          <FieldLabel required>
                            Origem
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
                            Destino
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
                            Local
                          </FieldLabel>

                          <Input
                            value={
                              local
                            }
                            onChange={(
                              e
                            ) =>
                              setLocal(
                                e.target
                                  .value
                              )
                            }
                            placeholder="Ex.: CUIABÁ - MT"
                            className="h-11 rounded-xl"
                          />
                        </div>
                      </div>

                      {trechoOrigem &&
                        trechoDestino && (
                          <div className="mt-4 flex items-center justify-center gap-3 rounded-xl border border-primary/10 bg-primary/[0.04] px-4 py-3">
                            <span className="rounded-lg bg-background px-3 py-1.5 text-xs font-black">
                              {
                                trechoOrigem
                              }
                            </span>

                            <ArrowRight className="h-4 w-4 text-primary" />

                            <span className="rounded-lg bg-background px-3 py-1.5 text-xs font-black">
                              {
                                trechoDestino
                              }
                            </span>
                          </div>
                        )}
                    </div>

                    {ultimoLancamento &&
                      !avisoFechado && (
                        <div className="flex items-start gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/[0.05] p-3.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500">
                            <Info className="h-4 w-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-sky-500">
                              Último lançamento
                            </p>

                            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                              {
                                ultimoLancamento.aerodromo_partida ||
                                "—"
                              }{" "}
                              ×{" "}
                              {
                                ultimoLancamento.aerodromo_chegada ||
                                "—"
                              }{" "}
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
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                  </div>
                )}

                {/* COMBUSTÍVEL */}
                {step ===
                  "combustivel" && (
                  <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">

                    <SectionHeader
                      icon={Fuel}
                      eyebrow="Etapa 02"
                      title="Dados do combustível"
                      description="Informe combustível, fornecedor, quantidade e preço."
                    />

                    <div className="grid gap-4 md:grid-cols-2">

                      <div>
                        <FieldLabel required>
                          Combustível
                        </FieldLabel>

                        <SearchableCombobox
                          items={
                            TIPOS_COMBUSTIVEL
                          }
                          value={
                            tipoCombustivel
                          }
                          onChange={(
                            id
                          ) => {
                            setTipoCombustivel(
                              id
                            );

                            if (
                              abastecedorId
                            ) {
                              const fornecedor =
                                fornecedores.find(
                                  (
                                    f
                                  ) =>
                                    f.id ===
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
                            (
                              f
                            ) => ({
                              id:
                                f.id,
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
                                  f
                                ) =>
                                  f.id ===
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
                          onChange={(
                            e
                          ) =>
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
                          value={
                            litros
                          }
                          onChange={(
                            e
                          ) =>
                            setLitros(
                              e.target
                                .value
                            )
                          }
                          inputMode="decimal"
                          placeholder="0,00"
                          className="h-11 rounded-xl text-right"
                        />
                      </div>

                      <div>
                        <FieldLabel required>
                          Valor unitário
                        </FieldLabel>

                        <Input
                          value={
                            valorUnitario
                          }
                          onChange={(
                            e
                          ) =>
                            setValorUnitario(
                              e.target
                                .value
                            )
                          }
                          inputMode="decimal"
                          placeholder="0,00"
                          className="h-11 rounded-xl text-right"
                        />
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-4">
                      <div className="flex items-center gap-3">
                        <CircleDollarSign className="h-5 w-5 text-emerald-500" />

                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-500">
                            Valor total
                          </p>

                          <p className="text-[10px] text-muted-foreground">
                            {litrosNum > 0 &&
                            unitNum > 0
                              ? `${litrosNum.toLocaleString(
                                  "pt-BR"
                                )} L × ${brl(
                                  unitNum
                                )}`
                              : "Informe litros e preço"}
                          </p>
                        </div>
                      </div>

                      <span className="text-2xl font-black text-emerald-500">
                        {brl(
                          valorTotal
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {/* COMANDA */}
                {step ===
                  "comanda" && (
                  <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">

                    <SectionHeader
                      icon={Receipt}
                      eyebrow="Etapa 03"
                      title="Comanda"
                      description="Identifique a comanda e anexe o comprovante."
                    />

                    <div className="grid gap-4 md:grid-cols-2">

                      <div>
                        <FieldLabel>
                          Número da comanda
                        </FieldLabel>

                        <Input
                          value={
                            comanda
                          }
                          onChange={(
                            e
                          ) =>
                            setComanda(
                              e.target
                                .value
                            )
                          }
                          placeholder="Ex.: 47574"
                          className="h-11 rounded-xl"
                        />
                      </div>

                      <div>
                        <FieldLabel>
                          Comprovante
                        </FieldLabel>

                        {comandaUrl ? (
                          <div className="flex h-11 items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-3">
                            <span className="flex items-center gap-2 text-xs font-semibold text-emerald-500">
                              <CheckCircle2 className="h-4 w-4" />
                              Arquivo enviado
                            </span>

                            <a
                              href={
                                comandaUrl
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              Abrir
                            </a>
                          </div>
                        ) : (
                          <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background/50 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground">
                            {uploadingComanda ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}

                            {uploadingComanda
                              ? "Enviando..."
                              : "Enviar comanda"}

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
                                  e
                                    .target
                                    .files?.[0];

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
                )}

                {/* FATURAMENTO */}
                {step ===
                  "faturamento" && (
                  <div className="space-y-4">

                    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">

                      <SectionHeader
                        icon={CreditCard}
                        eyebrow="Etapa 04"
                        title="Faturamento"
                        description="Defina como o abastecimento será lançado financeiramente."
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
                            placeholder="Selecione"
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
                            value={
                              pagoPor
                            }
                            onChange={(
                              id
                            ) =>
                              setPagoPor(
                                id
                              )
                            }
                            placeholder="Selecione"
                            icon={
                              <Building2 className="h-4 w-4" />
                            }
                          />
                        </div>

                        {isFaturado && (
                          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4 md:col-span-2">
                            <FieldLabel required>
                              Prazo do faturamento
                            </FieldLabel>

                            <Input
                              type="date"
                              value={
                                prazo
                              }
                              onChange={(
                                e
                              ) =>
                                setPrazo(
                                  e.target
                                    .value
                                )
                              }
                              className="h-11 rounded-xl"
                            />

                            <p className="mt-2 text-[10px] text-amber-500">
                              O lançamento ficará como pendente.
                            </p>
                          </div>
                        )}

                        {isAVista && (
                          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4 md:col-span-2">
                            <FieldLabel required>
                              Data do pagamento
                            </FieldLabel>

                            <Input
                              type="date"
                              value={
                                dataPagamento
                              }
                              onChange={(
                                e
                              ) =>
                                setDataPagamento(
                                  e.target
                                    .value
                                )
                              }
                              className="h-11 rounded-xl"
                            />

                            <p className="mt-2 text-[10px] text-emerald-500">
                              O lançamento ficará como pago.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">

                      <SectionHeader
                        icon={Paperclip}
                        eyebrow="Documentos"
                        title="Anexos financeiros"
                        description="NF, boleto e comprovantes."
                      />

                      <AnexosDinamicosField
                        anexos={anexos}
                        onChange={
                          setAnexos
                        }
                        storagePrefix={`abastecimentos/${
                          clienteId ||
                          "sem-cliente"
                        }`}
                      />
                    </div>
                  </div>
                )}

                {/* OBSERVAÇÕES */}
                {step ===
                  "observacoes" && (
                  <div className="space-y-4">

                    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
                      <SectionHeader
                        icon={
                          FileText
                        }
                        eyebrow="Etapa 05"
                        title="Observações"
                        description="Informações adicionais do abastecimento."
                      />

                      <Textarea
                        value={
                          observacao
                        }
                        onChange={(
                          e
                        ) =>
                          setObservacao(
                            e.target
                              .value
                          )
                        }
                        placeholder="Registre informações complementares..."
                        className="min-h-[160px] rounded-xl"
                      />
                    </div>

                    <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-4">

                      <div className="mb-3 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />

                        <p className="text-xs font-bold">
                          Resumo
                        </p>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">

                        <InfoBox
                          label="Trecho"
                          value={
                            `${trechoOrigem || "—"} → ${
                              trechoDestino ||
                              "—"
                            }`
                          }
                        />

                        <InfoBox
                          label="Combustível"
                          value={
                            tipoCombustivel ||
                            "—"
                          }
                        />

                        <InfoBox
                          label="Total"
                          value={
                            <span className="text-emerald-500">
                              {brl(
                                valorTotal
                              )}
                            </span>
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* FOOTER CREATE */}
            <div className="shrink-0 border-t border-border/60 bg-card px-4 py-3">

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <p className="text-xs font-semibold">
                    {currentStep.title}
                  </p>

                  <p className="text-[10px] text-muted-foreground">
                    Etapa {stepIndex + 1} de{" "}
                    {STEPS.length}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex">

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      onOpenChange(
                        false
                      )
                    }
                    disabled={
                      salvando
                    }
                    className="h-10 rounded-xl"
                  >
                    Cancelar
                  </Button>

                  {stepIndex > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={
                        goPrevious
                      }
                      disabled={
                        salvando
                      }
                      className="h-10 rounded-xl"
                    >
                      Voltar
                    </Button>
                  )}

                  {stepIndex <
                  STEPS.length -
                    1 ? (
                    <Button
                      type="button"
                      onClick={
                        goNext
                      }
                      disabled={
                        salvando
                      }
                      className="h-10 rounded-xl px-6"
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
                      className="h-10 rounded-xl px-6 sm:min-w-52"
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
          </>
        )}

        {/* =====================================================
            FOOTER VISUALIZAÇÃO
        ===================================================== */}
        {isViewing && (
          <div className="shrink-0 border-t border-border/60 bg-card px-4 py-3">
            <div className="flex items-center justify-between gap-3">

              <div className="hidden items-center gap-2 sm:flex">
                <FileCheck2 className="h-4 w-4 text-emerald-500" />

                <span className="text-xs text-muted-foreground">
                  Visualização do registro existente
                </span>
              </div>

              <Button
                type="button"
                onClick={() =>
                  onOpenChange(false)
                }
                className="h-10 w-full rounded-xl sm:ml-auto sm:w-auto sm:min-w-32"
              >
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}