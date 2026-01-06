import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRASReports } from "@/hooks/useCTMData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  FileText, 
  Plus, 
  Camera, 
  Download, 
  ChevronRight, 
  Loader2,
  X,
  Image as ImageIcon,
  Eye
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";

interface RASReportsProps {
  aircraftId: string;
  aircraftRegistration: string;
}

interface RASPhoto {
  id: string;
  file?: File;
  url?: string;
  preview: string;
  description: string;
}

interface RASFormData {
  number: string;
  maintenance_type: string;
  maintenance_center: string;
  entry_date: string;
  responsible: string;
  inspection_title: string;
  description: string;
  photos: RASPhoto[];
}

export function CTMRASReports({ aircraftId, aircraftRegistration }: RASReportsProps) {
  const { data: reports = [], isLoading, refetch } = useRASReports(aircraftId);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [showNewRASDialog, setShowNewRASDialog] = useState(false);

  if (isLoading) {
    return (
      <Card className="bg-gradient-card border-border">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (selectedReport) {
    return (
      <RASReportView 
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
              Documentação técnica de manutenções corretivas emergenciais
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
                Crie um novo RAS para documentar manutenções corretivas
              </p>
              <Button size="sm" className="gap-2" onClick={() => setShowNewRASDialog(true)}>
                <Plus className="h-4 w-4" />
                Criar Primeiro RAS
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {reports.map((report: any) => (
                <Card 
                  key={report.id} 
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedReport(report)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-foreground">{report.number || 'RAS'}</h4>
                        <p className="text-sm text-muted-foreground">{report.maintenance_type}</p>
                      </div>
                      <Badge variant={report.status === 'completed' ? 'default' : 'secondary'}>
                        {report.status === 'completed' ? 'Concluído' : 'Registrado'}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <p className="text-muted-foreground">{report.maintenance_center}</p>
                      <p className="text-muted-foreground">
                        {report.entry_date && format(new Date(report.entry_date), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>

                    <div className="flex items-center justify-end mt-3 text-primary text-sm">
                      <Eye className="h-4 w-4 mr-1" />
                      Ver documento
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <NewRASDialog
        open={showNewRASDialog}
        onOpenChange={setShowNewRASDialog}
        aircraftId={aircraftId}
        aircraftRegistration={aircraftRegistration}
        onSuccess={handleRASCreated}
      />
    </>
  );
}

// New RAS Dialog Component with proper form structure
interface NewRASDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftId: string;
  aircraftRegistration: string;
  onSuccess: () => void;
}

function NewRASDialog({ open, onOpenChange, aircraftId, aircraftRegistration, onSuccess }: NewRASDialogProps) {
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<RASFormData>({
    number: `RAS-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
    maintenance_type: "Corretiva",
    maintenance_center: "",
    entry_date: new Date().toISOString().split("T")[0],
    responsible: "",
    inspection_title: "",
    description: "",
    photos: [],
  });

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newPhotos: RASPhoto[] = [];
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const photo: RASPhoto = {
          id: crypto.randomUUID(),
          file,
          preview: event.target?.result as string,
          description: "",
        };
        setFormData(prev => ({
          ...prev,
          photos: [...prev.photos, photo]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (id: string) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter(p => p.id !== id)
    }));
  };

  const updatePhotoDescription = (id: string, description: string) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.map(p => p.id === id ? { ...p, description } : p)
    }));
  };

  const handleSave = async () => {
    if (!formData.maintenance_center || !formData.entry_date || !formData.responsible) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    try {
      setSaving(true);

      // Upload photos to storage
      const uploadedPhotos: { url: string; description: string }[] = [];
      
      for (const photo of formData.photos) {
        if (photo.file) {
          const fileName = `ras/${aircraftId}/${Date.now()}_${photo.file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("maintenance-photos")
            .upload(fileName, photo.file);

          if (uploadError) {
            console.error("Upload error:", uploadError);
            // Continue even if upload fails - we'll use the preview
          } else {
            const { data: publicUrl } = supabase.storage
              .from("maintenance-photos")
              .getPublicUrl(fileName);
            
            uploadedPhotos.push({
              url: publicUrl.publicUrl,
              description: photo.description,
            });
          }
        }
      }

      // Save RAS to database
      const { error } = await supabase
        .from("ras")
        .insert({
          aircraft_id: aircraftId,
          number: formData.number,
          maintenance_type: formData.maintenance_type,
          maintenance_center: formData.maintenance_center,
          entry_date: formData.entry_date,
          responsible: formData.responsible,
          objective: formData.inspection_title,
          description: formData.description,
          status: "completed",
        });

      if (error) throw error;

      toast.success("RAS criado com sucesso!");
      resetForm();
      onSuccess();
    } catch (error: any) {
      console.error("Error creating RAS:", error);
      toast.error("Erro ao criar RAS: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      number: `RAS-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      maintenance_type: "Corretiva",
      maintenance_center: "",
      entry_date: new Date().toISOString().split("T")[0],
      responsible: "",
      inspection_title: "",
      description: "",
      photos: [],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Novo Relatório de Acompanhamento de Serviço (RAS)</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Document Preview Header */}
          <Card className="bg-muted/30 border-2">
            <CardContent className="pt-4">
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold text-foreground">RELATÓRIO DE ACOMPANHAMENTO DE SERVIÇO - RAS</h2>
              </div>
              
              {/* Header Info Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm border rounded-lg p-4 bg-background">
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <span className="font-semibold text-muted-foreground">Aeronave:</span>
                    <span className="font-medium">{aircraftRegistration}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-muted-foreground">Matrícula:</span>
                    <span className="font-medium">{aircraftRegistration}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="font-semibold text-muted-foreground">Período Manutenção:</span>
                    <Input
                      type="date"
                      value={formData.entry_date}
                      onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                      className="h-8 w-40"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-2 items-center">
                    <span className="font-semibold text-muted-foreground">Centro de Manutenção:</span>
                    <Input
                      placeholder="Ex: Hangar União"
                      value={formData.maintenance_center}
                      onChange={(e) => setFormData({ ...formData, maintenance_center: e.target.value })}
                      className="h-8 flex-1"
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="font-semibold text-muted-foreground">Tipo de Manutenção:</span>
                    <Input
                      placeholder="Ex: Corretiva Pneus"
                      value={formData.maintenance_type}
                      onChange={(e) => setFormData({ ...formData, maintenance_type: e.target.value })}
                      className="h-8 flex-1"
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="font-semibold text-muted-foreground">Resp. pelo acompanhamento:</span>
                    <Input
                      placeholder="Nome do responsável"
                      value={formData.responsible}
                      onChange={(e) => setFormData({ ...formData, responsible: e.target.value })}
                      className="h-8 flex-1"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inspection Title */}
          <div className="space-y-3">
            <div className="bg-primary/10 text-primary text-center py-2 rounded-lg font-semibold">
              DESCRIÇÃO DAS INSPEÇÕES REALIZADAS
            </div>
            
            <div className="space-y-2">
              <Label>Título da Inspeção/Serviço *</Label>
              <Input
                placeholder="Ex: SUBSTITUIÇÃO TEMPORÁRIA DO PNEU ESQUERDO"
                value={formData.inspection_title}
                onChange={(e) => setFormData({ ...formData, inspection_title: e.target.value })}
                className="font-medium uppercase"
              />
            </div>
          </div>

          {/* Photo Upload Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Fotos do Serviço
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Adicionar Fotos
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>

            {formData.photos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {formData.photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <div className="aspect-video rounded-lg overflow-hidden border bg-muted">
                      <img
                        src={photo.preview}
                        alt="Foto do serviço"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removePhoto(photo.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <Input
                      placeholder="Descrição da foto"
                      value={photo.description}
                      onChange={(e) => updatePhotoDescription(photo.id, e.target.value)}
                      className="mt-2 text-xs h-8"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Clique em "Adicionar Fotos" para incluir imagens do serviço
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Descrição Detalhada do Ocorrido *</Label>
            <Textarea
              placeholder="Descreva em detalhes o que aconteceu, as ações tomadas e os resultados obtidos..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={6}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Inclua informações como: causa do problema, procedimentos realizados, peças utilizadas, etc.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar RAS
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// RAS Report View Component with PDF Export
interface RASReportViewProps {
  report: any;
  aircraftRegistration: string;
  onBack: () => void;
}

function RASReportView({ report, aircraftRegistration, onBack }: RASReportViewProps) {
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    try {
      setExporting(true);
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      let yPos = 20;

      // Header - Logo placeholder
      pdf.setFillColor(0, 82, 147);
      pdf.rect(margin, yPos, 40, 15, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('SHARE', margin + 5, yPos + 7);
      pdf.setFontSize(8);
      pdf.text('Brasil', margin + 5, yPos + 12);
      
      yPos += 25;

      // Title
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      const title = 'RELATÓRIO DE ACOMPANHAMENTO DE SERVIÇO - RAS';
      pdf.text(title, pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 15;

      // Header info box
      pdf.setFillColor(230, 230, 230);
      pdf.rect(margin, yPos, pageWidth - margin * 2, 30, 'F');
      pdf.setDrawColor(0, 0, 0);
      pdf.rect(margin, yPos, pageWidth - margin * 2, 30);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('RELATÓRIO DE ACOMPANHAMENTO DE SERVIÇO – R.A.S', pageWidth / 2, yPos + 7, { align: 'center' });
      
      yPos += 12;
      pdf.setFontSize(9);
      const leftCol = margin + 5;
      const rightCol = pageWidth / 2 + 5;
      
      pdf.text(`Aeronave: ${aircraftRegistration}`, leftCol, yPos);
      pdf.text(`Centro de Manutenção: ${report.maintenance_center || '-'}`, rightCol, yPos);
      yPos += 6;
      pdf.text(`Matrícula: ${aircraftRegistration}`, leftCol, yPos);
      pdf.text(`Tipo de Manutenção: ${report.maintenance_type || '-'}`, rightCol, yPos);
      yPos += 6;
      const dateStr = report.entry_date ? format(new Date(report.entry_date), 'dd/MM/yyyy', { locale: ptBR }) : '-';
      pdf.text(`Período Manutenção: ${dateStr}`, leftCol, yPos);
      pdf.text(`Resp. pelo acompanhamento: ${report.responsible || '-'}`, rightCol, yPos);
      
      yPos += 15;

      // Inspection section header
      pdf.setFillColor(200, 200, 200);
      pdf.rect(margin, yPos, pageWidth - margin * 2, 8, 'F');
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DESCRIÇÃO DAS INSPEÇÕES REALIZADAS', pageWidth / 2, yPos + 5.5, { align: 'center' });
      
      yPos += 15;

      // Inspection title
      if (report.objective) {
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`• ${report.objective.toUpperCase()}`, margin, yPos);
        yPos += 10;
      }

      // Description
      if (report.description) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        
        // Draw description box
        const descLines = pdf.splitTextToSize(report.description, pageWidth - margin * 2 - 10);
        const descHeight = descLines.length * 5 + 10;
        
        pdf.setFillColor(245, 245, 245);
        pdf.rect(margin, yPos, pageWidth - margin * 2, descHeight, 'F');
        pdf.setDrawColor(150, 150, 150);
        pdf.rect(margin, yPos, pageWidth - margin * 2, descHeight);
        
        pdf.text(descLines, margin + 5, yPos + 7);
        yPos += descHeight + 10;
      }

      // Footer
      const footerY = pdf.internal.pageSize.getHeight() - 15;
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, margin, footerY);
      pdf.text(`Página 1 de 1`, pageWidth - margin, footerY, { align: 'right' });

      // Save
      pdf.save(`RAS_${report.number || 'documento'}_${aircraftRegistration}.pdf`);
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Erro ao exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ChevronRight className="h-4 w-4 rotate-180" />
          Voltar
        </Button>
        <Button onClick={handleExportPDF} disabled={exporting} className="gap-2">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Exportar PDF
        </Button>
      </div>

      {/* Document Preview */}
      <Card className="bg-white border-2" ref={reportRef}>
        <CardContent className="p-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-start justify-between mb-4">
              <div className="bg-primary text-primary-foreground px-4 py-2 rounded">
                <span className="font-bold text-lg">SHARE</span>
                <span className="text-sm block">Brasil</span>
              </div>
            </div>
            
            <h1 className="text-center text-lg font-bold text-foreground mb-4">
              RELATÓRIO DE ACOMPANHAMENTO DE SERVIÇO - RAS
            </h1>

            {/* Info Table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted text-center py-2 font-semibold text-sm border-b">
                RELATÓRIO DE ACOMPANHAMENTO DE SERVIÇO – R.A.S
              </div>
              <div className="grid grid-cols-2 divide-x text-sm">
                <div className="p-3 space-y-2">
                  <p><span className="font-semibold text-primary">Aeronave:</span> {aircraftRegistration}</p>
                  <p><span className="font-semibold text-primary">Matrícula:</span> {aircraftRegistration}</p>
                  <p><span className="font-semibold text-primary">Período Manutenção:</span> {report.entry_date ? format(new Date(report.entry_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</p>
                </div>
                <div className="p-3 space-y-2">
                  <p><span className="font-semibold text-primary">Centro de Manutenção:</span> {report.maintenance_center || '-'}</p>
                  <p><span className="font-semibold text-primary">Tipo de Manutenção:</span> {report.maintenance_type || '-'}</p>
                  <p><span className="font-semibold text-primary">Resp. pelo acompanhamento:</span> {report.responsible || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="space-y-6">
            <div className="bg-muted/50 text-center py-2 rounded font-semibold text-sm">
              DESCRIÇÃO DAS INSPEÇÕES REALIZADAS
            </div>

            {report.objective && (
              <div>
                <h3 className="font-bold text-foreground mb-2">• {report.objective.toUpperCase()}</h3>
              </div>
            )}

            {report.description && (
              <div className="bg-muted/30 p-4 rounded-lg border">
                <p className="text-sm whitespace-pre-wrap">{report.description}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t text-xs text-muted-foreground flex justify-between">
            <span>Gerado em: {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
            <span>RAS: {report.number || '-'}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}