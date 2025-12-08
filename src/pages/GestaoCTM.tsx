import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plane, Calendar, ChevronDown, ChevronRight, Plus, Pencil } from "lucide-react";

interface Aircraft {
  id: string;
  registration: string;
  model: string;
  status?: string | null;
}

interface CTMData {
  id: string;
  month: number;
  year: number;
  control_type: string;
  item_name: string;
  left_value: string | null;
  right_value: string | null;
  last_change_date: string | null;
  last_change_hours: number | null;
  service_order_number: string | null;
  invoice_number: string | null;
  hours_after: number | null;
  remaining_hours: number | null;
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function GestaoCTM() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState<string>("");
  const [ctmData, setCtmData] = useState<CTMData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>(`${new Date().getMonth() + 1}`);
  const [editItem, setEditItem] = useState<CTMData | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  useEffect(() => {
    loadAircraft();
  }, []);

  useEffect(() => {
    if (selectedAircraft) {
      loadCTMData();
    } else {
      setCtmData([]);
    }
  }, [selectedAircraft, selectedYear]);

  const loadAircraft = async () => {
    try {
      const { data, error } = await supabase
        .from("aircraft")
        .select("id, registration, model, status")
        .order("registration");

      if (error) throw error;
      setAircraft(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar aeronaves: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCTMData = async () => {
    try {
      const { data, error } = await supabase
        .from("ctm_tracking")
        .select("*")
        .eq("aircraft_id", selectedAircraft)
        .eq("year", selectedYear)
        .order("month", { ascending: true });

      if (error) throw error;
      setCtmData(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar dados CTM: " + error.message);
    }
  };

  const handleSelectAircraft = (aircraftId: string) => {
    setSelectedAircraft(aircraftId);
  };

  const createMonthData = async (month: number) => {
    if (!selectedAircraft) return;

    try {
      const { data: exists } = await supabase
        .from("ctm_tracking")
        .select("id")
        .eq("aircraft_id", selectedAircraft)
        .eq("month", month)
        .eq("year", selectedYear)
        .limit(1);

      if (exists && exists.length > 0) {
        toast.info("Já existe controle CTM para este mês.");
        return;
      }

      const items = [
        { control_type: "Pneus", item_name: "Principal Esquerdo" },
        { control_type: "Pneus", item_name: "Principal Direito" },
        { control_type: "Pneus", item_name: "Dianteiro" },
        { control_type: "Câmaras", item_name: "Principal Esquerdo" },
        { control_type: "Câmaras", item_name: "Principal Direito" },
        { control_type: "Câmaras", item_name: "Dianteiro" },
        { control_type: "Velas", item_name: "Velas do Motor" },
        { control_type: "Pastilhas", item_name: "Freio Esquerdo" },
        { control_type: "Pastilhas", item_name: "Freio Direito" },
        { control_type: "Consumíveis", item_name: "Óleo do Motor" },
        { control_type: "Consumíveis", item_name: "Filtro de Óleo" },
        { control_type: "Consumíveis", item_name: "Filtro de Ar" },
      ];

      const rows = items.map((it) => ({
        aircraft_id: selectedAircraft,
        month,
        year: selectedYear,
        control_type: it.control_type,
        item_name: it.item_name,
      }));

      const { error } = await supabase.from("ctm_tracking").insert(rows);
      if (error) throw error;
      toast.success("Controle CTM criado para o mês.");
      loadCTMData();
    } catch (e: any) {
      toast.error("Erro ao criar CTM: " + e.message);
    }
  };

  const getMonthData = (month: number) => {
    return ctmData.filter((item) => item.month === month);
  };

  const groupByControlType = (data: CTMData[]) => {
    return data.reduce((acc, item) => {
      if (!acc[item.control_type]) {
        acc[item.control_type] = [];
      }
      acc[item.control_type].push(item);
      return acc;
    }, {} as Record<string, CTMData[]>);
  };

  const normalizeStatus = (s: string | null | undefined) => (s ?? "").toString().trim().toLowerCase();
  const isActiveStatus = (s: string | null | undefined) => ["ativo", "ativa", "active"].includes(normalizeStatus(s));
  const isInactiveStatus = (s: string | null | undefined) => ["inativo", "inativa", "inactive"].includes(normalizeStatus(s));
  const activeAircraft = aircraft.filter((a) => isActiveStatus(a.status));
  const inactiveAircraft = aircraft.filter((a) => isInactiveStatus(a.status));

  if (loading) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <span className="text-muted-foreground">Carregando...</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Gestão CTM - Controle Técnico de Manutenção
          </h1>
          <p className="text-muted-foreground">
            Controle mensal de pneus, câmaras, velas, pastilhas e consumíveis por aeronave
          </p>
        </div>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-primary" />
              Aeronaves Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {activeAircraft.map((ac) => (
                <Button
                  key={ac.id}
                  variant={selectedAircraft === ac.id ? "default" : "outline"}
                  onClick={() => handleSelectAircraft(ac.id)}
                  className="uppercase"
                >
                  {ac.registration} - {ac.model}
                </Button>
              ))}
              {activeAircraft.length === 0 && (
                <span className="text-muted-foreground">Nenhuma aeronave ativa.</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {showInactive ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              Aeronaves Inativas
              <span className="text-sm text-muted-foreground">({inactiveAircraft.length})</span>
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowInactive((s) => !s)}>
              {showInactive ? "Ocultar" : "Mostrar"}
            </Button>
          </CardHeader>
          {showInactive && (
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                {inactiveAircraft.map((ac) => (
                  <Button
                    key={ac.id}
                    variant={selectedAircraft === ac.id ? "default" : "outline"}
                    onClick={() => handleSelectAircraft(ac.id)}
                    className="uppercase"
                  >
                    {ac.registration} - {ac.model}
                  </Button>
                ))}
                {inactiveAircraft.length === 0 && (
                  <span className="text-muted-foreground">Nenhuma aeronave inativa.</span>
                )}
              </div>
            </CardContent>
          )}
        </Card>

        {selectedAircraft && (
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Controle CTM - {aircraft.find(a => a.id === selectedAircraft)?.registration}
                </CardTitle>
                <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={selectedMonth} onValueChange={setSelectedMonth} className="w-full">
                <TabsList className="w-full grid grid-cols-12 h-auto p-1">
                  {MONTH_NAMES.map((name, index) => {
                    const monthNum = index + 1;
                    const hasData = ctmData.some((d) => d.month === monthNum);
                    return (
                      <TabsTrigger
                        key={monthNum}
                        value={String(monthNum)}
                        className={`flex items-center justify-center gap-0.5 px-1 py-2 text-xs sm:text-sm ${hasData ? '' : 'opacity-60'}`}
                      >
                        {name}
                        {hasData && <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0" />}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {MONTH_NAMES.map((_, index) => {
                  const monthNum = index + 1;
                  const monthData = getMonthData(monthNum);
                  const groupedByType = groupByControlType(monthData);

                  return (
                    <TabsContent key={monthNum} value={String(monthNum)} className="space-y-4">
                      {monthData.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground mb-4">
                            Nenhum dado CTM para {MONTH_NAMES[monthNum - 1]} {selectedYear}
                          </p>
                          <Button onClick={() => createMonthData(monthNum)} className="gap-2">
                            <Plus className="h-4 w-4" /> Criar Controle para este Mês
                          </Button>
                        </div>
                      ) : (
                        Object.entries(groupedByType).map(([controlType, items]) => (
                          <Card key={controlType} className="border-border">
                            <CardHeader className="py-3">
                              <CardTitle className="text-lg">{controlType}</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-sm">
                                  <thead>
                                    <tr className="border-b border-border">
                                      <th className="text-left p-2 font-medium">Item</th>
                                      <th className="text-left p-2 font-medium">Esquerdo</th>
                                      <th className="text-left p-2 font-medium">Direito</th>
                                      <th className="text-left p-2 font-medium">Última Troca</th>
                                      <th className="text-left p-2 font-medium">Horas Troca</th>
                                      <th className="text-left p-2 font-medium">O.S.</th>
                                      <th className="text-left p-2 font-medium">NF</th>
                                      <th className="text-left p-2 font-medium">Horas Após</th>
                                      <th className="text-left p-2 font-medium">Restantes</th>
                                      <th className="text-left p-2 font-medium">Ações</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {items.map((item) => (
                                      <tr key={item.id} className="border-b border-border hover:bg-accent">
                                        <td className="p-2">{item.item_name}</td>
                                        <td className="p-2">{item.left_value || "-"}</td>
                                        <td className="p-2">{item.right_value || "-"}</td>
                                        <td className="p-2">
                                          {item.last_change_date
                                            ? new Date(item.last_change_date).toLocaleDateString("pt-BR")
                                            : "-"}
                                        </td>
                                        <td className="p-2">{item.last_change_hours ?? "-"}</td>
                                        <td className="p-2">{item.service_order_number || "-"}</td>
                                        <td className="p-2">{item.invoice_number || "-"}</td>
                                        <td className="p-2">{item.hours_after ?? "-"}</td>
                                        <td className="p-2">{item.remaining_hours ?? "-"}</td>
                                        <td className="p-2">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                              setEditItem(item);
                                              setEditDialogOpen(true);
                                            }}
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            </CardContent>
          </Card>
        )}

        <CTMEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          item={editItem}
          onSaved={loadCTMData}
        />
      </div>
    </Layout>
  );
}

function CTMEditDialog({
  open,
  onOpenChange,
  item,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CTMData | null;
  onSaved: () => void;
}) {
  const [formData, setFormData] = useState<Partial<CTMData>>({});

  useEffect(() => {
    if (item) {
      setFormData({
        left_value: item.left_value || "",
        right_value: item.right_value || "",
        last_change_date: item.last_change_date || "",
        last_change_hours: item.last_change_hours,
        service_order_number: item.service_order_number || "",
        invoice_number: item.invoice_number || "",
        hours_after: item.hours_after,
        remaining_hours: item.remaining_hours,
      });
    }
  }, [item]);

  const handleSave = async () => {
    if (!item) return;

    try {
      const { error } = await supabase
        .from("ctm_tracking")
        .update({
          left_value: formData.left_value || null,
          right_value: formData.right_value || null,
          last_change_date: formData.last_change_date || null,
          last_change_hours: formData.last_change_hours || null,
          service_order_number: formData.service_order_number || null,
          invoice_number: formData.invoice_number || null,
          hours_after: formData.hours_after || null,
          remaining_hours: formData.remaining_hours || null,
        })
        .eq("id", item.id);

      if (error) throw error;
      toast.success("Item atualizado com sucesso!");
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error("Erro ao atualizar: " + e.message);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar {item.item_name} - {item.control_type}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor Esquerdo</Label>
              <Input
                value={formData.left_value || ""}
                onChange={(e) => setFormData({ ...formData, left_value: e.target.value })}
                placeholder="Ex: P/N 12345"
              />
            </div>
            <div>
              <Label>Valor Direito</Label>
              <Input
                value={formData.right_value || ""}
                onChange={(e) => setFormData({ ...formData, right_value: e.target.value })}
                placeholder="Ex: P/N 12345"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data Última Troca</Label>
              <Input
                type="date"
                value={formData.last_change_date || ""}
                onChange={(e) => setFormData({ ...formData, last_change_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Horas Última Troca</Label>
              <Input
                type="number"
                value={formData.last_change_hours ?? ""}
                onChange={(e) => setFormData({ ...formData, last_change_hours: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="0"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nº O.S.</Label>
              <Input
                value={formData.service_order_number || ""}
                onChange={(e) => setFormData({ ...formData, service_order_number: e.target.value })}
                placeholder="Ex: OS-001"
              />
            </div>
            <div>
              <Label>Nº Nota Fiscal</Label>
              <Input
                value={formData.invoice_number || ""}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                placeholder="Ex: NF-12345"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Horas Após</Label>
              <Input
                type="number"
                value={formData.hours_after ?? ""}
                onChange={(e) => setFormData({ ...formData, hours_after: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Horas Restantes</Label>
              <Input
                type="number"
                value={formData.remaining_hours ?? ""}
                onChange={(e) => setFormData({ ...formData, remaining_hours: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
