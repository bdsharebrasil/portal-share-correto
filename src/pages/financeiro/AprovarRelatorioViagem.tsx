// @ts-nocheck
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, FileText, Loader2, AlertTriangle, AlertCircle } from 'lucide-react';

export default function AprovarRelatorioViagem() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<'crew' | 'client' | null>(null);
  const [clientLogin, setClientLogin] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [showClientLogin, setShowClientLogin] = useState(false);
  const [clientAuthenticating, setClientAuthenticating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        setUser(authUser);

        const { data, error } = await supabase
          .from('travel_expense_reports')
          .select('*, clientes_id_rel:clientes_id(razao_social)')
          .eq('approval_token', token)
          .maybeSingle();

        if (error || !data) {
          toast.error('Link de aprovação inválido');
          setLoading(false);
          return;
        }

        setReport(data);

        // Detectar papel: tripulante (auth.users) ou cliente (portal)
        const isCrew = authUser?.id === data.tripulacao_id || authUser?.id === data.tripulante_id2;

        if (isCrew) {
          setRole('crew');
        } else if (data.requires_client_approval && !authUser) {
          // Se cliente precisa de aprovação e não há usuário autenticado, mostrar formulário de login
          setShowClientLogin(true);
        }

      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // Carrega o PDF apenas quando o usuário está autenticado
  useEffect(() => {
    if (!report || (!user && role !== 'client')) {
      return;
    }

    (async () => {
      if (report.pdf_path) {
        const { data: signed } = await supabase.storage
          .from('travel-reports')
          .createSignedUrl(report.pdf_path, 60 * 60);
        if (signed?.signedUrl) setPdfUrl(signed.signedUrl);
      } else if (report.url_pdf) {
        setPdfUrl(report.url_pdf);
      }
    })();
  }, [report, user, role]);

  const handleClientLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientLogin || !clientPassword || !report) {
      toast.error('Informe login e senha');
      return;
    }

    setClientAuthenticating(true);
    try {
      // Verificar credenciais do cliente no portal
      const { data: clientAuth, error } = await supabase
        .from('autenticacao_portal_cliente')
        .select('id, clientes_id, login, ativo, hash_senha')
        .eq('login', clientLogin)
        .maybeSingle();

      if (error || !clientAuth) {
        toast.error('Login não encontrado');
        return;
      }

      if (!clientAuth.ativo) {
        toast.error('Acesso desativado');
        return;
      }

      // Verificar se é o cliente do relatório
      if (clientAuth.clientes_id !== report.clientes_id) {
        toast.error('Você não tem acesso a este relatório');
        return;
      }

      // Validar senha - comparação direta (as senhas são armazenadas em texto na BD)
      if (clientAuth.hash_senha !== clientPassword) {
        toast.error('Senha incorreta');
        return;
      }

      // Autenticação bem-sucedida
      setRole('client');
      setUser({ id: clientAuth.id, login: clientAuth.login });
      setShowClientLogin(false);
      setClientLogin('');
      setClientPassword('');
      toast.success('Autenticação bem-sucedida!');
    } catch (err: any) {
      toast.error('Erro ao autenticar');
      console.error(err);
    } finally {
      setClientAuthenticating(false);
    }
  };

  const submitDecision = async (decision: 'approved' | 'rejected') => {
    if (!report) return;
    if (!user && role !== 'client') {
      toast.error('Você precisa estar logado para aprovar');
      return;
    }
    setSubmitting(true);
    try {
      const isCrew = role === 'crew';
      const updates: any = {};
      if (isCrew) {
        updates.crew_approval_status = decision;
        updates.crew_approved_at = new Date().toISOString();
        updates.crew_approval_notes = notes || null;
      } else {
        updates.client_approval_status = decision;
        updates.client_approved_at = new Date().toISOString();
        updates.client_approval_notes = notes || null;
      }
      if (decision === 'rejected') updates.status = 'em_revisao';

      const { error } = await supabase
        .from('travel_expense_reports')
        .update(updates)
        .eq('id', report.id);
      if (error) throw error;

      await supabase.from('travel_report_approval_log').insert({
        travel_report_id: report.id,
        actor_type: isCrew ? 'crew' : 'client',
        actor_id: user?.id || null,
        actor_name: user?.email || user?.login || 'cliente',
        decision,
        notes: notes || null,
      });

      // Se discordância (rejected), enviar notificações
      if (decision === 'rejected') {
        try {
          const notificationsToCreate = [];

          if (isCrew) {
            // Tripulante discordou - notificar gerente/admin que criou o relatório
            if (report.generated_by_user_id) {
              notificationsToCreate.push({
                user_id: report.generated_by_user_id,
                title: '⚠️ Tripulante Discordou de Relatório',
                message: `${report.nome_tripulante} discordou do relatório nº ${report.numero_relatorio}. Motivo: ${notes || 'Não informado'}`,
                type: 'warning',
                read: false,
              });
            }

            // Também notificar cliente se ele precisa aprovar (via portal)
            if (report.requires_client_approval && report.clientes_id) {
              try {
                const { data: clientAuth } = await supabase
                  .from('autenticacao_portal_cliente')
                  .select('id')
                  .eq('clientes_id', report.clientes_id)
                  .eq('ativo', true)
                  .maybeSingle();

                if (clientAuth?.id) {
                  notificationsToCreate.push({
                    user_id: clientAuth.id,
                    title: '⚠️ Relatório Aguardando Revisão',
                    message: `O tripulante identificou divergências no relatório nº ${report.numero_relatorio}. O documento será revisado.`,
                    type: 'warning',
                    read: false,
                  });
                }
              } catch (err) {
                console.warn('Erro ao buscar cliente para notificação:', err);
              }
            }
          } else {
            // Cliente discordou - notificar gerente/admin que criou o relatório
            if (report.generated_by_user_id) {
              notificationsToCreate.push({
                user_id: report.generated_by_user_id,
                title: '⚠️ Cliente Discordou de Relatório',
                message: `${report.clientes_id_rel?.razao_social} discordou do relatório nº ${report.numero_relatorio}. Motivo: ${notes || 'Não informado'}`,
                type: 'warning',
                read: false,
              });
            }

            // Também notificar tripulante
            if (report.tripulacao_id) {
              try {
                const { data: crewMember } = await supabase
                  .from('membros_tripulacao')
                  .select('user_id')
                  .eq('id', report.tripulacao_id)
                  .single();

                if (crewMember?.user_id) {
                  notificationsToCreate.push({
                    user_id: crewMember.user_id,
                    title: '⚠️ Relatório Aguardando Revisão',
                    message: `O cliente identificou divergências no relatório nº ${report.numero_relatorio}. O documento será revisado.`,
                    type: 'warning',
                    read: false,
                  });
                }
              } catch (err) {
                console.warn('Erro ao buscar tripulante para notificação:', err);
              }
            }
          }

          // Inserir todas as notificações
          if (notificationsToCreate.length > 0) {
            const { error: notifError } = await supabase
              .from('notifications')
              .insert(notificationsToCreate);
            if (notifError) {
              console.error('Erro ao enviar notificações de discordância:', notifError);
            }
          }
        } catch (notifErr) {
          console.error('Erro ao criar notificações de discordância:', notifErr);
        }
      }

      toast.success(decision === 'approved' ? '✓ Relatório aprovado!' : 'Relatório devolvido para revisão');
      setReport({ ...report, ...updates });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar decisão');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-2">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-bold">Link inválido</h2>
            <p className="text-muted-foreground text-sm">Este link de aprovação não foi encontrado ou expirou.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const myStatus = role === 'crew' ? report.crew_approval_status : report.client_approval_status;
  const alreadyDecided = myStatus === 'approved' || myStatus === 'rejected';

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Mensagem de boas-vindas */}
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 shadow-md">
          <CardContent className="p-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 flex items-start pt-1">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-blue-900 mb-2">
                  Olá Tripulante! 👋
                </h2>
                <p className="text-blue-800 leading-relaxed">
                  Por gentileza, verifique seu relatório e nos confirme se está em conformidade. Caso identifique alguma divergência, é só marcar o que precisa ser ajustado. Estamos aqui para ajudar!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Aprovação de Relatório de Viagem
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {report.numero_relatorio} · {report.clientes_id_rel?.razao_social}
                </p>
              </div>
              <Badge variant={alreadyDecided ? (myStatus === 'approved' ? 'default' : 'destructive') : 'secondary'}>
                {myStatus === 'approved' ? 'Aprovado' : myStatus === 'rejected' ? 'Em revisão' : 'Pendente'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showClientLogin && !user && report?.requires_client_approval && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4 text-blue-900">Login do Cliente</h3>
                  <form onSubmit={handleClientLogin} className="space-y-4">
                    <div>
                      <Label htmlFor="client-login" className="text-blue-900">Login</Label>
                      <Input
                        id="client-login"
                        type="text"
                        value={clientLogin}
                        onChange={(e) => setClientLogin(e.target.value)}
                        placeholder="Seu login"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="client-password" className="text-blue-900">Senha</Label>
                      <Input
                        id="client-password"
                        type="password"
                        value={clientPassword}
                        onChange={(e) => setClientPassword(e.target.value)}
                        placeholder="Sua senha"
                        className="mt-1"
                      />
                    </div>
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={clientAuthenticating}>
                      {clientAuthenticating ? 'Autenticando...' : 'Entrar'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {!user && role !== 'client' && !showClientLogin && (
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
                Você precisa estar autenticado para aprovar. <a className="underline font-semibold" href={`/#/login?redirect=/aprovar-relatorio/${token}`}>Fazer login</a>
              </div>
            )}

            {/* Mostrar PDF apenas se usuário está autenticado (crew ou cliente) */}
            {(user || role === 'client') && pdfUrl ? (
              <div className="space-y-2">
                <iframe
                  src={pdfUrl}
                  className="w-full h-[60vh] rounded-lg border"
                  title="Relatório PDF"
                  onError={() => {
                    toast.error('❌ Erro ao carregar o PDF');
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Se o PDF não aparecer, <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">clique aqui para abrir em nova aba</a>
                </p>
              </div>
            ) : (
              <Card className="border-amber-200 bg-amber-50 p-6">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-amber-900">PDF não disponível</h3>
                    <p className="text-sm text-amber-800 mt-1">
                      O PDF do relatório ainda não foi gerado. Por favor, aguarde alguns momentos e recarregue a página.
                    </p>
                    <p className="text-xs text-amber-700 mt-2">
                      Se o problema persistir, entre em contato com o gerenciador do sistema.
                    </p>
                    <button
                      onClick={() => window.location.reload()}
                      className="mt-3 text-amber-700 font-semibold hover:underline"
                    >
                      ↻ Recarregar página
                    </button>
                  </div>
                </div>
              </Card>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><strong>Tripulante:</strong><br />{report.nome_tripulante}</div>
              {report.nome_tripulante_2 && <div><strong>Tripulante 2:</strong><br />{report.nome_tripulante_2}</div>}
              <div><strong>Aeronave:</strong><br />{report.matricula_aeronave}</div>
              <div><strong>Total:</strong><br />R$ {Number(report.total_valor || 0).toFixed(2).replace('.', ',')}</div>
            </div>

            {!alreadyDecided && (user || role === 'client') && role && (
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="notes">Observações (opcional — obrigatório se discordar)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: valor da hospedagem do dia 12 está divergente..."
                  rows={3}
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!notes.trim()) {
                        toast.error('Informe o motivo da discordância');
                        return;
                      }
                      submitDecision('rejected');
                    }}
                    disabled={submitting}
                    className="gap-2"
                  >
                    <XCircle className="h-4 w-4 text-destructive" />
                    Discordo / Devolver
                  </Button>
                  <Button
                    onClick={() => submitDecision('approved')}
                    disabled={submitting}
                    className="gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Conferi e aprovo
                  </Button>
                </div>
              </div>
            )}

            {alreadyDecided && (
              <div className="p-4 rounded-lg bg-muted text-sm">
                <strong>Sua decisão já foi registrada:</strong> {myStatus === 'approved' ? 'aprovado' : 'devolvido para revisão'}
                {(role === 'crew' ? report.crew_approval_notes : report.client_approval_notes) && (
                  <p className="mt-2 text-muted-foreground">
                    Observações: {role === 'crew' ? report.crew_approval_notes : report.client_approval_notes}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
