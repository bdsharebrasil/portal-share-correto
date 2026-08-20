import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  departamento: string | null;
};

export type Attachment = {
  id: string;
  message_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
};

export type RecipientRow = {
  id: string;
  message_id: string;
  recipient_id: string;
  kind: string;
  is_read: boolean;
  is_archived: boolean;
  is_deleted: boolean;
  is_starred: boolean;
  folder_id: string | null;
};

export type MessageRow = {
  id: string;
  sender_id: string;
  subject: string;
  body: string;
  created_at: string;
};

export type MailItem = {
  message: MessageRow;
  sender: Profile | null;
  recipients: { profile: Profile | null; kind: string }[];
  attachments: Attachment[];
  /** row of the current user as recipient (null when the message was sent by me) */
  myRow: RecipientRow | null;
  outgoing: boolean;
};

export type Folder = { id: string; name: string; color: string };

export type MailboxView =
  | "inbox"
  | "unread"
  | "starred"
  | "sent"
  | "archived"
  | "trash"
  | string; // folder:<id>

export function useMensagens() {
  const [meId, setMeId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [items, setItems] = useState<MailItem[]>([]);
  const [loading, setLoading] = useState(true);

  const profileMap = useMemo(() => {
    const m = new Map<string, Profile>();
    profiles.forEach((p) => m.set(p.id, p));
    return m;
  }, [profiles]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  const loadProfiles = useCallback(async () => {
    const { data } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, avatar_url, departamento")
      .order("full_name");
    setProfiles((data as any) || []);
  }, []);

  const loadFolders = useCallback(async () => {
    if (!meId) return;
    const { data } = await (supabase as any)
      .from("message_folders")
      .select("id, name, color")
      .eq("user_id", meId)
      .order("created_at");
    setFolders((data as any) || []);
  }, [meId]);

  const loadMessages = useCallback(async () => {
    if (!meId) return;
    setLoading(true);

    const [{ data: recvRows }, { data: sentRows }] = await Promise.all([
      (supabase as any)
        .from("internal_message_recipients")
        .select("*")
        .eq("recipient_id", meId),
      (supabase as any)
        .from("internal_messages")
        .select("*")
        .eq("sender_id", meId)
        .eq("sender_deleted", false)
        .order("created_at", { ascending: false }),
    ]);

    const myRows: RecipientRow[] = (recvRows as any) || [];
    const sentMessages: MessageRow[] = (sentRows as any) || [];

    const ids = Array.from(
      new Set([...myRows.map((r) => r.message_id), ...sentMessages.map((m) => m.id)])
    );

    if (ids.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const [{ data: msgs }, { data: allRecipients }, { data: atts }] = await Promise.all([
      (supabase as any)
        .from("internal_messages")
        .select("*")
        .in("id", ids)
        .order("created_at", { ascending: false }),
      (supabase as any).from("internal_message_recipients").select("*").in("message_id", ids),
      (supabase as any).from("internal_message_attachments").select("*").in("message_id", ids),
    ]);

    const messages: MessageRow[] = (msgs as any) || [];
    const recipientsAll: RecipientRow[] = (allRecipients as any) || [];
    const attachments: Attachment[] = (atts as any) || [];

    const built: MailItem[] = messages.map((m) => {
      const myRow = myRows.find((r) => r.message_id === m.id) || null;
      return {
        message: m,
        sender: profileMap.get(m.sender_id) || null,
        recipients: recipientsAll
          .filter((r) => r.message_id === m.id)
          .map((r) => ({ profile: profileMap.get(r.recipient_id) || null, kind: r.kind })),
        attachments: attachments.filter((a) => a.message_id === m.id),
        myRow,
        outgoing: m.sender_id === meId,
      };
    });

    setItems(built);
    setLoading(false);
  }, [meId, profileMap]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    if (meId && profiles.length >= 0) loadMessages();
  }, [meId, profiles, loadMessages]);

  // realtime refresh
  useEffect(() => {
    if (!meId) return;
    const channel = supabase
      .channel("internal-messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "internal_message_recipients" },
        () => loadMessages()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [meId, loadMessages]);

  const updateMyRow = async (item: MailItem, patch: Partial<RecipientRow>) => {
    if (!item.myRow) return;
    setItems((prev) =>
      prev.map((it) =>
        it.message.id === item.message.id && it.myRow
          ? { ...it, myRow: { ...it.myRow, ...patch } as RecipientRow }
          : it
      )
    );
    await (supabase as any)
      .from("internal_message_recipients")
      .update(patch)
      .eq("id", item.myRow.id);
  };

  const updateSent = async (item: MailItem, patch: Record<string, any>) => {
    await (supabase as any).from("internal_messages").update(patch).eq("id", item.message.id);
    await loadMessages();
  };

  return {
    meId,
    profiles,
    profileMap,
    folders,
    items,
    loading,
    reload: loadMessages,
    reloadFolders: loadFolders,
    updateMyRow,
    updateSent,
  };
}

export function useUnreadMessagesCount(userId: string | null) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }

    let cancelled = false;
    const loadCount = async () => {
      const { count: unreadCount, error } = await supabase
        .from("internal_message_recipients")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .eq("is_read", false)
        .eq("is_deleted", false);

      if (cancelled) return;
      if (error) {
        console.error("Erro ao carregar mensagens não lidas:", error);
        return;
      }
      setCount(unreadCount ?? 0);
    };

    void loadCount();

    const channel = supabase
      .channel(`unread-messages-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "internal_message_recipients",
          filter: `recipient_id=eq.${userId}`,
        },
        () => void loadCount()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return count;
}

export function filterMailbox(items: MailItem[], view: MailboxView): MailItem[] {
  if (view === "sent") return items.filter((i) => i.outgoing);
  const incoming = items.filter((i) => !!i.myRow);
  switch (view) {
    case "inbox":
      return incoming.filter((i) => !i.myRow!.is_deleted && !i.myRow!.is_archived && !i.myRow!.folder_id);
    case "unread":
      return incoming.filter((i) => !i.myRow!.is_deleted && !i.myRow!.is_read);
    case "starred":
      return incoming.filter((i) => !i.myRow!.is_deleted && i.myRow!.is_starred);
    case "archived":
      return incoming.filter((i) => !i.myRow!.is_deleted && i.myRow!.is_archived);
    case "trash":
      return incoming.filter((i) => i.myRow!.is_deleted);
    default:
      if (view.startsWith("folder:")) {
        const fid = view.slice(7);
        return incoming.filter((i) => !i.myRow!.is_deleted && i.myRow!.folder_id === fid);
      }
      return incoming;
  }
}

export function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
