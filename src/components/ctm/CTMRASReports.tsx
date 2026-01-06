import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RASReport, RASItem, RASPhoto } from "@/types/ctm";
import { useRASReports, useRASItems, useRASPhotos } from "@/hooks/useCTMData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  FileText, 
  Plus, 
  Camera, 
  Download, 
  Printer, 
  ChevronRight, 
  Calendar,
  Building2,
  Clock,
  Wrench,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RASReportsProps {
  aircraftId: string;
  aircraftRegistration: string;
}

export function CTMRASReports({ aircraftId, aircraftRegistration }: RASReportsProps) {
  const { data: reports = [], isLoading, refetch } = useRASReports(aircraftId);
  const [selectedReport, setSelectedReport] = useState<RASReport | null>(null);
  const [showNewRASDialog, setShowNewRASDialog] = useState(false);

  if (isLoading) {
    return (
      <Card className="bg-gradient-card border-border">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-64">
            <span className="text-muted-foreground">Carregando relatórios...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (selectedReport) {
    return (
      <RASReportDetail 
        report={selectedReport} 
        aircraftRegistration={aircraftRegistration}
        onBack={() => setSelectedReport(null)} 
      />
    );
  }

  const handleRASCreated = () => {
    setShowNewRASDialog(false);
    refetch();
  };

  return (
    <>
      <Card className="bg-gradient-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Relatórios de Acompanhamento de Serviço (RAS)
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Documentação técnica de manutenções realizadas
            </p>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setShowNewRASDialog(true)}>
            <Plus className="h-4 w-4" />
            Novo RAS
          </Button>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-foreground mb-1">Nenhum relatório cadastrado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie um novo RAS para documentar serviços de manutenção
              </p>
              <Button size="sm" className="gap-2" onClick={() => setShowNewRASDialog(true)}>
                <Plus className="h-4 w-4" />
                Criar Primeiro RAS
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {reports.map((report) => (
                <Card 
                  key={report.id} 
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedReport(report)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-foreground">{report.number}</h4>
                        <p className="text-sm text-muted-foreground">{report.maintenance_type}</p>
                      </div>
                      <Badge variant={report.status === 'completed' ? 'default' : 'secondary'}>
                        {report.status === 'completed' ? 'Concluído' : 'Em Andamento'}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="h-4 w-4" />
                        <span>{report.maintenance_center}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {format(new Date(report.entry_date), "dd/MM/yyyy", { locale: ptBR })}
                          {report.exit_date && ` - ${format(new Date(report.exit_date), "dd/MM/yyyy", { locale: ptBR })}`}
                        </span>
                      </div>
                      {report.cell_hours_entry && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{report.cell_hours_entry}h célula</span>
                        </div>
                      )}
                    </div>

                    {report.grand_total && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Total:</span>
                          <span className="font-bold text-foreground">
                            R$ {report.grand_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-end mt-3 text-primary text-sm">
                      Ver detalhes <ChevronRight className="h-4 w-4 ml-1" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New RAS Dialog */}
      <NewRASDialog
        open={showNewRASDialog}
        onOpenChange={setShowNewRASDialog}
        aircraftId={aircraftId}
        onSuccess={handleRASCreated}
      />
    </>
  );
}

// New RAS Dialog Component
interface NewRASDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftId: string;
  onSuccess: () => void;
}

function NewRASDialog({ open, onOpenChange, aircraftId, onSuccess }: NewRASDialogProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    number: "",
    maintenance_type: "preventiva",
    maintenance_center: "",
    entry_date: new Date().toISOString().split("T")[0],
    exit_date: "",
    cell_hours_entry: "",
    cell_hours_exit: "",
    planned_days: "",
    description: "",
    status: "in_progress",
  });

  const handleSave = async () => {
    if (!formData.number || !formData.maintenance_center || !formData.entry_date) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    try {
      setSaving(true);
      
      const { error } = await supabase
        .from("ras")
        .insert({
          aircraft_id: aircraftId,
          number: formData.number,
          maintenance_type: formData.maintenance_type,
          maintenance_center: formData.maintenance_center,
          entry_date: formData.entry_date,
          exit_date: formData.exit_date || null,
          cell_hours_entry: formData.cell_hours_entry ? parseFloat(formData.cell_hours_entry) : null,
          cell_hours_exit: formData.cell_hours_exit ? parseFloat(formData.cell_hours_exit) : null,
          planned_days: formData.planned_days ? parseInt(formData.planned_days) : null,
          description: formData.description || null,
          status: formData.status,
        });

      if (error) throw error;

      toast.success("RAS criado com sucesso!");
      setFormData({
        number: "",
        maintenance_type: "preventiva",
        maintenance_center: "",
        entry_date: new Date().toISOString().split("T")[0],
        exit_date: "",
        cell_hours_entry: "",
        cell_hours_exit: "",
        planned_days: "",
        description: "",
        status: "in_progress",
      });
      onSuccess();
    } catch (error: any) {
      console.error("Error creating RAS:", error);
      toast.error("Erro ao criar RAS: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Relatório de Acompanhamento de Serviço (RAS)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="number">Número do RAS *</Label>
              <Input
                id="number"
                placeholder="Ex: RAS-2025-001"
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maintenance_type">Tipo de Manutenção *</Label>
              <Select
                value={formData.maintenance_type}
                onValueChange={(value) => setFormData({ ...formData, maintenance_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preventiva">Preventiva</SelectItem>
                  <SelectItem value="corretiva">Corretiva</SelectItem>
                  <SelectItem value="revisao">Revisão</SelectItem>
                  <SelectItem value="inspecao">Inspeção</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maintenance_center">Centro de Manutenção *</Label>
            <Input
              id="maintenance_center"
              placeholder="Ex: Hangar União"
              value={formData.maintenance_center}
              onChange={(e) => setFormData({ ...formData, maintenance_center: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entry_date">Data de Entrada *</Label>
              <Input
                id="entry_date"
                type="date"
                value={formData.entry_date}
                onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="exit_date">Data de Saída</Label>
              <Input
                id="exit_date"
                type="date"
                value={formData.exit_date}
                onChange={(e) => setFormData({ ...formData, exit_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cell_hours_entry">Célula Entrada (h)</Label>
              <Input
                id="cell_hours_entry"
                type="number"
                step="0.1"
                placeholder="0.0"
                value={formData.cell_hours_entry}
                onChange={(e) => setFormData({ ...formData, cell_hours_entry: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cell_hours_exit">Célula Saída (h)</Label>
              <Input
                id="cell_hours_exit"
                type="number"
                step="0.1"
                placeholder="0.0"
                value={formData.cell_hours_exit}
                onChange={(e) => setFormData({ ...formData, cell_hours_exit: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="planned_days">Dias Previstos</Label>
              <Input
                id="planned_days"
                type="number"
                placeholder="0"
                value={formData.planned_days}
                onChange={(e) => setFormData({ ...formData, planned_days: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              placeholder="Descreva os serviços realizados..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar RAS
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface RASReportDetailProps {
  report: RASReport;
  aircraftRegistration: string;
  onBack: () => void;
}

function RASReportDetail({ report, aircraftRegistration, onBack }: RASReportDetailProps) {
  const { data: items = [] } = useRASItems(report.id);
  const { data: photos = [] } = useRASPhotos(report.id);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<RASPhoto | null>(null);

  const handlePrint = () => {
    window.print();
  };

  const laborItems = items.filter(i => i.item_type === 'labor' || i.item_type === 'servico');
  const partItems = items.filter(i => i.item_type === 'parts' || i.item_type === 'peca');

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ChevronRight className="h-4 w-4 rotate-180" />
          Voltar
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Report Document */}
      <Card className="bg-gradient-card border-border print:shadow-none print:border-2">
        <CardHeader className="border-b print:border-b-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Relatório de Acompanhamento de Serviço</p>
              <CardTitle className="text-2xl">{report.number}</CardTitle>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg">{aircraftRegistration}</p>
              <Badge variant={report.status === 'completed' ? 'default' : 'secondary'}>
                {report.status === 'completed' ? 'Concluído' : 'Em Andamento'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Tipo</p>
              <p className="font-medium">{report.maintenance_type}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Centro</p>
              <p className="font-medium">{report.maintenance_center}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Entrada</p>
              <p className="font-medium">
                {format(new Date(report.entry_date), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Saída</p>
              <p className="font-medium">
                {report.exit_date 
                  ? format(new Date(report.exit_date), "dd/MM/yyyy", { locale: ptBR })
                  : "-"
                }
              </p>
            </div>
            {report.cell_hours_entry && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Célula Entrada</p>
                <p className="font-medium">{report.cell_hours_entry}h</p>
              </div>
            )}
            {report.cell_hours_exit && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Célula Saída</p>
                <p className="font-medium">{report.cell_hours_exit}h</p>
              </div>
            )}
            {report.planned_days && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Dias Previstos</p>
                <p className="font-medium">{report.planned_days}</p>
              </div>
            )}
            {report.effective_days && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Dias Efetivos</p>
                <p className="font-medium">{report.effective_days}</p>
              </div>
            )}
          </div>

          {/* Description */}
          {report.description && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Descrição</p>
              <p className="text-foreground">{report.description}</p>
            </div>
          )}

          {/* Services Table */}
          {laborItems.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Serviços Executados
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {laborItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.supplier || "-"}</TableCell>
                      <TableCell className="text-right">
                        R$ {(item.total_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Parts Table */}
          {partItems.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Peças e Materiais</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>P/N</TableHead>
                    <TableHead>S/N</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-right">Valor Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="font-mono text-sm">{item.part_number || "-"}</TableCell>
                      <TableCell className="font-mono text-sm">{item.serial_number || "-"}</TableCell>
                      <TableCell className="text-center">{item.quantity || 1}</TableCell>
                      <TableCell className="text-right">
                        R$ {(item.unit_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        R$ {(item.total_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Photos */}
          {photos.length > 0 && (
            <div className="print:break-before-page">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Registro Fotográfico
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {photos.map((photo) => (
                  <div 
                    key={photo.id} 
                    className="relative group cursor-pointer"
                    onClick={() => {
                      setSelectedPhoto(photo);
                      setShowPhotoDialog(true);
                    }}
                  >
                    <img 
                      src={photo.photo_url} 
                      alt={photo.caption || "Foto"} 
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    {photo.caption && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {photo.caption}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="border-t pt-4">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                {report.labor_total !== null && report.labor_total !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mão de Obra:</span>
                    <span>R$ {report.labor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {report.parts_total !== null && report.parts_total !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Peças:</span>
                    <span>R$ {report.parts_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>R$ {(report.grand_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Photo Dialog */}
      <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedPhoto?.caption || "Foto"}</DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <img 
              src={selectedPhoto.photo_url} 
              alt={selectedPhoto.caption || "Foto"} 
              className="w-full rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
