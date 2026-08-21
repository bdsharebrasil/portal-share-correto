import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Folder, FolderOpen, FileText, Plus, Pencil, Trash2, Eye, X,
  Calendar, AlertTriangle, CheckCircle2, Clock, Download, Loader2,
  Upload, ChevronDown, ChevronRight, FileCheck2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getFlightDocumentPublicUrl } from "@/lib/storageHelper";
import { DocumentViewer } from "@/components/DocumentViewer";

interface DocumentosAeronaveTabProps {
  aircraftId: string;
}

interface AircraftDocument {
  id: string;
  nome: string;
  descricao: string | null;
  caminho_arquivo: string;
  tipo_arquivo: string | null;
  tamanho_arquivo: number | null;
  tipo_documento: string | null;
  data_validade: string | null;
  dias_alerta: number | null;
  criado_em: string;
  enviado_por: string | null;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  certificado_matricula: "Certificado de Matrícula",
  certificado_aeronavegabilidade: "Certificado de Aeronavegabilidade",
  licenca_anatel: "Licença ANATEL",
  seguro_reta: "Seguro RETA",
  pesagem_balanceamento: "Peso e Balanceamento",
  inspecao_anual: "Inspeção Anual",
  manual_voo: "Manual de Voo",
  diario_bordo: "Diário de Bordo",
  outro: "Outros",
};

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type ExpiryStatus = "expired" | "warning" | "valid" | "none";

function getExpiryInfo(doc: AircraftDocument): {
  status: ExpiryStatus;
  label: string;
  daysLeft: number | null;
} {
  if (!doc.data_validade) return { status: "none", label: "Sem validade", daysLeft: null };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(doc.data_validade + "T00:00:00");
  const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const alertDays = doc.dias_alerta ?? 30;

  if (daysLeft < 0) return { status: "expired", label: "Vencido", daysLeft };
  if (daysLeft <= alertDays) return { status: "warning", label: `Vence em ${daysLeft}d`, daysLeft };
  return { status: "valid", label: `Válido até ${expiry.toLocaleDateString("pt-BR")}`, daysLeft };
}

const FOLDER_COLORS: Record<ExpiryStatus, { border: string; bg: string; icon: string; ring: string }> = {
  expired: {
    border: "border-red-500/50",
    bg: "bg-red-500/5",
    icon: "text-red-400",
    ring: "ring-2 ring-red-500/30",
  },
  warning: {
    border: "border-amber-500/50",
    bg: "bg-amber-500/5",
    icon: "text-amber-400",
    ring: "ring-2 ring-amber-500/30",
  },
  valid: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
    icon: "text-emerald-400",
    ring: "",
  },
  none: {
    border: "border-border/50",
    bg: "bg-card/30",
    icon: "text-muted-foreground",
    ring: "",
  },
};

const STATUS_BADGE: Record<ExpiryStatus, string> = {
  expired: "bg-red-500/15 text-red-400 border-red-500/30",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  valid: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  none: "bg-secondary/30 text-muted-foreground border-border/40",
};

function formatDate(v: string | null): string {
  if (!v) return "—";
  return new Date(v + (v.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR");
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function getFolderExpiryStatus(docs: AircraftDocument[]): ExpiryStatus {
  if (docs.length === 0) return "none";
  const statuses = docs.map((d) => getExpiryInfo(d).status);
  if (statuses.includes("expired")) return "expired";
  if (statuses.includes("warning")) return "warning";
  if (statuses.includes("valid")) return "valid";
  return "none";
}

export function DocumentosAeronaveTab({ aircraftId }: DocumentosAeronaveTabProps) {
  const [docs, setDocs] = useState<AircraftDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [previewDoc, setPreviewDoc] = useState<AircraftDocument | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<AircraftDocument | null>(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("documentos_voo")
      .select("*")
      .eq("aeronave_id", aircraftId)
      .order("criado_em", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar documentos: " + error.message);
    } else {
      setDocs((data ?? []) as AircraftDocument[]);
    }
    setLoading(false);
  }, [aircraftId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // Group documents by tipo_documento
  const grouped = useMemo(() => {
    const map = new Map<string, AircraftDocument[]>();
    for (const doc of docs) {
      const key = doc.tipo_documento || "outro";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(doc);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const labelA = DOCUMENT_TYPE_LABELS[a[0]] || a[0];
      const labelB = DOCUMENT_TYPE_LABELS[b[0]] || b[0];
      return labelA.localeCompare(labelB);
    });
  }, [docs]);

  // Auto-expand folders that have expired or warning docs
  useEffect(() => {
    const toExpand = new Set<string>();
    for (const [tipo, docsInGroup] of grouped) {
      const folderStatus = getFolderExpiryStatus(docsInGroup);
      if (folderStatus === "expired" || folderStatus === "warning") {
        toExpand.add(tipo);
      }
    }
    setExpandedFolders((prev) => new Set([...Array.from(prev), ...Array.from(toExpand)]));
  }, [grouped]);

  const toggleFolder = (key: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDelete = async (doc: AircraftDocument) => {
    if (!window.confirm(`Excluir "${doc.nome}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const { error: storageError } = await supabase.storage
        .from("flight-documents")
        .remove([doc.caminho_arquivo]);
      if (storageError) console.warn("Storage cleanup warning:", storageError.message);

      const { error: dbError } = await supabase
        .from("documentos_voo")
        .delete()
        .eq("id", doc.id);
      if (dbError) throw dbError;

      toast.success("Documento excluído");
      loadDocs();
    } catch (e: any) {
      toast.error("Erro ao excluir: " + (e.message || "desconhecido"));
    }
  };

  const handleDownload = async (doc: AircraftDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from("flight-documents")
        .download(doc.caminho_arquivo);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.nome;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error("Erro ao baixar: " + (e.message || "desconhecido"));
    }
  };

  const stats = useMemo(() => {
    let expired = 0, warning = 0, valid = 0, noExpiry = 0;
    for (const d of docs) {
      const s = getExpiryInfo(d).status;
      if (s === "expired") expired++;
      else if (s === "warning") warning++;
      else if (s === "valid") valid++;
      else noExpiry++;
    }
    return { total: docs.length, expired, warning, valid, noExpiry };
  }, [docs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="section-accent">
          <h2 className="text-lg font-semibold">Documentos da Aeronave</h2>
        </div>
        <button
          onClick={() => { setEditingDoc(null); setFormOpen(true); }}
          className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-cyan-400/35 bg-transparent px-4 py-1.5 text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-400/10"
        >
          <Plus className="h-4 w-4" /> Adicionar Documento
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatChip label="Total" value={stats.total} icon={FileText} color="text-muted-foreground" />
        <StatChip label="Vencidos" value={stats.expired} icon={AlertTriangle} color="text-red-400" />
        <StatChip label="Próximos" value={stats.warning} icon={Clock} color="text-amber-400" />
        <StatChip label="Válidos" value={stats.valid} icon={CheckCircle2} color="text-emerald-400" />
      </div>

      {/* Empty state */}
      {docs.length === 0 && !formOpen && (
        <div className="rounded-2xl border border-border/50 bg-card/40 p-12 text-center">
          <FolderOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground mb-4">Nenhum documento cadastrado para esta aeronave</p>
          <button
            onClick={() => { setEditingDoc(null); setFormOpen(true); }}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-cyan-400/35 bg-transparent px-4 py-1.5 text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-400/10"
          >
            <Plus className="h-4 w-4" /> Adicionar primeiro documento
          </button>
        </div>
      )}

      {/* Folders grouped by tipo_documento */}
      {grouped.length > 0 && (
        <div className="space-y-3">
          {grouped.map(([tipo, docsInGroup]) => {
            const folderStatus = getFolderExpiryStatus(docsInGroup);
            const colors = FOLDER_COLORS[folderStatus];
            const isExpanded = expandedFolders.has(tipo);
            const label = DOCUMENT_TYPE_LABELS[tipo] || tipo;

            return (
              <div
                key={tipo}
                className={cn(
                  "rounded-2xl border transition-all duration-300",
                  colors.border,
                  colors.bg,
                  folderStatus !== "none" && colors.ring,
                )}
              >
                {/* Folder header */}
                <button
                  onClick={() => toggleFolder(tipo)}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <div className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors",
                    colors.border,
                    colors.bg,
                  )}>
                    {isExpanded ? (
                      <FolderOpen className={cn("h-5 w-5", colors.icon)} />
                    ) : (
                      <Folder className={cn("h-5 w-5", colors.icon)} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-foreground capitalize">{label}</p>
                      <span className="rounded-full bg-card-secondary/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {docsInGroup.length} {docsInGroup.length === 1 ? "doc" : "docs"}
                      </span>
                      {folderStatus === "expired" && (
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", STATUS_BADGE.expired)}>
                          <AlertTriangle className="mr-1 inline h-3 w-3" />Vencido
                        </span>
                      )}
                      {folderStatus === "warning" && (
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", STATUS_BADGE.warning)}>
                          <Clock className="mr-1 inline h-3 w-3" />Próximo do vencimento
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {folderStatus === "expired" && "Há documentos vencidos que precisam de atenção"}
                      {folderStatus === "warning" && "Documentos próximos do vencimento"}
                      {folderStatus === "valid" && "Todos os documentos estão válidos"}
                      {folderStatus === "none" && "Documentos sem data de validade"}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                </button>

                {/* Documents list */}
                {isExpanded && (
                  <div className="space-y-2 px-4 pb-4">
                    {docsInGroup.map((doc) => {
                      const info = getExpiryInfo(doc);
                      const docColors = FOLDER_COLORS[info.status];
                      return (
                        <div
                          key={doc.id}
                          className={cn(
                            "group flex items-center gap-3 rounded-xl border p-3 transition-all duration-200",
                            docColors.border,
                            "bg-background/40 hover:bg-card/60",
                          )}
                        >
                          {/* File icon */}
                          <div className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
                            docColors.border, docColors.bg,
                          )}>
                            <FileText className={cn("h-4 w-4", docColors.icon)} />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{doc.nome}</p>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                              {doc.data_validade && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(doc.data_validade)}
                                </span>
                              )}
                              <span>{formatFileSize(doc.tamanho_arquivo)}</span>
                            </div>
                            {doc.descricao && (
                              <p className="truncate text-xs text-muted-foreground/70 mt-0.5 italic">{doc.descricao}</p>
                            )}
                          </div>

                          {/* Expiry badge */}
                          <span className={cn(
                            "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold whitespace-nowrap",
                            STATUS_BADGE[info.status],
                          )}>
                            {info.status === "expired" && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                            {info.status === "valid" && <CheckCircle2 className="mr-1 inline h-3 w-3" />}
                            {info.label}
                          </span>

                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setPreviewDoc(doc)}
                              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-card-secondary hover:text-primary"
                              title="Visualizar"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDownload(doc)}
                              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-card-secondary hover:text-primary"
                              title="Baixar"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => { setEditingDoc(doc); setFormOpen(true); }}
                              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-card-secondary hover:text-amber-400"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(doc)}
                              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-card-secondary hover:text-red-400"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload/Edit form */}
      {formOpen && (
        <DocumentForm
          aircraftId={aircraftId}
          editingDoc={editingDoc}
          onClose={() => { setFormOpen(false); setEditingDoc(null); }}
          onSaved={() => { setFormOpen(false); setEditingDoc(null); loadDocs(); }}
        />
      )}

      {/* Inline preview */}
      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
          onDownload={() => handleDownload(previewDoc)}
        />
      )}
    </div>
  );
}

// ── Stat Chip ─────────────────────────────────────────────────────────────────
function StatChip({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: typeof FileText; color: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-3 transition-all duration-300 hover:border-border/80 hover:bg-card/80">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", color)} />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className="mt-1 text-xl font-bold text-white tracking-tight">{value}</p>
    </div>
  );
}

// ── Document Form (Upload/Edit) ───────────────────────────────────────────────
function DocumentForm({ aircraftId, editingDoc, onClose, onSaved }: {
  aircraftId: string;
  editingDoc: AircraftDocument | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [nome, setNome] = useState(editingDoc?.nome ?? "");
  const [descricao, setDescricao] = useState(editingDoc?.descricao ?? "");
  const [tipoDocumento, setTipoDocumento] = useState(editingDoc?.tipo_documento ?? "");
  const [dataValidade, setDataValidade] = useState(editingDoc?.data_validade ?? "");
  const [diasAlerta, setDiasAlerta] = useState(String(editingDoc?.dias_alerta ?? 30));
  const [saving, setSaving] = useState(false);

  const isEditing = !!editingDoc;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      toast.error("Apenas PDF, JPG e PNG são permitidos");
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande. Máximo 10MB");
      return;
    }
    setFile(f);
    if (!nome) setNome(f.name.replace(/\.[^/.]+$/, ""));
  };

  const handleSubmit = async () => {
    if (!nome.trim()) {
      toast.error("Nome do documento é obrigatório");
      return;
    }
    if (!isEditing && !file) {
      toast.error("Selecione um arquivo");
      return;
    }

    setSaving(true);
    try {
      if (isEditing && editingDoc) {
        // Update metadata (optionally replace file)
        let caminhoArquivo = editingDoc.caminho_arquivo;
        let tipoArquivo = editingDoc.tipo_arquivo;
        let tamanhoArquivo = editingDoc.tamanho_arquivo;

        if (file) {
          // Remove old file
          await supabase.storage.from("flight-documents").remove([editingDoc.caminho_arquivo]);
          const ext = file.name.split(".").pop();
          const newFileName = `${aircraftId}/${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from("flight-documents").upload(newFileName, file);
          if (upErr) throw upErr;
          caminhoArquivo = newFileName;
          tipoArquivo = file.type;
          tamanhoArquivo = file.size;
        }

        const { error } = await supabase
          .from("documentos_voo")
          .update({
            nome: nome.trim(),
            descricao: descricao.trim() || null,
            tipo_documento: tipoDocumento.trim() || null,
            data_validade: dataValidade || null,
            dias_alerta: parseInt(diasAlerta) || 30,
            caminho_arquivo: caminhoArquivo,
            tipo_arquivo: tipoArquivo,
            tamanho_arquivo: tamanhoArquivo,
          })
          .eq("id", editingDoc.id);
        if (error) throw error;

        toast.success("Documento atualizado!");
      } else {
        // Insert new
        const ext = file!.name.split(".").pop();
        const fileName = `${aircraftId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("flight-documents").upload(fileName, file!);
        if (upErr) throw upErr;

        const { data: { user } } = await supabase.auth.getUser();

        const { error: dbErr } = await supabase.from("documentos_voo").insert({
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          caminho_arquivo: fileName,
          tipo_arquivo: file!.type,
          tamanho_arquivo: file!.size,
          enviado_por: user?.id ?? null,
          aeronave_id: aircraftId,
          tipo_documento: tipoDocumento.trim() || null,
          data_validade: dataValidade || null,
          dias_alerta: parseInt(diasAlerta) || 30,
        });
        if (dbErr) throw dbErr;

        toast.success("Documento adicionado!");
      }

      onSaved();
    } catch (e: any) {
      toast.error("Erro: " + (e.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full rounded-xl bg-background/80 border border-border/60 px-4 py-2.5 text-sm font-medium text-foreground outline-none transition-all duration-200 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-400 placeholder:text-muted-foreground shadow-inner";
  const labelCls = "block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md" style={{ background: "rgba(2,6,23,0.90)" }} onClick={onClose}>
      <div
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border/50 bg-card shadow-[0_0_50px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-card/80 px-6 py-5 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              {isEditing ? <Pencil className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
            </div>
            <div>
              <div className="text-base font-bold text-foreground tracking-wide">
                {isEditing ? "Editar Documento" : "Adicionar Documento"}
              </div>
              <div className="text-[11px] font-medium uppercase tracking-widest text-teal-500/70">
                {isEditing ? "Atualizar informações" : "Enviar novo arquivo"}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-red-500/15 hover:text-red-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-auto p-6 md:p-8 custom-scrollbar">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Tipo de documento */}
            <div className="md:col-span-2">
              <label className={labelCls}>Tipo de Documento</label>
              <select
                className={inputCls}
                value={tipoDocumento}
                onChange={(e) => setTipoDocumento(e.target.value)}
              >
                <option value="">Selecione um tipo...</option>
                {Object.entries(DOCUMENT_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Nome */}
            <div className="md:col-span-2">
              <label className={labelCls}>Nome do Documento *</label>
              <input
                className={inputCls}
                placeholder="Ex: Certificado de Aeronavegabilidade 2025"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>

            {/* Data de Validade */}
            <div>
              <label className={labelCls}>Data de Validade</label>
              <input
                type="date"
                className={inputCls}
                value={dataValidade}
                onChange={(e) => setDataValidade(e.target.value)}
              />
            </div>

            {/* Dias de Alerta */}
            <div>
              <label className={labelCls}>Alertar com quantos dias de antecedência?</label>
              <input
                type="number"
                min="1"
                max="365"
                className={inputCls}
                value={diasAlerta}
                onChange={(e) => setDiasAlerta(e.target.value)}
              />
            </div>

            {/* Descrição */}
            <div className="md:col-span-2">
              <label className={labelCls}>Observações</label>
              <textarea
                className={cn(inputCls, "min-h-16 resize-none")}
                placeholder="Informações adicionais sobre o documento"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>

            {/* File upload */}
            <div className="md:col-span-2">
              <label className={labelCls}>
                {isEditing ? "Substituir Arquivo (opcional)" : "Arquivo (PDF ou Imagem) *"}
              </label>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/jpg"
                onChange={handleFileChange}
                className={inputCls}
              />
              {file && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {file.name} ({formatFileSize(file.size)})
                </p>
              )}
              {isEditing && !file && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Arquivo atual: {editingDoc?.caminho_arquivo.split("/").pop()}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Formatos aceitos: PDF, JPG, PNG (Máx. 10MB)
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-ctm-teal px-5 py-2.5 text-sm font-bold text-[hsl(var(--ctm-navy))] transition-colors hover:bg-ctm-teal-light disabled:opacity-50"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
            ) : (
              <><FileCheck2 className="h-4 w-4" /> {isEditing ? "Salvar Alterações" : "Adicionar"}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Document Preview Modal ────────────────────────────────────────────────────
function DocumentPreviewModal({ doc, onClose, onDownload }: {
  doc: AircraftDocument;
  onClose: () => void;
  onDownload: () => void;
}) {
  const fileUrl = getFlightDocumentPublicUrl(doc.caminho_arquivo);
  const info = getExpiryInfo(doc);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md" style={{ background: "rgba(2,6,23,0.92)" }} onClick={onClose}>
      <div
        className="relative flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border/50 bg-card shadow-[0_0_60px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-border bg-card/80 px-6 py-4 backdrop-blur-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-bold text-foreground">{doc.nome}</p>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                {doc.tipo_documento && (
                  <span className="capitalize">{DOCUMENT_TYPE_LABELS[doc.tipo_documento] || doc.tipo_documento}</span>
                )}
                {doc.data_validade && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {formatDate(doc.data_validade)}
                  </span>
                )}
                <span className={cn("rounded-full border px-2 py-0.5 font-bold", STATUS_BADGE[info.status])}>
                  {info.label}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onDownload}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-card-secondary"
            >
              <Download className="h-4 w-4" /> Baixar
            </button>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-red-500/15 hover:text-red-400"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Preview content */}
        <div className="flex-1 overflow-auto bg-background/50 custom-scrollbar">
          {(() => {
            const path = (doc.caminho_arquivo || doc.nome || "").toLowerCase();
            const isPdf = doc.tipo_arquivo === "application/pdf" || path.endsWith(".pdf");
            const isImage = doc.tipo_arquivo?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/.test(path);

            if (isImage) {
              return (
                <div className="flex items-center justify-center p-6">
                  <img src={fileUrl} alt={doc.nome} className="max-w-full max-h-[70vh] rounded-lg" />
                </div>
              );
            }
            if (isPdf) {
              return (
                <div className="p-3">
                  <iframe
                    src={`${fileUrl}#toolbar=1&view=FitH`}
                    title={doc.nome}
                    className="h-[75vh] w-full rounded-xl border border-border bg-white"
                  />
                  <div className="mt-2 text-center">
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-teal-400 hover:underline"
                    >
                      Abrir em nova aba
                    </a>
                  </div>
                </div>
              );
            }
            return (
              <div className="flex h-full min-h-[300px] items-center justify-center p-8">
                <div className="text-center">
                  <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-4">Pré-visualização não disponível para este tipo de arquivo</p>
                  <button
                    onClick={onDownload}
                    className="inline-flex items-center gap-2 rounded-lg bg-ctm-teal px-4 py-2 text-sm font-semibold text-[hsl(var(--ctm-navy))]"
                  >
                    <Download className="h-4 w-4" /> Baixar arquivo
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

      </div>
    </div>
  );
}
