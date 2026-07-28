import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  Search,
  Wallet,
  FileText,
  CheckCircle2,
  Clock,
  DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";

/* ─────────────────────────── types ─────────────────────────── */

interface Prestador {
  id: string;
  nome: string | null;
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: string | null;
  pix: string | null;
  observacoes: string | null;
  ativo: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

interface NotaFiscal {
  id: string;
  prestador_id: string | null;
  numero_nota: string | null;
  valor: number | string | null;
  descricao: string | null;
  mes_referencia: number | null;
  ano_referencia: number | null;
  data_emissao: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string | null;
  arquivo_nota_url: string | null;
  comprovante_pagamento_url: string | null;
  controle_bancario_id: string | null;
  observacoes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

type SubTab = "prestadores" | "notas";

const MESES = [
  { value: 1, label: "Jan" }, { value: 2, label: "Fev" }, { value: 3, label: "Mar" },
  { value: 4, label: "Abr" }, { value: 5, label: "Mai" }, { value: 6, label: "Jun" },
  { value: 7, label: "Jul" }, { value: 8, label: "Ago" }, { value: 9, label: "Set" },
  { value: 10, label: "Out" }, { value: 11, label: "Nov" }, { value: 12, label: "Dez" },
];

/* ─────────────────────────── helpers ─────────────────────────── */

const num = (v: string | number | null | undefined) => Number(v) || 0;
const today = () => new Date().toISOString().slice(0, 10);

function StatusBadgeNF({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  if (s === "pago") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border"
        style={{ background: "rgba(34,197,94,0.10)", color: "#4ade80", borderColor: "rgba(34,197,94,0.25)" }}>
        <CheckCircle2 className="h-3 w-3 mr-1" /> Pago
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

export default function PrestadoresPJTab() {
  const [sub, setSub] = useState<SubTab>("prestadores");
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-100">Prestadores PJ</h2>
        <p className="text-xs text-slate-400">Cadastro de prestadores de serviço e notas fiscais.</p>
      </div>
      {/* sub-tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setSub("prestadores")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 ${
            sub === "prestadores"
              ? "text-slate-950"
              : "border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800"
          }`}
          style={sub === "prestadores" ? { background: "#06b6d4" } : undefined}
        >
          <Wallet className="h-4 w-4" /> Cadastro de Prestadores
        </button>
        <button
          onClick={() => setSub("notas")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 ${
            sub === "notas"
              ? "text-slate-950"
              : "border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800"
          }`}
          style={sub === "notas" ? { background: "#06b6d4" } : undefined}
        >
          <FileText className="h-4 w-4" /> Notas Fiscais
        </button>
      </div>
      {sub === "prestadores" ? <PrestadoresPanel /> : <NotasPanel />}
    </div>
  );
}

/* ─────────────────────────── prestadores panel ─────────────────────────── */

function PrestadoresPanel() {
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    nome: "", cpf_cnpj: "", email: "", telefone: "", endereco: "", cidade: "", uf: "",
    banco: "", agencia: "", conta: "", tipo_conta: "corrente", pix: "", observacoes: "", ativo: true,
  });

  const fetchP = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("prestadores_servico")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPrestadores((data ?? []) as Prestador[]);
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao carregar prestadores." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchP(); }, [fetchP]);

  const openNew = () => {
    setForm({ nome: "", cpf_cnpj: "", email: "", telefone: "", endereco: "", cidade: "", uf: "",
      banco: "", agencia: "", conta: "", tipo_conta: "corrente", pix: "", observacoes: "", ativo: true });
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (p: Prestador) => {
    setForm({
      nome: p.nome ?? "", cpf_cnpj: p.cpf_cnpj ?? "", email: p.email ?? "", telefone: p.telefone ?? "",
      endereco: p.endereco ?? "", cidade: p.cidade ?? "", uf: p.uf ?? "", banco: p.banco ?? "",
      agencia: p.agencia ?? "", conta: p.conta ?? "", tipo_conta: p.tipo_conta ?? "corrente",
      pix: p.pix ?? "", observacoes: p.observacoes ?? "", ativo: p.ativo ?? true,
    });
    setEditingId(p.id);
    setShowModal(true);
  };

  const save = async () => {
    if (!form.nome.trim()) { setToast({ type: "err", text: "Informe o nome." }); return; }
    setSaving(true); setToast(null);
    try {
      const payload = {
        nome: form.nome.trim(), cpf_cnpj: form.cpf_cnpj.trim() || null,
        email: form.email.trim() || null, telefone: form.telefone.trim() || null,
        endereco: form.endereco.trim() || null, cidade: form.cidade.trim() || null,
        uf: form.uf.trim() || null, banco: form.banco.trim() || null,
        agencia: form.agencia.trim() || null, conta: form.conta.trim() || null,
        tipo_conta: form.tipo_conta, pix: form.pix.trim() || null,
        observacoes: form.observacoes.trim() || null, ativo: form.ativo,
      };
      if (editingId) {
        const { error } = await supabase.from("prestadores_servico")
          .update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editingId);
        if (error) throw error;
        setToast({ type: "ok", text: "Prestador atualizado." });
      } else {
        const { error } = await supabase.from("prestadores_servico").insert(payload);
        if (error) throw error;
        setToast({ type: "ok", text: "Prestador criado." });
      }
      setShowModal(false); fetchP();
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao salvar." });
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("prestadores_servico").delete().eq("id", deleteId);
      if (error) throw error;
      setToast({ type: "ok", text: "Prestador excluído." });
      setDeleteId(null); fetchP();
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao excluir." });
    } finally { setDeleting(false); }
  };

  const inputCls = "border border-slate-700 bg-slate-950/70 text-slate-100 placeholder:text-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400 w-full";
  const labelCls = "block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1";

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button onClick={fetchP} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-3 py-2 text-sm inline-flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </button>
        <button onClick={openNew} className="text-slate-950 rounded-lg px-3 py-2 text-sm font-semibold inline-flex items-center gap-2" style={{ background: "#06b6d4" }}>
          <Plus className="h-4 w-4" /> Novo Prestador
        </button>
      </div>

      {toast && (
        <div className="rounded-lg px-4 py-2 text-sm border"
          style={{ background: toast.type === "ok" ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
            color: toast.type === "ok" ? "#4ade80" : "#f87171",
            borderColor: toast.type === "ok" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)" }}>
          {toast.text}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400 py-10 text-center">Carregando...</div>
      ) : prestadores.length === 0 ? (
        <div className="rounded-2xl p-10 text-center text-sm text-slate-400"
          style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
          Nenhum prestador cadastrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {prestadores.map((p) => (
            <div key={p.id} className="rounded-2xl p-4 space-y-2"
              style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-100 truncate">{p.nome || "—"}</div>
                  <div className="text-xs text-slate-400 truncate">{p.cpf_cnpj || "Sem documento"}</div>
                </div>
                {p.ativo === false && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border"
                    style={{ background: "rgba(100,116,139,0.10)", color: "#94a3b8", borderColor: "rgba(100,116,139,0.25)" }}>
                    Inativo
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-300 space-y-0.5">
                {p.email && <div>{p.email}</div>}
                {p.telefone && <div>{p.telefone}</div>}
                {p.cidade && <div>{p.cidade}{p.uf ? ` - ${p.uf}` : ""}</div>}
              </div>
              {p.banco && (
                <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-1.5">
                  Banco: <span className="text-slate-200">{p.banco}</span>
                  {p.conta && <span> · Conta: {p.conta}</span>}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1 border-t border-slate-800">
                <button onClick={() => openEdit(p)} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-2.5 py-1.5 text-xs inline-flex items-center gap-1">
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </button>
                <button onClick={() => setDeleteId(p.id)} className="border border-red-900/50 bg-red-950/40 text-red-300 hover:bg-red-900/40 rounded-lg px-2.5 py-1.5 text-xs inline-flex items-center gap-1">
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full mx-4 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-100">{editingId ? "Editar Prestador" : "Novo Prestador"}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2"><label className={labelCls}>Nome *</label>
                <input className={inputCls} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div><label className={labelCls}>CPF/CNPJ</label>
                <input className={inputCls} value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} /></div>
              <div><label className={labelCls}>Telefone</label>
                <input className={inputCls} value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
              <div className="md:col-span-2"><label className={labelCls}>E-mail</label>
                <input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="md:col-span-2"><label className={labelCls}>Endereço</label>
                <input className={inputCls} value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} /></div>
              <div><label className={labelCls}>Cidade</label>
                <input className={inputCls} value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
              <div><label className={labelCls}>UF</label>
                <input className={inputCls} maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })} /></div>
              <div><label className={labelCls}>Banco</label>
                <input className={inputCls} value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} /></div>
              <div><label className={labelCls}>Agência</label>
                <input className={inputCls} value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} /></div>
              <div><label className={labelCls}>Conta</label>
                <input className={inputCls} value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} /></div>
              <div><label className={labelCls}>Tipo de Conta</label>
                <select className={inputCls + " cursor-pointer"} value={form.tipo_conta} onChange={(e) => setForm({ ...form, tipo_conta: e.target.value })}>
                  <option value="corrente">Corrente</option>
                  <option value="poupanca">Poupança</option>
                  <option value="investimento">Investimento</option>
                </select></div>
              <div className="md:col-span-2"><label className={labelCls}>PIX</label>
                <input className={inputCls} value={form.pix} onChange={(e) => setForm({ ...form, pix: e.target.value })} /></div>
              <div className="md:col-span-2"><label className={labelCls}>Observações</label>
                <textarea className={inputCls} rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
              <div className="md:col-span-2 flex items-center gap-2">
                <input id="ativo" type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} className="h-4 w-4 accent-cyan-400" />
                <label htmlFor="ativo" className="text-sm text-slate-200">Ativo</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowModal(false)} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-4 py-2 text-sm">Cancelar</button>
              <button onClick={save} disabled={saving} className="text-slate-950 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: "#06b6d4" }}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* delete modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-950/50 flex items-center justify-center"><Trash2 className="h-5 w-5 text-red-400" /></div>
              <h3 className="text-base font-bold text-slate-100">Excluir prestador</h3>
            </div>
            <p className="text-sm text-slate-300">Tem certeza que deseja excluir este prestador? Esta ação não pode ser desfeita.</p>
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

/* ─────────────────────────── notas panel ─────────────────────────── */

function NotasPanel() {
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const now = new Date();
  const [fMes, setFMes] = useState<string>("");
  const [fAno, setFAno] = useState<string>("");
  const [fPrestador, setFPrestador] = useState<string>("");
  const [fStatus, setFStatus] = useState<string>("");

  const [form, setForm] = useState({
    prestador_id: "", numero_nota: "", valor: "", descricao: "", mes_referencia: String(now.getMonth() + 1),
    ano_referencia: String(now.getFullYear()), data_emissao: today(), data_vencimento: "",
    data_pagamento: "", status: "pendente", observacoes: "", arquivo_nota_url: "", comprovante_pagamento_url: "",
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [n, p] = await Promise.all([
        supabase.from("prestador_notas_fiscais").select("*").order("data_emissao", { ascending: false }),
        supabase.from("prestadores_servico").select("*").order("nome", { ascending: true }),
      ]);
      if (n.error) throw n.error;
      if (p.error) throw p.error;
      setNotas((n.data ?? []) as NotaFiscal[]);
      setPrestadores((p.data ?? []) as Prestador[]);
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao carregar notas." });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const prestadorNome = (id: string | null) =>
    prestadores.find((p) => p.id === id)?.nome || "—";

  const filtered = useMemo(() => {
    let list = notas;
    if (fMes) list = list.filter((n) => String(n.mes_referencia) === fMes);
    if (fAno) list = list.filter((n) => String(n.ano_referencia) === fAno);
    if (fPrestador) list = list.filter((n) => n.prestador_id === fPrestador);
    if (fStatus) list = list.filter((n) => (n.status ?? "").toLowerCase() === fStatus);
    return list;
  }, [notas, fMes, fAno, fPrestador, fStatus]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const pendentes = filtered.filter((n) => (n.status ?? "").toLowerCase() !== "pago").length;
    const pagos = total - pendentes;
    const valorTotal = filtered.reduce((s, n) => s + num(n.valor), 0);
    return { total, pendentes, pagos, valorTotal };
  }, [filtered]);

  const openNew = () => {
    setForm({ prestador_id: "", numero_nota: "", valor: "", descricao: "", mes_referencia: String(now.getMonth() + 1),
      ano_referencia: String(now.getFullYear()), data_emissao: today(), data_vencimento: "",
      data_pagamento: "", status: "pendente", observacoes: "", arquivo_nota_url: "", comprovante_pagamento_url: "" });
    setEditingId(null); setShowModal(true);
  };

  const openEdit = (n: NotaFiscal) => {
    setForm({
      prestador_id: n.prestador_id ?? "", numero_nota: n.numero_nota ?? "",
      valor: n.valor != null ? String(n.valor) : "", descricao: n.descricao ?? "",
      mes_referencia: n.mes_referencia != null ? String(n.mes_referencia) : "",
      ano_referencia: n.ano_referencia != null ? String(n.ano_referencia) : "",
      data_emissao: n.data_emissao ?? "", data_vencimento: n.data_vencimento ?? "",
      data_pagamento: n.data_pagamento ?? "", status: n.status ?? "pendente",
      observacoes: n.observacoes ?? "", arquivo_nota_url: n.arquivo_nota_url ?? "",
      comprovante_pagamento_url: n.comprovante_pagamento_url ?? "",
    });
    setEditingId(n.id); setShowModal(true);
  };

  const save = async () => {
    if (!form.prestador_id) { setToast({ type: "err", text: "Selecione o prestador." }); return; }
    setSaving(true); setToast(null);
    try {
      const payload = {
        prestador_id: form.prestador_id, numero_nota: form.numero_nota.trim() || null,
        valor: form.valor ? Number(form.valor) : 0, descricao: form.descricao.trim() || null,
        mes_referencia: Number(form.mes_referencia) || null,
        ano_referencia: Number(form.ano_referencia) || null,
        data_emissao: form.data_emissao || null, data_vencimento: form.data_vencimento || null,
        data_pagamento: form.status === "pago" ? (form.data_pagamento || today()) : null,
        status: form.status, observacoes: form.observacoes.trim() || null,
        arquivo_nota_url: form.arquivo_nota_url.trim() || null,
        comprovante_pagamento_url: form.comprovante_pagamento_url.trim() || null,
      };
      if (editingId) {
        const { error } = await supabase.from("prestador_notas_fiscais")
          .update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editingId);
        if (error) throw error;
        setToast({ type: "ok", text: "Nota fiscal atualizada." });
      } else {
        const { error } = await supabase.from("prestador_notas_fiscais").insert(payload);
        if (error) throw error;
        setToast({ type: "ok", text: "Nota fiscal criada." });
      }
      setShowModal(false); fetchAll();
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao salvar." });
    } finally { setSaving(false); }
  };

  const pagar = async (n: NotaFiscal) => {
    setPayingId(n.id); setToast(null);
    try {
      const { error } = await supabase.from("prestador_notas_fiscais")
        .update({ status: "pago", data_pagamento: today(), updated_at: new Date().toISOString() }).eq("id", n.id);
      if (error) throw error;
      setToast({ type: "ok", text: "Nota marcada como paga." });
      fetchAll();
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao pagar." });
    } finally { setPayingId(null); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("prestador_notas_fiscais").delete().eq("id", deleteId);
      if (error) throw error;
      setToast({ type: "ok", text: "Nota fiscal excluída." });
      setDeleteId(null); fetchAll();
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao excluir." });
    } finally { setDeleting(false); }
  };

  const inputCls = "border border-slate-700 bg-slate-950/70 text-slate-100 placeholder:text-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400 w-full";
  const labelCls = "block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1";
  const anos = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-4">
      {/* summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Notas", value: String(summary.total), icon: FileText, color: "#38bdf8" },
          { label: "Pendentes", value: String(summary.pendentes), icon: Clock, color: "#fbbf24" },
          { label: "Pagos", value: String(summary.pagos), icon: CheckCircle2, color: "#4ade80" },
          { label: "Total Período", value: formatBRL(summary.valorTotal), icon: DollarSign, color: "#22d3ee" },
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

      {/* toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        <div><label className={labelCls}>Mês</label>
          <select className={inputCls + " cursor-pointer"} value={fMes} onChange={(e) => setFMes(e.target.value)}>
            <option value="">Todos</option>
            {MESES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select></div>
        <div><label className={labelCls}>Ano</label>
          <select className={inputCls + " cursor-pointer"} value={fAno} onChange={(e) => setFAno(e.target.value)}>
            <option value="">Todos</option>
            {anos.map((y) => <option key={y} value={y}>{y}</option>)}
          </select></div>
        <div><label className={labelCls}>Prestador</label>
          <select className={inputCls + " cursor-pointer"} value={fPrestador} onChange={(e) => setFPrestador(e.target.value)}>
            <option value="">Todos</option>
            {prestadores.map((p) => <option key={p.id} value={p.id}>{p.nome || "—"}</option>)}
          </select></div>
        <div><label className={labelCls}>Status</label>
          <select className={inputCls + " cursor-pointer"} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
          </select></div>
        <div className="flex-1 min-w-[180px]"><label className={labelCls}>Buscar</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <input className={inputCls + " pl-8"} placeholder="Número, descrição..." onChange={() => {}} />
          </div></div>
        <button onClick={openNew} className="text-slate-950 rounded-lg px-3 py-2 text-sm font-semibold inline-flex items-center gap-2" style={{ background: "#06b6d4" }}>
          <Plus className="h-4 w-4" /> Nova Nota
        </button>
      </div>

      {toast && (
        <div className="rounded-lg px-4 py-2 text-sm border"
          style={{ background: toast.type === "ok" ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
            color: toast.type === "ok" ? "#4ade80" : "#f87171",
            borderColor: toast.type === "ok" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)" }}>
          {toast.text}
        </div>
      )}

      {/* table */}
      {loading ? (
        <div className="text-sm text-slate-400 py-10 text-center">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-10 text-center text-sm text-slate-400"
          style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
          Nenhuma nota fiscal encontrada.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <th className="px-3 py-2">Número</th>
                <th className="px-3 py-2">Prestador</th>
                <th className="px-3 py-2">Descrição</th>
                <th className="px-3 py-2">Referência</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2">Vencimento</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((n) => (
                <tr key={n.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                  <td className="px-3 py-2 text-slate-200">{n.numero_nota || "—"}</td>
                  <td className="px-3 py-2 text-slate-200">{prestadorNome(n.prestador_id)}</td>
                  <td className="px-3 py-2 text-slate-300 max-w-[200px] truncate">{n.descricao || "—"}</td>
                  <td className="px-3 py-2 text-slate-400">
                    {n.mes_referencia ? `${String(n.mes_referencia).padStart(2, "0")}/${n.ano_referencia ?? ""}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-cyan-300">{formatBRL(num(n.valor))}</td>
                  <td className="px-3 py-2 text-slate-300">{n.data_vencimento || "—"}</td>
                  <td className="px-3 py-2"><StatusBadgeNF status={n.status} /></td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      {(n.status ?? "").toLowerCase() !== "pago" && (
                        <button onClick={() => pagar(n)} disabled={payingId === n.id}
                          className="border border-emerald-900/50 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/40 rounded px-2 py-1 text-[10px] font-semibold disabled:opacity-50">
                          {payingId === n.id ? "..." : "Pagar"}
                        </button>
                      )}
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

      {/* modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full mx-4 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-100">{editingId ? "Editar Nota Fiscal" : "Nova Nota Fiscal"}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2"><label className={labelCls}>Prestador *</label>
                <select className={inputCls + " cursor-pointer"} value={form.prestador_id} onChange={(e) => setForm({ ...form, prestador_id: e.target.value })}>
                  <option value="">Selecione</option>
                  {prestadores.map((p) => <option key={p.id} value={p.id}>{p.nome || "—"}</option>)}
                </select></div>
              <div><label className={labelCls}>Número da Nota</label>
                <input className={inputCls} value={form.numero_nota} onChange={(e) => setForm({ ...form, numero_nota: e.target.value })} /></div>
              <div><label className={labelCls}>Valor (R$)</label>
                <input type="number" step="0.01" className={inputCls} value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
              <div className="md:col-span-2"><label className={labelCls}>Descrição</label>
                <input className={inputCls} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
              <div><label className={labelCls}>Mês Referência</label>
                <select className={inputCls + " cursor-pointer"} value={form.mes_referencia} onChange={(e) => setForm({ ...form, mes_referencia: e.target.value })}>
                  {MESES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select></div>
              <div><label className={labelCls}>Ano Referência</label>
                <input type="number" className={inputCls} value={form.ano_referencia} onChange={(e) => setForm({ ...form, ano_referencia: e.target.value })} /></div>
              <div><label className={labelCls}>Data Emissão</label>
                <input type="date" className={inputCls} value={form.data_emissao} onChange={(e) => setForm({ ...form, data_emissao: e.target.value })} /></div>
              <div><label className={labelCls}>Data Vencimento</label>
                <input type="date" className={inputCls} value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} /></div>
              <div><label className={labelCls}>Status</label>
                <select className={inputCls + " cursor-pointer"} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                </select></div>
              <div><label className={labelCls}>Data Pagamento</label>
                <input type="date" className={inputCls} value={form.data_pagamento} onChange={(e) => setForm({ ...form, data_pagamento: e.target.value })} /></div>
              <div className="md:col-span-2"><label className={labelCls}>URL Arquivo Nota</label>
                <input className={inputCls} value={form.arquivo_nota_url} onChange={(e) => setForm({ ...form, arquivo_nota_url: e.target.value })} /></div>
              <div className="md:col-span-2"><label className={labelCls}>URL Comprovante</label>
                <input className={inputCls} value={form.comprovante_pagamento_url} onChange={(e) => setForm({ ...form, comprovante_pagamento_url: e.target.value })} /></div>
              <div className="md:col-span-2"><label className={labelCls}>Observações</label>
                <textarea className={inputCls} rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowModal(false)} className="border border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 rounded-lg px-4 py-2 text-sm">Cancelar</button>
              <button onClick={save} disabled={saving} className="text-slate-950 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: "#06b6d4" }}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
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
