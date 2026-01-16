import React, { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, AlertTriangle, Calendar, Clock, Repeat, DollarSign, Trash2, Edit2, CheckCircle, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { format, isBefore, isWithinInterval, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AgendamentoPagamentoForm } from "@/components/agendamento-pagamentos/AgendamentoPagamentoForm";
import { syncAgendamentoPagamentoToControle, removeAgendamentoPagamentoFromControle } from "@/services/syncSalariesToBankingControl";

export default function AgendamentoPagamentos() {
  const { user } = useAuth();
  const { isAdmin, isGestorMaster, isFinanceiroMaster } = useUserRole();
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAgendamento, setEditingAgendamento] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const isAuthorized = isAdmin || isGestorMaster || isFinanceiroMaster;

  useEffect(() => {
    if (isAuthorized) {
      loadAgendamentos();
    }
  }, [isAuthorized]);

  const loadAgendamentos = async () => {
    if (!isAuthorized) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("agendamento_pagamentos")
        .select("*")
        .order("data_agendamento", { ascending: true });

      if (error) {
        toast.error(`Erro ao carregar: ${error.message}`);
        return;
      }

      setAgendamentos(data || []);
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar agendamentos");
    }
    setIsLoading(false);
  };

  const getAgendamentoStats = () => {
    const today = new Date();
    const next7Days = addDays(today, 7);

    const totalAgendados = agendamentos.filter(a => a.status === 'agendado').length;
    const proximosPorVencer = agendamentos.filter(a =>
      a.status === 'agendado' &&
      isWithinInterval(new Date(a.data_agendamento), { start: today, end: next7Days })
    ).length;
    const recorrentes = agendamentos.filter(a => a.eh_recorrente && a.status === 'agendado').length;
    const valorTotal = agendamentos
      .filter(a => a.status === 'agendado')
      .reduce((sum, a) => sum + parseFloat(a.valor), 0);

    return { totalAgendados, proximosPorVencer, recorrentes, valorTotal };
  };

  const upcomingPayments = useMemo(() => {
    const today = new Date();
    const next7Days = addDays(today, 7);
    return agendamentos.filter(a => {
      return a.status === 'agendado' &&
        isWithinInterval(new Date(a.data_agendamento), { start: today, end: next7Days });
    });
  }, [agendamentos]);

  const stats = getAgendamentoStats();

  const handleEdit = (agendamento: any) => {
    setEditingAgendamento(agendamento);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;

    try {
      // Remove do controle bancário se existir
      await removeAgendamentoPagamentoFromControle(deleteConfirmId);

      // Remove o agendamento
      const { error } = await supabase
        .from("agendamento_pagamentos")
        .delete()
        .eq("id", deleteConfirmId);

      if (error) {
        toast.error(`Erro ao deletar: ${error.message}`);
        return;
      }

      toast.success("Agendamento deletado com sucesso!");
      setDeleteConfirmId(null);
      loadAgendamentos();
    } catch (error: any) {
      toast.error(error.message || "Erro ao deletar");
    }
  };

  const handleMarkAsPaid = async (agendamento: any) => {
    try {
      // Primeiro, sincroniza o pagamento com o controle bancário
      await syncAgendamentoPagamentoToControle(agendamento, user?.id);

      // Depois, atualiza o status no agendamento
      const { error } = await supabase
        .from("agendamento_pagamentos")
        .update({ status: 'pago' })
        .eq("id", agendamento.id);

      if (error) {
        toast.error(`Erro ao atualizar: ${error.message}`);
        return;
      }

      toast.success("Pagamento sincronizado com o controle bancário!");
      loadAgendamentos();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar");
    }
  };

  const handleOpenForm = (agendamento?: any) => {
    setEditingAgendamento(agendamento || null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingAgendamento(null);
  };

  const handleFormSuccess = () => {
    handleCloseForm();
    loadAgendamentos();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pago":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "agendado":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "cancelado":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string, isOverdue?: boolean) => {
    if (isOverdue && status === 'agendado') return 'Vencido';
    switch (status) {
      case "pago":
        return "Pago";
      case "agendado":
        return "Agendado";
      case "cancelado":
        return "Cancelado";
      default:
        return status;
    }
  };

  if (!isAuthorized) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <p className="text-destructive font-semibold">Acesso negado</p>
              <p className="text-sm text-muted-foreground mt-2">Você não tem permissão para acessar esta página.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-[calc(100vh-4rem)] p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">Agendamento de Contas</h1>
              <p className="text-primary-foreground/80 mt-1">Gerencie pagamentos agendados e recorrentes</p>
            </div>
            {!showForm && (
              <Button
                onClick={() => handleOpenForm()}
                className="bg-background text-foreground hover:bg-background/90"
              >
                <Plus className="w-5 h-5 mr-2" />
                Agendar Pagamento
              </Button>
            )}
          </div>
        </div>

        {/* Alerta de vencimentos próximos */}
        {upcomingPayments.length > 0 && (
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-400">
              Você tem <strong>{upcomingPayments.length}</strong> pagamento(s) próximo(s) do vencimento nos próximos 7 dias.
            </AlertDescription>
          </Alert>
        )}

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Agendado</p>
                  <p className="text-2xl font-bold text-primary">{stats.totalAgendados}</p>
                </div>
                <Calendar className="w-8 h-8 text-primary/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Próximos 7 dias</p>
                  <p className="text-2xl font-bold text-amber-500">{stats.proximosPorVencer}</p>
                </div>
                <Clock className="w-8 h-8 text-amber-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Recorrentes</p>
                  <p className="text-2xl font-bold text-green-500">{stats.recorrentes}</p>
                </div>
                <Repeat className="w-8 h-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="text-2xl font-bold text-purple-500">
                    R$ {stats.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-purple-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Formulário Inline */}
        {showForm && (
          <AgendamentoPagamentoForm
            agendamento={editingAgendamento}
            onSuccess={handleFormSuccess}
            onCancel={handleCloseForm}
          />
        )}

        {/* Lista de Agendamentos */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Pagamentos Agendados</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-32">
                <p className="text-muted-foreground">Carregando...</p>
              </div>
            ) : agendamentos.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">Nenhum pagamento agendado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {agendamentos.map((agendamento) => {
                  const isOverdue = isBefore(new Date(agendamento.data_agendamento), new Date()) && agendamento.status === 'agendado';
                  const rowClass = agendamento.status === 'pago' 
                    ? 'bg-green-500/10 border-l-4 border-l-green-500' 
                    : isOverdue 
                      ? 'bg-red-500/10 border-l-4 border-l-red-500' 
                      : 'bg-muted/30 border-l-4 border-l-primary';

                  return (
                    <div key={agendamento.id} className={`p-4 rounded-lg ${rowClass}`}>
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground">{agendamento.descricao}</h3>
                          <p className="text-sm text-muted-foreground">Fornecedor: {agendamento.fornecedor}</p>
                          <div className="flex items-center gap-4 mt-2 flex-wrap">
                            <Badge className={getStatusColor(agendamento.status)}>
                              {getStatusLabel(agendamento.status, isOverdue)}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(agendamento.data_agendamento), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                            {agendamento.categoria && (
                              <Badge variant="outline" className="text-xs">
                                {agendamento.categoria}
                              </Badge>
                            )}
                            {agendamento.eh_recorrente && (
                              <Badge variant="outline" className="gap-1">
                                <Repeat className="w-3 h-3" />
                                {agendamento.frequencia_recorrencia === 'mensal' ? 'Mensal' :
                                  agendamento.frequencia_recorrencia === 'trimestral' ? 'Trimestral' :
                                    agendamento.frequencia_recorrencia === 'anual' ? 'Anual' : 'Semanal'}
                                {agendamento.dia_recorrencia && ` - Dia ${agendamento.dia_recorrencia}`}
                              </Badge>
                            )}
                            {agendamento.lembrete_antecipado && (
                              <Badge variant="outline" className="gap-1 text-amber-500 border-amber-500/30">
                                <Bell className="w-3 h-3" />
                                Lembrete
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 w-full md:w-auto">
                          <p className="font-bold text-lg text-foreground">
                            R$ {parseFloat(agendamento.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          <div className="flex gap-2">
                            {agendamento.status === 'agendado' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleMarkAsPaid(agendamento)}
                                className="hover:bg-green-500/20 hover:text-green-400"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Pago
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(agendamento)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirmId(agendamento.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog de confirmação de exclusão */}
        <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Exclusão</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">Deseja realmente deletar este agendamento? Esta ação não pode ser desfeita.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Deletar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
