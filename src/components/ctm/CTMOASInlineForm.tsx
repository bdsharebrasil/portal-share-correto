import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, X, Save, Loader2 } from "lucide-react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface Oficina {
  id: string;
  razao_social: string;
  cnpj: string | null;
  telefone: string | null;
  mecanico_responsavel: string | null;
}

interface CTMOASInlineFormProps {
  aircraftId: string;
  aircraftRegistration: string;
  categoryName: string;
  onCreated: () => void;
  onCancel: () => void;
}

const SERVICE_STATUS = ["em_andamento", "concluido", "pendente"];
const STATUS_LABELS: Record<string, string> = {
  em_andamento: "Em Andamento",
  concluido: "Concluído",
  pendente: "Pendente",
};

// Helper para obter data de hoje sem problemas de timezone
const getTodayString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function CTMOASInlineForm({
  aircraftId,
  aircraftRegistration,
  categoryName,
  onCreated,
  onCancel,
}: CTMOASInlineFormProps) {
  const [loading, setLoading] = useState(false);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [formData, setFormData] = useState({
    numero: "",
    os_oficina: "",
    oficina_nome: "",
    oficina_contato: "",
    data_entrada: getTodayString(),
    data_saida: "",
    dias_previstos: "",
    dias_efetivos: "",
    horas_celula: "",
    objetivo: "",
    observacoes: "",
    status: "em_andamento",
  });

  useEffect(() => {
    loadOficinas();
  }, []);

  const loadOficinas = async () => {
    const { data } = await supabase
      .from("oficinas")
      .select("id, razao_social, cnpj, telefone, mecanico_responsavel")
      .eq("ativo", true)
      .order("razao_social");
    if (data) setOficinas(data);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleOficinaSelect = (oficinaId: string) => {
    const oficina = oficinas.find((o) => o.id === oficinaId);
    if (oficina) {
      setFormData((prev) => ({
        ...prev,
        oficina_nome: oficina.razao_social,
        oficina_contato: oficina.telefone || "",
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.numero) {
      toast.error("Número da OAS é obrigatório");
      return;
    }

    setLoading(true);
    try {
      // 1. Create in service_orders
      const { data: newOrder, error: orderError } = await (supabase as any).from("ctm_ordem_acompanhamento_servico").insert([
        {
          aeronave_id: aircraftId,
          numero: formData.numero,
          tipo_manutencao: categoryName,
          os_oficina: formData.os_oficina || null,
          oficina_nome: formData.oficina_nome || null,
          oficina_contato: formData.oficina_contato || null,
          data_entrada: formData.data_entrada || null,
          data_saida: formData.data_saida || null,
          dias_previstos: formData.dias_previstos ? parseInt(formData.dias_previstos) : null,
          dias_efetivos: formData.dias_efetivos ? parseInt(formData.dias_efetivos) : null,
          horas_celula: formData.horas_celula ? parseFloat(formData.horas_celula) : null,
          objetivo: formData.objetivo || null,
          observacoes: formData.observacoes || null,
          status: formData.status,
        },
      ]).select().single();

      if (orderError) throw orderError;

      // 2. Create synchronization record in manutencoes
      if (newOrder && aircraftId) {
        const dataEntrada = formData.data_entrada || getTodayString();

        const { error: manutencaoError } = await supabase
          .from('manutencoes')
          .insert([
            {
              aeronave_id: aircraftId,
              tipo: categoryName,
              data_programada: dataEntrada,
              mecanico: 'A designar',
              etapa: 'em_andamento',
              oficina: formData.oficina_nome || null,
              observacoes: formData.observacoes || null,
              vencimento_tipo: 'horas',
              vencimento_horas: formData.horas_celula ? parseFloat(formData.horas_celula) : null,
            }
          ]);

        if (manutencaoError) {
          console.error('Erro ao criar registro em manutencoes:', manutencaoError);
        }
      }

      // 3. Create synchronization record in aircraft_maintenance_records
      if (newOrder && aircraftId) {
        const mapMaintenanceType = (tipo?: string, horas?: number): string => {
          if (!tipo && !horas) return '100h';
          if (tipo?.includes('50')) return '50h';
          if (tipo?.includes('100')) return '100h';
          if (tipo?.includes('150')) return '150h';
          if (tipo?.includes('200')) return '200h';
          if (horas) {
            if (horas <= 50) return '50h';
            if (horas <= 100) return '100h';
            if (horas <= 150) return '150h';
            return '200h';
          }
          return '100h';
        };

        const performedHours = formData.horas_celula ? parseFloat(formData.horas_celula) : 0;
        const maintenanceType = mapMaintenanceType(categoryName, performedHours);

        const { error: recordError } = await supabase
          .from('registros_manutencao_aeronave')
          .insert([
            {
              aeronave_id: aircraftId,
              tipo_manutencao: maintenanceType,
              horas_realizada: performedHours,
              data_realizada: formData.data_entrada || getTodayString(),
              proxima_vencimento_horas: performedHours + 50,
              nome_mecanico: 'A designar',
              centro_manutencao: formData.oficina_nome || null,
              numero_ordem_servico: formData.numero || null,
              descricao: formData.observacoes || null,
              custo: 0,
            }
          ]);

        if (recordError) {
          console.error('Erro ao criar registro em aircraft_maintenance_records:', recordError);
        }
      }

      toast.success(`OAS nº ${formData.numero} criada com sucesso!`);
      onCreated();
    } catch (error: any) {
      console.error('Erro ao criar OAS:', error);
      toast.error(error.message || "Erro ao criar OAS");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Nova OAS — {categoryName} — {aircraftRegistration}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Row 1: Número + Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Número da OAS *</Label>
                <Input
                  placeholder="Ex: OAS-2025-001"
                  value={formData.numero}
                  onChange={(e) => handleChange("numero", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Categoria</Label>
                <Input disabled value={categoryName} className="bg-muted/50" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => handleChange("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_STATUS.map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Oficina */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Oficina</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Selecionar Oficina Cadastrada</Label>
                  <Select onValueChange={handleOficinaSelect}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {oficinas.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.razao_social}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Nome da Oficina</Label>
                  <Input
                    value={formData.oficina_nome}
                    onChange={(e) => handleChange("oficina_nome", e.target.value)}
                    placeholder="Nome da oficina"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Contato</Label>
                  <Input
                    value={formData.oficina_contato}
                    onChange={(e) => handleChange("oficina_contato", e.target.value)}
                    placeholder="Telefone / Email"
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Datas + Horas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Data Entrada</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={
                        "w-full justify-start text-left font-normal bg-background border-border" +
                        (!formData.data_entrada ? " text-muted-foreground" : "")
                      }
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.data_entrada
                        ? format(parse(formData.data_entrada, "yyyy-MM-dd", new Date()), "dd/MM/yyyy")
                        : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.data_entrada ? parse(formData.data_entrada, "yyyy-MM-dd", new Date()) : undefined}
                      onSelect={(date) => handleChange("data_entrada", date ? format(date, "yyyy-MM-dd") : "")}
                      locale={ptBR}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Data Saída</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={
                        "w-full justify-start text-left font-normal bg-background border-border" +
                        (!formData.data_saida ? " text-muted-foreground" : "")
                      }
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.data_saida
                        ? format(parse(formData.data_saida, "yyyy-MM-dd", new Date()), "dd/MM/yyyy")
                        : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.data_saida ? parse(formData.data_saida, "yyyy-MM-dd", new Date()) : undefined}
                      onSelect={(date) => handleChange("data_saida", date ? format(date, "yyyy-MM-dd") : "")}
                      locale={ptBR}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Dias Previstos</Label>
                <Input type="number" value={formData.dias_previstos} onChange={(e) => handleChange("dias_previstos", e.target.value)} min="0" />
              </div>
              <div>
                <Label>Horas Célula</Label>
                <Input type="number" value={formData.horas_celula} onChange={(e) => handleChange("horas_celula", e.target.value)} step="0.1" min="0" />
              </div>
            </div>

            {/* Row 4: Objetivo + Observações */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Objetivo</Label>
                <Textarea value={formData.objetivo} onChange={(e) => handleChange("objetivo", e.target.value)} rows={2} placeholder="Descreva o objetivo da manutenção..." />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={formData.observacoes} onChange={(e) => handleChange("observacoes", e.target.value)} rows={2} placeholder="Observações adicionais..." />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Criar OAS
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
