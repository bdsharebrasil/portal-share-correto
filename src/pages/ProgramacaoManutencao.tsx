import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Wrench, Search, Building2, DollarSign, Trash2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { ManutencaoDialog } from "@/components/manutencao/ManutencaoDialog";
import { useToast } from "@/hooks/use-toast";
import { fetchManutencoesWithAircraft, type ManutencaoWithAircraft } from "@/services/manutencoes";

export default function ProgramacaoManutencao() {
  const [manutencoes, setManutencoes] = useState<ManutencaoWithAircraft[]>([]);
  const [filteredManutencoes, setFilteredManutencoes] = useState<ManutencaoWithAircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadManutencoes();
  }, []);

  useEffect(() => {
    filterManutencoes();
  }, [manutencoes, searchQuery]);

  const loadManutencoes = async () => {
    setLoading(true);
    try {
      const manutencoesData = await fetchManutencoesWithAircraft();
      setManutencoes(manutencoesData);
    } catch (error) {
      console.error("Erro ao carregar manutenções:", error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar as manutenções.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterManutencoes = () => {
    if (!searchQuery) {
      setFilteredManutencoes(manutencoes);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = manutencoes.filter(
      (m) =>
        m.tipo.toLowerCase().includes(query) ||
        (m.aeronave_registration && m.aeronave_registration.toLowerCase().includes(query)) ||
        m.mecanico.toLowerCase().includes(query) ||
        (m.oficina && m.oficina.toLowerCase().includes(query))
    );

    setFilteredManutencoes(filtered);
  };

  const handleEtapaChange = async (id: string, novaEtapa: string) => {
    try {
      const { error } = await (await import("@/integrations/supabase/client")).supabase
        .from("manutencoes")
        .update({ etapa: novaEtapa })
        .eq("id", id);

      if (error) throw error;

      setManutencoes(
        manutencoes.map((m) => (m.id === id ? { ...m, etapa: novaEtapa } : m))
      );

      toast({
        title: "Sucesso",
        description: "Etapa atualizada com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao atualizar etapa:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a etapa.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteManutencao = async (id: string) => {
    setDeleteId(id);
    try {
      const { error } = await (await import("@/integrations/supabase/client")).supabase
        .from("manutencoes")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setManutencoes(manutencoes.filter((m) => m.id !== id));
      toast({
        title: "Sucesso",
        description: "Manutenção deletada com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao deletar manutenção:", error);
      toast({
        title: "Erro",
        description: "Não foi possível deletar a manutenção.",
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  const handleSaveManutencao = () => {
    loadManutencoes();
  };

  const getEtapaLabel = (etapa: string) => {
    const labels: Record<string, string> = {
      aguardando: "Aguardando",
      em_andamento: "Em Andamento",
      concluida: "Concluída",
      cancelada: "Cancelada",
    };
    return labels[etapa] || etapa;
  };

  const getEtapaColor = (etapa: string) => {
    const colors: Record<string, string> = {
      aguardando: "bg-muted text-muted-foreground",
      em_andamento: "bg-warning text-warning-foreground",
      concluida: "bg-success text-success-foreground",
      cancelada: "bg-destructive text-destructive-foreground",
    };
    return colors[etapa] || "bg-muted text-muted-foreground";
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Programação de Manutenção
            </h1>
            <p className="text-muted-foreground">
              Gerencie a programação de manutenções preventivas e corretivas
            </p>
          </div>
          <ManutencaoDialog onSave={handleSaveManutencao} mode="create" />
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Programadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {manutencoes.filter((m) => m.etapa === "aguardando").length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Em Andamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">
                {manutencoes.filter((m) => m.etapa === "em_andamento").length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Concluídas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">
                {manutencoes.filter((m) => m.etapa === "concluida").length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{manutencoes.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Manutenções Programadas</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar manutenções..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredManutencoes.length === 0 ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <p>Nenhuma manutenção encontrada</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredManutencoes.map((manutencao) => (
                  <div
                    key={manutencao.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent transition-smooth"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                        <Wrench className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{manutencao.tipo}</h3>
                        {manutencao.aeronave_registration && (
                          <p className="text-sm text-muted-foreground">
                            Aeronave: {manutencao.aeronave_registration}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 flex-wrap">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {new Date(manutencao.data_programada).toLocaleDateString("pt-BR")}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Mecânico: {manutencao.mecanico}
                          </div>
                          {manutencao.oficina && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Building2 className="h-4 w-4" />
                              {manutencao.oficina}
                            </div>
                          )}
                          {manutencao.custo_estimado && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <DollarSign className="h-4 w-4" />
                              R${" "}
                              {manutencao.custo_estimado.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}
                            </div>
                          )}
                        </div>
                        {manutencao.observacoes && (
                          <div className="text-sm text-muted-foreground mt-2 italic">
                            "{manutencao.observacoes}"
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ManutencaoDialog
                        manutencao={manutencao}
                        onSave={handleSaveManutencao}
                        mode="edit"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteManutencao(manutencao.id)}
                        disabled={deleteId === manutencao.id}
                      >
                        {deleteId === manutencao.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                      <Select
                        value={manutencao.etapa}
                        onValueChange={(value) => handleEtapaChange(manutencao.id, value)}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue>
                            <Badge className={getEtapaColor(manutencao.etapa)}>
                              {getEtapaLabel(manutencao.etapa)}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aguardando">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                              Aguardando
                            </div>
                          </SelectItem>
                          <SelectItem value="em_andamento">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-warning" />
                              Em Andamento
                            </div>
                          </SelectItem>
                          <SelectItem value="concluida">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-success" />
                              Concluída
                            </div>
                          </SelectItem>
                          <SelectItem value="cancelada">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-destructive" />
                              Cancelada
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
