import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { BookOpen, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Note {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export function NotesPanel() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const initializeUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      await fetchNotes(user.id);
    };
    void initializeUser();
  }, []);

  const fetchNotes = async (currentUserId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_notes")
        .select("*")
        .eq("user_id", currentUserId)
        .order("updated_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      setNotes((data || []) as Note[]);
    } catch (error) {
      console.error("Erro ao carregar notas:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Recados</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-primary hover:text-primary/80"
          onClick={() => navigate("/minhas-tarefas")}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          Carregando recados...
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          <BookOpen className="mx-auto h-10 w-10 mb-2 opacity-50" />
          <p>Nenhum recado criado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="p-2 rounded-lg bg-background/50 border border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => navigate("/minhas-tarefas")}
            >
              <p className="text-sm text-foreground line-clamp-2">{note.content}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(note.updated_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      )}

      <Button
        variant="ghost"
        className="w-full mt-4 text-primary hover:text-primary/80"
        onClick={() => navigate("/minhas-tarefas")}
      >
        Ver Todos os Recados
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
