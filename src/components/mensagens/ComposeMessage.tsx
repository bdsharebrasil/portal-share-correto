import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Paperclip, Send, X, Plus, Search, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { initials, type Profile } from "@/hooks/useMensagens";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profiles: Profile[];
  meId: string | null;
  onSent: () => void;
  initial?: { to?: string[]; subject?: string; body?: string };
}

function PeoplePicker({
  label,
  profiles,
  selected,
  onChange,
  exclude,
}: {
  label: string;
  profiles: Profile[];
  selected: string[];
  onChange: (v: string[]) => void;
  exclude: string[];
}) {
  const [q, setQ] = useState("");
  const list = useMemo(
    () =>
      profiles.filter(
        (p) =>
          !exclude.includes(p.id) &&
          (p.full_name?.toLowerCase().includes(q.toLowerCase()) ||
            p.email?.toLowerCase().includes(q.toLowerCase()))
      ),
    [profiles, q, exclude]
  );

  return (
    <div className="flex items-start gap-3 border-b border-border/60 px-1 py-2.5">
      <span className="w-10 shrink-0 pt-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {selected.map((id) => {
          const p = profiles.find((x) => x.id === id);
          return (
            <span
              key={id}
              className="group flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 py-0.5 pl-0.5 pr-2 text-xs text-foreground"
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={p?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/20 text-[9px]">{initials(p?.full_name)}</AvatarFallback>
              </Avatar>
              {p?.full_name || "Usuário"}
              <button onClick={() => onChange(selected.filter((s) => s !== id))}>
                <X className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" />
              </button>
            </span>
          );
        })}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
              <Plus className="h-3 w-3" /> adicionar
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar pessoa..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <ScrollArea className="max-h-64">
              <div className="p-1">
                {list.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhum usuário</p>
                )}
                {list.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onChange(Array.from(new Set([...selected, p.id])))}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={p.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/15 text-[10px]">{initials(p.full_name)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{p.full_name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{p.email}</span>
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export default function ComposeMessage({ open, onOpenChange, profiles, meId, onSent, initial }: Props) {
  const [to, setTo] = useState<string[]>(initial?.to || []);
  const [cc, setCc] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState(initial?.subject || "");
  const [body, setBody] = useState(initial?.body || "");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTo([]);
    setCc([]);
    setSubject("");
    setBody("");
    setFiles([]);
    setShowCc(false);
  };

  const send = async () => {
    if (!meId) return;
    if (to.length === 0) return toast.error("Escolha ao menos um destinatário");
    if (!subject.trim() && !body.trim()) return toast.error("Escreva um assunto ou mensagem");

    setSending(true);
    try {
      const { data: msg, error } = await (supabase as any)
        .from("internal_messages")
        .insert({ sender_id: meId, subject: subject.trim(), body: body.trim() })
        .select("id")
        .single();
      if (error) throw error;

      const rows = [
        ...to.map((id) => ({ message_id: msg.id, recipient_id: id, kind: "to" })),
        ...cc.filter((id) => !to.includes(id)).map((id) => ({ message_id: msg.id, recipient_id: id, kind: "cc" })),
      ];
      const { error: rErr } = await (supabase as any).from("internal_message_recipients").insert(rows);
      if (rErr) throw rErr;

      for (const f of files) {
        const path = `${meId}/${msg.id}/${Date.now()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("message-attachments").upload(path, f);
        if (upErr) throw upErr;
        await (supabase as any).from("internal_message_attachments").insert({
          message_id: msg.id,
          file_name: f.name,
          file_path: path,
          file_type: f.type,
          file_size: f.size,
        });
      }

      toast.success("Mensagem enviada");
      reset();
      onOpenChange(false);
      onSent();
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden border-border/70 bg-card/95 p-0 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-r from-primary/15 via-transparent to-transparent px-5 py-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Nova mensagem</h2>
        </div>

        <div className="px-5 pt-2">
          <PeoplePicker label="Para" profiles={profiles} selected={to} onChange={setTo} exclude={cc} />
          {showCc ? (
            <PeoplePicker label="Cc" profiles={profiles} selected={cc} onChange={setCc} exclude={to} />
          ) : (
            <button
              onClick={() => setShowCc(true)}
              className="mt-2 text-xs font-medium text-primary hover:underline"
            >
              + adicionar cópia (Cc)
            </button>
          )}

          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Assunto"
            className="mt-3 border-0 border-b border-border/60 bg-transparent px-1 text-base font-semibold focus-visible:ring-0"
          />

          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escreva sua mensagem..."
            className="mt-3 min-h-[220px] resize-none border-0 bg-transparent px-1 focus-visible:ring-0"
          />

          {files.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <span
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs"
                >
                  {f.type.startsWith("image/") ? (
                    <ImageIcon className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-primary" />
                  )}
                  <span className="max-w-[180px] truncate">{f.name}</span>
                  <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))}>
                    <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-5 py-3">
          <div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                setFiles((prev) => [...prev, ...Array.from(e.target.files || [])]);
                e.target.value = "";
              }}
            />
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
              <Paperclip className="mr-1.5 h-4 w-4" /> Anexar
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={send} disabled={sending} className="shadow-lg shadow-primary/20">
              {sending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
              Enviar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
