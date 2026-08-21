import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { useManualTutoriais, useCreateManualTutorial, useUpdateManualTutorial, useDeleteManualTutorial, type ManualTutorial } from "@/hooks/useManualTutoriais";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { BookOpen, Search, Plus, Pencil, Trash2, Video, ChevronDown, ChevronUp, PlayCircle, FolderOpen } from "lucide-react";
import { toast } from "sonner";

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function getEmbedUrl(url: string): string | null {
  const ytId = extractYouTubeId(url);
  if (ytId) return `https://www.youtube.com/embed/${ytId}`;
  if (url.includes("vimeo.com")) {
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }
  return null;
}

export default function ManualSistema() {
  const { data: tutoriais = [], isLoading } = useManualTutoriais();
  const { isAdmin } = useUserRole();
  const createMut = useCreateManualTutorial();
  const updateMut = useUpdateManualTutorial();
  const deleteMut = useDeleteManualTutorial();

  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ManualTutorial | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManualTutorial | null>(null);

  const [form, setForm] = useState({ titulo: "", descricao: "", video_url: "", categoria: "Geral", ordem: 0 });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return tutoriais;
    return tutoriais.filter((t) =>
      t.titulo.toLowerCase().includes(s) ||
      t.descricao.toLowerCase().includes(s) ||
      t.categoria.toLowerCase().includes(s)
    );
  }, [tutoriais, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, ManualTutorial[]>();
    filtered.forEach((t) => {
      const arr = map.get(t.categoria) || [];
      arr.push(t);
      map.set(t.categoria, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const openCreate = () => {
    setEditing(null);
    setForm({ titulo: "", descricao: "", video_url: "", categoria: "Geral", ordem: 0 });
    setDialogOpen(true);
  };

  const openEdit = (t: ManualTutorial) => {
    setEditing(t);
    setForm({ titulo: t.titulo, descricao: t.descricao, video_url: t.video_url || "", categoria: t.categoria, ordem: t.ordem });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.titulo.trim() || !form.descricao.trim()) {
      toast.error("Preencha título e descrição");
      return;
    }
    const payload = {
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim(),
      video_url: form.video_url.trim() || null,
      categoria: form.categoria.trim() || "Geral",
      ordem: Number(form.ordem) || 0,
    };
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, ...payload });
        toast.success("Tutorial atualizado");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Tutorial criado");
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar tutorial");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      toast.success("Tutorial removido");
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover tutorial");
    }
  };

  return (
    <Layout>
      <div className="space-y-6 px-2">
        {/* Header */}
        <header className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/20 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold text-xl text-foreground leading-tight">Manual do Sistema</h1>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Tutoriais e guias de uso
            </span>
          </div>
        </header>

        {/* Search + Admin button */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar tutorial... ex: como emitir um recibo"
              className="pl-9"
            />
          </div>
          {isAdmin && (
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Tutorial
            </Button>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="bg-card/50 animate-pulse h-48" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="bg-card/50">
            <CardContent className="p-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">
                {search
                  ? "Nenhum tutorial encontrado para sua busca."
                  : "Nenhum tutorial cadastrado ainda."}
              </p>
              {isAdmin && !search && (
                <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  Criar primeiro tutorial
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {grouped.map(([categoria, items]) => (
              <div key={categoria}>
                <div className="flex items-center gap-2 mb-3">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">{categoria}</h2>
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                  <div className="h-px bg-border flex-1" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((t) => {
                    const expanded = expandedId === t.id;
                    const embedUrl = t.video_url ? getEmbedUrl(t.video_url) : null;
                    return (
                      <Card
                        key={t.id}
                        className="bg-card/60 border-border/60 hover:border-primary/30 transition-all duration-200 overflow-hidden flex flex-col"
                      >
                        {/* Video thumbnail or icon */}
                        {embedUrl && expanded ? (
                          <div className="aspect-video bg-black">
                            <iframe
                              src={embedUrl}
                              title={t.titulo}
                              className="w-full h-full"
                              allowFullScreen
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            />
                          </div>
                        ) : (
                          <div
                            className="aspect-video bg-gradient-to-br from-primary/10 to-muted/20 flex items-center justify-center cursor-pointer relative group"
                            onClick={() => setExpandedId(expanded ? null : t.id)}
                          >
                            {embedUrl ? (
                              <PlayCircle className="h-12 w-12 text-primary/60 group-hover:text-primary group-hover:scale-110 transition-all" />
                            ) : (
                              <BookOpen className="h-10 w-10 text-muted-foreground/40" />
                            )}
                          </div>
                        )}

                        <CardContent className="p-4 flex flex-col gap-3 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-sm text-foreground leading-snug">{t.titulo}</h3>
                            {isAdmin && (
                              <div className="flex gap-1 shrink-0">
                                <button
                                  onClick={() => openEdit(t)}
                                  className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                  title="Editar"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(t)}
                                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          <p className={`text-xs text-muted-foreground ${expanded ? "" : "line-clamp-3"}`}>
                            {t.descricao}
                          </p>

                          <div className="flex items-center justify-between mt-auto pt-2">
                            {t.video_url && (
                              <a
                                href={t.video_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <Video className="h-3.5 w-3.5" />
                                Abrir vídeo
                              </a>
                            )}
                            <button
                              onClick={() => setExpandedId(expanded ? null : t.id)}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
                            >
                              {expanded ? (
                                <>Recolher <ChevronUp className="h-3.5 w-3.5" /></>
                              ) : (
                                <>Expandir <ChevronDown className="h-3.5 w-3.5" /></>
                              )}
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Tutorial" : "Novo Tutorial"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">Título</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ex: Como emitir um recibo"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Descrição / Passo a passo</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Descreva o passo a passo de como realizar a ação..."
                className="mt-1 min-h-[120px]"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">URL do vídeo (opcional)</Label>
              <Input
                value={form.video_url}
                onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                placeholder="https://youtube.com/watch?v=..."
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Suporta YouTube e Vimeo. O vídeo será incorporado no tutorial.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Categoria</Label>
                <Input
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  placeholder="Ex: Financeiro, Operações"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Ordem</Label>
                <Input
                  type="number"
                  value={form.ordem}
                  onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tutorial?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteTarget?.titulo}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
