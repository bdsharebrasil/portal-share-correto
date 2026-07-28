import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  FileText,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";

/* ─────────────────────────── types ─────────────────────────── */

interface NFSaida {
  id: string;
  numero: string | null;
  cliente_nome: string | null;
  cliente_cnpj: string | null;
  data_criacao: string | null;
  data_vencimento: string | null;
  valor: number | string | null;
  categoria: string | null;
  descricao: string | null;
  status: string | null;
  arquivo_pdf_url: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
  criado_por: string | null;
  aeronave: string | null;
  client_id: string | null;
  aircraft_id: string | null;
}

interface FormState {
  numero: string;
  cliente_nome: string;
  cliente_cnpj: string;
  data_criacao: string;
  data_vencimento: string;
  valor: string;
  categoria: string;
  descricao: string;
  status: string;
  aeronave: string;
  arquivo_pdf_url: string;
}

const emptyForm: FormState = {
  numero: "", cliente_nome: "", cliente_cnpj: "", data_criacao: new Date().toISOString().slice(0, 10),
  data_vencimento: "", valor: "", categoria: "", descricao: "", status: "pendente",
  aeronave: "", arquivo_pdf_url: "",
};

const STATUS_OPCOES = [
  { value: "pendente", label: "Pendente" },
  { value: "recebido", label: "Recebido" },
  { value: "cancelado", label: "Cancelado" },
];

/* ─────────────────────────── helpers ─────────────────────────── */

const num = (v: string | number | null | undefined) => Number(v) || 0;

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  if (s === "recebido") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border"
        style={{ background: "rgba(34,197,94,0.10)", color: "#4ade80", borderColor: "rgba(34,197,94,0.25)" }}>
        <CheckCircle2 className="h-3 w-3 mr-1" /> Recebido
      </span>
    );
  }
  if (s === "cancelado") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border"
        style={{ background: "rgba(100,116,139,0.10)", color: "#94a3b8", borderColor: "rgba(100,116,139,0.25)" }}>
        <XCircle className="h-3 w-3 mr-1" /> Cancelado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border"
      style={{ background: "rgba(245,158,11,0.10)", color: "#fbbf24", borderColor: "rgba(245,158,11,0.25)" }}>
      <Clock className="h-3 w-3 mr-1" /> Pendente
    </span>
  );
}

/* ─────────────────────────── main ─────────────────────────── */

export default function NFSaidaTab() {
  const [notas, setNotas] = useState<NFSaida[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchNotas = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notas_fiscais_saida")
        .select("*")
        .order("data_criacao", { ascending: false });
      if (error) throw error;
      setNotas((data ?? []) as NFSaida[]);
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao carregar notas." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotas(); }, [fetchNotas]);

  const summary = useMemo(() => {
    const total = notas.length;
    const totalPendente = notas
      .filter((n) => (n.status ?? "").toLowerCase() === "pendente")
      .reduce((s, n) => s + num(n.valor), 0);
    const totalRecebido = notas
      .filter((n) => (n.status ?? "").toLowerCase() === "recebido")
      .reduce((s, n) => s + num(n.valor), 0);
    return { total, totalPendente, totalRecebido };
  }, [notas]);

  const openNew = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
  const openEdit = (n: NFSaida) => {
    setForm({
      numero: n.numero ?? "", cliente_nome: n.cliente_nome ?? "", cliente_cnpj: n.cliente_cnpj ?? "",
      data_criacao: n.data_criacao ?? new Date().toISOString().slice(0, 10),
      data_vencimento: n.data_vencimento ?? "", valor: n.valor != null ? String(n.valor) : "",
      categoria: n.categoria ?? "", descricao: n.descricao ?? "", status: n.status ?? "pendente",
      aeronave: n.aeronave ?? "", arquivo_pdf_url: n.arquivo_pdf_url ?? "",
    });
    setEditingId(n.id); setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); };

  const save = async () => {
    if (!form.numero.trim()) { setToast({ type: "err", text: "Informe o número da nota." }); return; }
    setSaving(true); setToast(null);
    try {
      const payload = {
        numero: form.numero.trim(), cliente_nome: form.cliente_nome.trim() || null,
        cliente_cnpj: form.cliente_cnpj.trim() || null,
        data_criacao: form.data_criacao || null, data_vencimento: form.data_vencimento || null,
        valor: form.valor ? Number(form.valor) : 0, categoria: form.categoria.trim() || null,
        descricao: form.descricao.trim() || null, status: form.status,
        aeronave: form.aeronave.trim() || null, arquivo_pdf_url: form.arquivo_pdf_url.trim() || null,
      };
      if (editingId) {
        const { error } = await supabase.from("notas_fiscais_saida")
          .update({ ...payload, atualizado_em: new Date().toISOString() }).eq("id", editingId);
        if (error) throw error;
        setToast({ type: "ok", text: "Nota fiscal atualizada." });
      } else {
        const { error } = await supabase.from("notas_fiscais_saida").insert({
          ...payload, criado_em: new Date().toISOString(),
        });
        if (error) throw error;
        setToast({ type: "ok", text: "Nota fiscal criada." });
      }
      closeForm(); fetchNotas();
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao salvar." });
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("notas_fiscais_saida").delete().eq("id", deleteId);
      if (error) throw error;
      setToast({ type: "ok", text: "Nota fiscal excluída." });
      setDeleteId(null); fetchNotas();
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao excluir." });
    } finally { setDeleting(false); }
  };

  const inputCls = "border border-slate-700 bg-slate-950/70 text-slate-100 placeholder:text-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400 w-full";
  const labelCls = "block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Notas Fiscais de Saída</h2>
          <p className="text-xs text-slate-400">Notas fiscais emitidas para clientes.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchNotas} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-3 py-2 text-sm inline-flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
          <button onClick={openNew} className="text-slate-950 rounded-lg px-3 py-2 text-sm font-semibold inline-flex items-center gap-2" style={{ background: "#06b6d4" }}>
            <Plus className="h-4 w-4" /> Nova Nota
          </button>
        </div>
      </div>

      {/* summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: "Total Notas", value: String(summary.total), icon: FileText, color: "#38bdf8" },
          { label: "Total Pendente", value: formatBRL(summary.totalPendente), icon: Clock, color: "#fbbf24" },
          { label: "Total Recebido", value: formatBRL(summary.totalRecebido), icon: DollarSign, color: "#4ade80" },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl p-4" style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{c.label}</span>
                <Icon className="h-4 w-4" style={{ color: c.color }} />
              </div>
              <div className="text-lg font-bold mt-1" style={{ color: c.color }}>{c.value}</div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div className="rounded-lg px-4 py-2 text-sm border"
          style={{ background: toast.type === "ok" ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
            color: toast.type === "ok" ? "#4ade80" : "#f87171",
            borderColor: toast.type === "ok" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)" }}>
          {toast.text}
        </div>
      )}

      {/* inline form */}
      {showForm && (
        <div className="rounded-2xl p-5 space-y-4" style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100">{editingId ? "Editar Nota Fiscal" : "Nova Nota Fiscal"}</h3>
            <button onClick={closeForm} className="text-slate-400 hover:text-slate-200"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className={labelCls}>Número *</label>
              <input className={inputCls} value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></div>
            <div><label className={labelCls}>Cliente</label>
              <input className={inputCls} value={form.cliente_nome} onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })} /></div>
            <div><label className={labelCls}>CNPJ Cliente</label>
              <input className={inputCls} value={form.cliente_cnpj} onChange={(e) => setForm({ ...form, cliente_cnpj: e.target.value })} /></div>
            <div><label className={labelCls}>Data Emissão</label>
              <input type="date" className={inputCls} value={form.data_criacao} onChange={(e) => setForm({ ...form, data_criacao: e.target.value })} /></div>
            <div><label className={labelCls}>Data Vencimento</label>
              <input type="date" className={inputCls} value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} /></div>
            <div><label className={labelCls}>Valor (R$)</label>
              <input type="number" step="0.01" className={inputCls} value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
            <div><label className={labelCls}>Categoria</label>
              <input className={inputCls} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} /></div>
            <div><label className={labelCls}>Aeronave</label>
              <input className={inputCls} value={form.aeronave} onChange={(e) => setForm({ ...form, aeronave: e.target.value })} /></div>
            <div><label className={labelCls}>Status</label>
              <select className={inputCls + " cursor-pointer"} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUS_OPCOES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select></div>
            <div className="md:col-span-3"><label className={labelCls}>Descrição</label>
              <textarea className={inputCls} rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div className="md:col-span-3"><label className={labelCls}>URL do PDF</label>
              <input className={inputCls} value={form.arquivo_pdf_url} onChange={(e) => setForm({ ...form, arquivo_pdf_url: e.target.value })} placeholder="https://..." /></div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={closeForm} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-4 py-2 text-sm">Cancelar</button>
            <button onClick={save} disabled={saving} className="text-slate-950 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: "#06b6d4" }}>
              {saving ? "Salvando..." : editingId ? "Salvar Alterações" : "Criar Nota"}
            </button>
          </div>
        </div>
      )}

      {/* table */}
      {loading ? (
        <div className="text-sm text-slate-400 py-10 text-center">Carregando...</div>
      ) : notas.length === 0 ? (
        <div className="rounded-2xl p-10 text-center text-sm text-slate-400" style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
          Nenhuma nota fiscal cadastrada.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <th className="px-3 py-2">Número</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Aeronave</th>
                <th className="px-3 py-2">Emissão</th>
                <th className="px-3 py-2">Vencimento</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-center">PDF</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {notas.map((n) => (
                <tr key={n.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                  <td className="px-3 py-2 text-slate-200 font-semibold">{n.numero || "—"}</td>
                  <td className="px-3 py-2 text-slate-200">{n.cliente_nome || "—"}</td>
                  <td className="px-3 py-2 text-slate-300">{n.aeronave || "—"}</td>
                  <td className="px-3 py-2 text-slate-300">{n.data_criacao || "—"}</td>
                  <td className="px-3 py-2 text-slate-300">{n.data_vencimento || "—"}</td>
                  <td className="px-3 py-2 text-right font-semibold text-cyan-300">{formatBRL(num(n.valor))}</td>
                  <td className="px-3 py-2 text-slate-300">{n.categoria || "—"}</td>
                  <td className="px-3 py-2"><StatusBadge status={n.status} /></td>
                  <td className="px-3 py-2 text-center">
                    {n.arquivo_pdf_url ? (
                      <a href={n.arquivo_pdf_url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300 inline-flex items-center justify-center">
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    ) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(n)} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded px-2 py-1 text-[10px]">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button onClick={() => setDeleteId(n.id)} className="border border-red-900/50 bg-red-950/40 text-red-300 hover:bg-red-900/40 rounded px-2 py-1 text-[10px]">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* delete modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-950/50 flex items-center justify-center"><Trash2 className="h-5 w-5 text-red-400" /></div>
              <h3 className="text-base font-bold text-slate-100">Excluir nota fiscal</h3>
            </div>
            <p className="text-sm text-slate-300">Tem certeza que deseja excluir esta nota fiscal? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setDeleteId(null)} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-4 py-2 text-sm">Cancelar</button>
              <button onClick={confirmDelete} disabled={deleting} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#dc2626" }}>
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
