import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Send, Receipt, X, FileText, Calendar, DollarSign, Trash2, Check, Upload, Tag } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EnvioDespesaTabProps {
  clientId: string;
  clientName: string;
  aircraftId: string;
  aircraftRegistration: string;
}

interface RateioDespesa {
  id: string;
  client_name: string;
  aeronave_registro: string;
  valor_rateado: number;
  percentual: number;
  status: string;
  observacoes: string | null;
  criado_em: string;
  boleto: string | null;
  nota_fiscal: string | null;
  categoria_id: string | null;
  data_pagamento: string | null;
  comprovante_url: string | null;
}

interface ExpenseCategory {
  id: string;
  expense_type: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  combustivel_emergencia: "Combustível Emergência",
  diaria_hangar: "Diária Hangar",
  tarifa_infraero: "Tarifa Infraero",
  taxa_pouso: "Taxa de Pouso",
  servicos_rampa: "Serviços de Rampa",
  manutencao: "Manutenção",
  seguro: "Seguro",
  hangaragem: "Hangaragem",
  limpeza: "Limpeza",
  outros: "Outros"
};

export function EnvioDespesaTab({ clientId, clientName, aircraftId, aircraftRegistration }: EnvioDespesaTabProps) {
  const [despesas, setDespesas] = useState<RateioDespesa[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [valor, setValor] = useState("");
  const [percentual, setPercentual] = useState("100");
  const [observacoes, setObservacoes] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [boletoFile, setBoletoFile] = useState<File | null>(null);
  const [notaFiscalFile, setNotaFiscalFile] = useState<File | null>(null);

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedDespesa, setSelectedDespesa] = useState<RateioDespesa | null>(null);
  const [dataPagamento, setDataPagamento] = useState("");
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null);
  const [updatingPayment, setUpdatingPayment] = useState(false);

  useEffect(() => {
    loadDespesas();
    loadCategories();
  }, [clientId, aircraftId]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('expense_config')
        .select('*')
        .order('expense_type');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadDespesas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rateio_despesas')
        .select('*')
        .eq('client_id', clientId)
        .eq('aeronave_id', aircraftId)
        .order('criado_em', { ascending: false });

      if (error) throw error;
      setDespesas(data || []);
    } catch (error) {
      console.error('Error loading despesas:', error);
      toast.error('Erro ao carregar despesas');
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${clientId}/${Date.now()}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('client-documents')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('client-documents')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!valor || parseFloat(valor) <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    if (!categoriaId) {
      toast.error('Selecione uma categoria');
      return;
    }

    try {
      setSubmitting(true);

      let boletoUrl = null;
      let notaFiscalUrl = null;

      // Upload files if provided
      if (boletoFile) {
        boletoUrl = await uploadFile(boletoFile, 'boletos');
      }
      if (notaFiscalFile) {
        notaFiscalUrl = await uploadFile(notaFiscalFile, 'notas-fiscais');
      }

      const valorNum = parseFloat(valor.replace(',', '.'));
      const percentualNum = parseFloat(percentual);
      const valorRateado = valorNum * (percentualNum / 100);

      // Generate a unique despesa_id
      const despesaId = crypto.randomUUID();

      // Use UTC date to avoid timezone issues
      const now = new Date();
      const dataEnvio = format(now, 'yyyy-MM-dd');

      const { error } = await supabase
        .from('rateio_despesas')
        .insert({
          despesa_id: despesaId,
          client_id: clientId,
          client_name: clientName,
          aeronave_id: aircraftId,
          aeronave_registro: aircraftRegistration,
          valor: valorNum,
          valor_rateado: valorRateado,
          percentual: percentualNum,
          status: 'pendente',
          observacoes: observacoes || null,
          boleto: boletoUrl,
          nota_fiscal: notaFiscalUrl,
          categoria_id: categoriaId,
          data_envio: dataEnvio
        });

      if (error) throw error;

      toast.success('Despesa enviada com sucesso!');
      
      // Reset form
      setValor("");
      setPercentual("100");
      setObservacoes("");
      setCategoriaId("");
      setBoletoFile(null);
      setNotaFiscalFile(null);
      
      // Reload list
      loadDespesas();
    } catch (error) {
      console.error('Error submitting despesa:', error);
      toast.error('Erro ao enviar despesa');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta despesa?')) return;

    try {
      const { error } = await supabase
        .from('rateio_despesas')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Despesa excluída');
      loadDespesas();
    } catch (error) {
      console.error('Error deleting despesa:', error);
      toast.error('Erro ao excluir despesa');
    }
  };

  const openPaymentModal = (despesa: RateioDespesa) => {
    setSelectedDespesa(despesa);
    setDataPagamento(format(new Date(), 'yyyy-MM-dd'));
    setComprovanteFile(null);
    setPaymentModalOpen(true);
  };

  const handleMarkAsPaid = async () => {
    if (!selectedDespesa) return;
    
    if (!dataPagamento) {
      toast.error('Informe a data de pagamento');
      return;
    }

    try {
      setUpdatingPayment(true);

      let comprovanteUrl = null;
      if (comprovanteFile) {
        comprovanteUrl = await uploadFile(comprovanteFile, 'comprovantes');
      }

      const { error } = await supabase
        .from('rateio_despesas')
        .update({
          status: 'pago',
          data_pagamento: dataPagamento,
          comprovante_url: comprovanteUrl,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', selectedDespesa.id);

      if (error) throw error;

      toast.success('Despesa marcada como paga!');
      setPaymentModalOpen(false);
      setSelectedDespesa(null);
      loadDespesas();
    } catch (error) {
      console.error('Error marking as paid:', error);
      toast.error('Erro ao atualizar status');
    } finally {
      setUpdatingPayment(false);
    }
  };

  const getCategoryLabel = (categoriaId: string | null) => {
    if (!categoriaId) return '-';
    const category = categories.find(c => c.id === categoriaId);
    if (!category) return '-';
    return CATEGORY_LABELS[category.expense_type] || category.expense_type;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pendente</Badge>;
      case 'pago':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Pago</Badge>;
      case 'cancelado':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    try {
      // Parse as local date to avoid timezone shift
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return format(date, "dd/MM/yyyy", { locale: ptBR });
      }
      return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Form Card */}
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Send className="h-5 w-5 text-primary" />
            Enviar Nova Despesa
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Envie despesas diretamente para o cliente - sem fluxo de caixa ou reembolso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria *</Label>
                <Select value={categoriaId} onValueChange={setCategoriaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <span className="flex items-center gap-2">
                          <Tag className="h-3 w-3" />
                          {CATEGORY_LABELS[cat.expense_type] || cat.expense_type}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="valor">Valor (R$) *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="valor"
                    type="text"
                    placeholder="0,00"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="percentual">Percentual do Cliente (%)</Label>
                <Select value={percentual} onValueChange={setPercentual}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o percentual" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25%</SelectItem>
                    <SelectItem value="50">50%</SelectItem>
                    <SelectItem value="75">75%</SelectItem>
                    <SelectItem value="100">100%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                placeholder="Descrição da despesa..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Boleto (opcional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setBoletoFile(e.target.files?.[0] || null)}
                    className="flex-1"
                  />
                  {boletoFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setBoletoFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {boletoFile && (
                  <p className="text-xs text-muted-foreground">{boletoFile.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Nota Fiscal (opcional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setNotaFiscalFile(e.target.files?.[0] || null)}
                    className="flex-1"
                  />
                  {notaFiscalFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setNotaFiscalFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {notaFiscalFile && (
                  <p className="text-xs text-muted-foreground">{notaFiscalFile.name}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>Enviando...</>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Despesa
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Histórico de Despesas */}
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Receipt className="h-5 w-5 text-primary" />
            Histórico de Despesas Enviadas
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Despesas enviadas para {clientName} - {aircraftRegistration}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : despesas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma despesa enviada ainda
            </div>
          ) : (
            <div className="space-y-3">
              {despesas.map((despesa) => (
                <div
                  key={despesa.id}
                  className="p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Data Envio</p>
                        <p className="font-medium text-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(despesa.criado_em), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Categoria</p>
                        <p className="font-medium text-foreground flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {getCategoryLabel(despesa.categoria_id)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Valor Rateado</p>
                        <p className="font-medium text-emerald-400">
                          {formatCurrency(despesa.valor_rateado)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ({despesa.percentual}%)
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Status</p>
                        <div 
                          className={despesa.status === 'pendente' ? 'cursor-pointer' : ''}
                          onClick={() => despesa.status === 'pendente' && openPaymentModal(despesa)}
                          title={despesa.status === 'pendente' ? 'Clique para marcar como pago' : ''}
                        >
                          {getStatusBadge(despesa.status)}
                        </div>
                        {despesa.data_pagamento && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Pago em: {formatDate(despesa.data_pagamento)}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Anexos</p>
                        <div className="flex flex-wrap gap-1">
                          {despesa.boleto && (
                            <a
                              href={despesa.boleto}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              <FileText className="h-3 w-3" />
                              Boleto
                            </a>
                          )}
                          {despesa.nota_fiscal && (
                            <a
                              href={despesa.nota_fiscal}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              <FileText className="h-3 w-3" />
                              NF
                            </a>
                          )}
                          {despesa.comprovante_url && (
                            <a
                              href={despesa.comprovante_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-green-400 hover:underline flex items-center gap-1"
                            >
                              <Check className="h-3 w-3" />
                              Comprovante
                            </a>
                          )}
                          {!despesa.boleto && !despesa.nota_fiscal && !despesa.comprovante_url && (
                            <span className="text-xs text-muted-foreground">Nenhum</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {despesa.status === 'pendente' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-400 border-green-400/30 hover:bg-green-400/10"
                              onClick={() => openPaymentModal(despesa)}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Pagar
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(despesa.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {despesa.observacoes && (
                    <p className="text-sm text-muted-foreground mt-2 pt-2 border-t border-border">
                      {despesa.observacoes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Marcar como Pago
            </DialogTitle>
            <DialogDescription>
              Informe a data de pagamento e anexe o comprovante (opcional)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dataPagamento">Data de Pagamento *</Label>
              <Input
                id="dataPagamento"
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Comprovante de Pagamento (opcional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setComprovanteFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                {comprovanteFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setComprovanteFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {comprovanteFile && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Upload className="h-3 w-3" />
                  {comprovanteFile.name}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleMarkAsPaid} disabled={updatingPayment}>
              {updatingPayment ? (
                <>Salvando...</>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Confirmar Pagamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
