import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  Tag,
  Landmark,
  Users,
  CheckCircle2,
  Wallet,
  Building2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/* ─────────────────────────── types ─────────────────────────── */

interface Categoria {
  id: string;
  nome: string | null;
  tipo: string | null;
  reembolsavel: boolean | null;
  descricao: string | null;
  ativo: boolean | null;
  criado_por: string | null;
  grupo_categoria: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
}

interface ExpenseConfig {
  id: string;
  expense_type: string;
  subcategoria_1: string | null;
  subcategoria_2: string | null;
  subcategoria_3: string | null;
  subcategoria_4: string | null;
  categoria_pai: string | null;
}

interface ContaBancaria {
  id: string;
  banco: string | null;
  numero_conta: string | null;
  tipo_conta: string | null;
  ativo: boolean | null;
  criado_por: string | null;
}

interface Fornecedor {
  id: string;
  nome_completo: string | null;
  cidade: string | null;
  telefone: string | null;
  documento: string | null;
  categoria: string | null;
  apelido: string | null;
  conta_pagamento: string | null;
  criado_por: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
}

type SubTab = "caixa_share" | "caixa_cliente" | "contas" | "fornecedores";

const CATEGORIAS_TIPO = [
  { value: "receita", label: "Receita" },
  { value: "despesa", label: "Despesa" },
  { value: "entrada", label: "Entrada" },
  { value: "saida", label: "Saída" },
  { value: "reembolso", label: "Reembolso" },
];

const CONTAS_TIPO = [{ value: "corrente", label: "Corrente" }];

const FORNECEDOR_CATEGORIAS = [
  { value: "share", label: "Share" },
  { value: "particular", label: "Particular" },
  { value: "ambos", label: "Ambos" },
  { value: "nenhum", label: "Nenhum" },
];

const TIPO_BADGE_CFG: Record<string, { bg: string; color: string; border: string }> = {
  receita: { bg: "rgba(34,197,94,0.10)", color: "#4ade80", border: "rgba(34,197,94,0.25)" },
  entrada: { bg: "rgba(59,130,246,0.10)", color: "#60a5fa", border: "rgba(59,130,246,0.25)" },
  reembolso: { bg: "rgba(168,85,247,0.10)", color: "#c084fc", border: "rgba(168,85,247,0.25)" },
  despesa: { bg: "rgba(239,68,68,0.10)", color: "#f87171", border: "rgba(239,68,68,0.25)" },
  saida: { bg: "rgba(245,158,11,0.10)", color: "#fbbf24", border: "rgba(245,158,11,0.25)" },
};

/* ─────────────────────────── helpers ─────────────────────────── */

function TipoBadge({ tipo }: { tipo: string | null }) {
  const t = (tipo ?? "").toLowerCase();
  const s = TIPO_BADGE_CFG[t] || TIPO_BADGE_CFG.despesa;
  const label = CATEGORIAS_TIPO.find((x) => x.value === t)?.label || tipo || "—";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}
    >
      {label}
    </span>
  );
}

function FornecedorCatBadge({ cat }: { cat: string | null }) {
  const c = (cat ?? "").toLowerCase();
  const cfg: Record<string, { bg: string; color: string; border: string }> = {
    share: { bg: "rgba(56,189,248,0.10)", color: "#38bdf8", border: "rgba(56,189,248,0.25)" },
    particular: { bg: "rgba(168,85,247,0.10)", color: "#c084fc", border: "rgba(168,85,247,0.25)" },
    ambos: { bg: "rgba(245,158,11,0.10)", color: "#fbbf24", border: "rgba(245,158,11,0.25)" },
    nenhum: { bg: "rgba(100,116,139,0.10)", color: "#94a3b8", border: "rgba(100,116,139,0.25)" },
  };
  const s = cfg[c] || cfg.nenhum;
  const label = FORNECEDOR_CATEGORIAS.find((x) => x.value === c)?.label || cat || "—";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}
    >
      {label}
    </span>
  );
}

/* ─────────────────────────── main ─────────────────────────── */

export default function ConfiguracoesTab() {
  const [sub, setSub] = useState<SubTab>("caixa_share");
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-100">Configurações</h2>
        <p className="text-xs text-slate-400">Categorias, contas bancárias e fornecedores favoritos.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <SubBtn active={sub === "caixa_share"} onClick={() => setSub("caixa_share")} icon={Wallet} label="Caixa Share" color="#10b981" />
        <SubBtn active={sub === "caixa_cliente"} onClick={() => setSub("caixa_cliente")} icon={Building2} label="Caixa Cliente" color="#3b82f6" />
        <SubBtn active={sub === "contas"} onClick={() => setSub("contas")} icon={Landmark} label="Contas Bancárias" />
        <SubBtn active={sub === "fornecedores"} onClick={() => setSub("fornecedores")} icon={Users} label="Fornecedores" />
      </div>
      {sub === "caixa_share" && <CaixaSharePanel />}
      {sub === "caixa_cliente" && <CaixaClientePanel />}
      {sub === "contas" && <ContasPanel />}
      {sub === "fornecedores" && <FornecedoresPanel />}
    </div>
  );
}

function SubBtn({
  active,
  onClick,
  icon: Icon,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.FC<any>;
  label: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 ${
        active ? "text-slate-950" : "border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800"
      }`}
      style={active ? { background: color || "#06b6d4" } : undefined}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

/* ─────────────────────────── shared UI ─────────────────────────── */

const inputCls =
  "border border-slate-700 bg-slate-950/70 text-slate-100 placeholder:text-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400 w-full";
const labelCls = "block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1";

function DeleteModal({
  open,
  title,
  message,
  onCancel,
  onConfirm,
  deleting,
}: {
  open: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full mx-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-red-950/50 flex items-center justify-center">
            <Trash2 className="h-5 w-5 text-red-400" />
          </div>
          <h3 className="text-base font-bold text-slate-100">{title}</h3>
        </div>
        <p className="text-sm text-slate-300">{message}</p>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-4 py-2 text-sm">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "#dc2626" }}
          >
            {deleting ? "Excluindo..." : "Excluir"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ toast }: { toast: { type: "ok" | "err"; text: string } | null }) {
  if (!toast) return null;
  return (
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
  );
}

/* ─────────────────────────── caixa share panel (green — categorias_movimentacao) ─────────────────────────── */

const GREEN = "#10b981";

function CaixaSharePanel() {
  const [items, setItems] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    tipo: "despesa",
    grupo_categoria: "",
    reembolsavel: false,
    descricao: "",
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("categorias_movimentacao").select("*").order("nome", { ascending: true });
      if (error) throw error;
      setItems((data ?? []) as Categoria[]);
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao carregar." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const openNew = () => {
    setForm({ nome: "", tipo: "despesa", grupo_categoria: "", reembolsavel: false, descricao: "" });
    setEditingId(null);
    setShowForm(true);
  };
  const openEdit = (c: Categoria) => {
    setForm({
      nome: c.nome ?? "",
      tipo: c.tipo ?? "despesa",
      grupo_categoria: c.grupo_categoria ?? "",
      reembolsavel: !!c.reembolsavel,
      descricao: c.descricao ?? "",
    });
    setEditingId(c.id);
    setShowForm(true);
  };
  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const save = async () => {
    if (!form.nome.trim()) {
      setToast({ type: "err", text: "Informe o nome." });
      return;
    }
    setSaving(true);
    setToast(null);
    try {
      const payload = {
        nome: form.nome.trim(),
        tipo: form.tipo,
        grupo_categoria: form.grupo_categoria.trim() || null,
        reembolsavel: form.reembolsavel,
        descricao: form.descricao.trim() || null,
        ativo: true,
      };
      if (editingId) {
        const { error } = await supabase
          .from("categorias_movimentacao")
          .update({ ...payload, atualizado_em: new Date().toISOString() })
          .eq("id", editingId);
        if (error) throw error;
        setToast({ type: "ok", text: "Categoria atualizada." });
      } else {
        const { error } = await supabase.from("categorias_movimentacao").insert({
          ...payload,
          criado_por: "00000000-0000-0000-0000-000000000000",
          criado_em: new Date().toISOString(),
        });
        if (error) throw error;
        setToast({ type: "ok", text: "Categoria criada." });
      }
      closeForm();
      fetchItems();
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
      const { error } = await supabase.from("categorias_movimentacao").delete().eq("id", deleteId);
      if (error) throw error;
      setToast({ type: "ok", text: "Categoria excluída." });
      setDeleteId(null);
      fetchItems();
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao excluir." });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: GREEN }} />
       
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={fetchItems} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-3 py-2 text-sm inline-flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </button>
        <button onClick={openNew} className="text-slate-950 rounded-lg px-3 py-2 text-sm font-semibold inline-flex items-center gap-2" style={{ background: GREEN }}>
          <Plus className="h-4 w-4" /> Nova Categoria
        </button>
      </div>

      <Toast toast={toast} />

      {showForm && (
        <div className="rounded-2xl p-5 space-y-4" style={{ border: "1px solid rgba(16,185,129,0.25)", background: "rgba(15,23,42,0.7)" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold" style={{ color: GREEN }}>
              {editingId ? "Editar Categoria" : "Nova Categoria"}
            </h3>
            <button onClick={closeForm} className="text-slate-400 hover:text-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nome *</label>
              <input className={inputCls} style={{ borderColor: "rgba(16,185,129,0.3)" }} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Tipo</label>
              <select className={inputCls + " cursor-pointer"} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {CATEGORIAS_TIPO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Grupo de Categoria</label>
              <input className={inputCls} value={form.grupo_categoria} onChange={(e) => setForm({ ...form, grupo_categoria: e.target.value })} />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <input
                id="reemb"
                type="checkbox"
                checked={form.reembolsavel}
                onChange={(e) => setForm({ ...form, reembolsavel: e.target.checked })}
                className="h-4 w-4"
                style={{ accentColor: GREEN }}
              />
              <label htmlFor="reemb" className="text-sm text-slate-200">
                Reembolsável
              </label>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Descrição</label>
              <textarea className={inputCls} rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={closeForm} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-4 py-2 text-sm">
              Cancelar
            </button>
            <button onClick={save} disabled={saving} className="text-slate-950 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: GREEN }}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400 py-10 text-center">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl p-10 text-center text-sm text-slate-400" style={{ border: "1px solid rgba(16,185,129,0.2)", background: "rgba(15,23,42,0.7)" }}>
          Nenhuma categoria cadastrada.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid rgba(16,185,129,0.2)", background: "rgba(15,23,42,0.7)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wider border-b border-slate-700" style={{ color: GREEN }}>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Grupo</th>
                <th className="px-3 py-2">Reembolsável</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                  <td className="px-3 py-2 text-slate-200 font-semibold">{c.nome || "—"}</td>
                  <td className="px-3 py-2">
                    <TipoBadge tipo={c.tipo} />
                  </td>
                  <td className="px-3 py-2 text-slate-300">{c.grupo_categoria || "—"}</td>
                  <td className="px-3 py-2">
                    {c.reembolsavel ? <CheckCircle2 className="h-4 w-4" style={{ color: GREEN }} /> : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(c)} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded px-2 py-1 text-[10px]">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button onClick={() => setDeleteId(c.id)} className="border border-red-900/50 bg-red-950/40 text-red-300 hover:bg-red-900/40 rounded px-2 py-1 text-[10px]">
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

      <DeleteModal
        open={!!deleteId}
        title="Excluir categoria"
        message="Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita."
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        deleting={deleting}
      />
    </div>
  );
}

/* ─────────────────────────── caixa cliente panel (blue — expense_configu) ─────────────────────────── */

const BLUE = "#3b82f6";

function CaixaClientePanel() {
  const [items, setItems] = useState<ExpenseConfig[]>([]);
  const [parentOptions, setParentOptions] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    expense_type: "",
    subcategoria_1: "",
    subcategoria_2: "",
    subcategoria_3: "",
    subcategoria_4: "",
    categoria_pai: "",
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("expense_configu").select("*").order("expense_type", { ascending: true });
      if (error) throw error;
      setItems((data ?? []) as ExpenseConfig[]);
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao carregar." });
    } finally {
      setLoading(false);
    }
  }, []);

  // Categorias do Caixa Share marcadas como reembolsáveis — são as únicas que
  // fazem sentido como "categoria pai" (o que sai do caixa share e volta como
  // reembolso do caixa cliente).
  const fetchParentOptions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("categorias_movimentacao")
        .select("*")
        .eq("reembolsavel", true)
        .order("nome", { ascending: true });
      if (error) throw error;
      setParentOptions((data ?? []) as Categoria[]);
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao carregar categorias pai." });
    }
  }, []);

  useEffect(() => {
    fetchItems();
    fetchParentOptions();
  }, [fetchItems, fetchParentOptions]);

  const parentName = (id: string | null) => parentOptions.find((p) => p.id === id)?.nome || null;

  const openNew = () => {
    setForm({ expense_type: "", subcategoria_1: "", subcategoria_2: "", subcategoria_3: "", subcategoria_4: "", categoria_pai: "" });
    setEditingId(null);
    setShowForm(true);
  };
  const openEdit = (c: ExpenseConfig) => {
    setForm({
      expense_type: c.expense_type ?? "",
      subcategoria_1: c.subcategoria_1 ?? "",
      subcategoria_2: c.subcategoria_2 ?? "",
      subcategoria_3: c.subcategoria_3 ?? "",
      subcategoria_4: c.subcategoria_4 ?? "",
      categoria_pai: c.categoria_pai ?? "",
    });
    setEditingId(c.id);
    setShowForm(true);
  };
  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const save = async () => {
    if (!form.expense_type.trim()) {
      setToast({ type: "err", text: "Informe o tipo de despesa." });
      return;
    }
    setSaving(true);
    setToast(null);
    try {
      const payload = {
        expense_type: form.expense_type.trim(),
        subcategoria_1: form.subcategoria_1.trim() || null,
        subcategoria_2: form.subcategoria_2.trim() || null,
        subcategoria_3: form.subcategoria_3.trim() || null,
        subcategoria_4: form.subcategoria_4.trim() || null,
        categoria_pai: form.categoria_pai || null,
      };
      if (editingId) {
        const { error } = await supabase.from("expense_configu").update(payload).eq("id", editingId);
        if (error) throw error;
        setToast({ type: "ok", text: "Configuração atualizada." });
      } else {
        const { error } = await supabase.from("expense_configu").insert(payload);
        if (error) throw error;
        setToast({ type: "ok", text: "Configuração criada." });
      }
      closeForm();
      fetchItems();
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
      const { error } = await supabase.from("expense_configu").delete().eq("id", deleteId);
      if (error) throw error;
      setToast({ type: "ok", text: "Configuração excluída." });
      setDeleteId(null);
      fetchItems();
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao excluir." });
    } finally {
      setDeleting(false);
    }
  };

  const subs = (c: ExpenseConfig) => [c.subcategoria_1, c.subcategoria_2, c.subcategoria_3, c.subcategoria_4].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: BLUE }} />

       
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={fetchItems} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-3 py-2 text-sm inline-flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </button>
        <button onClick={openNew} className="text-slate-950 rounded-lg px-3 py-2 text-sm font-semibold inline-flex items-center gap-2" style={{ background: BLUE }}>
          <Plus className="h-4 w-4" /> Nova Configuração
        </button>
      </div>

      <Toast toast={toast} />

      {showForm && (
        <div className="rounded-2xl p-5 space-y-4" style={{ border: "1px solid rgba(59,130,246,0.25)", background: "rgba(15,23,42,0.7)" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold" style={{ color: BLUE }}>
              {editingId ? "Editar Configuração" : "Nova Configuração"}
            </h3>
            <button onClick={closeForm} className="text-slate-400 hover:text-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className={labelCls}>Tipo de Despesa *</label>
              <input
                className={inputCls}
                style={{ borderColor: "rgba(59,130,246,0.3)" }}
                value={form.expense_type}
                onChange={(e) => setForm({ ...form, expense_type: e.target.value })}
                placeholder="Ex: Manutenção, Combustível, Hangar..."
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Categoria Pai (Caixa Share reembolsável)</label>
              <select className={inputCls + " cursor-pointer"} value={form.categoria_pai} onChange={(e) => setForm({ ...form, categoria_pai: e.target.value })}>
                <option value="">Nenhuma</option>
                {parentOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">Associa esta despesa do caixa cliente à categoria do caixa share que será reembolsada.</p>
            </div>
            <div>
              <label className={labelCls}>Subcategoria 1</label>
              <input className={inputCls} value={form.subcategoria_1} onChange={(e) => setForm({ ...form, subcategoria_1: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Subcategoria 2</label>
              <input className={inputCls} value={form.subcategoria_2} onChange={(e) => setForm({ ...form, subcategoria_2: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Subcategoria 3</label>
              <input className={inputCls} value={form.subcategoria_3} onChange={(e) => setForm({ ...form, subcategoria_3: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Subcategoria 4</label>
              <input className={inputCls} value={form.subcategoria_4} onChange={(e) => setForm({ ...form, subcategoria_4: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={closeForm} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-4 py-2 text-sm">
              Cancelar
            </button>
            <button onClick={save} disabled={saving} className="text-slate-950 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: BLUE }}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400 py-10 text-center">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl p-10 text-center text-sm text-slate-400" style={{ border: "1px solid rgba(59,130,246,0.2)", background: "rgba(15,23,42,0.7)" }}>
          Nenhuma configuração cadastrada.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid rgba(59,130,246,0.2)", background: "rgba(15,23,42,0.7)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wider border-b border-slate-700" style={{ color: BLUE }}>
                <th className="px-3 py-2">Tipo de Despesa</th>
                <th className="px-3 py-2">Subcategorias</th>
                <th className="px-3 py-2">Categoria Pai</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const s = subs(c);
                const pName = parentName(c.categoria_pai);
                return (
                  <tr key={c.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                    <td className="px-3 py-2 text-slate-200 font-semibold">{c.expense_type || "—"}</td>
                    <td className="px-3 py-2">
                      {s.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {s.map((sub, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border"
                              style={{ background: "rgba(59,130,246,0.10)", color: "#60a5fa", borderColor: "rgba(59,130,246,0.25)" }}
                            >
                              {sub}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {pName ? (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border"
                          style={{ background: "rgba(16,185,129,0.10)", color: "#4ade80", borderColor: "rgba(16,185,129,0.25)" }}
                        >
                          {pName}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(c)} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded px-2 py-1 text-[10px]">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={() => setDeleteId(c.id)} className="border border-red-900/50 bg-red-950/40 text-red-300 hover:bg-red-900/40 rounded px-2 py-1 text-[10px]">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <DeleteModal
        open={!!deleteId}
        title="Excluir configuração"
        message="Tem certeza que deseja excluir esta configuração de despesa? Esta ação não pode ser desfeita."
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        deleting={deleting}
      />
    </div>
  );
}

/* ─────────────────────────── contas panel ─────────────────────────── */

function ContasPanel() {
  const [items, setItems] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ banco: "", numero_conta: "", tipo_conta: "corrente", ativo: true });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("contas_bancarias").select("*").order("banco", { ascending: true });
      if (error) throw error;
      setItems((data ?? []) as ContaBancaria[]);
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao carregar." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const openNew = () => {
    setForm({ banco: "", numero_conta: "", tipo_conta: "corrente", ativo: true });
    setEditingId(null);
    setShowForm(true);
  };
  const openEdit = (c: ContaBancaria) => {
    setForm({ banco: c.banco ?? "", numero_conta: c.numero_conta ?? "", tipo_conta: c.tipo_conta ?? "corrente", ativo: c.ativo ?? true });
    setEditingId(c.id);
    setShowForm(true);
  };
  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const save = async () => {
    if (!form.banco.trim()) {
      setToast({ type: "err", text: "Informe o banco." });
      return;
    }
    setSaving(true);
    setToast(null);
    try {
      const payload = { banco: form.banco.trim(), numero_conta: form.numero_conta.trim() || null, tipo_conta: form.tipo_conta, ativo: form.ativo };
      if (editingId) {
        const { error } = await supabase.from("contas_bancarias").update(payload).eq("id", editingId);
        if (error) throw error;
        setToast({ type: "ok", text: "Conta atualizada." });
      } else {
        const { error } = await supabase.from("contas_bancarias").insert({ ...payload, criado_por: "00000000-0000-0000-0000-000000000000" });
        if (error) throw error;
        setToast({ type: "ok", text: "Conta criada." });
      }
      closeForm();
      fetchItems();
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
      const { error } = await supabase.from("contas_bancarias").delete().eq("id", deleteId);
      if (error) throw error;
      setToast({ type: "ok", text: "Conta excluída." });
      setDeleteId(null);
      fetchItems();
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao excluir." });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button onClick={fetchItems} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-3 py-2 text-sm inline-flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </button>
        <button onClick={openNew} className="text-slate-950 rounded-lg px-3 py-2 text-sm font-semibold inline-flex items-center gap-2" style={{ background: "#06b6d4" }}>
          <Plus className="h-4 w-4" /> Nova Conta
        </button>
      </div>

      <Toast toast={toast} />

      {showForm && (
        <div className="rounded-2xl p-5 space-y-4" style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100">{editingId ? "Editar Conta" : "Nova Conta Bancária"}</h3>
            <button onClick={closeForm} className="text-slate-400 hover:text-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Banco *</label>
              <input className={inputCls} value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Número da Conta</label>
              <input className={inputCls} value={form.numero_conta} onChange={(e) => setForm({ ...form, numero_conta: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Tipo de Conta</label>
              <select className={inputCls + " cursor-pointer"} value={form.tipo_conta} onChange={(e) => setForm({ ...form, tipo_conta: e.target.value })}>
                {CONTAS_TIPO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2 pb-1">
              <input id="conta-ativo" type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} className="h-4 w-4 accent-cyan-400" />
              <label htmlFor="conta-ativo" className="text-sm text-slate-200">
                Ativo
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={closeForm} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-4 py-2 text-sm">
              Cancelar
            </button>
            <button onClick={save} disabled={saving} className="text-slate-950 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: "#06b6d4" }}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400 py-10 text-center">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl p-10 text-center text-sm text-slate-400" style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
          Nenhuma conta bancária cadastrada.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <th className="px-3 py-2">Banco</th>
                <th className="px-3 py-2">Número da Conta</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Ativo</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                  <td className="px-3 py-2 text-slate-200 font-semibold">{c.banco || "—"}</td>
                  <td className="px-3 py-2 text-slate-300">{c.numero_conta || "—"}</td>
                  <td className="px-3 py-2 text-slate-300">{CONTAS_TIPO.find((t) => t.value === (c.tipo_conta ?? ""))?.label || c.tipo_conta || "—"}</td>
                  <td className="px-3 py-2">{c.ativo ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <span className="text-slate-600">—</span>}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(c)} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded px-2 py-1 text-[10px]">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button onClick={() => setDeleteId(c.id)} className="border border-red-900/50 bg-red-950/40 text-red-300 hover:bg-red-900/40 rounded px-2 py-1 text-[10px]">
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

      <DeleteModal
        open={!!deleteId}
        title="Excluir conta bancária"
        message="Tem certeza que deseja excluir esta conta bancária? Esta ação não pode ser desfeita."
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        deleting={deleting}
      />
    </div>
  );
}

/* ─────────────────────────── fornecedores panel ─────────────────────────── */

function FornecedoresPanel() {
  const [items, setItems] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    nome_completo: "",
    apelido: "",
    documento: "",
    cidade: "",
    telefone: "",
    categoria: "nenhum",
    conta_pagamento: "",
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("fornecedores_favoritos").select("*").order("nome_completo", { ascending: true });
      if (error) throw error;
      setItems((data ?? []) as Fornecedor[]);
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao carregar." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const openNew = () => {
    setForm({ nome_completo: "", apelido: "", documento: "", cidade: "", telefone: "", categoria: "nenhum", conta_pagamento: "" });
    setEditingId(null);
    setShowForm(true);
  };
  const openEdit = (f: Fornecedor) => {
    setForm({
      nome_completo: f.nome_completo ?? "",
      apelido: f.apelido ?? "",
      documento: f.documento ?? "",
      cidade: f.cidade ?? "",
      telefone: f.telefone ?? "",
      categoria: (f.categoria ?? "nenhum").toLowerCase(),
      conta_pagamento: f.conta_pagamento ?? "",
    });
    setEditingId(f.id);
    setShowForm(true);
  };
  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const save = async () => {
    if (!form.nome_completo.trim()) {
      setToast({ type: "err", text: "Informe o nome." });
      return;
    }
    setSaving(true);
    setToast(null);
    try {
      const payload = {
        nome_completo: form.nome_completo.trim(),
        apelido: form.apelido.trim() || null,
        documento: form.documento.trim() || null,
        cidade: form.cidade.trim() || null,
        telefone: form.telefone.trim() || null,
        categoria: form.categoria,
        conta_pagamento: form.conta_pagamento.trim() || null,
      };
      if (editingId) {
        const { error } = await supabase
          .from("fornecedores_favoritos")
          .update({ ...payload, atualizado_em: new Date().toISOString() })
          .eq("id", editingId);
        if (error) throw error;
        setToast({ type: "ok", text: "Fornecedor atualizado." });
      } else {
        const { error } = await supabase.from("fornecedores_favoritos").insert({ ...payload, criado_em: new Date().toISOString() });
        if (error) throw error;
        setToast({ type: "ok", text: "Fornecedor criado." });
      }
      closeForm();
      fetchItems();
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
      const { error } = await supabase.from("fornecedores_favoritos").delete().eq("id", deleteId);
      if (error) throw error;
      setToast({ type: "ok", text: "Fornecedor excluído." });
      setDeleteId(null);
      fetchItems();
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao excluir." });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button onClick={fetchItems} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-3 py-2 text-sm inline-flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </button>
        <button onClick={openNew} className="text-slate-950 rounded-lg px-3 py-2 text-sm font-semibold inline-flex items-center gap-2" style={{ background: "#06b6d4" }}>
          <Plus className="h-4 w-4" /> Novo Fornecedor
        </button>
      </div>

      <Toast toast={toast} />

      {showForm && (
        <div className="rounded-2xl p-5 space-y-4" style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100">{editingId ? "Editar Fornecedor" : "Novo Fornecedor"}</h3>
            <button onClick={closeForm} className="text-slate-400 hover:text-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nome Completo *</label>
              <input className={inputCls} value={form.nome_completo} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Apelido</label>
              <input className={inputCls} value={form.apelido} onChange={(e) => setForm({ ...form, apelido: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Documento</label>
              <input className={inputCls} value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Cidade</label>
              <input className={inputCls} value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Telefone</label>
              <input className={inputCls} value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Categoria</label>
              <select className={inputCls + " cursor-pointer"} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                {FORNECEDOR_CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Conta de Pagamento</label>
              <input className={inputCls} value={form.conta_pagamento} onChange={(e) => setForm({ ...form, conta_pagamento: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={closeForm} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-4 py-2 text-sm">
              Cancelar
            </button>
            <button onClick={save} disabled={saving} className="text-slate-950 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: "#06b6d4" }}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400 py-10 text-center">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl p-10 text-center text-sm text-slate-400" style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
          Nenhum fornecedor cadastrado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <th className="px-3 py-2">Nome / Apelido</th>
                <th className="px-3 py-2">Documento</th>
                <th className="px-3 py-2">Cidade</th>
                <th className="px-3 py-2">Telefone</th>
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                  <td className="px-3 py-2">
                    <div className="text-slate-200 font-semibold">{f.nome_completo || "—"}</div>
                    {f.apelido && <div className="text-slate-400 text-[11px]">{f.apelido}</div>}
                  </td>
                  <td className="px-3 py-2 text-slate-300">{f.documento || "—"}</td>
                  <td className="px-3 py-2 text-slate-300">{f.cidade || "—"}</td>
                  <td className="px-3 py-2 text-slate-300">{f.telefone || "—"}</td>
                  <td className="px-3 py-2">
                    <FornecedorCatBadge cat={f.categoria} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(f)} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded px-2 py-1 text-[10px]">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button onClick={() => setDeleteId(f.id)} className="border border-red-900/50 bg-red-950/40 text-red-300 hover:bg-red-900/40 rounded px-2 py-1 text-[10px]">
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

      <DeleteModal
        open={!!deleteId}
        title="Excluir fornecedor"
        message="Tem certeza que deseja excluir este fornecedor? Esta ação não pode ser desfeita."
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        deleting={deleting}
      />
    </div>
  );
}