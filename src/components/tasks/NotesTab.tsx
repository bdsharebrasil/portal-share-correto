import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Trash2, Check, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Note {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export default function NotesTab() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    const initializeUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        console.error("Erro ao obter usuário:", error);
        toast.error("Erro ao carregar usuário");
        setLoading(false);
        return;
      }

      setUserId(user.id);
      await fetchNotes(user.id);
    };

    void initializeUser();
  }, []);

  const fetchNotes = async (currentUserId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_notes")
        .select("*")
        .eq("user_id", currentUserId)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Erro ao carregar notas:", error);
        toast.error("Erro ao carregar notas");
        setNotes([]);
      } else {
        setNotes((data ?? []) as Note[]);
      }
    } catch (error) {
      console.error("Erro inesperado ao carregar notas:", error);
      toast.error("Erro inesperado ao carregar notas");
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) {
      toast.error("Por favor, escreva algo na nota");
      return;
    }

    if (!userId) {
      toast.error("Erro: usuário não identificado");
      return;
    }

    setSavingNote(true);
    try {
      const { data, error } = await supabase
        .from("user_notes")
        .insert([
          {
            content: newNoteContent.trim(),
            user_id: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select();

      if (error) {
        console.error("Erro ao salvar nota:", error);
        toast.error("Erro ao salvar nota");
        return;
      }

      if (data && data.length > 0) {
        setNotes([data[0] as Note, ...notes]);
        setNewNoteContent("");
        toast.success("Nota salva com sucesso!");
      }
    } catch (error) {
      console.error("Erro inesperado ao salvar nota:", error);
      toast.error("Erro inesperado ao salvar nota");
    } finally {
      setSavingNote(false);
    }
  };

  const handleEditNote = (noteId: string, content: string) => {
    setEditingNoteId(noteId);
    setEditingContent(content);
  };

  const handleSaveEdit = async (noteId: string) => {
    if (!editingContent.trim()) {
      toast.error("A nota não pode estar vazia");
      return;
    }

    setSavingNote(true);
    try {
      const { error } = await supabase
        .from("user_notes")
        .update({
          content: editingContent.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", noteId)
        .eq("user_id", userId);

      if (error) {
        console.error("Erro ao atualizar nota:", error);
        toast.error("Erro ao atualizar nota");
        return;
      }

      setNotes(
        notes.map((note) =>
          note.id === noteId
            ? {
                ...note,
                content: editingContent.trim(),
                updated_at: new Date().toISOString(),
              }
            : note
        )
      );
      setEditingNoteId(null);
      setEditingContent("");
      toast.success("Nota atualizada com sucesso!");
    } catch (error) {
      console.error("Erro inesperado ao atualizar nota:", error);
      toast.error("Erro inesperado ao atualizar nota");
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm("Deseja realmente excluir esta nota?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("user_notes")
        .delete()
        .eq("id", noteId)
        .eq("user_id", userId);

      if (error) {
        console.error("Erro ao deletar nota:", error);
        toast.error("Erro ao deletar nota");
        return;
      }

      setNotes(notes.filter((note) => note.id !== noteId));
      toast.success("Nota deletada com sucesso!");
    } catch (error) {
      console.error("Erro inesperado ao deletar nota:", error);
      toast.error("Erro inesperado ao deletar nota");
    }
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingContent("");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Adicionar Nova Nota</h2>
        <Card className="border-dashed">
          <CardContent className="p-4 space-y-3">
            <Textarea
              placeholder="Digite sua nota aqui..."
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              rows={3}
              disabled={savingNote}
              className="resize-none"
            />
            <Button
              onClick={handleAddNote}
              disabled={savingNote || !newNoteContent.trim()}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Nota
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Minhas Notas</h2>
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Carregando notas...
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma nota criada ainda. Comece a adicionar notas acima!
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <Card key={note.id} className="hover:shadow-md transition-all">
                <CardContent className="p-4">
                  {editingNoteId === note.id ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        rows={4}
                        disabled={savingNote}
                        className="resize-none"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelEdit}
                          disabled={savingNote}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(note.id)}
                          disabled={savingNote || !editingContent.trim()}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                        {note.content}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(note.updated_at), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditNote(note.id, note.content)}
                            disabled={editingNoteId !== null}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Editar nota"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteNote(note.id)}
                            disabled={editingNoteId !== null}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Deletar nota"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
