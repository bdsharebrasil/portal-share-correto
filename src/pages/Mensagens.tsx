import { useMemo, useState } from "react";
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
  Users,
  ChevronRight,
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
  const [replyTo, setReplyTo] = useState<{ to: string[]; subject: string } | null>(null);
  const [viewer, setViewer] = useState<{ url: string; title: string } | null>(null);

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

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[230px_minmax(280px,340px)_1fr]">
            {/* Pastas */}
            <aside className="rounded-2xl border border-border/70 bg-card/60 p-3 backdrop-blur-xl">
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
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Pastas
                  </span>
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

            {/* Lista */}
            <section className="flex max-h-[calc(100vh-200px)] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/60 backdrop-blur-xl">
              <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar mensagens..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>

              <ScrollArea className="flex-1">
                {loading ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">Carregando...</p>
                ) : list.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 p-10 text-muted-foreground">
                    <MailOpen className="h-10 w-10 opacity-40" />
                    <p className="text-sm">Nenhuma mensagem aqui</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {list.map((item) => {
                      const unread = !!item.myRow && !item.myRow.is_read;
                      const active = selectedId === item.message.id;
                      const person = item.outgoing
                        ? item.recipients[0]?.profile
                        : item.sender;
                      return (
                        <button
                          key={item.message.id}
                          onClick={() => openMessage(item)}
                          className={`relative flex w-full gap-3 px-3 py-3 text-left transition-colors ${
                            active ? "bg-primary/10" : "hover:bg-muted/40"
                          }`}
                        >
                          {unread && (
                            <span className="absolute left-0 top-0 h-full w-[3px] bg-primary" />
                          )}
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarImage src={person?.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/15 text-[11px]">
                              {initials(person?.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`truncate text-sm ${unread ? "font-bold text-foreground" : "text-foreground/80"}`}
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
                            <p className={`truncate text-[13px] ${unread ? "font-semibold" : "text-muted-foreground"}`}>
                              {item.message.subject || "(sem assunto)"}
                            </p>
                            <p className="truncate text-xs text-muted-foreground/80">{item.message.body}</p>
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

            {/* Leitor */}
            <section className="flex max-h-[calc(100vh-200px)] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/60 backdrop-blur-xl">
              {!selected ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-muted-foreground">
                  <div className="rounded-2xl bg-primary/10 p-5 ring-1 ring-primary/20">
                    <Mail className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-sm">Selecione uma mensagem para ler</p>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3 border-b border-border/60 bg-gradient-to-r from-primary/10 to-transparent px-5 py-4">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold">
                        {selected.message.subject || "(sem assunto)"}
                      </h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {format(new Date(selected.message.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {selected.myRow && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Favoritar"
                            onClick={() => updateMyRow(selected, { is_starred: !selected.myRow!.is_starred } as any)}
                          >
                            <Star
                              className={`h-4 w-4 ${selected.myRow.is_starred ? "fill-amber-400 text-amber-400" : ""}`}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={selected.myRow.is_archived ? "Desarquivar" : "Arquivar"}
                            onClick={() => updateMyRow(selected, { is_archived: !selected.myRow!.is_archived } as any)}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" title="Mover para pasta">
                                <FolderIcon className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
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
                          <Button
                            variant="ghost"
                            size="icon"
                            title={selected.myRow.is_deleted ? "Restaurar" : "Excluir"}
                            onClick={async () => {
                              await updateMyRow(selected, { is_deleted: !selected.myRow!.is_deleted } as any);
                              setSelectedId(null);
                            }}
                          >
                            {selected.myRow.is_deleted ? (
                              <RotateCcw className="h-4 w-4" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        </>
                      )}
                      {selected.outgoing && !selected.myRow && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Excluir dos enviados"
                          onClick={async () => {
                            await updateSent(selected, { sender_deleted: true });
                            setSelectedId(null);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 border-b border-border/60 px-5 py-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selected.sender?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/15 text-xs">
                        {initials(selected.sender?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-semibold">{selected.sender?.full_name || "Usuário"}</p>
                      <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
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

                  <ScrollArea className="flex-1">
                    <div className="whitespace-pre-wrap px-5 py-5 text-sm leading-relaxed text-foreground/90">
                      {selected.message.body}
                    </div>

                    {selected.attachments.length > 0 && (
                      <div className="px-5 pb-6">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Anexos ({selected.attachments.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selected.attachments.map((a) => (
                            <button
                              key={a.id}
                              onClick={() => openAttachment(a.file_path, a.file_name)}
                              className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs transition-colors hover:border-primary/50 hover:bg-muted"
                            >
                              {a.file_type?.startsWith("image/") ? (
                                <ImageIcon className="h-4 w-4 text-primary" />
                              ) : (
                                <FileText className="h-4 w-4 text-primary" />
                              )}
                              <span className="max-w-[200px] truncate">{a.file_name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </ScrollArea>

                  <div className="border-t border-border/60 bg-muted/20 px-5 py-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setReplyTo({
                          to: [selected.message.sender_id],
                          subject: selected.message.subject.startsWith("Re:")
                            ? selected.message.subject
                            : `Re: ${selected.message.subject}`,
                        });
                        setComposeOpen(true);
                      }}
                    >
                      <SendIcon className="mr-2 h-4 w-4" /> Responder
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
          key={replyTo ? `reply-${replyTo.subject}` : "new"}
          open={composeOpen}
          onOpenChange={setComposeOpen}
          profiles={profiles.filter((p) => p.id !== meId)}
          meId={meId}
          onSent={reload}
          initial={replyTo ? { to: replyTo.to, subject: replyTo.subject } : undefined}
        />
      )}

      {viewer && (
        <AttachmentViewerModal url={viewer.url} title={viewer.title} onClose={() => setViewer(null)} />
      )}
    </Layout>
  );
}
