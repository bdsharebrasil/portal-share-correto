import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Inbox,
  Mail,
  MailOpen,
  Send as SendIcon,
  Star,
  Archive,
  Trash2,
  Folder as FolderIcon,
  FolderPlus,
  Search,
  Paperclip,
  PenSquare,
  FileText,
  Image as ImageIcon,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  Forward,
  AlertOctagon,
} from "lucide-react";
import ComposeMessage from "@/components/mensagens/ComposeMessage";
import AttachmentViewerModal from "@/components/dashboard/gestor/financeiro-share/AttachmentViewerModal";
import {
  useMensagens,
  filterMailbox,
  initials,
  type MailItem,
  type MailboxView,
} from "@/hooks/useMensagens";

export default function Mensagens() {
  const {
    meId,
    profiles,
    folders,
    items,
    loading,
    reload,
    reloadFolders,
    updateMyRow,
    updateSent,
  } = useMensagens();

  const [view, setView] = useState<MailboxView>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ to: string[]; subject: string; body?: string } | null>(null);
  const [viewer, setViewer] = useState<{ url: string; title: string } | null>(null);
  const [inlineImages, setInlineImages] = useState<Record<string, string>>({});

  const list = useMemo(() => {
    const base = filterMailbox(items, view);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (i) =>
        i.message.subject.toLowerCase().includes(q) ||
        i.message.body.toLowerCase().includes(q) ||
        (i.sender?.full_name || "").toLowerCase().includes(q)
    );
  }, [items, view, search]);

  const selected = list.find((i) => i.message.id === selectedId) || null;

  const unreadCount = items.filter((i) => i.myRow && !i.myRow.is_read && !i.myRow.is_deleted).length;

  const openMessage = (item: MailItem) => {
    setSelectedId(item.message.id);
    if (item.myRow && !item.myRow.is_read) {
      updateMyRow(item, { is_read: true, read_at: new Date().toISOString() } as any);
    }
  };

  // Pré-carrega preview inline das imagens anexadas na mensagem aberta
  useEffect(() => {
    if (!selected) return;
    const imageAttachments = selected.attachments.filter((a) => a.file_type?.startsWith("image/"));
    imageAttachments.forEach(async (a) => {
      if (inlineImages[a.id]) return;
      const { data } = await supabase.storage.from("message-attachments").createSignedUrl(a.file_path, 3600);
      if (data?.signedUrl) {
        setInlineImages((prev) => ({ ...prev, [a.id]: data.signedUrl }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.message.id]);

  const openAttachment = async (path: string, name: string) => {
    const { data, error } = await supabase.storage
      .from("message-attachments")
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return toast.error("Não foi possível abrir o anexo");
    setViewer({ url: data.signedUrl, title: name });
  };

  const createFolder = async () => {
    const name = window.prompt("Nome da pasta");
    if (!name?.trim() || !meId) return;
    const { error } = await (supabase as any)
      .from("message_folders")
      .insert({ user_id: meId, name: name.trim() });
    if (error) return toast.error("Erro ao criar pasta");
    toast.success("Pasta criada");
    reloadFolders();
  };

  const moveToFolder = async (item: MailItem, folderId: string | null) => {
    await updateMyRow(item, { folder_id: folderId, is_archived: false } as any);
    toast.success(folderId ? "Movido para a pasta" : "Removido da pasta");
  };

  const navItems: { key: MailboxView; label: string; icon: any; badge?: number }[] = [
    { key: "inbox", label: "Caixa de entrada", icon: Inbox },
    { key: "unread", label: "Não lidas", icon: Mail, badge: unreadCount },
    { key: "starred", label: "Favoritas", icon: Star },
    { key: "sent", label: "Enviadas", icon: SendIcon },
    { key: "archived", label: "Arquivadas", icon: Archive },
    { key: "trash", label: "Lixeira", icon: Trash2 },
  ];

  const handleReply = () => {
    if (!selected) return;
    setReplyTo({
      to: [selected.message.sender_id],
      subject: selected.message.subject.startsWith("Re:")
        ? selected.message.subject
        : `Re: ${selected.message.subject}`,
    });
    setComposeOpen(true);
  };

  const handleForward = () => {
    if (!selected) return;
    setReplyTo({
      to: [],
      subject: selected.message.subject.startsWith("Fwd:")
        ? selected.message.subject
        : `Fwd: ${selected.message.subject}`,
      body: `\n\n---------- Mensagem encaminhada ----------\nDe: ${selected.sender?.full_name || "Usuário"}\nData: ${format(
        new Date(selected.message.created_at),
        "dd/MM/yyyy 'às' HH:mm"
      )}\nAssunto: ${selected.message.subject}\n\n${selected.message.body}`,
    });
    setComposeOpen(true);
  };

  return (
    <Layout>
      <div className="relative min-h-[calc(100vh-73px)] overflow-hidden">
        <div className="pointer-events-none absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-primary/20 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 right-10 h-64 w-64 rounded-full bg-accent/20 blur-[120px]" />

        <div className="relative p-4 md:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
                <span className="rounded-xl bg-primary/15 p-2 ring-1 ring-primary/25">
                  <Mail className="h-5 w-5 text-primary" />
                </span>
                Mensagens
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Comunicação interna privada entre os usuários do sistema
              </p>
            </div>
            <Button
              onClick={() => {
                setReplyTo(null);
                setComposeOpen(true);
              }}
              className="shadow-lg shadow-primary/25"
            >
              <PenSquare className="mr-2 h-4 w-4" /> Nova mensagem
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_360px_1fr]">
            {/* Pastas */}
            <aside className="portal-card p-3">
              <nav className="space-y-1">
                {navItems.map((n) => {
                  const active = view === n.key;
                  return (
                    <button
                      key={n.key}
                      onClick={() => {
                        setView(n.key);
                        setSelectedId(null);
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all ${
                        active
                          ? "bg-primary/15 font-semibold text-foreground ring-1 ring-primary/30"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      <n.icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                      <span className="flex-1 text-left">{n.label}</span>
                      {!!n.badge && (
                        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                          {n.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="mt-4 border-t border-border/60 pt-3">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="portal-section-label">Pastas</span>
                  <button onClick={createFolder} className="text-muted-foreground hover:text-primary">
                    <FolderPlus className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  {folders.length === 0 && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma pasta ainda</p>
                  )}
                  {folders.map((f) => {
                    const key = `folder:${f.id}`;
                    const active = view === key;
                    return (
                      <button
                        key={f.id}
                        onClick={() => {
                          setView(key);
                          setSelectedId(null);
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all ${
                          active
                            ? "bg-primary/15 font-semibold text-foreground ring-1 ring-primary/30"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        }`}
                      >
                        <FolderIcon className="h-4 w-4" style={{ color: f.color }} />
                        <span className="flex-1 truncate text-left">{f.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>

            {/* Lista estilo caixa de e-mail */}
            <section className="portal-card flex max-h-[calc(100vh-200px)] flex-col overflow-hidden">
              <div className="portal-card-header flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>

              <ScrollArea className="flex-1 ctm-scroll">
                {loading ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">Carregando...</p>
                ) : list.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 p-10 text-muted-foreground">
                    <MailOpen className="h-10 w-10 opacity-40" />
                    <p className="text-sm">Nenhuma mensagem aqui</p>
                  </div>
                ) : (
                  <div>
                    {list.map((item) => {
                      const unread = !!item.myRow && !item.myRow.is_read;
                      const active = selectedId === item.message.id;
                      const person = item.outgoing ? item.recipients[0]?.profile : item.sender;
                      return (
                        <button
                          key={item.message.id}
                          onClick={() => openMessage(item)}
                          className={`relative flex w-full gap-3 border-b border-border/40 px-4 py-3.5 text-left transition-colors ${
                            active ? "bg-primary/15" : unread ? "bg-white/[0.02] hover:bg-muted/40" : "hover:bg-muted/30"
                          }`}
                        >
                          {unread && !active && (
                            <span className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary" />
                          )}
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarImage src={person?.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/15 text-[11px]">
                              {initials(person?.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`truncate text-sm ${unread ? "font-bold text-foreground" : "text-foreground/85"}`}
                              >
                                {item.outgoing
                                  ? `Para: ${item.recipients.map((r) => r.profile?.full_name).filter(Boolean).join(", ") || "—"}`
                                  : person?.full_name || "Usuário"}
                              </span>
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(item.message.created_at), {
                                  addSuffix: true,
                                  locale: ptBR,
                                })}
                              </span>
                            </div>
                            <p
                              className={`truncate text-[13px] ${
                                unread ? "font-semibold text-foreground/90" : "text-muted-foreground"
                              }`}
                            >
                              {item.message.subject || "(sem assunto)"}
                            </p>
                            <p className="truncate text-xs text-muted-foreground/70">{item.message.body}</p>
                            <div className="mt-1 flex items-center gap-2">
                              {item.attachments.length > 0 && (
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <Paperclip className="h-3 w-3" /> {item.attachments.length}
                                </span>
                              )}
                              {item.myRow?.is_starred && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                              {item.myRow?.is_archived && <Archive className="h-3 w-3 text-muted-foreground" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </section>

            {/* Leitor estilo e-mail */}
            <section className="portal-card flex max-h-[calc(100vh-200px)] flex-col overflow-hidden">
              {!selected ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-muted-foreground">
                  <div className="rounded-2xl bg-primary/10 p-5 ring-1 ring-primary/20">
                    <Mail className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-sm">Selecione uma mensagem para ler</p>
                </div>
              ) : (
                <>
                  {/* Toolbar de ações */}
                  <div className="flex flex-wrap items-center gap-1 border-b border-border/60 px-3 py-2">
                    {selected.myRow && (
                      <>
                        <ToolbarButton
                          icon={Trash2}
                          label={selected.myRow.is_deleted ? "Restaurar" : "Excluir"}
                          danger={!selected.myRow.is_deleted}
                          onClick={async () => {
                            await updateMyRow(selected, { is_deleted: !selected.myRow!.is_deleted } as any);
                            setSelectedId(null);
                          }}
                        />
                        <ToolbarButton icon={AlertOctagon} label="Spam" onClick={() => toast.info("Em breve")} />
                        <ToolbarButton
                          icon={Archive}
                          label={selected.myRow.is_archived ? "Desarquivar" : "Arquivar"}
                          onClick={() => updateMyRow(selected, { is_archived: !selected.myRow!.is_archived } as any)}
                        />
                        <ToolbarButton
                          icon={Star}
                          label="Favoritar"
                          active={selected.myRow.is_starred}
                          onClick={() => updateMyRow(selected, { is_starred: !selected.myRow!.is_starred } as any)}
                        />
                        <div className="mx-1 h-5 w-px bg-border/60" />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
                              <FolderIcon className="h-3.5 w-3.5" /> Mover
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {folders.length === 0 && (
                              <DropdownMenuItem onClick={createFolder}>
                                <FolderPlus className="mr-2 h-4 w-4" /> Criar pasta
                              </DropdownMenuItem>
                            )}
                            {folders.map((f) => (
                              <DropdownMenuItem key={f.id} onClick={() => moveToFolder(selected, f.id)}>
                                <FolderIcon className="mr-2 h-4 w-4" style={{ color: f.color }} />
                                {f.name}
                              </DropdownMenuItem>
                            ))}
                            {selected.myRow.folder_id && (
                              <DropdownMenuItem onClick={() => moveToFolder(selected, null)}>
                                <RotateCcw className="mr-2 h-4 w-4" /> Tirar da pasta
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                    {selected.outgoing && !selected.myRow && (
                      <ToolbarButton
                        icon={Trash2}
                        label="Excluir dos enviados"
                        danger
                        onClick={async () => {
                          await updateSent(selected, { sender_deleted: true });
                          setSelectedId(null);
                        }}
                      />
                    )}
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        onClick={handleReply}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                      >
                        <SendIcon className="h-3.5 w-3.5" /> Responder
                      </button>
                      <button
                        onClick={handleForward}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                      >
                        <Forward className="h-3.5 w-3.5" /> Encaminhar
                      </button>
                    </div>
                  </div>

                  <ScrollArea className="flex-1 ctm-scroll">
                    <div className="px-6 pt-5">
                      <h2 className="text-xl font-bold leading-tight">
                        {selected.message.subject || "(sem assunto)"}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {format(new Date(selected.message.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>

                      <div className="mt-4 flex items-center gap-3 border-b border-border/50 pb-4">
                        <Avatar className="h-11 w-11">
                          <AvatarImage src={selected.sender?.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/15 text-xs">
                            {initials(selected.sender?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="font-semibold">{selected.sender?.full_name || "Usuário"}</p>
                          <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                            Para:{" "}
                            {selected.recipients
                              .filter((r) => r.kind === "to")
                              .map((r) => r.profile?.full_name)
                              .filter(Boolean)
                              .join(", ") || "—"}
                            {selected.recipients.some((r) => r.kind === "cc") && (
                              <>
                                <ChevronRight className="h-3 w-3" />
                                Cc:{" "}
                                {selected.recipients
                                  .filter((r) => r.kind === "cc")
                                  .map((r) => r.profile?.full_name)
                                  .filter(Boolean)
                                  .join(", ")}
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="whitespace-pre-wrap px-6 py-5 text-sm leading-relaxed text-foreground/90">
                      {selected.message.body}
                    </div>

                    {/* Preview inline de imagens anexadas */}
                    {selected.attachments.some((a) => a.file_type?.startsWith("image/")) && (
                      <div className="space-y-3 px-6 pb-4">
                        {selected.attachments
                          .filter((a) => a.file_type?.startsWith("image/"))
                          .map((a) => (
                            <button
                              key={a.id}
                              onClick={() => openAttachment(a.file_path, a.file_name)}
                              className="block w-full overflow-hidden rounded-xl border border-border/60"
                            >
                              {inlineImages[a.id] ? (
                                <img src={inlineImages[a.id]} alt={a.file_name} className="max-h-96 w-full object-cover" />
                              ) : (
                                <div className="skeleton h-48 w-full" />
                              )}
                            </button>
                          ))}
                      </div>
                    )}

                    {/* Anexos não-imagem */}
                    {selected.attachments.some((a) => !a.file_type?.startsWith("image/")) && (
                      <div className="px-6 pb-6">
                        <p className="portal-section-label mb-2">Anexos</p>
                        <div className="flex flex-wrap gap-2">
                          {selected.attachments
                            .filter((a) => !a.file_type?.startsWith("image/"))
                            .map((a) => (
                              <button
                                key={a.id}
                                onClick={() => openAttachment(a.file_path, a.file_name)}
                                className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs transition-colors hover:border-primary/50 hover:bg-muted"
                              >
                                <FileText className="h-4 w-4 text-primary" />
                                <span className="max-w-[200px] truncate">{a.file_name}</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </ScrollArea>

                  <div className="flex items-center gap-2 border-t border-border/60 bg-muted/10 px-6 py-3">
                    <Button size="sm" onClick={handleReply} className="shadow-lg shadow-primary/20">
                      <SendIcon className="mr-2 h-4 w-4" /> Responder
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleForward}>
                      <Forward className="mr-2 h-4 w-4" /> Encaminhar
                    </Button>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </div>

      {composeOpen && (
        <ComposeMessage
          key={replyTo ? `reply-${replyTo.subject}-${replyTo.to.join(",")}` : "new"}
          open={composeOpen}
          onOpenChange={setComposeOpen}
          profiles={profiles.filter((p) => p.id !== meId)}
          meId={meId}
          onSent={reload}
          initial={replyTo ? { to: replyTo.to, subject: replyTo.subject, body: replyTo.body } : undefined}
        />
      )}

      {viewer && (
        <AttachmentViewerModal url={viewer.url} title={viewer.title} onClose={() => setViewer(null)} />
      )}
    </Layout>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  active,
  danger,
}: {
  icon: any;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-amber-500/15 text-amber-400"
          : danger
          ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${active ? "fill-amber-400" : ""}`} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}