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
  RotateCcw,
  ChevronRight,
  ChevronDown,
  Forward,
  AlertOctagon,
  MoreHorizontal,
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

  useEffect(() => {
    if (!selected) return;
    const imageAttachments = selected.attachments.filter((a) => a.file_type?.startsWith("image/"));
    imageAttachments.forEach(async (a) => {
      if (inlineImages[a.id]) return;
      const { data } = await supabase.storage.from("message-attachments").createSignedUrl(a.file_path, 3600);
      if (data?.signedUrl) setInlineImages((prev) => ({ ...prev, [a.id]: data.signedUrl }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.message.id]);

  const openAttachment = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("message-attachments").createSignedUrl(path, 3600);
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

  const navTabs: { key: MailboxView; label: string; icon: any; badge?: number }[] = [
    { key: "inbox", label: "Inbox", icon: Inbox },
    { key: "unread", label: "Não lidas", icon: Mail, badge: unreadCount },
    { key: "starred", label: "Favoritas", icon: Star },
    { key: "sent", label: "Enviadas", icon: SendIcon },
    { key: "archived", label: "Arquivo", icon: Archive },
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

        <div className="relative flex h-[calc(100vh-73px)] flex-col p-4 md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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
              className="bg-[rgba(103,221,217,1)] shadow-lg shadow-primary/25"
            >
              <PenSquare className="mr-2 h-4 w-4" /> Nova mensagem
            </Button>
          </div>

          {/* 2 colunas: lista + leitor */}
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
            {/* LISTA (estilo caixa de e-mail) */}
            <section className="portal-card mt-[-12px] mb-[-12px] ml-[-17px] mr-[-17px] flex min-h-0 flex-col overflow-hidden pt-[3px] pb-[3px] pl-0 pr-0">
              {/* Busca */}
              <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>

              {/* Título + contagem, igual "Inbox / 743 messages, 2 unread" */}
              <div className="flex items-center justify-between px-4 pb-2 pt-3">
                <h2 className="text-lg font-bold">
                  {navTabs.find((t) => t.key === view)?.label || "Inbox"}
                </h2>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground">
                      <FolderIcon className="h-3.5 w-3.5" />
                      Pastas
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={createFolder}>
                      <FolderPlus className="mr-2 h-4 w-4" /> Nova pasta
                    </DropdownMenuItem>
                    {folders.map((f) => (
                      <DropdownMenuItem
                        key={f.id}
                        onClick={() => {
                          setView(`folder:${f.id}`);
                          setSelectedId(null);
                        }}
                      >
                        <FolderIcon className="mr-2 h-4 w-4" style={{ color: f.color }} />
                        {f.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="mx-[3px] mt-[8px] mb-[8px] px-4 pt-0 pb-[19px] text-[13px] font-light leading-[5px] text-muted-foreground">
                {items.length} mensagens, {unreadCount} não lidas
              </p>

              {/* Abas compactas (Inbox / Unread / Starred / Sent / Archived / Trash) */}
              <div className="mt-[-9px] mb-[-9px] ml-[-3px] mr-[-3px] flex min-h-0 items-center gap-[5px] overflow-x-auto border-b border-border/50 px-3 pb-2 text-[8px] font-light leading-[14px] no-scrollbar">
                {navTabs.map((n) => {
                  const active = view === n.key;
                  return (
                    <button
                      key={n.key}
                      onClick={() => {
                        setView(n.key);
                        setSelectedId(null);
                      }}
                      className={`my-1 flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                        active
                          ? "bg-primary/15 text-foreground ring-1 ring-primary/30"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      <n.icon className={`h-3.5 w-3.5 ${active ? "text-primary" : ""}`} />
                      {n.label}
                      {!!n.badge && (
                        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                          {n.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
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
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarImage src={person?.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/15 text-[11px]">
                              {initials(person?.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 truncate">
                                {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                                <span
                                  className={`truncate text-sm ${unread ? "font-bold text-foreground" : "text-foreground/85"}`}
                                >
                                  {item.outgoing
                                    ? `Para: ${item.recipients.map((r) => r.profile?.full_name).filter(Boolean).join(", ") || "—"}`
                                    : person?.full_name || "Usuário"}
                                </span>
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

            {/* LEITOR */}
            <section className="portal-card flex min-h-0 flex-col overflow-hidden">
              {!selected ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-muted-foreground">
                  <div className="rounded-2xl bg-primary/10 p-5 ring-1 ring-primary/20">
                    <Mail className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-sm">Selecione uma mensagem para ler</p>
                </div>
              ) : (
                <>
                  {/* Toolbar: Delete · Spam · Archive · Favorite · Reply */}
                  <div className="flex items-center gap-1 border-b border-border/60 px-4 py-2.5">
                    {selected.myRow && (
                      <>
                        <ToolbarButton
                          icon={Trash2}
                          label="Delete"
                          danger={!selected.myRow.is_deleted}
                          activeIcon={selected.myRow.is_deleted ? RotateCcw : undefined}
                          onClick={async () => {
                            await updateMyRow(selected, { is_deleted: !selected.myRow!.is_deleted } as any);
                            setSelectedId(null);
                          }}
                        />
                        <ToolbarButton icon={AlertOctagon} label="Spam" onClick={() => toast.info("Em breve")} />
                        <ToolbarButton
                          icon={Archive}
                          label={selected.myRow.is_archived ? "Unarchive" : "Archive"}
                          onClick={() => updateMyRow(selected, { is_archived: !selected.myRow!.is_archived } as any)}
                        />
                        <ToolbarButton
                          icon={Star}
                          label="Favorite"
                          active={selected.myRow.is_starred}
                          onClick={() => updateMyRow(selected, { is_starred: !selected.myRow!.is_starred } as any)}
                        />
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

                    <div className="mx-2 h-5 w-px bg-border/60" />

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
                        {selected.myRow?.folder_id && (
                          <DropdownMenuItem onClick={() => moveToFolder(selected, null)}>
                            <RotateCcw className="mr-2 h-4 w-4" /> Tirar da pasta
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="ml-auto flex items-center gap-1">
                      <button
                        onClick={handleReply}
                        className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                      >
                        <SendIcon className="h-3.5 w-3.5" /> Reply
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={handleForward}>
                            <Forward className="mr-2 h-4 w-4" /> Encaminhar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <ScrollArea className="flex-1 ctm-scroll">
                    <div className="px-6 pt-5">
                      <h2 className="text-xl font-bold leading-tight">
                        {selected.message.subject || "(sem assunto)"}
                      </h2>

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
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {format(new Date(selected.message.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>

                    <div className="whitespace-pre-wrap px-6 py-5 text-sm leading-relaxed text-foreground/90">
                      {selected.message.body}
                    </div>

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

                  {/* Rodapé: Reply / Forward, igual ao botão azul + cinza da screenshot */}
                  <div className="flex items-center gap-2 border-t border-border/60 bg-muted/10 px-6 py-3">
                    <Button size="sm" onClick={handleReply} className="shadow-lg shadow-primary/20">
                      <SendIcon className="mr-2 h-4 w-4" /> Reply
                    </Button>
                    <Button size="sm" variant="secondary" onClick={handleForward}>
                      <Forward className="mr-2 h-4 w-4" /> Forward
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
  activeIcon: ActiveIcon,
  label,
  onClick,
  active,
  danger,
}: {
  icon: any;
  activeIcon?: any;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  const RenderIcon = ActiveIcon || Icon;
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center justify-center rounded-lg p-2 transition-colors ${
        active
          ? "bg-amber-500/15 text-amber-400"
          : danger
          ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      <RenderIcon className={`h-4 w-4 ${active ? "fill-amber-400" : ""}`} />
    </button>
  );
}
