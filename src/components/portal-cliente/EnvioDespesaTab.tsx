import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Send, Receipt, Upload, X, FileText, Calendar, DollarSign, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
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
}

export function EnvioDespesaTab({ clientId, clientName, aircraftId, aircraftRegistration }: EnvioDespesaTabProps) {
  const [despesas, setDespesas] = useState<RateioDespesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [valor, setValor] = useState("");
  const [percentual, setPercentual] = useState("100");
  const [observacoes, setObservacoes] = useState("");
  const [boletoFile, setBoletoFile] = useState<File | null>(null);
  const [notaFiscalFile, setNotaFiscalFile] = useState<File | null>(null);

  useEffect(() => {
    loadDespesas();
  }, [clientId, aircraftId]);

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
          nota_fiscal: notaFiscalUrl
        });

      if (error) throw error;

      toast.success('Despesa enviada com sucesso!');
      
      // Reset form
      setValor("");
      setPercentual("100");
      setObservacoes("");
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor">Valor (R$)</Label>
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
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Data</p>
                        <p className="font-medium text-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(despesa.criado_em), "dd/MM/yyyy", { locale: ptBR })}
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
                        {getStatusBadge(despesa.status)}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Anexos</p>
                        <div className="flex gap-2">
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
                          {!despesa.boleto && !despesa.nota_fiscal && (
                            <span className="text-xs text-muted-foreground">Nenhum</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {despesa.status === 'pendente' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(despesa.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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
    </div>
  );
}
