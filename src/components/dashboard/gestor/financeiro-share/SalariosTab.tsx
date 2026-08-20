import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  Save,
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
  descontos_detalhes?: unknown;
  beneficios_detalhes?: unknown;
  custo_total_empresa?: number | string | null;
  valor_total?: number | string | null;
  beneficios: string | null;
  horas_voadas: string | null;
  decimo_terceiro_parcela1: number | string | null;
  decimo_terceiro_parcela2: number | string | null;
  ferias: number | string | null;
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
  extra: string;
  decimo_terceiro_parcela1: string;
  decimo_terceiro_parcela2: string;
  ferias: string;
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
  extra: "",
  decimo_terceiro_parcela1: "",
  decimo_terceiro_parcela2: "",
  ferias: "",
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

const num = (v: string | number | null | undefined) => Number(v) || 0;

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

const getMonthYearFromDate = (dateString: string): { month: number; year: number } => {
  const date = new Date(dateString);
  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
};

/* ─────────────────────────── main ─────────────────────────── */

export default function SalariosTab() {
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
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<{ userId: string; field: "holerite" | "comprovante" } | null>(null);

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
      const publicUrl = await uploadFileToStorage(file, field);
      setForms((prev) => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          [field === "holerite" ? "holerite_url" : "comprovante_url"]: publicUrl,
        },
      }));
      setToast({ type: "ok", text: `${field === "holerite" ? "Holerite" : "Comprovante"} enviado com sucesso!` });
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao realizar upload." });
    } finally {
      setUploadingField(null);
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

      // 3. Busca histórico de pagamentos salvos
      const { data: pags, error: pe } = await (supabase as any)
        .from("historico_pagamentos_funcionarios")
        .select("*")
        .in("id_usuario", userIds);

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
            extra: p.adicionais ?? "",
            decimo_terceiro_parcela1: p.decimo_terceiro_parcela1 != null ? String(p.decimo_terceiro_parcela1) : "",
            decimo_terceiro_parcela2: p.decimo_terceiro_parcela2 != null ? String(p.decimo_terceiro_parcela2) : "",
            ferias: p.ferias != null ? String(p.ferias) : "",
            banco: p.banco_pagamento ?? "",
            data_pagamento: p.data_pagamento ?? "",
            obs: p.observacoes ?? "",
            holerite_url: p.url_holerite ?? "",
            comprovante_url: p.url_comprovante ?? "",
            show13: has13,
            showFerias: hasFerias,
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

  const resumoFolha = useCallback((userId: string) => {
    const f = forms[userId] ?? emptyForm;
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
    const adicionais = num(f.extra) + (f.show13 ? num(f.decimo_terceiro_parcela1) + num(f.decimo_terceiro_parcela2) : 0) + (f.showFerias ? num(f.ferias) : 0);
    const custoTotal = liquido + totalBeneficios + adicionais;
    return { bruto, descontos, totalDescontos, liquido, beneficios, totalBeneficios, adicionais, custoTotal };
  }, [forms]);

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
      if (resumo.bruto <= 0) throw new Error("Informe o salário bruto do holerite.");
      if (resumo.liquido <= 0) throw new Error("Informe o salário líquido ou preencha descontos válidos.");
      if (resumo.liquido > resumo.bruto && resumo.totalDescontos > 0) throw new Error("O líquido não pode ser maior que o bruto quando existem descontos.");

      const payload = {
        id_usuario: userId,
        salario_holerite: resumo.bruto,
        salario_bruto: resumo.bruto,
        salario_liquido: resumo.liquido,
        descontos_detalhes: resumo.descontos,
        beneficios_detalhes: resumo.beneficios,
        custo_total_empresa: resumo.custoTotal,
        valor_total: resumo.custoTotal,
        beneficios: resumo.beneficios.length > 0 ? resumo.beneficios.map((item) => `${item.tipo}: ${formatBRL(item.valor)}`).join("; ") : f.benefit.trim() || null,
        horas_voadas: horasVoadasTexto,
        adicionais: f.extra.trim() || null,
        decimo_terceiro_parcela1: f.show13 && f.decimo_terceiro_parcela1 ? Number(f.decimo_terceiro_parcela1) : null,
        decimo_terceiro_parcela2: f.show13 && f.decimo_terceiro_parcela2 ? Number(f.decimo_terceiro_parcela2) : null,
        ferias: f.showFerias && f.ferias ? Number(f.ferias) : null,
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
      setToast({ type: "ok", text: `Pagamento salvo. Líquido: ${formatBRL(resumo.liquido)} · Custo total: ${formatBRL(resumo.custoTotal)}.` });
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao salvar pagamento." });
    } finally {
      setSavingId(null);
    }
  };

  const totalFuncionario = (userId: string) => resumoFolha(userId).custoTotal;

  const inputCls =
    "border border-slate-700 bg-slate-950/70 text-slate-100 placeholder:text-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400 w-full";
  const labelCls = "block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1";

  const anos = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Salários</h2>
          <p className="text-xs text-slate-400">Gestão da folha de pagamento dos colaboradores.</p>
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
          className="rounded-2xl p-10 text-center text-sm text-slate-400"
          style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}
        >
          Selecione um período e clique em "Carregar".
        </div>
      ) : loading ? (
        <div className="text-sm text-slate-400 py-10 text-center">Carregando...</div>
      ) : funcionarios.length === 0 ? (
        <div
          className="rounded-2xl p-10 text-center text-sm text-slate-400"
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
                  onClick={() => setExpandedId(expanded ? null : u.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-100 truncate">
                          {u.full_name || "Sem nome"}
                        </span>
                        {u.departamento && (
                          <span className="text-[10px] bg-slate-800 text-cyan-300 border border-slate-700 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <Building2 className="h-2.5 w-2.5" />
                            {u.departamento}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 truncate">{u.email || "—"}</div>
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
                  <div className="px-4 pb-4 pt-3 border-t border-slate-800 space-y-4">
                    {/* Bloco de Dados Bancários do Colaborador */}
                    <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-3 text-slate-300">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-cyan-400" />
                        <span className="font-semibold text-slate-200">Dados Bancários Cadastrados:</span>
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
                          type="number"
                          step="0.01"
                          className={inputCls}
                          placeholder="Ex.: 1.621,00"
                          value={f.salario_bruto}
                          onChange={(e) =>
                            setForms((prev) => ({ ...prev, [u.id]: { ...f, salario_bruto: e.target.value, base_salary_holerite: e.target.value } }))
                          }
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Desconto INSS</label>
                        <input
                          type="number"
                          step="0.01"
                          className={inputCls}
                          placeholder="Ex.: 121,57"
                          value={f.desconto_inss}
                          onChange={(e) => setForms((prev) => ({ ...prev, [u.id]: { ...f, desconto_inss: e.target.value } }))}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Desconto IRRF</label>
                        <input
                          type="number"
                          step="0.01"
                          className={inputCls}
                          value={f.desconto_irrf}
                          onChange={(e) => setForms((prev) => ({ ...prev, [u.id]: { ...f, desconto_irrf: e.target.value } }))}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Outros descontos</label>
                        <input
                          type="number"
                          step="0.01"
                          className={inputCls}
                          value={f.desconto_outros}
                          onChange={(e) => setForms((prev) => ({ ...prev, [u.id]: { ...f, desconto_outros: e.target.value } }))}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Salário líquido a pagar</label>
                        <input
                          type="number"
                          step="0.01"
                          className={inputCls + " border-emerald-500/50"}
                          placeholder="Calculado pelo bruto − descontos"
                          value={f.salario_liquido}
                          onChange={(e) => setForms((prev) => ({ ...prev, [u.id]: { ...f, salario_liquido: e.target.value } }))}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Cartão alimentação</label>
                        <input
                          type="number"
                          step="0.01"
                          className={inputCls}
                          placeholder="Ex.: 300,00"
                          value={f.benefit_card}
                          onChange={(e) => setForms((prev) => ({ ...prev, [u.id]: { ...f, benefit_card: e.target.value } }))}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Outros benefícios</label>
                        <input
                          type="number"
                          step="0.01"
                          className={inputCls}
                          value={f.benefit_other}
                          onChange={(e) => setForms((prev) => ({ ...prev, [u.id]: { ...f, benefit_other: e.target.value } }))}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Adicional</label>
                        <input
                          type="number"
                          step="0.01"
                          className={inputCls}
                          value={f.extra}
                          onChange={(e) => setForms((prev) => ({ ...prev, [u.id]: { ...f, extra: e.target.value } }))}
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
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                          <div><span className="block text-[10px] uppercase tracking-wider text-slate-500">Bruto</span><strong className="text-sm text-slate-200">{formatBRL(resumo.bruto)}</strong></div>
                          <div><span className="block text-[10px] uppercase tracking-wider text-slate-500">Descontos</span><strong className="text-sm text-rose-300">− {formatBRL(resumo.totalDescontos)}</strong></div>
                          <div><span className="block text-[10px] uppercase tracking-wider text-slate-500">Líquido</span><strong className="text-sm text-emerald-300">{formatBRL(resumo.liquido)}</strong></div>
                          <div><span className="block text-[10px] uppercase tracking-wider text-slate-500">Benefícios</span><strong className="text-sm text-amber-300">+ {formatBRL(resumo.totalBeneficios)}</strong></div>
                          <div><span className="block text-[10px] uppercase tracking-wider text-slate-500">Custo empresa</span><strong className="text-sm text-cyan-300">{formatBRL(resumo.custoTotal)}</strong></div>
                        </div>
                      );
                    })()}

                    {/* Calculadora de Horas de Voo — apenas Tripulante / Piloto Chefe */}
                    {crew && (
                      <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Cálculo de Horas de Voo — {MESES.find((m) => m.value === mes)?.label}/{ano}
                          </span>
                          <button
                            type="button"
                            disabled={horasTotal === 0}
                            onClick={() =>
                              setForms((prev) => ({
                                ...prev,
                                [u.id]: { ...f, extra: horasTotal.toFixed(2) },
                              }))
                            }
                            className="text-[11px] bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 px-2 py-1 rounded-lg border border-cyan-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Usar {formatBRL(horasTotal)} como Adicional
                          </button>
                        </div>

                        {horasDetalhado.length === 0 ? (
                          <p className="text-xs text-slate-500">
                            Nenhuma hora de voo lançada para este colaborador no período selecionado.
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {horasDetalhado.map((d) => (
                              <div
                                key={d.aeronaveId}
                                className="flex items-center justify-between text-xs text-slate-300 gap-2"
                              >
                                <span className="truncate">
                                  {d.matricula}
                                  {d.modelo ? ` · ${d.modelo}` : ""}
                                </span>
                                <span className="text-slate-400 whitespace-nowrap">
                                  {d.horas.toFixed(1)}h × {formatBRL(d.taxa)}
                                </span>
                                <span className="text-cyan-300 font-semibold whitespace-nowrap">
                                  {formatBRL(d.valor)}
                                </span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between text-xs pt-1.5 mt-1 border-t border-slate-800">
                              <span className="font-semibold text-slate-200">Total Horas de Voo</span>
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
                          className="text-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" /> Adicionar 13º Salário
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setForms((prev) => ({
                              ...prev,
                              [u.id]: { ...f, show13: false, decimo_terceiro_parcela1: "", decimo_terceiro_parcela2: "" },
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
                          className="text-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" /> Adicionar Férias
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setForms((prev) => ({
                              ...prev,
                              [u.id]: { ...f, showFerias: false, ferias: "" },
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
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-900/30 rounded-xl border border-slate-800">
                        {f.show13 && (
                          <>
                            <div>
                              <label className={labelCls}>13º Parcela 1</label>
                              <input
                                type="number"
                                step="0.01"
                                className={inputCls}
                                value={f.decimo_terceiro_parcela1}
                                onChange={(e) =>
                                  setForms((prev) => ({
                                    ...prev,
                                    [u.id]: { ...f, decimo_terceiro_parcela1: e.target.value },
                                  }))
                                }
                              />
                            </div>
                            <div>
                              <label className={labelCls}>13º Parcela 2</label>
                              <input
                                type="number"
                                step="0.01"
                                className={inputCls}
                                value={f.decimo_terceiro_parcela2}
                                onChange={(e) =>
                                  setForms((prev) => ({
                                    ...prev,
                                    [u.id]: { ...f, decimo_terceiro_parcela2: e.target.value },
                                  }))
                                }
                              />
                            </div>
                          </>
                        )}
                        {f.showFerias && (
                          <div>
                            <label className={labelCls}>Férias</label>
                            <input
                              type="number"
                              step="0.01"
                              className={inputCls}
                              value={f.ferias}
                              onChange={(e) =>
                                setForms((prev) => ({ ...prev, [u.id]: { ...f, ferias: e.target.value } }))
                              }
                            />
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
                          <div className="flex items-center justify-between p-2 bg-slate-950/80 border border-slate-700 rounded-lg text-xs">
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
                          <label className="flex items-center justify-center gap-2 p-2 border border-dashed border-slate-700 hover:border-cyan-400/50 bg-slate-950/40 rounded-lg cursor-pointer text-xs text-slate-400 transition-colors">
                            {uploadingField?.userId === u.id && uploadingField?.field === "holerite" ? (
                              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                            ) : (
                              <Upload className="h-4 w-4 text-cyan-400" />
                            )}
                            <span>Anexar Holerite</span>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              disabled={uploadingField !== null}
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
                          <div className="flex items-center justify-between p-2 bg-slate-950/80 border border-slate-700 rounded-lg text-xs">
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
                          <label className="flex items-center justify-center gap-2 p-2 border border-dashed border-slate-700 hover:border-cyan-400/50 bg-slate-950/40 rounded-lg cursor-pointer text-xs text-slate-400 transition-colors">
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

                    <div className="flex items-center justify-between pt-2">
                      <div className="text-xs text-slate-400 inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Total Final: <span className="text-cyan-300 font-bold ml-1">{formatBRL(totalFuncionario(u.id))}</span>
                      </div>
                      <button
                        onClick={() => saveRow(u.id)}
                        disabled={savingId === u.id || uploadingField !== null}
                        className="text-slate-950 rounded-lg px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
                        style={{ background: "#06b6d4" }}
                      >
                        <Save className="h-4 w-4" />
                        {savingId === u.id ? "Salvando..." : "Salvar"}
                      </button>
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
