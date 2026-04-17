// @ts-nocheck
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, FileText, Loader2, AlertTriangle } from 'lucide-react';

export default function AprovarRelatorioViagem() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<'crew' | 'client' | null>(null);

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
        if (authUser?.id) {
          if (authUser.id === data.tripulacao_id || authUser.id === data.tripulante_id2) {
            setRole('crew');
          }
        }

        if (data.pdf_path) {
          const { data: signed } = await supabase.storage
            .from('travel-reports')
            .createSignedUrl(data.pdf_path, 60 * 60);
          if (signed?.signedUrl) setPdfUrl(signed.signedUrl);
        } else if (data.url_pdf) {
          setPdfUrl(data.url_pdf);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

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
        actor_name: user?.email || 'cliente',
        decision,
        notes: notes || null,
      });

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
            {!user && (
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
                Você precisa estar autenticado para aprovar. <a className="underline font-semibold" href={`/#/login?redirect=/aprovar-relatorio/${token}`}>Fazer login</a>
              </div>
            )}

            {pdfUrl ? (
              <iframe src={pdfUrl} className="w-full h-[60vh] rounded-lg border" title="Relatório PDF" />
            ) : (
              <p className="text-sm text-muted-foreground">PDF do relatório não disponível.</p>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><strong>Tripulante:</strong><br />{report.nome_tripulante}</div>
              {report.nome_tripulante_2 && <div><strong>Tripulante 2:</strong><br />{report.nome_tripulante_2}</div>}
              <div><strong>Aeronave:</strong><br />{report.matricula_aeronave}</div>
              <div><strong>Total:</strong><br />R$ {Number(report.total_valor || 0).toFixed(2).replace('.', ',')}</div>
            </div>

            {!alreadyDecided && user && role && (
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
