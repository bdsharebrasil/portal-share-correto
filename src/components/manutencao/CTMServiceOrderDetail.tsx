import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Wrench, FileText, Calendar, DollarSign,
  Trash2, Edit, Download, Printer, AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OASData {
  id: string;
  aircraft_id: string;
  numero: string;
  data_entrada: string;
  data_saida: string | null;
  horas_celula: number;
  tipo_manutencao: string;
  objetivo: string;
  dias_previstos: number;
  dias_efetivos: number | null;
  oficina_nome: string;
  oficina_contato: string;
  total_mao_obra: number;
  total_pecas: number;
  total_geral: number;
  status: string;
  created_at: string;
}

interface ServicoOAS {
  id: string;
  oas_id: string;
  descricao: string;
  fornecedor: string;
  periodo: string;
  valor: number;
  nf: string;
}

interface PecaOAS {
  id: string;
  oas_id: string;
  descricao: string;
  fornecedor: string;
  periodo: string;
  valor: number;
  nf: string;
}

interface HorasVoo {
  mes: string;
  carvalima: number;
  watt: number;
  oficina_testes: number;
}

interface CTMServiceOrderDetailProps {
  serviceOrderId: string;
  aircraftRegistration: string;
  onBack: () => void;
}

export function CTMServiceOrderDetail({
  serviceOrderId,
  aircraftRegistration,
  onBack,
}: CTMServiceOrderDetailProps) {
  const [oas, setOas] = useState<OASData | null>(null);
  const [servicos, setServicos] = useState<ServicoOAS[]>([]);
  const [pecas, setPecas] = useState<PecaOAS[]>([]);
  const [horasVoo, setHorasVoo] = useState<HorasVoo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingServico, setEditingServico] = useState<ServicoOAS | null>(null);
  const [editingPeca, setEditingPeca] = useState<PecaOAS | null>(null);
  const [showServicoDialog, setShowServicoDialog] = useState(false);
  const [showPecaDialog, setShowPecaDialog] = useState(false);

  useEffect(() => {
    loadOASData();
  }, [serviceOrderId]);

  const loadOASData = async () => {
    try {
      setLoading(true);

      // Load OAS main data
      const { data: oasData, error: oasError } = await supabase
        .from("ctm_service_orders")
        .select("*")
        .eq("id", serviceOrderId)
        .single();

      if (oasError) throw oasError;
      setOas(oasData);

      // Load servicos
      const { data: servicosData, error: servicosError } = await supabase
        .from("ctm_oas_servicos")
        .select("*")
        .eq("oas_id", serviceOrderId)
        .order("created_at");

      if (!servicosError) setServicos(servicosData || []);

      // Load pecas
      const { data: pecasData, error: pecasError } = await supabase
        .from("ctm_oas_pecas")
        .select("*")
        .eq("oas_id", serviceOrderId)
        .order("created_at");

      if (!pecasError) setPecas(pecasData || []);

      // Load horas de voo
      const { data: horasData, error: horasError } = await supabase
        .from("ctm_oas_horas_voo")
        .select("*")
        .eq("oas_id", serviceOrderId)
        .order("mes");

      if (!horasError) setHorasVoo(horasData || []);
    } catch (error: any) {
      console.error("Erro ao carregar OAS:", error);
      toast.error("Erro ao carregar OAS");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "concluido":
      case "completed":
        return <Badge className="bg-green-500/10 text-green-600">Concluído</Badge>;
      case "em_andamento":
      case "ongoing":
        return <Badge className="bg-blue-500/10 text-blue-600">Em Andamento</Badge>;
      case "pendente":
      case "pending":
        return <Badge className="bg-yellow-500/10 text-yellow-600">Pendente</Badge>;
      default:
        return <Badge className="bg-slate-500/10 text-slate-600">{status}</Badge>;
    }
  };

  const handleDeleteServico = async (id: string) => {
    if (!confirm("Deseja remover este serviço?")) return;
    try {
      await supabase.from("ctm_oas_servicos").delete().eq("id", id);
      setServicos(servicos.filter(s => s.id !== id));
      toast.success("Serviço removido");
    } catch (error) {
      toast.error("Erro ao remover serviço");
    }
  };

  const handleDeletePeca = async (id: string) => {
    if (!confirm("Deseja remover esta peça?")) return;
    try {
      await supabase.from("ctm_oas_pecas").delete().eq("id", id);
      setPecas(pecas.filter(p => p.id !== id));
      toast.success("Peça removida");
    } catch (error) {
      toast.error("Erro ao remover peça");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="text-muted-foreground">Carregando OAS...</span>
      </div>
    );
  }

  if (!oas) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="text-muted-foreground">OAS não encontrada</span>
      </div>
    );
  }

  const totalServicos = servicos.reduce((sum, s) => sum + s.valor, 0);
  const totalPecas = pecas.reduce((sum, p) => sum + p.valor, 0);
  const totalGeral = totalServicos + totalPecas;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Ordem de Serviço</h1>
            <p className="text-muted-foreground">OAS Nº {oas.numero}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {getStatusBadge(oas.status)}
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Main OAS Info Card */}
      <Card className="bg-gradient-to-r from-slate-900 to-slate-800 border-border">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">AERONAVE</p>
              <p className="text-lg font-bold text-foreground">{aircraftRegistration}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">HORAS DE CÉLULA</p>
              <p className="text-lg font-bold text-foreground">{oas.horas_celula?.toLocaleString('pt-BR')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">TIPO DE MANUTENÇÃO</p>
              <p className="text-lg font-bold text-foreground">{oas.tipo_manutencao}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">PERÍODO</p>
              <p className="text-lg font-bold text-foreground">{oas.dias_previstos}H</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-border/30 grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">DATA DE ENTRADA</p>
              <p className="font-semibold text-foreground">
                {format(new Date(oas.data_entrada), "dd/MM/yyyy")}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">DATA DE SAÍDA</p>
              <p className="font-semibold text-foreground">
                {oas.data_saida ? format(new Date(oas.data_saida), "dd/MM/yyyy") : "—"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">DIAS PREVISTOS</p>
              <p className="font-semibold text-foreground">{oas.dias_previstos}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">DIAS EFETIVOS</p>
              <p className="font-semibold text-foreground">{oas.dias_efetivos || "—"}</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-border/30 grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">OFICINA</p>
              <p className="font-semibold text-foreground">{oas.oficina_nome}</p>
              {oas.oficina_contato && (
                <p className="text-sm text-muted-foreground">{oas.oficina_contato}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">OBJETIVO</p>
              <p className="font-semibold text-foreground">{oas.objetivo}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Horas de Voo */}
      {horasVoo.length > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Horas de Voo durante Manutenção
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">MÊS</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">CARVALIMA</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">WATT</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">OFICINA/TESTES</th>
                  </tr>
                </thead>
                <tbody>
                  {horasVoo.map((hora, idx) => (
                    <tr key={idx} className="border-b border-border/50 hover:bg-background/50">
                      <td className="px-4 py-3 text-sm text-foreground font-medium">{hora.mes}</td>
                      <td className="px-4 py-3 text-sm text-right text-foreground">{hora.carvalima}h</td>
                      <td className="px-4 py-3 text-sm text-right text-foreground">{hora.watt}h</td>
                      <td className="px-4 py-3 text-sm text-right text-foreground">{hora.oficina_testes}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Serviços */}
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Serviços Executados
          </CardTitle>
          <Button onClick={() => {
            setEditingServico(null);
            setShowServicoDialog(true);
          }} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Serviço
          </Button>
        </CardHeader>
        <CardContent>
          {servicos.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">DESCRIÇÃO</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">FORNECEDOR</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">PERÍODO</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">VALOR</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">NF</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {servicos.map((servico) => (
                    <tr key={servico.id} className="border-b border-border/50 hover:bg-background/50">
                      <td className="px-4 py-3 text-sm text-foreground">{servico.descricao}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{servico.fornecedor}</td>
                      <td className="px-4 py-3 text-sm text-center text-foreground">{servico.periodo}</td>
                      <td className="px-4 py-3 text-sm text-right text-foreground font-medium">
                        R$ {servico.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground text-muted-foreground">{servico.nf}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteServico(servico.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-background/50 font-semibold">
                    <td colSpan={3} className="px-4 py-3 text-sm text-foreground">SUBTOTAL SERVIÇOS</td>
                    <td className="px-4 py-3 text-sm text-right text-foreground">
                      R$ {totalServicos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Wrench className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum serviço adicionado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Peças */}
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Peças Aplicadas
          </CardTitle>
          <Button onClick={() => {
            setEditingPeca(null);
            setShowPecaDialog(true);
          }} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Peça
          </Button>
        </CardHeader>
        <CardContent>
          {pecas.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">DESCRIÇÃO</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">FORNECEDOR</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">PERÍODO</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">VALOR</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">NF</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {pecas.map((peca) => (
                    <tr key={peca.id} className="border-b border-border/50 hover:bg-background/50">
                      <td className="px-4 py-3 text-sm text-foreground">{peca.descricao}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{peca.fornecedor}</td>
                      <td className="px-4 py-3 text-sm text-center text-foreground">{peca.periodo}</td>
                      <td className="px-4 py-3 text-sm text-right text-foreground font-medium">
                        R$ {peca.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground text-muted-foreground">{peca.nf}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <Button variant="ghost" size="sm" onClick={() => handleDeletePeca(peca.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-background/50 font-semibold">
                    <td colSpan={3} className="px-4 py-3 text-sm text-foreground">SUBTOTAL PEÇAS</td>
                    <td className="px-4 py-3 text-sm text-right text-foreground">
                      R$ {totalPecas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhuma peça adicionada</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Total Card */}
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Serviços</p>
              <p className="text-2xl font-bold text-foreground">
                R$ {totalServicos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="border-l border-border"></div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Peças</p>
              <p className="text-2xl font-bold text-foreground">
                R$ {totalPecas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="border-l border-border"></div>
            <div className="space-y-2 text-right">
              <p className="text-sm text-muted-foreground">TOTAL GERAL</p>
              <p className="text-3xl font-bold text-primary">
                R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
