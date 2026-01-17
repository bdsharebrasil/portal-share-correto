import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MessageSquare, Send, Search, Plus, Pin, Clock, Trash2, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Role = 'admin' | 'tripulante' | 'financeiro' | 'financeiro_master' | 'operacoes' | 'ctm' | 'piloto_chefe' | 'cotista' | 'gestor_master' | 'operador' | 'coordenador_voo';
type TargetType = 'user' | 'role' | 'all';

interface Message {
  id: string;
  author_id: string;
  author_name: string;
  author_role: string | null;
  content: string;
  target_type: string;
  is_pinned: boolean;
  created_at: string;
  is_read: boolean;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  roles: Role[];
}

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  tripulante: 'Tripulante',
  financeiro: 'Financeiro',
  financeiro_master: 'Financeiro Master',
  operacoes: 'Operações',
  ctm: 'CTM',
  piloto_chefe: 'Piloto Chefe',
  cotista: 'Cotista',
  gestor_master: 'Gestor Master',
  operador: 'Operador',
  coordenador_voo: 'Coordenador de Voo'
};

// Mapeamento de grupos com seus respectivos papéis
const GROUPS: Record<string, Role[]> = {
  'Financeiro': ['financeiro', 'financeiro_master'],
  'Adm': ['admin'],
  'Operações': ['coordenador_voo', 'ctm'],
  'Tripulação': ['piloto_chefe', 'tripulante'],
  'Gestor': ['gestor_master']
};

export default function Recados() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [targetType, setTargetType] = useState<TargetType>('all');
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [targetRoles, setTargetRoles] = useState<Role[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('recados');
    if (stored) {
      try {
        setMessages(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading messages from localStorage:', e);
      }
    }
    loadCurrentUser();
    loadUsers();
  }, []);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const loadUsers = async () => {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('*');

    if (!profiles) return;

    const usersWithRoles = await Promise.all(
      profiles.map(async (profile) => {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', profile.id);

        return {
          ...profile,
          roles: roleData?.map(r => r.role) || []
        };
      })
    );

    setUsers(usersWithRoles as any);
  };

  const saveMessagesToLocalStorage = (msgs: Message[]) => {
    localStorage.setItem('recados', JSON.stringify(msgs));
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUserId) return;

    setLoading(true);

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', currentUserId)
        .single();

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUserId)
        .limit(1)
        .maybeSingle();

      const newMsg: Message = {
        id: crypto.randomUUID(),
        author_id: currentUserId,
        author_name: profile?.full_name || 'Usuário',
        author_role: roleData?.role || null,
        content: newMessage,
        target_type: targetType,
        is_pinned: isPinned,
        created_at: new Date().toISOString(),
        is_read: false
      };

      const updatedMessages = [newMsg, ...messages];
      setMessages(updatedMessages);
      saveMessagesToLocalStorage(updatedMessages);

      toast.success('Recado enviado com sucesso!');
      setNewMessage("");
      setTargetType('all');
      setTargetUserId("");
      setTargetRoles([]);
      setIsPinned(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar recado');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = (messageId: string) => {
    const updatedMessages = messages.map(m =>
      m.id === messageId ? { ...m, is_read: true } : m
    );
    setMessages(updatedMessages);
    saveMessagesToLocalStorage(updatedMessages);
  };

  const handleTogglePin = (messageId: string, currentPinned: boolean) => {
    const updatedMessages = messages.map(m =>
      m.id === messageId ? { ...m, is_pinned: !currentPinned } : m
    ).sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    setMessages(updatedMessages);
    saveMessagesToLocalStorage(updatedMessages);
    toast.success(currentPinned ? 'Recado desafixado' : 'Recado fixado');
  };

  const handleDeleteMessage = (messageId: string, authorId: string) => {
    if (currentUserId !== authorId) {
      toast.error('Você pode deletar apenas seus próprios recados');
      return;
    }

    const updatedMessages = messages.filter(m => m.id !== messageId);
    setMessages(updatedMessages);
    saveMessagesToLocalStorage(updatedMessages);
    toast.success('Recado deletado com sucesso');
  };

  const handleToggleRole = (role: Role) => {
    setTargetRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const filteredMessages = messages.filter(msg =>
    msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.author_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const unreadCount = messages.filter(m => !m.is_read).length;
  const pinnedCount = messages.filter(m => m.is_pinned).length;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Recados</h1>
            <p className="mt-2 text-muted-foreground">
              Central de comunicação interna da equipe
            </p>
          </div>
          <Button className="flex items-center gap-2 self-start">
            <Plus className="h-4 w-4" />
            Novo Recado
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Enviar Recado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="mensagem">
                  Mensagem
                </label>
                <Textarea
                  id="mensagem"
                  placeholder="Digite sua mensagem..."
                  rows={2}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="fixar"
                    checked={isPinned}
                    onCheckedChange={(checked) => setIsPinned(checked === true)}
                  />
                  <Label htmlFor="fixar" className="text-sm text-foreground cursor-pointer">
                    Fixar no mural
                  </Label>
                </div>
                <Button onClick={handleSendMessage} disabled={loading || !newMessage.trim()}>
                  <Send className="mr-2 h-4 w-4" />
                  {loading ? 'Enviando...' : 'Enviar'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Recados da Equipe
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar recados..." className="w-full pl-10 sm:w-64" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredMessages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p>Nenhum recado encontrado</p>
              </div>
            ) : (
              filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg border border-border p-4 transition-colors hover:bg-accent ${msg.is_read ? "" : "border-primary/20 bg-primary/5"
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src="" alt={msg.author_name} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(msg.author_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-foreground">{msg.author_name}</h4>
                        {msg.author_role && (
                          <Badge variant="outline" className="text-xs">
                            {ROLE_LABELS[msg.author_role as Role] || msg.author_role}
                          </Badge>
                        )}
                        {msg.is_pinned && <Pin className="h-3 w-3 text-yellow-600" />}
                        {!msg.is_read && (
                          <Badge className="bg-primary text-primary-foreground text-xs">
                            Novo
                          </Badge>
                        )}
                      </div>
                      <p className="mb-2 text-foreground">{msg.content}</p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ptBR })}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {!msg.is_read && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMarkAsRead(msg.id)}
                              className="flex items-center gap-1"
                              title="Marcar como lido"
                            >
                              <Check className="h-3 w-3" />
                              lido
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTogglePin(msg.id, msg.is_pinned)}
                            title={msg.is_pinned ? "Desafixar" : "Fixar"}
                          >
                            <Pin className="h-4 w-4" />
                          </Button>
                          {currentUserId === msg.author_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteMessage(msg.id, msg.author_id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Deletar recado"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
