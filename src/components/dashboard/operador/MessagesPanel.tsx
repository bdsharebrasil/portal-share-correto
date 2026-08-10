import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Pin, Lock, Plus, ArrowRight, StickyNote, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type RecadoRow = {
  id: string;
  autor_id: string;
  mensagem: string;
  fixado: boolean | null;
  departamento: string | null;
  criado_em: string | null;
  lido_por: string[] | null;
};

type EnrichedRecado = RecadoRow & {
  author_name: string;
  isPinned: boolean;
  isPrivate: boolean;
  isRead: boolean;
};

const PIN_COLORS = [
  "bg-amber-400/10 border-amber-400/30",
  "bg-emerald-400/10 border-emerald-400/30",
  "bg-sky-400/10 border-sky-400/30",
  "bg-rose-400/10 border-rose-400/30",
  "bg-violet-400/10 border-violet-400/30",
];

export function MessagesPanel() {
  const navigate = useNavigate();
  const { userRoles } = useUserRole();
  const [meId, setMeId] = useState<string | null>(null);
  const [readOverrides, setReadOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  const { data: recados = [], isLoading } = useQuery<EnrichedRecado[]>({
    queryKey: ["dashboard-recados", userRoles, meId],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("recados")
        .select("id, autor_id, mensagem, fixado, departamento, criado_em, lido_por")
        .order("fixado", { ascending: false })
        .order("criado_em", { ascending: false })
        .limit(30);

      const list = (rows || []) as RecadoRow[];
      const authorIds = Array.from(new Set(list.map((r) => r.autor_id)));
      const authorMap = new Map<string, string>();

      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("id, full_name")
          .in("id", authorIds);
        (profiles || []).forEach((p: any) => authorMap.set(p.id, p.full_name || "Usuário"));
      }

      const enriched: EnrichedRecado[] = list.map((r) => {
        const dep = (r.departamento || "todos").toLowerCase();
        const targeted = dep && dep !== "todos" ? dep.split(",").map((s) => s.trim()) : [];
        const isPrivate = targeted.length > 0;
        const visible =
          !isPrivate || targeted.some((role) => userRoles.includes(role));
        if (!visible) return null as any;
        return {
          ...r,
          author_name: authorMap.get(r.autor_id) || "Usuário",
          isPinned: !!r.fixado,
          isPrivate,
          isRead: !!(meId && Array.isArray(r.lido_por) && r.lido_por.includes(meId)),
        };
      }).filter(Boolean);

      return enriched;
    },
  });

  const withOverrides = recados.map((r) => ({
    ...r,
    isRead: readOverrides[r.id] ?? r.isRead,
  }));
  const pinned = withOverrides.filter((r) => r.isPinned);
  const privates = withOverrides.filter((r) => r.isPrivate && !r.isPinned);

  const markAsRead = async (e: React.MouseEvent, recadoId: string, currentReaders: string[] | null) => {
    e.stopPropagation();
    if (!meId) return;
    const next = Array.from(new Set([...(currentReaders || []), meId]));
    setReadOverrides((prev) => ({ ...prev, [recadoId]: true }));
    const { error } = await supabase
      .from("recados")
      .update({ lido_por: next })
      .eq("id", recadoId);
    if (error) {
      setReadOverrides((prev) => ({ ...prev, [recadoId]: false }));
      toast.error("Erro ao marcar como lido");
    } else {
      toast.success("Recado marcado como lido");
    }
  };

  const renderCard = (msg: EnrichedRecado, index: number) => {
    const palette = PIN_COLORS[index % PIN_COLORS.length];
    return (
      <div
        key={msg.id}
        onClick={() => navigate("/recados")}
        className={`relative p-4 rounded-xl border ${palette} hover:scale-[1.02] transition-transform cursor-pointer shadow-sm ${msg.isRead ? "opacity-70" : ""}`}
      >
        <div className="absolute -top-2 left-4 h-4 w-4 rounded-full bg-foreground/40 shadow-[0_1px_2px_rgba(0,0,0,0.4)] ring-2 ring-background" />
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {msg.isPinned && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-1 border-amber-400/40 text-amber-300 bg-amber-400/10">
                <Pin className="h-2.5 w-2.5" /> Fixado
              </Badge>
            )}
            {msg.isPrivate && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-1 border-rose-400/40 text-rose-300 bg-rose-400/10">
                <Lock className="h-2.5 w-2.5" /> Privado
              </Badge>
            )}
            {msg.isRead && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-1 border-emerald-400/40 text-emerald-300 bg-emerald-400/10">
                <CheckCheck className="h-2.5 w-2.5" /> Lido
              </Badge>
            )}
          </div>
          {msg.criado_em && (
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(msg.criado_em), { addSuffix: true, locale: ptBR })}
            </span>
          )}
        </div>
        <p className="text-sm text-foreground/90 line-clamp-4 whitespace-pre-wrap">{msg.mensagem}</p>
        <div className="flex items-center justify-between mt-2 gap-2">
          <p className="text-[11px] text-muted-foreground">Por: {msg.author_name}</p>
          {!msg.isRead && meId && (
            <button
              onClick={(e) => markAsRead(e, msg.id, msg.lido_por)}
              className="text-[11px] text-emerald-300 hover:text-emerald-200 flex items-center gap-1 hover:underline"
            >
              <Check className="h-3 w-3" /> Marcar como lido
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border py-4 px-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <StickyNote className="h-5 w-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-foreground">Quadro de Recados</h3>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80" onClick={() => navigate("/recados")}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate("/recados")}>
            Ver todos <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground py-8">Carregando recados...</div>
      ) : pinned.length === 0 && privates.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-8 text-muted-foreground">
          <StickyNote className="h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">Nenhum recado fixado ou privado</p>
        </div>
      ) : (
        <div className="space-y-5 overflow-y-auto max-h-[520px] pr-1">
          {pinned.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Pin className="h-3.5 w-3.5 text-amber-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Fixados no mural
                </h4>
                <span className="text-xs text-muted-foreground">({pinned.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pinned.map((m, i) => renderCard(m, i))}
              </div>
            </section>
          )}

          {privates.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-3.5 w-3.5 text-rose-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Privados para você
                </h4>
                <span className="text-xs text-muted-foreground">({privates.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {privates.map((m, i) => renderCard(m, i + pinned.length))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
