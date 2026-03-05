import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertCircle, Plus, Trash2, Edit2, Scale, TrendingUp, Check, X } from "lucide-react";

interface WeightBalanceData {
  id: string;
  aircraft_id: string;
  peso_vazio_padrao: number;
  braço_cg_padrao: number;
  peso_maximo_decolagem: number;
  peso_maximo_pouso: number;
  cg_limite_dianteiro: number;
  cg_limite_traseiro: number;
  mac_comprimento: number;
  lemac_distancia: number;
  validado: boolean;
  notas?: string;
}

interface WeightItem {
  id: string;
  weight_balance_id: string;
  descricao: string;
  categoria?: string;
  peso_sem_combustivel: number;
  braço_posicao: number;
  momento: number;
  incluir_no_calculo: boolean;
  observacao?: string;
}

interface WeightBalanceProps {
  aircraftId: string;
  aircraftRegistration: string;
}

export function CTMWeightBalanceComplete({
  aircraftId,
  aircraftRegistration,
}: WeightBalanceProps) {
  const [weightData, setWeightData] = useState<WeightBalanceData | null>(null);
  const [items, setItems] = useState<WeightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<WeightItem | null>(null);
  const [combustivel, setCombustivel] = useState(0);
  const [cgCalculation, setCgCalculation] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    descricao: "",
    categoria: "",
    peso: "",
    braco: "",
    incluir: true,
    observacao: "",
  });

  useEffect(() => {
    loadWeightData();
  }, [aircraftId]);

  useEffect(() => {
    if (weightData && items.length > 0) {
      calculateCG();
    }
  }, [weightData, items, combustivel]);

  const loadWeightData = async () => {
    try {
      setLoading(true);
      
      // Load weight balance data
      const { data: wbData, error: wbError } = await supabase
        .from("weight_balance")
        .select("*")
        .eq("aircraft_id", aircraftId)
        .single();

      if (wbError && wbError.code !== "PGRST116") throw wbError;

      if (wbData) {
        setWeightData(wbData);

        // Load items
        const { data: itemsData, error: itemsError } = await supabase
          .from("weight_balance_items")
          .select("*")
          .eq("weight_balance_id", wbData.id)
          .order("created_at");

        if (itemsError) throw itemsError;
        setItems(itemsData || []);
      }
    } catch (error: any) {
      console.error("Erro ao carregar dados de peso:", error);
      toast.error("Erro ao carregar dados de peso e balanceamento");
    } finally {
      setLoading(false);
    }
  };

  const calculateCG = async () => {
    if (!weightData) return;

    try {
      const { data, error } = await supabase.rpc("calculate_weight_and_cg", {
        _weight_balance_id: weightData.id,
        _combustivel_utilizado: combustivel,
      });

      if (error) throw error;
      if (data && data.length > 0) {
        setCgCalculation(data[0]);
      }
    } catch (error: any) {
      console.error("Erro ao calcular CG:", error);
    }
  };

  const handleSaveItem = async () => {
    if (!formData.descricao || !formData.peso || !formData.braco) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (!weightData) {
      toast.error("Dados de peso não carregados");
      return;
    }

    const peso = parseFloat(formData.peso);
    const braco = parseFloat(formData.braco);
    const momento = peso * braco;

    try {
      if (editingItem) {
        const { error } = await supabase
          .from("weight_balance_items")
          .update({
            descricao: formData.descricao,
            categoria: formData.categoria || null,
            peso_sem_combustivel: peso,
            braço_posicao: braco,
            momento,
            incluir_no_calculo: formData.incluir,
            observacao: formData.observacao || null,
          })
          .eq("id", editingItem.id);

        if (error) throw error;
        toast.success("Item atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("weight_balance_items")
          .insert({
            weight_balance_id: weightData.id,
            descricao: formData.descricao,
            categoria: formData.categoria || null,
            peso_sem_combustivel: peso,
            braço_posicao: braco,
            momento,
            incluir_no_calculo: formData.incluir,
            observacao: formData.observacao || null,
          });

        if (error) throw error;
        toast.success("Item adicionado com sucesso!");
      }

      resetForm();
      await loadWeightData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar item");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("weight_balance_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
      toast.success("Item removido com sucesso!");
      await loadWeightData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover item");
    }
  };

  const handleEditItem = (item: WeightItem) => {
    setEditingItem(item);
    setFormData({
      descricao: item.descricao,
      categoria: item.categoria || "",
      peso: item.peso_sem_combustivel.toString(),
      braco: item.braço_posicao.toString(),
      incluir: item.incluir_no_calculo,
      observacao: item.observacao || "",
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      descricao: "",
      categoria: "",
      peso: "",
      braco: "",
      incluir: true,
      observacao: "",
    });
    setShowForm(false);
  };

  if (loading) {
    return (
      <Card className="bg-gradient-card border-border">
        <CardContent className="pt-6 text-center text-muted-foreground">
          Carregando dados de peso e balanceamento...
        </CardContent>
      </Card>
    );
  }

  const handleCreateWeightBalance = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("weight_balance")
        .insert({
          aircraft_id: aircraftId,
          peso_vazio_padrao: 0,
          braco_cg_padrao: 0,
          peso_maximo_decolagem: 0,
          peso_maximo_pouso: 0,
          cg_limite_dianteiro: 15,
          cg_limite_traseiro: 35,
          mac_comprimento: 1,
          lemac_distancia: 0,
          validado: false,
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success("Configuração de peso criada com sucesso!");
      setWeightData(data);
    } catch (error: any) {
      console.error("Error creating weight balance:", error);
      toast.error("Erro ao criar configuração: " + error.message);
    }
  };

  if (!weightData) {
    return (
      <Card className="bg-gradient-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Peso e Balanceamento
          </CardTitle>
          <Button size="sm" onClick={handleCreateWeightBalance}>Configurar</Button>
        </CardHeader>
        <CardContent className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            Nenhuma configuração de peso e balanceamento encontrada
          </p>
          <p className="text-sm text-muted-foreground">
            Clique em "Configurar" para iniciar a configuração de peso e balanceamento
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalPeso = cgCalculation?.peso_total || 0;
  const cgPercentual = cgCalculation?.cg_percentual || 0;
  const dentroLimites = cgCalculation?.dentro_limites || false;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-background/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Peso Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalPeso.toFixed(1)} kg</p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalPeso > 0 && totalPeso <= weightData.peso_maximo_decolagem 
                ? "✓ Dentro dos limites" 
                : "⚠ Fora dos limites"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-background/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">CG (% MAC)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{cgPercentual.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {dentroLimites ? "✓ Dentro dos limites" : "⚠ Fora dos limites"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-background/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Limites CG</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono">
              {weightData.cg_limite_dianteiro.toFixed(1)}% a {weightData.cg_limite_traseiro.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">Dianteiro até Traseiro</p>
          </CardContent>
        </Card>

        <Card className="bg-background/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Combustível</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{combustivel.toFixed(1)} kg</p>
            <Input
              type="number"
              placeholder="0"
              value={combustivel}
              onChange={(e) => setCombustivel(parseFloat(e.target.value) || 0)}
              className="mt-2 h-8 text-xs"
              min="0"
              step="0.1"
            />
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card className="bg-gradient-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Itens de Peso
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Gerenciamento de itens que compõem o peso total da aeronave
            </p>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            Adicionar Item
          </Button>
        </CardHeader>

        <CardContent>
          {/* Items Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-center">Categoria</TableHead>
                  <TableHead className="text-center">Peso (kg)</TableHead>
                  <TableHead className="text-center">Braço (m)</TableHead>
                  <TableHead className="text-center">Momento</TableHead>
                  <TableHead className="w-20 text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum item adicionado. Clique em "Adicionar Item" para começar.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow 
                      key={item.id}
                      className={!item.incluir_no_calculo ? "opacity-50" : ""}
                    >
                      <TableCell>
                        <Checkbox 
                          checked={item.incluir_no_calculo}
                          disabled
                        />
                      </TableCell>
                      <TableCell className="font-medium">{item.descricao}</TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {item.categoria || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.peso_sem_combustivel.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.braço_posicao.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.momento.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditItem(item)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteItem(item.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {cgCalculation && !dentroLimites && (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="pt-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-600 mb-1">Atenção: Centro de Gravidade Fora dos Limites</p>
              <p className="text-sm text-muted-foreground">
                O CG está em {cgPercentual.toFixed(1)}% da MAC, mas os limites são {weightData.cg_limite_dianteiro.toFixed(1)}% a {weightData.cg_limite_traseiro.toFixed(1)}%. 
                Ajuste a distribuição de peso antes do voo.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Item Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Editar Item de Peso" : "Adicionar Item de Peso"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="descricao">Descrição *</Label>
              <Input
                id="descricao"
                placeholder="Ex: Piloto + Assento"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="categoria">Categoria</Label>
              <Input
                id="categoria"
                placeholder="Ex: Tripulação"
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="peso">Peso (kg) *</Label>
                <Input
                  id="peso"
                  type="number"
                  placeholder="0.00"
                  value={formData.peso}
                  onChange={(e) => setFormData({ ...formData, peso: e.target.value })}
                  step="0.1"
                  min="0"
                />
              </div>
              <div>
                <Label htmlFor="braco">Braço (m) *</Label>
                <Input
                  id="braco"
                  type="number"
                  placeholder="0.00"
                  value={formData.braco}
                  onChange={(e) => setFormData({ ...formData, braco: e.target.value })}
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="incluir"
                checked={formData.incluir}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, incluir: checked as boolean })
                }
              />
              <Label htmlFor="incluir" className="text-sm font-normal cursor-pointer">
                Incluir no cálculo de CG
              </Label>
            </div>

            <div>
              <Label htmlFor="observacao">Observação</Label>
              <Textarea
                id="observacao"
                placeholder="Adicione notas relevantes..."
                value={formData.observacao}
                onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={resetForm}>
              Cancelar
            </Button>
            <Button onClick={handleSaveItem}>
              {editingItem ? "Atualizar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
