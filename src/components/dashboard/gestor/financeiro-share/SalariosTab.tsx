import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  Save,
  Pencil,
  Calendar,
  Upload,
  FileText,
  Plus,
  Trash2,
  Building2,
  CreditCard,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { syncSalaryPaymentToFinancial } from "@/services/financialSyncClient";
import { readHolerite } from "@/lib/holeriteOCR";
import { calcularValorFerias } from "@/lib/feriasCalculator";
import { getPayslipPublicUrl } from "@/hooks/usePayslips";

/* ─────────────────────────── types ─────────────────────────── */

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  employment_status: string | null;
  tipo: string | null;
  bank_account: string | null;
  bank_agency: string | null;
  bank_name: string | null;
  bank_pix: string | null;
  departamento: string | null;
}

interface SalarioVigente {
  user_id: string;
  salario_bruto: number | null;
  salario_liquido: number | null;
  beneficios: string | null;
  data_vigencia: string;
}

interface PagamentoSalario {
  id: string;
  id_usuario: string | null;
  salario_holerite: number | string | null;
  salario_bruto?: number | string | null;
  salario_liquido?: number | string | null;
  valor_horas_voo?: number | string | null;
  bonificacao_extra?: number | string | null;
  descontos_detalhes?: unknown;
  beneficios_detalhes?: unknown;
  custo_total_empresa?: number | string | null;
  valor_total?: number | string | null;
  beneficios: string | null;
  horas_voadas: string | null;
  decimo_terceiro_parcela1: number | string | null;
  decimo_terceiro_parcela2: number | string | null;
  decimo_terceiro_referencia?: string | null;
  ferias: number | string | null;
  ferias_referencia?: string | null;
  ferias_modalidade?: string | null;
  ferias_dias_comprados?: number | string | null;
  ferias_inicio?: string | null;
  ferias_fim?: string | null;
  ferias_dias?: number | null;
  ferias_valor_holerite?: number | string | null;
  adicionais: string | null;
  observacoes: string | null;
  banco_pagamento: string | null;
  data_pagamento: string | null;
  url_holerite: string | null;
  url_comprovante: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
}

interface ContaBancaria {
  id: string;
  banco: string | null;
  numero_conta: string | null;
  tipo_conta: string | null;
}

interface AeronaveInfo {
  id: string;
  matricula: string;
  modelo: string;
}

interface TaxaHoraRow {
  aeronave_id: string;
  taxa_hora: number;
  data_vigencia: string;
}

interface FormState {
  base_salary_holerite: string;
  salario_bruto: string;
  salario_liquido: string;
  desconto_inss: string;
  desconto_irrf: string;
  desconto_outros: string;
  benefit: string;
  benefit_card: string;
  benefit_other: string;
  horas_voo: string;
  valor_horas_voo: string;
  extra: string;
  decimo_terceiro_parcela1: string;
  decimo_terceiro_parcela2: string;
  decimo_terceiro_referencia: string;
  ferias: string;
  ferias_referencia: string;
  ferias_modalidade: string;
  ferias_dias_comprados: string;
  ferias_inicio: string;
  ferias_fim: string;
  ferias_dias: string;
  ferias_valor_holerite: string;
  banco: string;
  data_pagamento: string;
  obs: string;
  holerite_url: string;
  comprovante_url: string;
  show13: boolean;
  showFerias: boolean;
}

const emptyForm: FormState = {
  base_salary_holerite: "",
  salario_bruto: "",
  salario_liquido: "",
  desconto_inss: "",
  desconto_irrf: "",
  desconto_outros: "",
  benefit: "",
  benefit_card: "",
  benefit_other: "",
  horas_voo: "",
  valor_horas_voo: "",
  extra: "",
  decimo_terceiro_parcela1: "",
  decimo_terceiro_parcela2: "",
  decimo_terceiro_referencia: "",
  ferias: "",
  ferias_referencia: "",
  ferias_modalidade: "",
  ferias_dias_comprados: "",
  ferias_inicio: "",
  ferias_fim: "",
  ferias_dias: "",
  ferias_valor_holerite: "",
  banco: "",
  data_pagamento: "",
  obs: "",
  holerite_url: "",
  comprovante_url: "",
  show13: false,
  showFerias: false,
};

const MESES = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

/* ─────────────────────────── helpers ─────────────────────────── */

const parseMoney = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value).trim().replace(/R\$/gi, "").replace(/\s/g, "");
  if (!text) return 0;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const num = (v: string | number | null | undefined) => parseMoney(v);

const moneyInput = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "";

  // Não formatar como moeda a cada tecla: isso reposiciona o cursor,
  // impede apagar o conteúdo e causa sensação de travamento no input.
  return String(value)
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/[^0-9,.-]/g, "")
    .replace(/(?!^)-/g, "")
    .replace(/(,.*),/g, "$1");
};

const parseJsonArray = (value: unknown): Array<{ tipo?: string; valor?: number | string }> => {
  if (Array.isArray(value)) return value as Array<{ tipo?: string; valor?: number | string }>;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const isCrewDepartamento = (departamento: string | null | undefined) => {
  const d = (departamento || "").toUpperCase();
  return d === "TRIPULANTE" || d === "PILOTO_CHEFE";
};

const calculateVacationDays = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) return 0;
  return Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
};

const formatDateRangeBR = (start: string, end: string): string => {
  if (!start || !end) return "";
  const toBR = (value: string) => value.split("-").reverse().join("/");
  return `${toBR(start)} a ${toBR(end)}`;
};

const getMonthYearFromDate = (dateString: string): { month: number; year: number } => {
  const date = new Date(dateString);
  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
};

/* ─────────────────────────── main ─────────────────────────── */

export default function SalariosTab() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [mes, setMes] = useState<number>(now.getMonth() + 1);
  const [ano, setAno] = useState<number>(now.getFullYear());
  const [loaded, setLoaded] = useState(false);

  const [funcionarios, setFuncionarios] = useState<UserProfile[]>([]);
  const [pagamentos, setPagamentos] = useState<Record<string, PagamentoSalario | null>>({});
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<{ userId: string; field: "holerite" | "comprovante" } | null>(null);
  const [readingHolerite, setReadingHolerite] = useState<string | null>(null);

  const setMoneyField = (userId: string, field: keyof FormState, value: string) => {
    setForms((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] ?? emptyForm), [field]: moneyInput(value) },
    }));
  };

  const [aeronaves, setAeronaves] = useState<AeronaveInfo[]>([]);
  const [taxasHora, setTaxasHora] = useState<TaxaHoraRow[]>([]);
  const [horasVooPorUsuario, setHorasVooPorUsuario] = useState<
    Record<string, { aeronave_id: string; horas: number }[]>
  >({});

  const fetchContas = useCallback(async () => {
    const { data } = await supabase
      .from("contas_bancarias")
      .select("id,banco,numero_conta,tipo_conta")
      .eq("ativo", true);
    setContas((data ?? []) as ContaBancaria[]);
  }, []);

  useEffect(() => {
    fetchContas();
  }, [fetchContas]);

  const uploadFileToStorage = async (file: File, folder: "holerite" | "comprovante"): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const bucket = folder === "holerite" ? "holerites" : "comprovantes";
    const filePath = `pagamento-salario/${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleFileUpload = async (userId: string, field: "holerite" | "comprovante", file: File) => {
    try {
      setUploadingField({ userId, field });
      let extractionMessage = "";
      if (field === "holerite") {
        setReadingHolerite(userId);
        const extraction = await readHolerite(file);
        setForms((prev) => {
          const current = prev[userId] ?? emptyForm;
          return {
            ...prev,
            [userId]: {
              ...current,
              salario_bruto: extraction.salarioBruto != null ? String(extraction.salarioBruto) : current.salario_bruto,
              base_salary_holerite: extraction.salarioBruto != null ? String(extraction.salarioBruto) : current.base_salary_holerite,
              salario_liquido: extraction.salarioLiquido != null ? String(extraction.salarioLiquido) : current.salario_liquido,
              desconto_inss: extraction.descontoInss != null ? String(extraction.descontoInss) : current.desconto_inss,
              desconto_irrf: extraction.descontoIrrf != null ? String(extraction.descontoIrrf) : current.desconto_irrf,
              desconto_outros: extraction.outrosDescontos != null ? String(extraction.outrosDescontos) : current.desconto_outros,
              ferias_valor_holerite: extraction.valorFerias != null ? String(extraction.valorFerias) : current.ferias_valor_holerite,
            },
          };
        });
        extractionMessage = extraction.salarioBruto || extraction.salarioLiquido
          ? ` Leitura automática concluída (${extraction.confidence != null ? `${Math.round(extraction.confidence)}% de confiança` : "confira os valores"}).`
          : " Não encontrei valores com segurança; confira os campos manualmente.";
      }
      const publicUrl = await uploadFileToStorage(file, field);
      setForms((prev) => ({
        ...prev,
        [userId]: {
          ...(prev[userId] ?? emptyForm),
          [field === "holerite" ? "holerite_url" : "comprovante_url"]: publicUrl,
        },
      }));
      setToast({ type: "ok", text: `${field === "holerite" ? "Holerite" : "Comprovante"} enviado com sucesso!${extractionMessage}` });
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao realizar upload ou ler o holerite." });
    } finally {
      setUploadingField(null);
      setReadingHolerite(null);
    }
  };

  const carregar = useCallback(async () => {
    setLoading(true);
    setToast(null);
    try {
      // 1. Busca colaboradores com dados bancários e departamento
      const { data: users, error: ue } = await supabase
        .from("user_profiles")
        .select("id,full_name,email,employment_status,tipo,bank_account,bank_agency,bank_name,bank_pix,departamento")
        .eq("employment_status", "ativo")
        .eq("tipo", "colaborador")
        .order("full_name", { ascending: true });

      if (ue) throw ue;
      const userList = (users ?? []) as UserProfile[];
      setFuncionarios(userList);

      if (userList.length === 0) {
        setPagamentos({});
        setForms({});
        setHorasVooPorUsuario({});
        setLoaded(true);
        setLoading(false);
        return;
      }

      const userIds = userList.map((u) => u.id);

      // 1.1 Para tripulantes / piloto chefe, busca horas de voo diretamente do diário de bordo no período
      const crewUsers = userList.filter((u) => isCrewDepartamento(u.departamento));
      if (crewUsers.length > 0) {
        const crewUserIds = crewUsers.map((u) => u.id);

        const { data: membrosData } = await (supabase as any)
          .from("membros_tripulacao")
          .select("id,user_id,canac")
          .in("user_id", crewUserIds);

        if (membrosData && membrosData.length > 0) {
          const startDate = `${ano}-${String(mes).padStart(2, "0")}-01`;
          const lastDay = new Date(ano, mes, 0).getDate();
          const endDate = `${ano}-${String(mes).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T23:59:59`;

          const [{ data: entriesData }, { data: aeronaveData }, { data: taxasData }] = await Promise.all([
            supabase
              .from("lancamentos_diario_bordo")
              .select("pic_canac,sic_canac,aeronave_id,tempo_total,data_registro")
              .gte("data_registro", startDate)
              .lte("data_registro", endDate),
            supabase.from("aeronave").select("id,matricula,modelo"),
            (supabase as any)
              .from("taxas_hora_aeronave")
              .select("aeronave_id,taxa_hora,data_vigencia")
              .order("data_vigencia", { ascending: false }),
          ]);

          setAeronaves((aeronaveData ?? []) as AeronaveInfo[]);
          setTaxasHora((taxasData ?? []) as TaxaHoraRow[]);

          const horasMap: Record<string, { aeronave_id: string; horas: number }[]> = {};

          (entriesData ?? []).forEach((entry: any) => {
            const tempoTotal = Number(entry.tempo_total) || 0;
            if (tempoTotal <= 0) return;

            membrosData.forEach((m: any) => {
              const isPic = entry.pic_canac === m.id || (m.canac && entry.pic_canac === m.canac);
              const isSic = entry.sic_canac === m.id || (m.canac && entry.sic_canac === m.canac);

              if (isPic || isSic) {
                const userId = m.user_id;
                if (!userId) return;

                if (!horasMap[userId]) horasMap[userId] = [];
                const linha = horasMap[userId].find((x) => x.aeronave_id === entry.aeronave_id);
                if (linha) {
                  linha.horas += tempoTotal;
                } else {
                  horasMap[userId].push({ aeronave_id: entry.aeronave_id, horas: tempoTotal });
                }
              }
            });
          });

          setHorasVooPorUsuario(horasMap);
        } else {
          setHorasVooPorUsuario({});
        }
      } else {
        setHorasVooPorUsuario({});
      }

      // 2. Busca histórico de salários para pré-preenchimento
      const { data: salariosData } = await (supabase as any)
        .from("salarios")
        .select("user_id, salario_bruto, salario_liquido, beneficios, data_vigencia")
        .in("user_id", userIds)
        .order("data_vigencia", { ascending: false });

      const salariosMap: Record<string, SalarioVigente> = {};
      (salariosData ?? []).forEach((s: any) => {
        if (!salariosMap[s.user_id]) salariosMap[s.user_id] = s;
      });

      // 3. Busca holerite mensal enviado pela contabilidade para pré-preenchimento
      const { data: holeritesData, error: he } = await (supabase as any)
        .from("employee_payslips")
        .select("employee_id, month, year, file_path, salario_bruto, salario_liquido, desconto_inss, desconto_irrf, outros_descontos, valor_ferias, total_descontos, ocr_status, ocr_confidence")
        .in("employee_id", userIds)
        .eq("month", mes)
        .eq("year", ano);
      if (he) throw he;

      const holeriteMap: Record<string, any> = {};
      (holeritesData ?? []).forEach((h: any) => {
        holeriteMap[h.employee_id] = h;
      });

      // 4. Busca histórico de pagamentos salvos
      const { data: pags, error: pe } = await (supabase as any)
        .from("historico_pagamentos_funcionarios")
        .select("*")
        .in("id_usuario", userIds)
        .eq("mes_referencia", mes)
        .eq("ano_referencia", ano);

      if (pe) throw pe;

      const pagMap: Record<string, PagamentoSalario | null> = {};
      const formMap: Record<string, FormState> = {};

      (pags ?? []).forEach((p: any) => {
        const existing = pagMap[p.id_usuario];
        if (!existing || (p.atualizado_em ?? "") > (existing.atualizado_em ?? "")) {
          pagMap[p.id_usuario] = p as PagamentoSalario;
        }
      });

      userList.forEach((u) => {
        const p = pagMap[u.id] ?? null;
        const holerite = holeriteMap[u.id] ?? null;
        const salVigente = salariosMap[u.id];

        if (p) {
          const descontos = parseJsonArray(p.descontos_detalhes);
          const beneficiosDetalhados = parseJsonArray(p.beneficios_detalhes);
          const descontoPorTipo = (tipo: string) => String(descontos.find((d) => d.tipo === tipo)?.valor ?? "");
          const beneficioPorTipo = (tipo: string) => String(beneficiosDetalhados.find((d) => d.tipo === tipo)?.valor ?? "");
          const bruto = p.salario_bruto ?? p.salario_holerite ?? salVigente?.salario_bruto ?? "";
          const liquido = p.salario_liquido ?? p.valor_total ?? (num(bruto) - descontos.reduce((sum, d) => sum + num(d.valor), 0));
          const has13 = Boolean(p.decimo_terceiro_parcela1 || p.decimo_terceiro_parcela2);
          const hasFerias = Boolean(p.ferias);

          formMap[u.id] = {
            base_salary_holerite: String(bruto),
            salario_bruto: String(bruto),
            salario_liquido: String(liquido),
            desconto_inss: descontoPorTipo("INSS"),
            desconto_irrf: descontoPorTipo("IRRF"),
            desconto_outros: descontoPorTipo("Outros descontos"),
            benefit: p.beneficios ?? (salVigente?.beneficios ?? ""),
            benefit_card: beneficioPorTipo("Cartão alimentação") || (p.beneficios && !Number.isNaN(Number(p.beneficios)) ? p.beneficios : ""),
            benefit_other: beneficioPorTipo("Outros benefícios"),
            horas_voo: p.horas_voadas ?? "",
            valor_horas_voo: p.valor_horas_voo != null ? String(p.valor_horas_voo) : "",
            extra: p.bonificacao_extra != null ? String(p.bonificacao_extra) : String(p.adicionais ?? ""),
            decimo_terceiro_parcela1: p.decimo_terceiro_parcela1 != null ? moneyInput(p.decimo_terceiro_parcela1) : "",
            decimo_terceiro_parcela2: p.decimo_terceiro_parcela2 != null ? moneyInput(p.decimo_terceiro_parcela2) : "",
            decimo_terceiro_referencia: p.decimo_terceiro_referencia ?? "",
            ferias: p.ferias != null ? moneyInput(p.ferias) : "",
            ferias_referencia: p.ferias_referencia ?? "",
            ferias_modalidade: p.ferias_modalidade === "gozo_parcial" ? "ferias_coletivas" : (p.ferias_modalidade ?? ""),
            ferias_dias_comprados: p.ferias_dias_comprados != null ? String(p.ferias_dias_comprados) : "",
            ferias_inicio: p.ferias_inicio ?? "",
            ferias_fim: p.ferias_fim ?? "",
            ferias_dias: p.ferias_dias != null ? String(p.ferias_dias) : "",
            ferias_valor_holerite: p.ferias_valor_holerite != null ? String(p.ferias_valor_holerite) : "",
            banco: p.banco_pagamento ?? "",
            data_pagamento: p.data_pagamento ?? "",
            obs: p.observacoes ?? "",
            holerite_url: p.url_holerite ?? "",
            comprovante_url: p.url_comprovante ?? "",
            show13: has13,
            showFerias: hasFerias,
          };
        } else if (holerite) {
          const bruto = holerite.salario_bruto ?? salVigente?.salario_bruto ?? "";
          const liquido = holerite.salario_liquido ?? salVigente?.salario_liquido ?? "";
          const totalDescontos = holerite.total_descontos ?? "";
          formMap[u.id] = {
            ...emptyForm,
            base_salary_holerite: String(bruto),
            salario_bruto: String(bruto),
            salario_liquido: String(liquido),
            desconto_inss: holerite.desconto_inss != null ? String(holerite.desconto_inss) : "",
            desconto_irrf: holerite.desconto_irrf != null ? String(holerite.desconto_irrf) : "",
            desconto_outros: holerite.outros_descontos != null ? String(holerite.outros_descontos) : (totalDescontos ? String(totalDescontos) : ""),
            ferias: holerite.valor_ferias != null ? moneyInput(holerite.valor_ferias) : "",
            holerite_url: getPayslipPublicUrl(holerite.file_path),
            benefit: salVigente?.beneficios ?? "",
          };
        } else {
          formMap[u.id] = {
            ...emptyForm,
            base_salary_holerite: salVigente?.salario_bruto ? String(salVigente.salario_bruto) : "",
            salario_bruto: salVigente?.salario_bruto ? String(salVigente.salario_bruto) : "",
            salario_liquido: salVigente?.salario_liquido ? String(salVigente.salario_liquido) : "",
            benefit: salVigente?.beneficios ?? "",
          };
        }
      });

      setPagamentos(pagMap);
      setForms(formMap);
      setLoaded(true);
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao carregar folha." });
    } finally {
      setLoading(false);
    }
  }, [mes, ano]);

  const taxaParaAeronave = useCallback(
    (aeronaveId: string) => {
      const doMes = taxasHora.find((t) => {
        if (t.aeronave_id !== aeronaveId) return false;
        const { month, year } = getMonthYearFromDate(t.data_vigencia);
        return month === mes && year === ano;
      });
      if (doMes) return doMes.taxa_hora;

      const selectedDate = new Date(ano, mes - 1);
      const anterior = taxasHora.find((t) => {
        if (t.aeronave_id !== aeronaveId) return false;
        const { month, year } = getMonthYearFromDate(t.data_vigencia);
        const rateDate = new Date(year, month - 1);
        return rateDate <= selectedDate;
      });
      return anterior?.taxa_hora ?? 0;
    },
    [taxasHora, mes, ano]
  );

  const calculadoraHoras = useCallback(
    (userId: string) => {
      const linhas = horasVooPorUsuario[userId] ?? [];
      const detalhado = linhas
        .filter((l) => l.horas > 0)
        .map((l) => {
          const taxa = taxaParaAeronave(l.aeronave_id);
          const aeronave = aeronaves.find((a) => a.id === l.aeronave_id);
          return {
            aeronaveId: l.aeronave_id,
            matricula: aeronave?.matricula || "—",
            modelo: aeronave?.modelo || "",
            horas: l.horas,
            taxa,
            valor: l.horas * taxa,
          };
        });
      const total = detalhado.reduce((acc, d) => acc + d.valor, 0);
      return { detalhado, total };
    },
    [horasVooPorUsuario, aeronaves, taxaParaAeronave]
  );

  const calculoFeriasEsperado = useCallback((userId: string) => {
    const f = forms[userId] ?? emptyForm;
    if (!f.showFerias || !f.ferias_dias) return null;

    const salarioBase = num(f.salario_bruto || f.base_salary_holerite);
    const diasGozo = Number(f.ferias_dias) || 0;
    const diasVendidos = f.ferias_modalidade?.startsWith("compra")
      ? Number(f.ferias_dias_comprados) || 0
      : 0;

    if (salarioBase <= 0 || diasGozo <= 0) return null;
    return calcularValorFerias({ salarioBase, diasGozo, diasVendidos });
  }, [forms]);

  const resumoFolha = useCallback((userId: string) => {
    const f = forms[userId] ?? emptyForm;
    const crew = isCrewDepartamento(funcionarios.find((employee) => employee.id === userId)?.departamento);
    const bruto = num(f.salario_bruto || f.base_salary_holerite);
    const descontos = [
      { tipo: "INSS", valor: num(f.desconto_inss) },
      { tipo: "IRRF", valor: num(f.desconto_irrf) },
      { tipo: "Outros descontos", valor: num(f.desconto_outros) },
    ].filter((item) => item.valor > 0);
    const totalDescontos = descontos.reduce((sum, item) => sum + item.valor, 0);
    const liquido = f.salario_liquido.trim() ? num(f.salario_liquido) : Math.max(0, bruto - totalDescontos);
    const beneficios = [
      { tipo: "Cartão alimentação", valor: num(f.benefit_card) },
      { tipo: "Outros benefícios", valor: num(f.benefit_other) },
    ].filter((item) => item.valor > 0);
    const totalBeneficios = beneficios.reduce((sum, item) => sum + item.valor, 0);
    const valorHorasVoo = crew ? num(f.valor_horas_voo) : 0;
    const bonificacaoExtra = num(f.extra);
    const adicionais = bonificacaoExtra + (f.show13 ? num(f.decimo_terceiro_parcela1) + num(f.decimo_terceiro_parcela2) : 0) + (f.showFerias ? num(f.ferias) : 0);
    const custoTotal = liquido + totalBeneficios + valorHorasVoo + adicionais;
    return { bruto, descontos, totalDescontos, liquido, beneficios, totalBeneficios, valorHorasVoo, bonificacaoExtra, adicionais, custoTotal };
  }, [forms, funcionarios]);

  const saveRow = async (userId: string) => {
    const f = forms[userId];
    if (!f) return;
    setSavingId(userId);
    setToast(null);
    try {
      const user = funcionarios.find((u) => u.id === userId);
      const crew = isCrewDepartamento(user?.departamento);

      const horasVoadasTexto = crew
        ? (() => {
            const { detalhado } = calculadoraHoras(userId);
            if (detalhado.length === 0) return null;
            return detalhado.map((d) => `${d.matricula}: ${d.horas.toFixed(1)}h`).join("; ");
          })()
        : f.horas_voo.trim() || null;

      const resumo = resumoFolha(userId);
      const valorHorasVoo = crew ? resumo.valorHorasVoo : 0;
      if (resumo.bruto <= 0) throw new Error("Informe o salário bruto do holerite.");
      if (resumo.liquido <= 0) throw new Error("Informe o salário líquido ou preencha descontos válidos.");
      if (resumo.liquido > resumo.bruto && resumo.totalDescontos > 0) throw new Error("O líquido não pode ser maior que o bruto quando existem descontos.");

      const payload = {
        id_usuario: userId,
        mes_referencia: mes,
        ano_referencia: ano,
        salario_holerite: resumo.bruto,
        salario_bruto: resumo.bruto,
        salario_liquido: resumo.liquido,
        descontos_detalhes: resumo.descontos,
        beneficios_detalhes: resumo.beneficios,
        custo_total_empresa: resumo.custoTotal,
        beneficios: resumo.beneficios.length > 0 ? resumo.beneficios.map((item) => `${item.tipo}: ${formatBRL(item.valor)}`).join("; ") : f.benefit.trim() || null,
        horas_voadas: horasVoadasTexto,
        valor_horas_voo: valorHorasVoo || null,
        bonificacao_extra: num(f.extra) || null,
        adicionais: f.extra.trim() || null,
        decimo_terceiro_parcela1: f.show13 && f.decimo_terceiro_parcela1 ? num(f.decimo_terceiro_parcela1) : null,
        decimo_terceiro_parcela2: f.show13 && f.decimo_terceiro_parcela2 ? num(f.decimo_terceiro_parcela2) : null,
        decimo_terceiro_referencia: f.show13 ? f.decimo_terceiro_referencia.trim() || null : null,
        ferias: f.showFerias && f.ferias ? num(f.ferias) : null,
        ferias_referencia: f.showFerias ? f.ferias_referencia.trim() || null : null,
        ferias_modalidade: f.showFerias ? f.ferias_modalidade || null : null,
        ferias_dias_comprados: f.showFerias && f.ferias_dias_comprados ? Number(f.ferias_dias_comprados) : null,
        ferias_inicio: f.showFerias ? f.ferias_inicio || null : null,
        ferias_fim: f.showFerias ? f.ferias_fim || null : null,
        ferias_dias: f.showFerias && f.ferias_dias ? Number(f.ferias_dias) : null,
        ferias_valor_holerite: f.showFerias && f.ferias_valor_holerite ? num(f.ferias_valor_holerite) : null,
        banco_pagamento: f.banco || null,
        data_pagamento: f.data_pagamento || null,
        observacoes: f.obs.trim() || null,
        url_holerite: f.holerite_url.trim() || null,
        url_comprovante: f.comprovante_url.trim() || null,
      };

      const existing = pagamentos[userId];
      let paymentId = existing?.id;
      if (existing?.id) {
        const { error } = await (supabase as any)
          .from("historico_pagamentos_funcionarios")
          .update({ ...payload, atualizado_em: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("historico_pagamentos_funcionarios")
          .insert({ ...payload, criado_em: new Date().toISOString() })
          .select("*")
          .single();
        if (error) throw error;
        paymentId = data.id;
        setPagamentos((prev) => ({ ...prev, [userId]: data as PagamentoSalario }));
      }

      const syncResult = await syncSalaryPaymentToFinancial(
        paymentId!,
        userId,
        user?.full_name || "Colaborador",
        userId,
        {
          salary_net: resumo.liquido,
          horas_voo: valorHorasVoo,
          benefit_card: num(f.benefit_card),
          benefit_other: num(f.benefit_other),
          extra: num(f.extra),
          ferias: f.showFerias ? num(f.ferias) : 0,
          decimo_terceiro_parcela1: f.show13 ? num(f.decimo_terceiro_parcela1) : 0,
          decimo_terceiro_parcela2: f.show13 ? num(f.decimo_terceiro_parcela2) : 0,
          comprovante_url: f.comprovante_url || null,
          obs: `${f.obs.trim()}${f.obs.trim() ? " · " : ""}Bruto: ${formatBRL(resumo.bruto)} · Descontos: ${formatBRL(resumo.totalDescontos)}`,
          banco: f.banco || null,
          data_pagamento: f.data_pagamento || null,
        },
      );
      if (!syncResult.success) throw new Error(syncResult.error || "Pagamento salvo, mas não foi sincronizado no Financeiro Share.");

      // Mantém o período de férias consistente com o pagamento da folha.
      // Se o período veio de uma solicitação aprovada, atualiza o mesmo registro;
      // se ainda não existir, cria o vínculo para não perder o histórico.
      if (f.showFerias && num(f.ferias) > 0) {
        const vacationYear = f.ferias_inicio
          ? new Date(`${f.ferias_inicio}T00:00:00`).getFullYear()
          : ano;
        const { data: vacationConfig, error: vacationLookupError } = await (supabase as any)
          .from("employee_vacation_config")
          .select("id, scheduled_date, total_vacation_days")
          .eq("user_profile", userId)
          .eq("year", vacationYear)
          .maybeSingle();
        if (vacationLookupError) throw vacationLookupError;

        const vacationPayload = {
          user_profile: userId,
          year: vacationYear,
          scheduled_date: f.ferias_inicio || vacationConfig?.scheduled_date || null,
          total_vacation_days: Number(f.ferias_dias) || vacationConfig?.total_vacation_days || 0,
          payment_status: "pago",
        };
        const vacationResult = vacationConfig?.id
          ? await (supabase as any).from("employee_vacation_config").update(vacationPayload).eq("id", vacationConfig.id)
          : await (supabase as any).from("employee_vacation_config").insert(vacationPayload);
        if (vacationResult.error) throw vacationResult.error;
      }

      queryClient.invalidateQueries({ queryKey: ["vacation-history", userId] });
      queryClient.invalidateQueries({ queryKey: ["vacation-requests-management"] });
      setToast({ type: "ok", text: `Pagamento salvo. Líquido: ${formatBRL(resumo.liquido)} · Custo total: ${formatBRL(resumo.custoTotal)}.` });
      setEditingId(null);
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao salvar pagamento." });
    } finally {
      setSavingId(null);
    }
  };

  const totalFuncionario = (userId: string) => resumoFolha(userId).custoTotal;

  const inputCls =
    "border border-border bg-background/70 text-foreground placeholder:text-muted-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400 w-full";
  const labelCls = "block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1";

  const anos = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Salários</h2>
          <p className="text-xs text-muted-foreground">Gestão da folha de pagamento dos colaboradores.</p>
        </div>
      </div>

      {/* Seletor de Período */}
      <div
        className="rounded-2xl p-4 flex flex-wrap items-end gap-3"
        style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}
      >
        <div>
          <label className={labelCls}>Mês</label>
          <select
            className={inputCls + " cursor-pointer"}
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
          >
            {MESES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Ano</label>
          <select
            className={inputCls + " cursor-pointer"}
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
          >
            {anos.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={carregar}
          disabled={loading}
          className="text-slate-950 rounded-lg px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
          style={{ background: "#06b6d4" }}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Carregar
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="rounded-lg px-4 py-2 text-sm border"
          style={{
            background: toast.type === "ok" ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
            color: toast.type === "ok" ? "#4ade80" : "#f87171",
            borderColor: toast.type === "ok" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
          }}
        >
          {toast.text}
        </div>
      )}

      {/* Lista */}
      {!loaded ? (
        <div
          className="rounded-2xl p-10 text-center text-sm text-muted-foreground"
          style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}
        >
          Selecione um período e clique em "Carregar".
        </div>
      ) : loading ? (
        <div className="text-sm text-muted-foreground py-10 text-center">Carregando...</div>
      ) : funcionarios.length === 0 ? (
        <div
          className="rounded-2xl p-10 text-center text-sm text-muted-foreground"
          style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}
        >
          Nenhum colaborador ativo encontrado.
        </div>
      ) : (
        <div className="space-y-2">
          {funcionarios.map((u) => {
            const expanded = expandedId === u.id;
            const pago = !!pagamentos[u.id];
            const f = forms[u.id] ?? emptyForm;
            const crew = isCrewDepartamento(u.departamento);
            const isReadonly = pago && editingId !== u.id;
            const { detalhado: horasDetalhado, total: horasTotal } = crew
              ? calculadoraHoras(u.id)
              : { detalhado: [], total: 0 };

            return (
              <div
                key={u.id}
                className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}
              >
                {/* Cabeçalho da Linha */}
                <button
                  onClick={() => {
                    const nextExpandedId = expanded ? null : u.id;
                    setExpandedId(nextExpandedId);
                    if (nextExpandedId !== u.id) setEditingId(null);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-card-secondary/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {u.full_name || "Sem nome"}
                        </span>
                        {u.departamento && (
                          <span className="text-[10px] bg-card-secondary text-cyan-300 border border-border px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <Building2 className="h-2.5 w-2.5" />
                            {u.departamento}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{u.email || "—"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-bold text-cyan-300">
                      {formatBRL(totalFuncionario(u.id))}
                    </span>
                    {pago && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border"
                        style={{
                          background: "rgba(34,197,94,0.10)",
                          color: "#4ade80",
                          borderColor: "rgba(34,197,94,0.25)",
                        }}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Pago
                      </span>
                    )}
                  </div>
                </button>

                {/* Form Expandido */}
                {expanded && (
                  <div className="px-4 pb-4 pt-3 border-t border-border space-y-4">
                    <fieldset disabled={isReadonly} className="contents">
                    {/* Bloco de Dados Bancários do Colaborador */}
                    <div className="p-3 bg-card/60 rounded-xl border border-border text-xs flex flex-wrap items-center justify-between gap-3 text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-cyan-400" />
                        <span className="font-semibold text-foreground">Dados Bancários Cadastrados:</span>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <span><strong>Banco:</strong> {u.bank_name || "—"}</span>
                        <span><strong>Agência:</strong> {u.bank_agency || "—"}</span>
                        <span><strong>Conta:</strong> {u.bank_account || "—"}</span>
                        <span><strong>PIX:</strong> {u.bank_pix || "—"}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className={labelCls}>Salário bruto do holerite</label>
                        <input
                          type="text" inputMode="decimal"
                          step="0.01"
                          className={inputCls}
                          placeholder="Ex.: 1.621,00"
                          value={f.salario_bruto}
                          onChange={(e) => {
                            const value = moneyInput(e.target.value);
                            setForms((prev) => ({ ...prev, [u.id]: { ...f, salario_bruto: value, base_salary_holerite: value } }));
                          }}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Desconto INSS</label>
                        <input
                          type="text" inputMode="decimal"
                          step="0.01"
                          className={inputCls}
                          placeholder="Ex.: 121,57"
                          value={f.desconto_inss}
                          onChange={(e) => setMoneyField(u.id, "desconto_inss", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Desconto IRRF</label>
                        <input
                          type="text" inputMode="decimal"
                          step="0.01"
                          className={inputCls}
                          value={f.desconto_irrf}
                          onChange={(e) => setMoneyField(u.id, "desconto_irrf", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Outros descontos</label>
                        <input
                          type="text" inputMode="decimal"
                          step="0.01"
                          className={inputCls}
                          value={f.desconto_outros}
                          onChange={(e) => setMoneyField(u.id, "desconto_outros", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Salário líquido a pagar</label>
                        <input
                          type="text" inputMode="decimal"
                          step="0.01"
                          className={inputCls + " border-emerald-500/50"}
                          placeholder="Calculado pelo bruto − descontos"
                          value={f.salario_liquido}
                          onChange={(e) => setMoneyField(u.id, "salario_liquido", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Cartão alimentação</label>
                        <input
                          type="text" inputMode="decimal"
                          step="0.01"
                          className={inputCls}
                          placeholder="Ex.: 300,00"
                          value={f.benefit_card}
                          onChange={(e) => setMoneyField(u.id, "benefit_card", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Outros benefícios</label>
                        <input
                          type="text" inputMode="decimal"
                          step="0.01"
                          className={inputCls}
                          value={f.benefit_other}
                          onChange={(e) => setMoneyField(u.id, "benefit_other", e.target.value)}
                        />
                      </div>
                      {crew && (
                        <div>
                          <label className={labelCls}>Valor horas de voo</label>
                          <input
                            type="text" inputMode="decimal"
                            className={inputCls + " border-cyan-500/40"}
                            placeholder="Ex.: 1.250,00"
                            value={f.valor_horas_voo}
                            onChange={(e) => setMoneyField(u.id, "valor_horas_voo", e.target.value)}
                          />
                        </div>
                      )}
                      <div>
                        <label className={labelCls}>Bonificação/Extra</label>
                        <input
                          type="text" inputMode="decimal"
                          step="0.01"
                          className={inputCls}
                          value={f.extra}
                          onChange={(e) => setMoneyField(u.id, "extra", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Conta Origem Pagamento</label>
                        <select
                          className={inputCls + " cursor-pointer"}
                          value={f.banco}
                          onChange={(e) =>
                            setForms((prev) => ({ ...prev, [u.id]: { ...f, banco: e.target.value } }))
                          }
                        >
                          <option value="">Selecione</option>
                          {contas.map((c) => (
                            <option key={c.id} value={c.banco || c.id}>
                              {c.banco} {c.numero_conta ? `· ${c.numero_conta}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Data de Pagamento</label>
                        <input
                          type="date"
                          className={inputCls}
                          value={f.data_pagamento}
                          onChange={(e) =>
                            setForms((prev) => ({ ...prev, [u.id]: { ...f, data_pagamento: e.target.value } }))
                          }
                        />
                      </div>
                    </div>

                    {(() => {
                      const resumo = resumoFolha(u.id);
                      return (
                        <div className={`grid grid-cols-2 ${crew ? "md:grid-cols-6" : "md:grid-cols-5"} gap-2 rounded-xl border border-border bg-card/40 p-3`}>
                          <div><span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Bruto</span><strong className="text-sm text-foreground">{formatBRL(resumo.bruto)}</strong></div>
                          <div><span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Descontos</span><strong className="text-sm text-rose-300">− {formatBRL(resumo.totalDescontos)}</strong></div>
                          <div><span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Líquido</span><strong className="text-sm text-emerald-300">{formatBRL(resumo.liquido)}</strong></div>
                          <div><span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Benefícios</span><strong className="text-sm text-amber-300">+ {formatBRL(resumo.totalBeneficios)}</strong></div>
                          {crew && <div><span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Horas de voo</span><strong className="text-sm text-cyan-300">+ {formatBRL(resumo.valorHorasVoo)}</strong></div>}
                          <div><span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Custo empresa</span><strong className="text-sm text-cyan-300">{formatBRL(resumo.custoTotal)}</strong></div>
                        </div>
                      );
                    })()}

                    {/* Calculadora de Horas de Voo — apenas Tripulante / Piloto Chefe */}
                    {crew && (
                      <div className="p-3 bg-card/40 rounded-xl border border-border space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Cálculo de Horas de Voo — {MESES.find((m) => m.value === mes)?.label}/{ano}
                          </span>
                          <button
                            type="button"
                            disabled={horasTotal === 0}
                            onClick={() =>
                              setForms((prev) => ({
                                ...prev,
                                [u.id]: { ...f, valor_horas_voo: horasTotal.toFixed(2) },
                              }))
                            }
                            className="text-[11px] bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 px-2 py-1 rounded-lg border border-cyan-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Usar {formatBRL(horasTotal)} como Valor horas de voo
                          </button>
                        </div>

                        {horasDetalhado.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Nenhuma hora de voo lançada para este colaborador no período selecionado.
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {horasDetalhado.map((d) => (
                              <div
                                key={d.aeronaveId}
                                className="flex items-center justify-between text-xs text-muted-foreground gap-2"
                              >
                                <span className="truncate">
                                  {d.matricula}
                                  {d.modelo ? " - " + d.modelo : ""}
                                </span>
                                <span className="text-muted-foreground whitespace-nowrap">
                                  {d.horas.toFixed(1)}h x {formatBRL(d.taxa)}
                                </span>
                                <span className="text-cyan-300 font-semibold whitespace-nowrap">
                                  {formatBRL(d.valor)}
                                </span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between text-xs pt-1.5 mt-1 border-t border-border">
                              <span className="font-semibold text-foreground">Valor horas de voo</span>
                              <span className="text-cyan-300 font-bold">{formatBRL(horasTotal)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Botões para Habilitar 13º e Férias */}
                    <div className="flex items-center gap-2 pt-1">
                      {!f.show13 ? (
                        <button
                          type="button"
                          onClick={() => setForms((prev) => ({ ...prev, [u.id]: { ...f, show13: true } }))}
                          className="text-xs bg-card-secondary hover:bg-secondary text-cyan-300 px-3 py-1.5 rounded-lg border border-border flex items-center gap-1.5 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" /> Adicionar 13º Salário
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setForms((prev) => ({
                              ...prev,
                              [u.id]: { ...f, show13: false, decimo_terceiro_parcela1: "", decimo_terceiro_parcela2: "", decimo_terceiro_referencia: "" },
                            }))
                          }
                          className="text-xs bg-red-950/40 hover:bg-red-900/60 text-red-300 px-3 py-1.5 rounded-lg border border-red-800/50 flex items-center gap-1.5 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remover 13º
                        </button>
                      )}

                      {!f.showFerias ? (
                        <button
                          type="button"
                          onClick={() => setForms((prev) => ({ ...prev, [u.id]: { ...f, showFerias: true } }))}
                          className="text-xs bg-card-secondary hover:bg-secondary text-cyan-300 px-3 py-1.5 rounded-lg border border-border flex items-center gap-1.5 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" /> Adicionar Férias
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setForms((prev) => ({
                              ...prev,
                              [u.id]: { ...f, showFerias: false, ferias: "", ferias_referencia: "", ferias_modalidade: "", ferias_dias_comprados: "" },
                            }))
                          }
                          className="text-xs bg-red-950/40 hover:bg-red-900/60 text-red-300 px-3 py-1.5 rounded-lg border border-red-800/50 flex items-center gap-1.5 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remover Férias
                        </button>
                      )}
                    </div>

                    {/* Campos Condicionais de 13º e Férias */}
                    {(f.show13 || f.showFerias) && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-card/30 rounded-xl border border-border">
                        {f.show13 && (
                          <>
                            <div>
                              <label className={labelCls}>Referência do 13º</label>
                              <input
                                type="text"
                                className={inputCls}
                                placeholder="Ex.: ano-base 2026"
                                value={f.decimo_terceiro_referencia}
                                onChange={(e) => setForms((prev) => ({ ...prev, [u.id]: { ...f, decimo_terceiro_referencia: e.target.value } }))}
                              />
                            </div>
                            <div>
                              <label className={labelCls}>13º Parcela 1</label>
                              <input
                                type="text" inputMode="decimal"
                                className={inputCls}
                                placeholder="R$ 0,00"
                                value={f.decimo_terceiro_parcela1}
                                onChange={(e) => setMoneyField(u.id, "decimo_terceiro_parcela1", e.target.value)}
                              />
                            </div>
                            <div>
                              <label className={labelCls}>13º Parcela 2</label>
                              <input
                                type="text" inputMode="decimal"
                                className={inputCls}
                                placeholder="R$ 0,00"
                                value={f.decimo_terceiro_parcela2}
                                onChange={(e) => setMoneyField(u.id, "decimo_terceiro_parcela2", e.target.value)}
                              />
                            </div>
                          </>
                        )}
                        {f.showFerias && (
                          <div className="col-span-full space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className={labelCls}>Modalidade das férias</label>
                                <select
                                  className={inputCls + " cursor-pointer"}
                                  value={f.ferias_modalidade}
                                  onChange={(e) => setForms((prev) => ({ ...prev, [u.id]: { ...f, ferias_modalidade: e.target.value, ferias_dias_comprados: e.target.value === "compra_10_dias" ? (f.ferias_dias_comprados || "10") : f.ferias_dias_comprados } }))}
                                >
                                  <option value="">Selecione</option>
                                  <option value="gozo_integral">Gozo integral</option>
                                  <option value="ferias_coletivas">Férias coletivas</option>
                                  <option value="compra_10_dias">Compra de 10 dias (abono pecuniário)</option>
                                  <option value="compra_outros_dias">Compra de outros dias</option>
                                </select>
                              </div>
                              <div>
                                <label className={labelCls}>Início das férias</label>
                                <input
                                  type="date"
                                  className={inputCls}
                                  value={f.ferias_inicio}
                                  onChange={(e) => {
                                    const inicio = e.target.value;
                                    const dias = calculateVacationDays(inicio, f.ferias_fim);
                                    setForms((prev) => ({
                                      ...prev,
                                      [u.id]: {
                                        ...f,
                                        ferias_inicio: inicio,
                                        ferias_dias: dias > 0 ? String(dias) : "",
                                        ferias_referencia: formatDateRangeBR(inicio, f.ferias_fim),
                                      },
                                    }));
                                  }}
                                />
                              </div>
                              <div>
                                <label className={labelCls}>Fim das férias</label>
                                <input
                                  type="date"
                                  className={inputCls}
                                  value={f.ferias_fim}
                                  onChange={(e) => {
                                    const fim = e.target.value;
                                    const dias = calculateVacationDays(f.ferias_inicio, fim);
                                    setForms((prev) => ({
                                      ...prev,
                                      [u.id]: {
                                        ...f,
                                        ferias_fim: fim,
                                        ferias_dias: dias > 0 ? String(dias) : "",
                                        ferias_referencia: formatDateRangeBR(f.ferias_inicio, fim),
                                      },
                                    }));
                                  }}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className={labelCls}>Referência (automática)</label>
                                <input
                                  type="text"
                                  className={inputCls + " bg-card/20"}
                                  readOnly
                                  placeholder="Ex.: 22/12/2025 a 05/01/2026"
                                  value={f.ferias_referencia}
                                />
                              </div>
                              <div>
                                <label className={labelCls}>Dias corridos</label>
                                <input
                                  type="text"
                                  className={inputCls + " bg-card/20"}
                                  readOnly
                                  placeholder="Calculado"
                                  value={f.ferias_dias ? `${f.ferias_dias} dias` : ""}
                                />
                              </div>
                              <div>
                                <label className={labelCls}>Dias comprados</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  className={inputCls}
                                  placeholder="Ex.: 10"
                                  value={f.ferias_dias_comprados}
                                  onChange={(e) => setForms((prev) => ({ ...prev, [u.id]: { ...f, ferias_dias_comprados: e.target.value.replace(/\D/g, "").slice(0, 2) } }))}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className={labelCls}>Valor das férias (pagamento)</label>
                                <input
                                  type="text" inputMode="decimal"
                                  className={inputCls}
                                  placeholder="R$ 0,00"
                                  value={f.ferias}
                                  onChange={(e) => setMoneyField(u.id, "ferias", e.target.value)}
                                />
                              </div>
                              {(() => {
                                const calculo = calculoFeriasEsperado(u.id);
                                if (!calculo) return null;
                                const valorInformado = num(f.ferias);
                                const diferenca = Math.abs(valorInformado - calculo.liquido);
                                return (
                                  <div className="col-span-full rounded-xl border border-border bg-card/40 p-3 text-xs space-y-2">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      <span className="font-semibold text-foreground">Valor esperado — cálculo CLT</span>
                                      <button
                                        type="button"
                                        onClick={() => setMoneyField(u.id, "ferias", calculo.liquido.toFixed(2).replace(".", ","))}
                                        className="rounded-lg border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-secondary/80"
                                      >
                                        Usar {formatBRL(calculo.liquido)}
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-muted-foreground">
                                      <div>Diária: {formatBRL(calculo.diaria)}</div>
                                      <div>Dias de gozo: {formatBRL(calculo.valorDiasGozo)}</div>
                                      <div>1/3 constitucional: {formatBRL(calculo.tercoGozo)}</div>
                                      {calculo.valorAbono > 0 && (
                                        <div>Abono + 1/3: {formatBRL(calculo.valorAbono + calculo.tercoAbono)}</div>
                                      )}
                                      <div>INSS: − {formatBRL(calculo.descontoInss)}</div>
                                    </div>
                                    <div className={diferenca < 0.5 ? "text-emerald-400" : "text-amber-400"}>
                                      Líquido esperado: <strong>{formatBRL(calculo.liquido)}</strong>
                                      {diferenca >= 0.5 && valorInformado > 0 && ` · diferença de ${formatBRL(diferenca)} em relação ao valor informado`}
                                    </div>
                                  </div>
                                );
                              })()}
                              {f.ferias_valor_holerite && (
                                <div className="flex flex-col justify-end pb-1">
                                  <div className={`p-2 rounded-lg border text-xs flex items-center gap-2 ${
                                    Math.abs(num(f.ferias) - num(f.ferias_valor_holerite)) < 0.01
                                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                                      : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                                  }`}>
                                    {Math.abs(num(f.ferias) - num(f.ferias_valor_holerite)) < 0.01 ? (
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    ) : (
                                      <FileText className="h-3.5 w-3.5" />
                                    )}
                                    <span>
                                      Valor no holerite: <strong>{formatBRL(num(f.ferias_valor_holerite))}</strong>
                                      {Math.abs(num(f.ferias) - num(f.ferias_valor_holerite)) >= 0.01 && " (confira a diferença)"}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Upload de Arquivos (Holerite / Comprovante) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Holerite Upload */}
                      <div>
                        <label className={labelCls}>Holerite (Imagem/PDF)</label>
                        {f.holerite_url ? (
                          <div className="flex items-center justify-between p-2 bg-background/80 border border-border rounded-lg text-xs">
                            <a
                              href={f.holerite_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-400 hover:underline flex items-center gap-1.5 truncate"
                            >
                              <FileText className="h-4 w-4" /> Ver Holerite
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() =>
                                setForms((prev) => ({ ...prev, [u.id]: { ...f, holerite_url: "" } }))
                              }
                              className="text-red-400 hover:text-red-300 p-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex items-center justify-center gap-2 p-2 border border-dashed border-border hover:border-cyan-400/50 bg-background/40 rounded-lg cursor-pointer text-xs text-muted-foreground transition-colors">
                            {readingHolerite === u.id || (uploadingField?.userId === u.id && uploadingField?.field === "holerite") ? (
                              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                            ) : (
                              <Upload className="h-4 w-4 text-cyan-400" />
                            )}
                            <span>{readingHolerite === u.id ? "Lendo campos do holerite..." : "Anexar holerite e ler campos"}</span>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              disabled={uploadingField !== null || readingHolerite !== null}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(u.id, "holerite", file);
                              }}
                            />
                          </label>
                        )}
                      </div>

                      {/* Comprovante Upload */}
                      <div>
                        <label className={labelCls}>Comprovante (Imagem/PDF)</label>
                        {f.comprovante_url ? (
                          <div className="flex items-center justify-between p-2 bg-background/80 border border-border rounded-lg text-xs">
                            <a
                              href={f.comprovante_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-400 hover:underline flex items-center gap-1.5 truncate"
                            >
                              <FileText className="h-4 w-4" /> Ver Comprovante
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() =>
                                setForms((prev) => ({ ...prev, [u.id]: { ...f, comprovante_url: "" } }))
                              }
                              className="text-red-400 hover:text-red-300 p-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex items-center justify-center gap-2 p-2 border border-dashed border-border hover:border-cyan-400/50 bg-background/40 rounded-lg cursor-pointer text-xs text-muted-foreground transition-colors">
                            {uploadingField?.userId === u.id && uploadingField?.field === "comprovante" ? (
                              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                            ) : (
                              <Upload className="h-4 w-4 text-cyan-400" />
                            )}
                            <span>Anexar Comprovante</span>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              disabled={uploadingField !== null}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(u.id, "comprovante", file);
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-3">
                      <label className={labelCls}>Observações</label>
                      <textarea
                        className={inputCls}
                        rows={2}
                        value={f.obs}
                        onChange={(e) =>
                          setForms((prev) => ({ ...prev, [u.id]: { ...f, obs: e.target.value } }))
                        }
                      />
                    </div>

                    </fieldset>

                    <div className="flex items-center justify-between pt-2">
                      <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Total Final: <span className="text-cyan-300 font-bold ml-1">{formatBRL(totalFuncionario(u.id))}</span>
                      </div>
                      {isReadonly ? (
                        <button
                          type="button"
                          onClick={() => setEditingId(u.id)}
                          className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 inline-flex items-center gap-2 hover:bg-cyan-400/20 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                          Editar pagamento
                        </button>
                      ) : (
                        <button
                          onClick={() => saveRow(u.id)}
                          disabled={savingId === u.id || uploadingField !== null}
                          className="text-slate-950 rounded-lg px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
                          style={{ background: "#06b6d4" }}
                        >
                          <Save className="h-4 w-4" />
                          {savingId === u.id ? "Salvando..." : pago ? "Salvar alterações" : "Salvar"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
