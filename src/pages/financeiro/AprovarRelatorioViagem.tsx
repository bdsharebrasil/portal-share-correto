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
import { syncTravelReportToFinance } from '@/lib/travelReportFinanceSync';


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

        // Buscar user_ids reais dos tripulantes vinculados
        const crewIds: string[] = [];
        for (const cid of [data.tripulacao_id, data.tripulante_id2].filter(Boolean)) {
          const { data: m } = await supabase
            .from('membros_tripulacao')
            .select('user_id')
            .eq('id', cid)
            .maybeSingle();
          if (m?.user_id) crewIds.push(m.user_id);
        }

        // Token único autoriza visualização. Se logado como tripulante, marca papel 'crew'.
        // Sem login: assumimos papel 'crew' baseado no token (link privado) — ele poderá aprovar.
        if (authUser && crewIds.includes(authUser.id)) {
          setRole('crew');
        } else if (data.requires_client_approval && !authUser) {
          setShowClientLogin(true);
        } else {
          // Acesso via token sem cliente: tratamos como crew (token é a credencial)
          setRole('crew');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // Carrega o PDF sempre que houver relatório (token já é a credencial)
  useEffect(() => {
    if (!report) return;
    (async () => {
      if (report.pdf_path) {
        const { data: signed } = await supabase.storage
          .from('travel-reports')
          .createSignedUrl(report.pdf_path, 60 * 60);
        if (signed?.signedUrl) { setPdfUrl(signed.signedUrl); return; }
      }
      if (report.pdf_url) setPdfUrl(report.pdf_url);
    })();
  }, [report]);


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
    if (!role) {
      toast.error('Não foi possível identificar seu papel neste relatório');
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
      if (decision === 'approved' && isCrew) updates.status = 'aprovado_tripulante';


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

      // Aprovação do tripulante → notificar admins + financeiro_master e sincronizar com financeiro (contas a pagar Share)
      if (decision === 'approved' && isCrew) {
        try {
          const { data: adminRoles } = await supabase
            .from('user_roles')
            .select('user_id, role')
            .in('role', ['admin', 'financeiro_master']);
          const uniqUserIds = Array.from(new Set((adminRoles || []).map((r: any) => r.user_id).filter(Boolean)));
          if (uniqUserIds.length > 0) {
            await supabase.from('notifications').insert(
              uniqUserIds.map((uid: string) => ({
                user_id: uid,
                title: '✅ Relatório aprovado pelo tripulante',
                message: `${report.nome_tripulante} aprovou o relatório nº ${report.numero_relatorio}. Pronto para envio ao cliente.`,
                type: 'success',
                read: false,
              }))
            );
          }
        } catch (e) {
          console.warn('Erro ao notificar admins:', e);
        }

        try {
          await syncTravelReportToFinance({
            reportId: report.id,
            numeroRelatorio: report.numero_relatorio,
            clientesId: report.clientes_id,
            clienteNome: report.clientes_id_rel?.razao_social || '',
            aeronaveId: report.aeronave_id,
            matriculaAeronave: report.matricula_aeronave,
            tripulacaoId: report.tripulacao_id,
            nomeTripulante: report.nome_tripulante,
            tripulanteId2: report.tripulante_id2,
            nomeTripulante2: report.nome_tripulante_2,
            totalCrew1: Number(report.total_trip || 0),
            totalCrew2: Number(report.total_trip2 || 0),
            totalSharebrasil: Number(report.total_sharebrasil || 0),
            dataReferencia: report.data_fim || report.data_inicio || new Date().toISOString().slice(0, 10),
            userId: user?.id || report.generated_by_user_id || null,
          });
        } catch (e) {
          console.warn('Erro ao sincronizar financeiro:', e);
        }
      }



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

            {/* Relatório em tela — sempre visível, sem depender de PDF */}
            <Card className="border-border bg-card/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Resumo do Relatório</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><p className="text-xs text-muted-foreground">Nº Relatório</p><p className="font-semibold">{report.numero_relatorio || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Rota</p><p className="font-semibold">{report.rota || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Data Início</p><p className="font-semibold">{report.data_inicio ? new Date(report.data_inicio).toLocaleDateString('pt-BR') : '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Data Fim</p><p className="font-semibold">{report.data_fim ? new Date(report.data_fim).toLocaleDateString('pt-BR') : '—'}</p></div>
                </div>

                <div className="pt-3 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">DESPESAS POR CATEGORIA</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      ['Combustível', report.total_combustivel],
                      ['Hospedagem', report.total_hospedagem],
                      ['Alimentação', report.total_alimentacao],
                      ['Transporte', report.total_transporte],
                      ['Outros', report.total_outros],
                    ].map(([label, val]) => (
                      <div key={label as string} className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="font-bold text-primary">R$ {Number(val || 0).toFixed(2).replace('.', ',')}</p>
                      </div>
                    ))}
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-bold text-primary text-lg">R$ {Number(report.total_valor || 0).toFixed(2).replace('.', ',')}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border grid grid-cols-3 gap-3">
                  <div><p className="text-xs text-muted-foreground">Tripulante</p><p className="font-semibold text-emerald-600">R$ {Number(report.total_tripulacao || 0).toFixed(2).replace('.', ',')}</p></div>
                  <div><p className="text-xs text-muted-foreground">Cliente</p><p className="font-semibold text-blue-600">R$ {Number(report.total_clientes || 0).toFixed(2).replace('.', ',')}</p></div>
                  <div><p className="text-xs text-muted-foreground">ShareBrasil</p><p className="font-semibold text-orange-600">R$ {Number(report.total_sharebrasil || 0).toFixed(2).replace('.', ',')}</p></div>
                </div>

                {report.observacoes && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">OBSERVAÇÕES</p>
                    <p className="whitespace-pre-wrap">{report.observacoes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* PDF opcional — só aparece se existir */}
            {pdfUrl && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">DOCUMENTO PDF (opcional)</p>
                <iframe
                  src={pdfUrl}
                  className="w-full h-[60vh] rounded-lg border"
                  title="Relatório PDF"
                />
                <p className="text-xs text-muted-foreground">
                  Se o PDF não aparecer, <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">clique aqui para abrir em nova aba</a>
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><strong>Tripulante:</strong><br />{report.nome_tripulante}</div>
              {report.nome_tripulante_2 && <div><strong>Tripulante 2:</strong><br />{report.nome_tripulante_2}</div>}
              <div><strong>Aeronave:</strong><br />{report.matricula_aeronave}</div>
              <div><strong>Total:</strong><br />R$ {Number(report.total_valor || 0).toFixed(2).replace('.', ',')}</div>
            </div>

            {!alreadyDecided && role && !showClientLogin && (
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
