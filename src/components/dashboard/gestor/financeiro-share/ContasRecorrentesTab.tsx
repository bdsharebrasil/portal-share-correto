import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  CalendarClock,
  Bell,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";

/* ─────────────────────────── types ─────────────────────────── */

interface ContaRecorrente {
  id: string;
  descricao: string | null;
  fornecedor: string | null;
  valor: number | string | null;
  categoria: string | null;
  frequencia_recorrencia: string | null;
  dia_recorrencia: number | null;
  lembrete_antecipado: boolean | null;
  status: string | null;
  notas: string | null;
  data_inicio: string | null;
  criado_por: string | null;
  atualizado_por: string | null;
  created_at: string | null;
  updated_at: string | null;
  empresa_id: string | null;
}

interface FormState {
  descricao: string;
  fornecedor: string;
  valor: string;
  categoria: string;
  frequencia_recorrencia: string;
  dia_recorrencia: string;
  status: string;
  lembrete_antecipado: boolean;
  notas: string;
  data_inicio: string;
}

const emptyForm: FormState = {
  descricao: "",
  fornecedor: "",
  valor: "",
  categoria: "",
  frequencia_recorrencia: "mensal",
  dia_recorrencia: "1",
  status: "agendado",
  lembrete_antecipado: false,
  notas: "",
  data_inicio: new Date().toISOString().slice(0, 10),
};

const FREQUENCIAS = [
  { value: "semanal", label: "Semanal" },
  { value: "mensal", label: "Mensal" },
  { value: "anual", label: "Anual" },
];

const STATUS_OPCOES = [
  { value: "agendado", label: "Agendado" },
  { value: "cancelado", label: "Cancelado" },
];

/* ─────────────────────────── helpers ─────────────────────────── */

const num = (v: string | number | null | undefined) => Number(v) || 0;

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  if (s === "cancelado") {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border"
        style={{
          background: "rgba(239,68,68,0.10)",
          color: "#f87171",
          borderColor: "rgba(239,68,68,0.25)",
        }}
      >
        <XCircle className="h-3 w-3 mr-1" /> Cancelado
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border"
      style={{
        background: "rgba(34,197,94,0.10)",
        color: "#4ade80",
        borderColor: "rgba(34,197,94,0.25)",
      }}
    >
      <CheckCircle2 className="h-3 w-3 mr-1" /> Agendado
    </span>
  );
}

const freqLabel = (f: string | null) =>
  FREQUENCIAS.find((x) => x.value === (f ?? "").toLowerCase())?.label || f || "—";

/* ─────────────────────────── main ─────────────────────────── */

export default function ContasRecorrentesTab() {
  const [contas, setContas] = useState<ContaRecorrente[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchContas = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("contas_recorrentes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setContas((data ?? []) as ContaRecorrente[]);
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao carregar contas recorrentes." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContas();
  }, [fetchContas]);

  const openNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (c: ContaRecorrente) => {
    setForm({
      descricao: c.descricao ?? "",
      fornecedor: c.fornecedor ?? "",
      valor: c.valor != null ? String(c.valor) : "",
      categoria: c.categoria ?? "",
      frequencia_recorrencia: c.frequencia_recorrencia ?? "mensal",
      dia_recorrencia: c.dia_recorrencia != null ? String(c.dia_recorrencia) : "1",
      status: c.status ?? "agendado",
      lembrete_antecipado: !!c.lembrete_antecipado,
      notas: c.notas ?? "",
      data_inicio: c.data_inicio ?? new Date().toISOString().slice(0, 10),
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const save = async () => {
    if (!form.descricao.trim()) {
      setToast({ type: "err", text: "Informe a descrição." });
      return;
    }
    setSaving(true);
    setToast(null);
    try {
      const payload = {
        descricao: form.descricao.trim(),
        fornecedor: form.fornecedor.trim() || null,
        valor: form.valor ? Number(form.valor) : 0,
        categoria: form.categoria.trim() || null,
        frequencia_recorrencia: form.frequencia_recorrencia,
        dia_recorrencia: Number(form.dia_recorrencia) || 1,
        status: form.status,
        lembrete_antecipado: form.lembrete_antecipado,
        notas: form.notas.trim() || null,
        data_inicio: form.data_inicio || null,
      };
      if (editingId) {
        const { error } = await supabase
          .from("contas_recorrentes")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingId);
        if (error) throw error;
        setToast({ type: "ok", text: "Conta recorrente atualizada." });
      } else {
        const { error } = await supabase.from("contas_recorrentes").insert(payload);
        if (error) throw error;
        setToast({ type: "ok", text: "Conta recorrente criada." });
      }
      closeForm();
      fetchContas();
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("contas_recorrentes").delete().eq("id", deleteId);
      if (error) throw error;
      setToast({ type: "ok", text: "Conta recorrente excluída." });
      setDeleteId(null);
      fetchContas();
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao excluir." });
    } finally {
      setDeleting(false);
    }
  };

  const inputCls =
    "border border-slate-700 bg-slate-950/70 text-slate-100 placeholder:text-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400 w-full";
  const labelCls = "block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1";

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Contas Recorrentes</h2>
          <p className="text-xs text-slate-400">Despesas e receitas que se repetem automaticamente.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchContas}
            className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-3 py-2 text-sm inline-flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
          <button
            onClick={openNew}
            className="text-slate-950 rounded-lg px-3 py-2 text-sm inline-flex items-center gap-2 font-semibold"
            style={{ background: "#06b6d4" }}
          >
            <Plus className="h-4 w-4" /> Nova Conta Recorrente
          </button>
        </div>
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

      {/* inline form */}
      {showForm && (
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100">
              {editingId ? "Editar Conta Recorrente" : "Nova Conta Recorrente"}
            </h3>
            <button onClick={closeForm} className="text-slate-400 hover:text-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Descrição *</label>
              <input
                className={inputCls}
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Ex.: Aluguel do galpão"
              />
            </div>
            <div>
              <label className={labelCls}>Fornecedor</label>
              <input
                className={inputCls}
                value={form.fornecedor}
                onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
                placeholder="Nome do fornecedor"
              />
            </div>
            <div>
              <label className={labelCls}>Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                className={inputCls}
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div>
              <label className={labelCls}>Categoria</label>
              <input
                className={inputCls}
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                placeholder="Ex.: Infraestrutura"
              />
            </div>
            <div>
              <label className={labelCls}>Frequência</label>
              <select
                className={inputCls + " cursor-pointer"}
                value={form.frequencia_recorrencia}
                onChange={(e) => setForm({ ...form, frequencia_recorrencia: e.target.value })}
              >
                {FREQUENCIAS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Dia da Recorrência</label>
              <select
                className={inputCls + " cursor-pointer"}
                value={form.dia_recorrencia}
                onChange={(e) => setForm({ ...form, dia_recorrencia: e.target.value })}
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Dia {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select
                className={inputCls + " cursor-pointer"}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {STATUS_OPCOES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Data de Início</label>
              <input
                type="date"
                className={inputCls}
                value={form.data_inicio}
                onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-2 pt-1">
              <input
                id="lembrete"
                type="checkbox"
                checked={form.lembrete_antecipado}
                onChange={(e) => setForm({ ...form, lembrete_antecipado: e.target.checked })}
                className="h-4 w-4 accent-cyan-400"
              />
              <label htmlFor="lembrete" className="text-sm text-slate-200 inline-flex items-center gap-1">
                <Bell className="h-3.5 w-3.5 text-cyan-400" /> Lembrar com antecedência
              </label>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Notas</label>
              <textarea
                className={inputCls}
                rows={3}
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                placeholder="Observações adicionais"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={closeForm}
              className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-4 py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="text-slate-950 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
              style={{ background: "#06b6d4" }}
            >
              {saving ? "Salvando..." : editingId ? "Salvar Alterações" : "Criar Conta"}
            </button>
          </div>
        </div>
      )}

      {/* list */}
      {loading ? (
        <div className="text-sm text-slate-400 py-10 text-center">Carregando...</div>
      ) : contas.length === 0 ? (
        <div
          className="rounded-2xl p-10 text-center text-sm text-slate-400"
          style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}
        >
          Nenhuma conta recorrente cadastrada.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contas.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl p-4 space-y-3"
              style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-100 truncate">{c.descricao || "—"}</div>
                  <div className="text-xs text-slate-400 truncate">{c.fornecedor || "Sem fornecedor"}</div>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Valor</div>
                  <div className="text-lg font-bold text-cyan-300">{formatBRL(num(c.valor))}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recorrência</div>
                  <div className="text-xs text-slate-200 inline-flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5 text-cyan-400" />
                    {freqLabel(c.frequencia_recorrencia)} · dia {c.dia_recorrencia ?? "—"}
                  </div>
                </div>
              </div>
              {c.categoria && (
                <div className="text-[11px] text-slate-400">
                  Categoria: <span className="text-slate-200">{c.categoria}</span>
                </div>
              )}
              {c.lembrete_antecipado && (
                <div className="text-[11px] text-cyan-400 inline-flex items-center gap-1">
                  <Bell className="h-3 w-3" /> Lembrete antecipado ativo
                </div>
              )}
              {c.notas && (
                <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-2 line-clamp-2">
                  {c.notas}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1 border-t border-slate-800">
                <button
                  onClick={() => openEdit(c)}
                  className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-2.5 py-1.5 text-xs inline-flex items-center gap-1"
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </button>
                <button
                  onClick={() => setDeleteId(c.id)}
                  className="border border-red-900/50 bg-red-950/40 text-red-300 hover:bg-red-900/40 rounded-lg px-2.5 py-1.5 text-xs inline-flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* delete modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-950/50 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Excluir conta recorrente</h3>
            </div>
            <p className="text-sm text-slate-300">
              Tem certeza que deseja excluir esta conta recorrente? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteId(null)}
                className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "#dc2626" }}
              >
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
