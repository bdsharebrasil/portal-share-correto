import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Plus, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Nota {
  id: string;
  titulo: string;
  conteudo: string;
  usuario_id: string;
  criado_em: string | null;
  atualizado_em: string | null;
}

interface UserOption {
  id: string;
  full_name: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface Props {
  title?: string;
  subtitle?: string;
}

export default function TarefasNotas({
  title = "Notas",
  subtitle = "Suas anotações e lembretes pessoais",
}: Props) {
  const { isLoading: roleLoading } = useUserRole();
  const [me, setMe] = useState<string | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ titulo: "", conteudo: "" });
  const [createForm, setCreateForm] = useState({ titulo: "", conteudo: "" });
  const [isCreating, setIsCreating] = useState(false);

  // -------------------------------------------------- Load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      if (cancelled) return;
      setMe(user.id);

      const [notasRes, usersRes] = await Promise.all([
        supabase
          .from("notas")
          .select("*")
          .eq("usuario_id", user.id)
          .order("atualizado_em", { ascending: false }),
        supabase
          .from("user_profiles")
          .select("id, full_name, display_name, email, avatar_url"),
      ]);
      if (cancelled) return;

      if (notasRes.error) {
        console.error(notasRes.error);
        toast.error("Erro ao carregar notas");
      } else {
        setNotas((notasRes.data || []) as Nota[]);
      }
      if (!usersRes.error) {
        setUsers((usersRes.data || []) as UserOption[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // -------------------------------------------------- Realtime
  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel("notas-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notas",
          filter: `usuario_id=eq.${me}`,
        },
        (payload) => {
          setNotas((prev) => {
            if (payload.eventType === "INSERT") {
              const n = payload.new as Nota;
              if (prev.find((x) => x.id === n.id)) return prev;
              return [n, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const n = payload.new as Nota;
              return prev.map((x) => (x.id === n.id ? n : x));
            }
            if (payload.eventType === "DELETE") {
              const o = payload.old as Nota;
              return prev.filter((x) => x.id !== o.id);
            }
            return prev;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me]);

  // -------------------------------------------------- Mutations
  const handleCreate = async () => {
    if (!createForm.titulo.trim() || !me) {
      toast.error("Título é obrigatório");
      return;
    }

    const { error } = await supabase.from("notas").insert({
      titulo: createForm.titulo,
      conteudo: createForm.conteudo,
      usuario_id: me,
    });

    if (error) {
      console.error(error);
      toast.error("Erro ao criar nota");
      return;
    }

    toast.success("Nota criada");
    setCreateForm({ titulo: "", conteudo: "" });
    setIsCreating(false);
  };

  const handleUpdate = async (id: string) => {
    const { error } = await supabase
      .from("notas")
      .update({
        titulo: editForm.titulo,
        conteudo: editForm.conteudo,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      toast.error("Erro ao atualizar nota");
      return;
    }

    toast.success("Nota atualizada");
    setEditingId(null);
    setEditForm({ titulo: "", conteudo: "" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta nota?")) return;

    const { error } = await supabase.from("notas").delete().eq("id", id);

    if (error) {
      console.error(error);
      toast.error("Erro ao excluir nota");
      return;
    }

    toast.success("Nota excluída");
  };

  const handleEditStart = (nota: Nota) => {
    setEditingId(nota.id);
    setEditForm({ titulo: nota.titulo, conteudo: nota.conteudo });
  };

  // -------------------------------------------------- Cores
  const BG = "hsl(222 25% 8%)";
  const SURF = "hsl(222 25% 10%)";
  const BORDER = "hsl(222 20% 20%)";
  const TEXT = "hsl(210 40% 92%)";
  const MUTED = "hsl(215 20% 55%)";

  if (loading || roleLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Carregando notas...
      </div>
    );
  }

  return (
    <div
      style={{
        background: BG,
        borderRadius: 16,
        border: `1px solid ${BORDER}`,
        color: TEXT,
        fontFamily: "'DM Sans', sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: SURF,
          borderBottom: `1px solid ${BORDER}`,
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.4 }}>
            {title}
          </div>
          <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>
            {subtitle}
          </div>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          style={{
            background: `linear-gradient(135deg,hsl(192 70% 50%),hsl(217 91% 55%))`,
            color: "hsl(222 25% 8%)",
            border: "none",
            borderRadius: 10,
            padding: "9px 20px",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            boxShadow: `0 4px 16px hsl(192 70% 50%)44`,
          }}
        >
          <Plus size={16} /> Nova Nota
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          padding: "20px",
          minHeight: 480,
        }}
      >
        {/* Create Form */}
        {isCreating && (
          <div
            style={{
              background: SURF,
              borderRadius: 12,
              border: `1px solid hsl(192 70% 50%)40`,
              padding: 16,
              marginBottom: 20,
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: MUTED, display: "block", marginBottom: 6 }}>
                Título *
              </label>
              <input
                value={createForm.titulo}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, titulo: e.target.value }))
                }
                placeholder="Título da nota..."
                style={{
                  width: "100%",
                  background: BG,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  padding: "8px 12px",
                  color: TEXT,
                  fontSize: 14,
                  fontFamily: "inherit",
                }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: MUTED, display: "block", marginBottom: 6 }}>
                Conteúdo
              </label>
              <textarea
                value={createForm.conteudo}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, conteudo: e.target.value }))
                }
                placeholder="Digite sua nota aqui..."
                rows={4}
                style={{
                  width: "100%",
                  background: BG,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  padding: "8px 12px",
                  color: TEXT,
                  fontSize: 14,
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setCreateForm({ titulo: "", conteudo: "" });
                }}
                style={{
                  background: "hsl(222 25% 14%)",
                  border: `1px solid ${BORDER}`,
                  color: TEXT,
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleCreate()}
                style={{
                  background: "hsl(192 70% 50%)",
                  color: "hsl(222 25% 8%)",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Criar
              </button>
            </div>
          </div>
        )}

        {/* Notas Grid */}
        {notas.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "hsl(215 20% 38%)",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>
              📝
            </div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              Nenhuma nota ainda
            </div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
              Crie uma nova nota para começar
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {notas.map((nota) => (
              <div
                key={nota.id}
                style={{
                  background: SURF,
                  borderRadius: 12,
                  border: `1px solid ${BORDER}`,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  transition: "all 0.2s",
                }}
              >
                {editingId === nota.id ? (
                  <>
                    <input
                      value={editForm.titulo}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, titulo: e.target.value }))
                      }
                      style={{
                        background: BG,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 6,
                        padding: "8px 10px",
                        color: TEXT,
                        fontSize: 14,
                        fontWeight: 700,
                        fontFamily: "inherit",
                      }}
                    />
                    <textarea
                      value={editForm.conteudo}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, conteudo: e.target.value }))
                      }
                      style={{
                        background: BG,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 6,
                        padding: "8px 10px",
                        color: TEXT,
                        fontSize: 13,
                        fontFamily: "inherit",
                        minHeight: 80,
                        resize: "vertical",
                      }}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{
                          flex: 1,
                          background: "hsl(222 25% 14%)",
                          border: `1px solid ${BORDER}`,
                          color: MUTED,
                          borderRadius: 6,
                          padding: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => void handleUpdate(nota.id)}
                        style={{
                          flex: 1,
                          background: "hsl(142 60% 50%)",
                          color: "hsl(222 25% 8%)",
                          border: "none",
                          borderRadius: 6,
                          padding: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Salvar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <h3
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: TEXT,
                          marginBottom: 6,
                        }}
                      >
                        {nota.titulo}
                      </h3>
                      <p
                        style={{
                          fontSize: 13,
                          color: MUTED,
                          lineHeight: 1.5,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {nota.conteudo || "(sem conteúdo)"}
                      </p>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "hsl(215 20% 40%)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Clock size={11} />
                      {nota.atualizado_em
                        ? new Date(nota.atualizado_em).toLocaleDateString(
                            "pt-BR",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )
                        : "—"}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        justifyContent: "space-between",
                      }}
                    >
                      <button
                        onClick={() => handleEditStart(nota)}
                        style={{
                          flex: 1,
                          background: "hsl(217 91% 60% / 0.15)",
                          color: "hsl(217 91% 65%)",
                          border: "1px solid hsl(217 91% 60% / 0.3)",
                          borderRadius: 6,
                          padding: "6px 8px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => void handleDelete(nota.id)}
                        style={{
                          flex: 1,
                          background: "hsl(0 75% 60% / 0.15)",
                          color: "hsl(0 75% 65%)",
                          border: "1px solid hsl(0 75% 60% / 0.3)",
                          borderRadius: 6,
                          padding: "6px 8px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4,
                        }}
                      >
                        <Trash2 size={12} /> Excluir
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
