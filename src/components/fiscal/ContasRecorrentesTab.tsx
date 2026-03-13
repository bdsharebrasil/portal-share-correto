import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, AlertTriangle, Calendar, Clock, Repeat, DollarSign, Trash2, Edit2, CheckCircle, Bell, FileCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, isBefore, isWithinInterval, addDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ContaRecorrenteForm } from "@/components/fiscal/ContaRecorrenteForm";

const MONTHS = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" }
];

export function ContasRecorrentesTab() {
  const { user } = useAuth();
  const [contas, setContas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingConta, setEditingConta] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateMonth, setGenerateMonth] = useState<string>("");
  const [generateYear, setGenerateYear] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadContas();
  }, []);

  const loadContas = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("contas_recorrentes")
        .select("*")
        .order("dia_recorrencia", { ascending: true });

      if (error) {
        toast.error(`Erro ao carregar: ${error.message}`);
        return;
      }

      setContas(data || []);
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar contas recorrentes");
    }
    setIsLoading(false);
  };

  const getContasStats = () => {
    const today = new Date();
    const next7Days = addDays(today, 7);

    const totalRecorrentes = contas.filter(c => c.status === 'agendado').length;
    const proximosVencimentos = contas.filter(c => {
      if (c.status !== 'agendado') return false;
      const contaDate = new Date();
      contaDate.setDate(c.dia_recorrencia || 1);
      return isWithinInterval(contaDate, { start: today, end: next7Days });
    }).length;
    const valorTotal = contas
      .filter(c => c.status === 'agendado' && c.valor)
      .reduce((sum, c) => sum + parseFloat(c.valor), 0);

    return { totalRecorrentes, proximosVencimentos, valorTotal };
  };

  const upcomingDueDates = useMemo(() => {
    const today = new Date();
    const next7Days = addDays(today, 7);
    
    return contas.filter(c => {
      if (c.status !== 'agendado') return false;
      const dueDate = new Date();
      dueDate.setDate(c.dia_recorrencia || 1);
      return isWithinInterval(dueDate, { start: today, end: next7Days });
    });
  }, [contas]);

  const stats = getContasStats();

  const handleEdit = (conta: any) => {
    setEditingConta(conta);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;

    try {
      const { error } = await supabase
        .from("contas_recorrentes")
        .delete()
        .eq("id", deleteConfirmId);

      if (error) {
        toast.error(`Erro ao deletar: ${error.message}`);
        return;
      }

      toast.success("Conta recorrente deletada com sucesso!");
      setDeleteConfirmId(null);
      loadContas();
    } catch (error: any) {
      toast.error(error.message || "Erro ao deletar");
    }
  };

  const handleMarkAsInactive = async (conta: any) => {
    try {
      const { error } = await supabase
        .from("contas_recorrentes")
        .update({ status: 'cancelado' })
        .eq("id", conta.id);

      if (error) {
        toast.error(`Erro ao atualizar: ${error.message}`);
        return;
      }

      toast.success("Conta recorrente desativada!");
      loadContas();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar");
    }
  };

  const handleOpenForm = (conta?: any) => {
    setEditingConta(conta || null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingConta(null);
  };

  const handleFormSuccess = () => {
    handleCloseForm();
    loadContas();
  };

  const generateContasAPagar = async () => {
    if (!generateMonth || !generateYear || !user) {
      toast.error("Selecione mês e ano");
      return;
    }

    setIsGenerating(true);
    try {
      const activeContas = contas.filter(c => c.status === 'agendado');
      
      if (activeContas.length === 0) {
        toast.info("Nenhuma conta recorrente ativa para gerar");
        setIsGenerating(false);
        return;
      }

      let generated = 0;
      let skipped = 0;

      for (const conta of activeContas) {
        // Calcular data de vencimento baseada no dia de recorrência
        const diaVencimento = conta.dia_recorrencia || 1;
        const dataVencimento = `${generateYear}-${generateMonth}-${String(diaVencimento).padStart(2, '0')}`;
        const dataRecebimento = new Date().toISOString().split('T')[0];

        // Verificar se já existe uma conta a pagar para este fornecedor/mês
        const { data: existing } = await (supabase as any)
          .from("contas_apagar")
          .select("id")
          .eq("fornecedor_nome", conta.fornecedor)
          .eq("descricao", conta.descricao)
          .gte("data_vencimento", `${generateYear}-${generateMonth}-01`)
          .lte("data_vencimento", `${generateYear}-${generateMonth}-31`)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        // Criar conta a pagar
        const { error } = await supabase.from("contas_apagar").insert({
          numero: `REC-${conta.id.slice(0, 6)}-${generateMonth}/${generateYear}`,
          fornecedor_nome: conta.fornecedor,
          fornecedor_cnpj: "",
          data_recebimento: dataRecebimento,
          data_vencimento: dataVencimento,
          valor: conta.valor || 0,
          categoria: conta.categoria || "Despesa Recorrente",
          descricao: conta.descricao,
          status: "pendente",
          aeronave: "N/A",
          criado_por: user.id
        });

        if (error) {
          console.error("Erro ao criar conta a pagar:", error);
        } else {
          generated++;
        }
      }

      if (generated > 0) {
        toast.success(`${generated} conta(s) a pagar criada(s) com sucesso!`);
      }
      if (skipped > 0) {
        toast.info(`${skipped} conta(s) já existiam e foram ignoradas`);
      }

      setShowGenerateDialog(false);
      setGenerateMonth("");
      setGenerateYear("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao gerar contas a pagar");
    } finally {
      setIsGenerating(false);
    }
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pago": return "Pago";
      case "agendado": return "Ativo";
      case "cancelado": return "Inativo";
      default: return status;
    }
  };

  const getFrequencyLabel = (frequency: string, day?: number) => {
    switch (frequency) {
      case "semanal": return "Semanal";
      case "mensal": return day ? `Dia ${day} do mês` : "Mensal";
      case "trimestral": return "Trimestral";
      case "anual": return "Anual";
      default: return frequency;
    }
  };

  const years = ["2025", "2026", "2027"];

  return (
    <div className="space-y-6">
      {/* Alerta de vencimentos próximos */}
      {upcomingDueDates.length > 0 && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-400">
            Você tem <strong>{upcomingDueDates.length}</strong> conta(s) recorrente(s) próxima(s) do vencimento nos próximos 7 dias.
          </AlertDescription>
        </Alert>
      )}

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Contas Recorrentes</p>
                <p className="text-2xl font-bold text-primary">{stats.totalRecorrentes}</p>
              </div>
              <Repeat className="w-8 h-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vencimentos Próximos</p>
                <p className="text-2xl font-bold text-amber-500">{stats.proximosVencimentos}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Valor Total Recorrente</p>
                <p className="text-2xl font-bold text-green-500">
                  R$ {stats.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formulário Inline */}
      {showForm && (
        <ContaRecorrenteForm
          conta={editingConta}
          onSuccess={handleFormSuccess}
          onCancel={handleCloseForm}
        />
      )}

      {/* Lista de Contas Recorrentes */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-foreground">Contas Recorrentes</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setShowGenerateDialog(true)} variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">
              <FileCheck className="w-4 h-4 mr-2" />
              Gerar Contas a Pagar
            </Button>
            {!showForm && (
              <Button onClick={() => handleOpenForm()} className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Nova Conta Recorrente
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : contas.length === 0 ? (
            <div className="text-center py-12">
              <Repeat className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">Nenhuma conta recorrente cadastrada</p>
              <p className="text-muted-foreground text-sm mt-2">Clique no botão acima para criar uma nova</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contas.map((conta) => {
                const isInactive = conta.status === 'cancelado';
                const rowClass = isInactive 
                  ? 'bg-red-500/10 border-l-4 border-l-red-500 opacity-75' 
                  : 'bg-muted/30 border-l-4 border-l-primary';

                return (
                  <div key={conta.id} className={`p-4 rounded-lg ${rowClass}`}>
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{conta.descricao}</h3>
                        <p className="text-sm text-muted-foreground">Fornecedor: {conta.fornecedor}</p>
                        <div className="flex items-center gap-4 mt-2 flex-wrap">
                          <Badge className={getStatusColor(conta.status)}>
                            {getStatusLabel(conta.status)}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {getFrequencyLabel(conta.frequencia_recorrencia, conta.dia_recorrencia)}
                          </span>
                          {conta.categoria && (
                            <Badge variant="outline" className="text-xs">
                              {conta.categoria}
                            </Badge>
                          )}
                          {conta.lembrete_antecipado && (
                            <Badge variant="outline" className="gap-1 text-amber-500 border-amber-500/30">
                              <Bell className="w-3 h-3" />
                              Com lembrete
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 w-full md:w-auto">
                        <p className="font-bold text-lg text-foreground">
                          {conta.valor ? `R$ ${parseFloat(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Valor variável'}
                        </p>
                        <div className="flex gap-2">
                          {conta.status === 'agendado' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMarkAsInactive(conta)}
                              className="hover:bg-red-500/20 hover:text-red-400"
                            >
                              <AlertTriangle className="w-4 h-4 mr-1" />
                              Desativar
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => handleEdit(conta)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirmId(conta.id)}
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
          <p className="text-muted-foreground">Deseja realmente deletar esta conta recorrente?</p>
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

      {/* Dialog para gerar contas a pagar */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Gerar Contas a Pagar
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Selecione o período para gerar as contas a pagar a partir das contas recorrentes ativas.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mês</Label>
                <Select value={generateMonth} onValueChange={setGenerateMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(month => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ano</Label>
                <Select value={generateYear} onValueChange={setGenerateYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Alert className="border-blue-500/30 bg-blue-500/10">
              <AlertDescription className="text-blue-400 text-sm">
                <strong>{contas.filter(c => c.status === 'agendado').length}</strong> conta(s) recorrente(s) ativa(s) serão processadas.
                Contas já existentes para o período serão ignoradas.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={generateContasAPagar} disabled={isGenerating || !generateMonth || !generateYear}>
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <FileCheck className="h-4 w-4 mr-2" />
                  Gerar Contas
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
