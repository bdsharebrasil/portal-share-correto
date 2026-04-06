import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Search, Eye, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ManutencaoComOS {
  id: string;
  numero_os: string | null;
  tipo: string;
  aeronave: string;
  aeronave_id: string | null;
  data: string;
  mecanico: string;
  status: string;
  descricao: string;
  oficina: string | null;
  custo_estimado: number | null;
}

interface Aircraft {
  id: string;
  registration: string;
}

export default function RelatoriosTecnicos() {
  const [relatorios, setRelatorios] = useState<ManutencaoComOS[]>([]);
  const [filtrados, setFiltrados] = useState<ManutencaoComOS[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [aircraftList, setAircraftList] = useState<Aircraft[]>([]);

  useEffect(() => {
    carregarRelatorios();
    carregarAeronaves();
  }, []);

  useEffect(() => {
    filtrarRelatorios();
  }, [searchTerm, relatorios]);

  const carregarAeronaves = async () => {
    try {
      const { data } = await supabase
        .from('aeronave')
        .select('id, matricula')
        .eq("status", "ativa")
        .order("matricula");
      setAircraftList(data || []);
    } catch (e) {
      console.error("Erro ao carregar aeronaves:", e);
    }
  };

  const carregarRelatorios = async () => {
    setLoading(true);
    try {
      const { data: manutencoes, error } = await supabase
        .from("manutencoes")
        .select("*")
        .order("data_programada", { ascending: false });

      if (error) throw error;

      const aircraftMap = await buscarMapaAeronaves();

      const mapped = (manutencoes || []).map((m: any) => ({
        id: m.id,
        numero_os: m.numero_os,
        tipo: m.tipo,
        aeronave: aircraftMap[m.aeronave_id] || "-",
        aeronave_id: m.aeronave_id,
        data: m.data_programada,
        mecanico: m.mecanico,
        status: m.etapa,
        descricao: m.observacoes || "",
        oficina: m.oficina,
        custo_estimado: m.custo_estimado,
      }));

      setRelatorios(mapped);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao carregar relatórios");
    } finally {
      setLoading(false);
    }
  };

  const buscarMapaAeronaves = async (): Promise<Record<string, string>> => {
    const maps: Record<string, string> = {};

    try {
      const { data } = await supabase.from('aeronave').select('id, matricula');
      if (data) {
        data.forEach((row: any) => {
          if (row.id && row.registration) {
            maps[row.id] = row.registration;
          }
        });
      }
    } catch (e) {
      console.error("Erro ao buscar aeronaves:", e);
    }

    return maps;
  };

  const filtrarRelatorios = () => {
    if (!searchTerm) {
      setFiltrados(relatorios);
      return;
    }

    const termo = searchTerm.toLowerCase();
    const resultado = relatorios.filter(
      (r) =>
        (r.numero_os && r.numero_os.toLowerCase().includes(termo)) ||
        r.tipo.toLowerCase().includes(termo) ||
        r.aeronave.toLowerCase().includes(termo) ||
        r.mecanico.toLowerCase().includes(termo)
    );

    setFiltrados(resultado);
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <span className="text-muted-foreground">Carregando relatórios...</span>
        </div>
      </Layout>
    );
  }

  const contagemStatus = {
    finalizado: relatorios.filter(r => r.situacao === "concluida").length,
    andamento: relatorios.filter(r => r.situacao === "em_andamento").length,
    pendente: relatorios.filter(r => r.situacao === "aguardando").length,
    total: relatorios.length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "concluida":
        return "bg-success text-white";
      case "em_andamento":
        return "bg-warning text-black";
      case "aguardando":
        return "bg-primary text-primary-foreground";
      case "cancelada":
        return "bg-destructive text-white";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "concluida":
        return "Finalizado";
      case "em_andamento":
        return "Em Andamento";
      case "aguardando":
        return "Pendente";
      case "cancelada":
        return "Cancelado";
      default:
        return status;
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Relatórios Técnicos (O.S)
            </h1>
            <p className="text-muted-foreground">
              Gerencie as Ordens de Serviço e relatórios técnicos de manutenção
            </p>
          </div>
          <Button className="flex items-center gap-2" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Nova O.A.S
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-700 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                Finalizados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                {contagemStatus.finalizado}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-700 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">
                Em Andamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                {contagemStatus.andamento}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {contagemStatus.pendente}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/20 dark:to-slate-800/20 border-slate-200 dark:border-slate-700 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-600 dark:text-slate-400">
                {contagemStatus.total}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Lista de Ordens de Serviço</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar O.S..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filtrados.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm
                    ? "Nenhuma O.S encontrada com este termo"
                    : "Nenhuma O.S cadastrada"}
                </div>
              ) : (
                filtrados.map((relatorio) => (
                  <div
                    key={relatorio.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent transition-smooth"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-foreground">
                            {relatorio.numero_os || "S/N"}
                          </h3>
                          <Badge variant="outline" className="text-xs">
                            {relatorio.tipo}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {relatorio.aeronave}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          Mecânico: {relatorio.mecanico}
                          {relatorio.oficina && ` • Oficina: ${relatorio.oficina}`}
                        </p>
                        {relatorio.descricao && (
                          <p className="text-sm text-muted-foreground mt-1 italic">
                            "{relatorio.descricao}"
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>
                            Data: {new Date(relatorio.data).toLocaleDateString('pt-BR')}
                          </span>
                          {relatorio.custo_estimado && (
                            <span>
                              Custo: R$ {relatorio.custo_estimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Badge className={getStatusColor(relatorio.situacao)}>
                        {getStatusLabel(relatorio.situacao)}
                      </Badge>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-1" />
                        PDF
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <CreateOSDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          aircraftList={aircraftList}
          onCreated={carregarRelatorios}
        />
      </div>
    </Layout>
  );
}

function CreateOSDialog({
  open,
  onOpenChange,
  aircraftList,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftList: Aircraft[];
  onCreated: () => void;
}) {
  const [formData, setFormData] = useState({
    numero_os: "",
    tipo: "",
    aeronave_id: "",
    data_programada: "",
    mecanico: "",
    etapa: "aguardando",
    oficina: "",
    observacoes: "",
    custo_estimado: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.tipo || !formData.aeronave_id || !formData.data_programada || !formData.mecanico) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("manutencoes").insert({
        numero_os: formData.numero_os || null,
        tipo: formData.tipo,
        aeronave_id: formData.aeronave_id,
        data_programada: formData.data_programada,
        mecanico: formData.mecanico,
        etapa: formData.etapa,
        oficina: formData.oficina || null,
        observacoes: formData.observacoes || null,
        custo_estimado: formData.custo_estimado ? Number(formData.custo_estimado) : null,
      });

      if (error) throw error;

      toast.success("O.S criada com sucesso!");
      onOpenChange(false);
      setFormData({
        numero_os: "",
        tipo: "",
        aeronave_id: "",
        data_programada: "",
        mecanico: "",
        etapa: "aguardando",
        oficina: "",
        observacoes: "",
        custo_estimado: "",
      });
      onCreated();
    } catch (e: any) {
      toast.error("Erro ao criar O.S: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Ordem de Serviço</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero_os">Número da O.S</Label>
              <Input
                id="numero_os"
                value={formData.numero_os}
                onChange={(e) => setFormData({ ...formData, numero_os: e.target.value })}
                placeholder="Ex: OS-2025-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Manutenção *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => setFormData({ ...formData, tipo: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manutenção Preventiva">Manutenção Preventiva</SelectItem>
                  <SelectItem value="Manutenção Corretiva">Manutenção Corretiva</SelectItem>
                  <SelectItem value="Inspeção">Inspeção</SelectItem>
                  <SelectItem value="Reparo">Reparo</SelectItem>
                  <SelectItem value="Revisão">Revisão</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aeronave">Aeronave *</Label>
              <Select
                value={formData.aeronave_id}
                onValueChange={(value) => setFormData({ ...formData, aeronave_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a aeronave" />
                </SelectTrigger>
                <SelectContent>
                  {aircraftList.map((ac) => (
                    <SelectItem key={ac.id} value={ac.id}>
                      {ac.registration}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="data">Data Programada *</Label>
              <Input
                id="data"
                type="data"
                value={formData.data_programada}
                onChange={(e) => setFormData({ ...formData, data_programada: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mecanico">Mecânico Responsável *</Label>
              <Input
                id="mecanico"
                value={formData.mecanico}
                onChange={(e) => setFormData({ ...formData, mecanico: e.target.value })}
                placeholder="Nome do mecânico"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="situacao">Status</Label>
              <Select
                value={formData.etapa}
                onValueChange={(value) => setFormData({ ...formData, etapa: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aguardando">Aguardando</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="oficina">Oficina</Label>
              <Input
                id="oficina"
                value={formData.oficina}
                onChange={(e) => setFormData({ ...formData, oficina: e.target.value })}
                placeholder="Nome da oficina"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custo">Custo Estimado (R$)</Label>
              <Input
                id="custo"
                type="number"
                step="0.01"
                value={formData.custo_estimado}
                onChange={(e) => setFormData({ ...formData, custo_estimado: e.target.value })}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Descreva os serviços a realizar..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Criar O.S"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
