import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  MessageSquare,
  Send,
  Search,
  Plus,
  Pin,
  Clock,
  Trash2,
  Check,
  ChevronDown,
  Eye,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Role = 'admin' | 'tripulante' | 'financeiro' | 'financeiro_master' | 'operacoes' | 'ctm' | 'piloto_chefe' | 'cotista' | 'gestor_master' | 'operador' | 'coordenador_voo';

interface Message {
  id: string;
  author_id: string;
  author_name: string;
  author_role: Role | null;
  content: string;
  departamento: string | null;
  is_pinned: boolean;
  created_at: string;
  is_read: boolean;
  lido_por?: string[];
}

interface RecadosRow {
  id: string;
  autor_id: string;
  mensagem: string;
  fixado?: boolean | null;
  departamento?: string | null;
  lido_por?: string[] | null;
  criado_em?: string | null;
  created_at?: string | null;
  atualizado_em?: string | null;
  updated_at?: string | null;
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
  const [currentUserRoles, setCurrentUserRoles] = useState<Role[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [targetRoles, setTargetRoles] = useState<Role[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Controla se o formulário de "Enviar Recado" está expandido
  const [showComposer, setShowComposer] = useState(false);
  // Controla a abertura do combobox de departamentos
  const [deptPopoverOpen, setDeptPopoverOpen] = useState(false);

  // Load from Supabase on mount
  useEffect(() => {
    loadCurrentUser();
    loadUsers();
  }, []);

  // Load messages after currentUserId is available so is_read is correct
  useEffect(() => {
    loadMessages();
  }, [currentUserId]);

  // Realtime subscription to messages
  useEffect(() => {
    if (!currentUserId) return;

    const subscription = supabase
      .channel('recados')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recados' }, (payload) => {
        loadMessages();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentUserId]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);

      // Load user roles
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const roles = (roleData?.map(r => r.role) || []) as Role[];
      setCurrentUserRoles(roles);
    }
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
          roles: (roleData?.map(r => r.role) || []) as Role[]
        };
      })
    );

    setUsers(usersWithRoles as any);
  };

  const loadMessages = async () => {
    const { data, error } = (await supabase
      .from('recados')
      .select('*')
      .order('fixado', { ascending: false })
      .order('criado_em', { ascending: false })) as {
        data: RecadosRow[] | null;
        error: { message?: string } | null;
      };

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    // Mapa de autores para obter nomes e roles
    const authorMap = new Map<string, {
      name: string;
      role: Role | null;
    }>();

    // Enriquecer mensagens com informações do autor
    const enrichedMessages = await Promise.all(
      (data || []).map(async (msg: RecadosRow) => {
        if (!authorMap.has(msg.autor_id)) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', msg.autor_id)
            .single();

          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', msg.autor_id)
            .limit(1)
            .maybeSingle();

          authorMap.set(msg.autor_id, {
            name: profile?.full_name || 'Usuário',
            role: (roleData?.role as Role | null) || null,
          });
        }

        const author = authorMap.get(msg.autor_id)!;

        const createdAt = (msg as { criado_em?: string | null; created_at?: string | null }).criado_em
          ?? (msg as { criado_em?: string | null; created_at?: string | null }).created_at
          ?? new Date().toISOString();

        return {
          id: msg.id,
          author_id: msg.autor_id,
          author_name: author.name,
          author_role: author.role,
          content: msg.mensagem,
          departamento: msg.departamento,
          is_pinned: msg.fixado || false,
          created_at: createdAt,
          is_read: currentUserId ? (msg.lido_por?.includes(currentUserId) || false) : false,
          lido_por: msg.lido_por || []
        } as Message;
      })
    );

    setMessages(enrichedMessages);
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

      let departamento = 'todos';
      if (targetRoles.length > 0) {
        departamento = targetRoles.join(',');
      }

      const { data: newMsg, error } = await supabase
        .from('recados')
        .insert({
          autor_id: currentUserId,
          mensagem: newMessage,
          fixado: isPinned,
          departamento: departamento
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Recado enviado com sucesso!');
      setNewMessage("");
      setTargetRoles([]);
      setIsPinned(false);
      setShowComposer(false);
      loadMessages();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar recado');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (messageId: string) => {
    if (!currentUserId) return;

    try {
      const { error } = await supabase.rpc('marcar_recado_lido', {
        p_recado_id: messageId,
      });

      if (error) throw error;

      loadMessages();
    } catch (error: any) {
      toast.error('Erro ao marcar como lido');
    }
  };

  const handleTogglePin = async (messageId: string, currentPinned: boolean) => {
    try {
      const { error } = await supabase
        .from('recados')
        .update({ fixado: !currentPinned })
        .eq('id', messageId);

      if (error) throw error;

      toast.success(currentPinned ? 'Recado desafixado' : 'Recado fixado');
      loadMessages();
    } catch (error: any) {
      toast.error('Erro ao fixar/desafixar recado');
    }
  };

  const handleDeleteMessage = async (messageId: string, authorId: string) => {
    if (currentUserId !== authorId && !currentUserRoles.includes('admin')) {
      toast.error('Você pode deletar apenas seus próprios recados');
      return;
    }

    try {
      const { error } = await supabase
        .from('recados')
        .delete()
        .eq('id', messageId);

      if (error) throw error;

      toast.success('Recado deletado com sucesso');
      loadMessages();
    } catch (error: any) {
      toast.error('Erro ao deletar recado');
    }
  };

  const filteredMessages = messages.filter(msg => {
    // Sempre filtra por search
    const matchesSearch = msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.author_name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Admin veem tudo
    if (currentUserRoles.includes('admin') || currentUserRoles.includes('financeiro_master')) {
      return true;
    }


    // Se for para departamentos específicos, verifica se o usuário está em algum deles
    if (msg.departamento) {
      const msgDepartamentos = msg.departamento.split(',');
      return msgDepartamentos.some((dept: string) => currentUserRoles.includes(dept as Role));
    }

    return false;
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  // Nomes dos leitores de um recado, a partir do array lido_por (ids)
  const getReaderNames = (lidoPor?: string[]) => {
    if (!lidoPor || lidoPor.length === 0) return [];
    return lidoPor.map((id) => users.find((u) => u.id === id)?.full_name || 'Usuário');
  };

  // Alterna a seleção de um grupo inteiro de papéis no combobox de departamentos
  const toggleGroup = (roles: Role[]) => {
    const allSelected = roles.every(r => targetRoles.includes(r));
    if (allSelected) {
      setTargetRoles(prev => prev.filter(r => !roles.includes(r)));
    } else {
      setTargetRoles(prev => {
        const newRoles = [...prev];
        roles.forEach(r => {
          if (!newRoles.includes(r)) newRoles.push(r);
        });
        return newRoles;
      });
    }
  };

  // Nomes dos grupos totalmente selecionados, para exibir no botão do combobox
  const selectedGroupNames = Object.entries(GROUPS)
    .filter(([, roles]) => roles.every(r => targetRoles.includes(r)))
    .map(([groupName]) => groupName);

  const departamentoLabel = targetRoles.length === 0
    ? 'Todos'
    : selectedGroupNames.length > 0
      ? selectedGroupNames.join(', ')
      : `${targetRoles.length} papel(is) selecionado(s)`;

  const unreadCount = filteredMessages.filter(m => !m.is_read).length;
  const pinnedCount = filteredMessages.filter(m => m.is_pinned).length;

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
        </div>

        <Card className="mb-6">
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setShowComposer(prev => !prev)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Enviar Recado
              </CardTitle>
              <ChevronDown
                className={`h-5 w-5 text-muted-foreground transition-transform ${showComposer ? 'rotate-180' : ''}`}
              />
            </div>
          </CardHeader>
          {showComposer && (
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="mensagem">
                      Mensagem
                    </label>
                    <Textarea
                      id="mensagem"
                      placeholder="Digite sua mensagem..."
                      rows={2}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Enviar para
                    </label>
                    <Popover open={deptPopoverOpen} onOpenChange={setDeptPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={deptPopoverOpen}
                          className="w-full justify-between font-normal"
                        >
                          <span className="truncate">{departamentoLabel}</span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-3" align="start">
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={targetRoles.length === 0}
                              onCheckedChange={() => setTargetRoles([])}
                            />
                            <span className="text-sm">Todos</span>
                          </label>
                          <div className="mt-2 space-y-2 border-t border-border pt-2">
                            {Object.entries(GROUPS).map(([groupName, roles]) => (
                              <label key={groupName} className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                  checked={roles.every(r => targetRoles.includes(r))}
                                  onCheckedChange={() => toggleGroup(roles)}
                                />
                                <span className="text-sm">{groupName}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
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
              </div>
            </CardContent>
          )}
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
                <Input
                  placeholder="Buscar recados..."
                  className="w-full pl-10 sm:w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredMessages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p>Nenhum recado criado</p>
               
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const readerNames = getReaderNames(msg.lido_por);
                return (
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
                        <p className="mb-2 text-foreground whitespace-pre-wrap">{msg.content}</p>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ptBR })}
                            </span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="flex items-center gap-1 hover:text-foreground"
                                  title="Ver quem leu"
                                >
                                  <Eye className="h-3 w-3" />
                                  {readerNames.length > 0
                                    ? `${readerNames.length} lido(s)`
                                    : 'Ninguém leu'}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-56 p-2" align="start">
                                {readerNames.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">Ninguém leu ainda</p>
                                ) : (
                                  <ul className="space-y-1 text-sm">
                                    {readerNames.map((name, idx) => (
                                      <li key={idx} className="flex items-center gap-2">
                                        <Check className="h-3 w-3 text-primary" />
                                        {name}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </PopoverContent>
                            </Popover>
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
                                Lido
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
                            {(currentUserId === msg.author_id || currentUserRoles.includes('admin')) && (
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
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}