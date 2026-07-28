import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  Save,
  Calendar,
  Link as LinkIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";

/* ─────────────────────────── types ─────────────────────────── */

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  employment_status: string | null;
  tipo: string | null;
}

interface PagamentoSalario {
  id: string;
  user_profile: string | null;
  base_salary_holerite: number | string | null;
  benefit: string | null;
  horas_voo: string | null;
  decimo_terceiro_parcela1: number | string | null;
  decimo_terceiro_parcela2: number | string | null;
  ferias: number | string | null;
  extra: string | null;
  obs: string | null;
  banco: string | null;
  data_pagamento: string | null;
  holerite_url: string | null;
  comprovante_url: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
}

interface ContaBancaria {
  id: string;
  banco: string | null;
  numero_conta: string | null;
  tipo_conta: string | null;
}

interface FormState {
  base_salary_holerite: string;
  benefit: string;
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
}

const emptyForm: FormState = {
  base_salary_holerite: "",
  benefit: "",
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

const today = () => new Date().toISOString().slice(0, 10);

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

  const carregar = useCallback(async () => {
    setLoading(true);
    setToast(null);
    try {
      const { data: users, error: ue } = await supabase
        .from("user_profiles")
        .select("id,full_name,email,employment_status,tipo")
        .eq("employment_status", "ativo")
        .eq("tipo", "colaborador")
        .order("full_name", { ascending: true });
      if (ue) throw ue;
      const userList = (users ?? []) as UserProfile[];
      setFuncionarios(userList);

      if (userList.length === 0) {
        setPagamentos({});
        setForms({});
        setLoaded(true);
        setLoading(false);
        return;
      }

      const { data: pags, error: pe } = await supabase
        .from("pagamento_salario_funcionario")
        .select("*")
        .in(
          "user_profile",
          userList.map((u) => u.id),
        );
      if (pe) throw pe;

      const pagMap: Record<string, PagamentoSalario | null> = {};
      const formMap: Record<string, FormState> = {};
      (pags ?? []).forEach((p: any) => {
        const existing = pagMap[p.user_profile];
        // keep the most recent by data_pagamento / atualizado_em
        if (!existing || (p.atualizado_em ?? "") > (existing.atualizado_em ?? "")) {
          pagMap[p.user_profile] = p as PagamentoSalario;
        }
      });
      userList.forEach((u) => {
        const p = pagMap[u.id] ?? null;
        if (p) {
          formMap[u.id] = {
            base_salary_holerite: p.base_salary_holerite != null ? String(p.base_salary_holerite) : "",
            benefit: p.benefit ?? "",
            horas_voo: p.horas_voo ?? "",
            extra: p.extra ?? "",
            decimo_terceiro_parcela1: p.decimo_terceiro_parcela1 != null ? String(p.decimo_terceiro_parcela1) : "",
            decimo_terceiro_parcela2: p.decimo_terceiro_parcela2 != null ? String(p.decimo_terceiro_parcela2) : "",
            ferias: p.ferias != null ? String(p.ferias) : "",
            banco: p.banco ?? "",
            data_pagamento: p.data_pagamento ?? "",
            obs: p.obs ?? "",
            holerite_url: p.holerite_url ?? "",
            comprovante_url: p.comprovante_url ?? "",
          };
        } else {
          formMap[u.id] = { ...emptyForm };
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

  const saveRow = async (userId: string) => {
    const f = forms[userId];
    if (!f) return;
    setSavingId(userId);
    setToast(null);
    try {
      const payload = {
        user_profile: userId,
        base_salary_holerite: f.base_salary_holerite ? Number(f.base_salary_holerite) : null,
        benefit: f.benefit.trim() || null,
        horas_voo: f.horas_voo.trim() || null,
        extra: f.extra.trim() || null,
        decimo_terceiro_parcela1: f.decimo_terceiro_parcela1 ? Number(f.decimo_terceiro_parcela1) : null,
        decimo_terceiro_parcela2: f.decimo_terceiro_parcela2 ? Number(f.decimo_terceiro_parcela2) : null,
        ferias: f.ferias ? Number(f.ferias) : null,
        banco: f.banco || null,
        data_pagamento: f.data_pagamento || null,
        obs: f.obs.trim() || null,
        holerite_url: f.holerite_url.trim() || null,
        comprovante_url: f.comprovante_url.trim() || null,
      };
      const existing = pagamentos[userId];
      if (existing?.id) {
        const { error } = await supabase
          .from("pagamento_salario_funcionario")
          .update({ ...payload, atualizado_em: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("pagamento_salario_funcionario")
          .insert({ ...payload, criado_em: new Date().toISOString() })
          .select("*")
          .single();
        if (error) throw error;
        setPagamentos((prev) => ({ ...prev, [userId]: data as PagamentoSalario }));
      }
      setToast({ type: "ok", text: "Pagamento salvo com sucesso." });
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao salvar pagamento." });
    } finally {
      setSavingId(null);
    }
  };

  const totalFuncionario = (userId: string) => {
    const f = forms[userId];
    if (!f) return 0;
    return (
      num(f.base_salary_holerite) +
      num(f.decimo_terceiro_parcela1) +
      num(f.decimo_terceiro_parcela2) +
      num(f.ferias)
    );
  };

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

      {/* period selector */}
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

      {/* toast */}
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

      {/* list */}
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
            return (
              <div
                key={u.id}
                className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}
              >
                {/* row header */}
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
                      <div className="text-sm font-semibold text-slate-100 truncate">
                        {u.full_name || "Sem nome"}
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

                {/* expanded form */}
                {expanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-800 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className={labelCls}>Salário Base (Holerite)</label>
                        <input
                          type="number"
                          step="0.01"
                          className={inputCls}
                          value={f.base_salary_holerite}
                          onChange={(e) =>
                            setForms((prev) => ({
                              ...prev,
                              [u.id]: { ...f, base_salary_holerite: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Benefício</label>
                        <input
                          className={inputCls}
                          value={f.benefit}
                          onChange={(e) =>
                            setForms((prev) => ({ ...prev, [u.id]: { ...f, benefit: e.target.value } }))
                          }
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Horas de Voo</label>
                        <input
                          className={inputCls}
                          value={f.horas_voo}
                          onChange={(e) =>
                            setForms((prev) => ({ ...prev, [u.id]: { ...f, horas_voo: e.target.value } }))
                          }
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Extra</label>
                        <input
                          className={inputCls}
                          value={f.extra}
                          onChange={(e) =>
                            setForms((prev) => ({ ...prev, [u.id]: { ...f, extra: e.target.value } }))
                          }
                        />
                      </div>
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
                      <div>
                        <label className={labelCls}>Conta Bancária</label>
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
                      <div>
                        <label className={labelCls}>URL Holerite</label>
                        <input
                          className={inputCls}
                          value={f.holerite_url}
                          onChange={(e) =>
                            setForms((prev) => ({ ...prev, [u.id]: { ...f, holerite_url: e.target.value } }))
                          }
                          placeholder="https://..."
                        />
                      </div>
                      <div>
                        <label className={labelCls}>URL Comprovante</label>
                        <input
                          className={inputCls}
                          value={f.comprovante_url}
                          onChange={(e) =>
                            setForms((prev) => ({
                              ...prev,
                              [u.id]: { ...f, comprovante_url: e.target.value },
                            }))
                          }
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="text-xs text-slate-400 inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Total: <span className="text-cyan-300 font-bold">{formatBRL(totalFuncionario(u.id))}</span>
                      </div>
                      <button
                        onClick={() => saveRow(u.id)}
                        disabled={savingId === u.id}
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

      {/* footer hint */}
      <div className="text-[11px] text-slate-500 inline-flex items-center gap-1">
        <LinkIcon className="h-3 w-3" /> Os pagamentos são salvos por colaborador e período.
      </div>
    </div>
  );
}
