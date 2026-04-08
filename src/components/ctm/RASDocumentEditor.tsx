import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Save,
  FileDown,
  X,
  ImageIcon,
  Loader2,
  ChevronLeft,
  Trash2,
} from "lucide-react";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RASPhoto {
  id: string;
  file?: File;
  preview: string;
  description: string;
  url?: string;
}

interface RASDocumentEditorProps {
  aircraftId: string;
  aircraftRegistration: string;
  onBack: () => void;
  existingRAS?: any;
}

export function RASDocumentEditor({
  aircraftId,
  aircraftRegistration,
  onBack,
  existingRAS,
}: RASDocumentEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<RASPhoto[]>(existingRAS?.photos || []);
  const [formData, setFormData] = useState({
    number: existingRAS?.number || `RAS-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
    maintenance_type: existingRAS?.maintenance_type || "Corretiva Pneus",
    maintenance_center: existingRAS?.maintenance_center || "Hangar União",
    entry_date: existingRAS?.entry_date || format(new Date(), "yyyy-MM-dd"),
    responsible: existingRAS?.responsible || "",
    inspection_title: existingRAS?.inspection_title || "SUBSTITUIÇÃO TEMPORÁRIA DO PNEU ESQUERDO",
    description: existingRAS?.description || "",
  });

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const photo: RASPhoto = {
          id: crypto.randomUUID(),
          file,
          preview: event.target?.result as string,
          description: "",
        };
        setPhotos((prev) => [...prev, photo]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePhotoDescription = (id: string, description: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, description } : p))
    );
  };

  const handleSaveDraft = async () => {
    try {
      setLoading(true);
      const draftData = {
        ...formData,
        photos: photos.map(p => ({ preview: p.preview, description: p.description })),
        draft: true,
      };
      localStorage.setItem(`ras_draft_${aircraftId}`, JSON.stringify(draftData));
      toast.success("Rascunho salvo com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar rascunho");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.maintenance_center || !formData.entry_date) {
        toast.error("Preencha os campos obrigatórios");
        return;
      }

      setLoading(true);

      // Upload photos to storage
      const uploadedPhotos: { url: string; description: string }[] = [];

      for (const photo of photos) {
        if (photo.file) {
          const fileName = `ras/${aircraftId}/${Date.now()}_${photo.file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("maintenance-photos")
            .upload(fileName, photo.file);

          if (uploadError) {
            console.error("Upload error:", uploadError);
            continue;
          }

          const { data: publicUrl } = supabase.storage
            .from("maintenance-photos")
            .getPublicUrl(fileName);

          uploadedPhotos.push({
            url: publicUrl.publicUrl,
            description: photo.description,
          });
        }
      }

      const rasData = {
        aircraft_id: aircraftId,
        number: formData.number,
        maintenance_type: formData.maintenance_type,
        maintenance_center: formData.maintenance_center,
        entry_date: formData.entry_date,
        responsible: formData.responsible,
        inspection_title: formData.inspection_title,
        description: formData.description,
        photos: uploadedPhotos,
      };

      const { error } = await (supabase.from("ras") as any).insert([rasData]);

      if (error) throw error;

      toast.success("RAS salvo com sucesso!");
      localStorage.removeItem(`ras_draft_${aircraftId}`);
      onBack();
    } catch (error: any) {
      console.error("Error saving RAS:", error);
      toast.error("Erro ao salvar RAS: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - 2 * margin;
      let yPosition = margin;

      // Header with logo and title
      const logoPath = "/logo.share.png";
      pdf.addImage(logoPath, "PNG", margin, yPosition, 20, 20);

      pdf.setFontSize(16);
      pdf.setTextColor(0, 0, 0);
      pdf.text("RELATÓRIO DE ACOMPANHAMENTO DE SERVIÇO - RAS", margin + 25, yPosition + 10);

      yPosition += 30;

      // Header Information
      pdf.setFontSize(10);
      pdf.setTextColor(80, 80, 80);

      const headerInfo = [
        { label: "Aeronave", value: aircraftRegistration },
        { label: "Matrícula", value: `${aircraftRegistration}-MDL` },
        { label: "Período Manutenção", value: formData.entry_date },
        { label: "Centro de Manutenção", value: formData.maintenance_center },
        { label: "Tipo de Manutenção", value: formData.maintenance_type },
      ];

      const colWidth = contentWidth / 2;
      for (let i = 0; i < headerInfo.length; i += 2) {
        if (yPosition > pageHeight - 40) {
          pdf.addPage();
          yPosition = margin;
        }

        pdf.setFont(undefined, "bold");
        pdf.text(headerInfo[i].label + ":", margin, yPosition);
        pdf.setFont(undefined, "normal");
        pdf.text(headerInfo[i].value, margin + 25, yPosition);

        if (i + 1 < headerInfo.length) {
          pdf.setFont(undefined, "bold");
          pdf.text(headerInfo[i + 1].label + ":", margin + colWidth, yPosition);
          pdf.setFont(undefined, "normal");
          pdf.text(headerInfo[i + 1].value, margin + colWidth + 25, yPosition);
        }

        yPosition += 8;
      }

      yPosition += 5;

      // Separator line
      pdf.setDrawColor(150, 150, 150);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;

      // Inspection title
      pdf.setFont(undefined, "bold");
      pdf.setFontSize(11);
      pdf.text("DESCRIÇÃO DAS INSPEÇÕES REALIZADAS", margin, yPosition);
      yPosition += 10;

      // Inspection details
      pdf.setFont(undefined, "normal");
      pdf.setFontSize(10);

      if (formData.inspection_title) {
        pdf.text(`• ${formData.inspection_title}`, margin, yPosition);
        yPosition += 7;
      }

      if (formData.description) {
        const splitText = pdf.splitTextToSize(formData.description, contentWidth);
        yPosition += 5;
        pdf.text(splitText, margin, yPosition);
        yPosition += splitText.length * 5 + 10;
      }

      // Photos
      if (photos.length > 0 || uploadedPhotos?.length > 0) {
        if (yPosition > pageHeight - 60) {
          pdf.addPage();
          yPosition = margin;
        }

        pdf.setFont(undefined, "bold");
        pdf.setFontSize(11);
        pdf.text("REGISTRO FOTOGRÁFICO", margin, yPosition);
        yPosition += 10;

        const photoList = [...photos, ...(uploadedPhotos || [])];
        for (const photo of photoList) {
          if (yPosition > pageHeight - 60) {
            pdf.addPage();
            yPosition = margin;
          }

          if (photo.preview || photo.url) {
            const photoUrl = photo.preview || photo.url;
            try {
              pdf.addImage(photoUrl, "JPEG", margin, yPosition, contentWidth / 2 - 5, 40);
              yPosition += 50;
            } catch (e) {
              console.log("Could not add photo to PDF");
            }
          }

          if (photo.description) {
            pdf.setFont(undefined, "normal");
            pdf.setFontSize(9);
            const descText = pdf.splitTextToSize(photo.description, contentWidth);
            pdf.text(descText, margin, yPosition);
            yPosition += descText.length * 4 + 10;
          }
        }
      }

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(
        `Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
        margin,
        pageHeight - 10
      );
      pdf.text(
        `RAS: ${formData.number}`,
        pageWidth - margin - 30,
        pageHeight - 10
      );

      pdf.save(`RAS_${formData.number}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Erro ao exportar PDF");
    }
  };

  const uploadedPhotos = photos.filter(p => p.file);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 shadow-sm z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="text-slate-600"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Novo RAS</h1>
              <p className="text-xs text-slate-500">
                Aeronave: {aircraftRegistration}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              disabled={loading}
              className="gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              💾 Rascunho
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={loading}
              className="gap-2"
            >
              <FileDown className="h-4 w-4" />
              PDF
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" />
              Salvar
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto mt-24 mb-8">
        {/* Document Container */}
        <div className="bg-white shadow-lg rounded-lg border border-slate-200 overflow-hidden">
          {/* Document Header */}
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 p-8">
            <div className="flex items-start gap-6 mb-6">
              <img
                src="/logo.share.png"
                alt="Share Brasil"
                className="h-16 w-auto"
              />
              <div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">
                  RELATÓRIO DE ACOMPANHAMENTO DE SERVIÇO - RAS
                </h1>
                <p className="text-sm text-slate-600">
                  Documentação técnica de manutenções corretivas emergenciais
                </p>
              </div>
            </div>

            {/* Document Header Info Grid */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Número RAS
                </label>
                <Input
                  value={formData.number}
                  onChange={(e) =>
                    setFormData({ ...formData, number: e.target.value })
                  }
                  className="mt-1 font-mono text-sm"
                  disabled
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Aeronave
                </label>
                <Input
                  value={aircraftRegistration}
                  disabled
                  className="mt-1 font-mono text-sm bg-slate-50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Centro de Manutenção *
                </label>
                <Input
                  value={formData.maintenance_center}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maintenance_center: e.target.value,
                    })
                  }
                  placeholder="Ex: Hangar União"
                  className="mt-1 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Data *
                </label>
                <Input
                  type="data"
                  value={formData.entry_date}
                  onChange={(e) =>
                    setFormData({ ...formData, entry_date: e.target.value })
                  }
                  className="mt-1 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Tipo de Manutenção
                </label>
                <Input
                  value={formData.maintenance_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maintenance_type: e.target.value,
                    })
                  }
                  placeholder="Ex: Corretiva Pneus"
                  className="mt-1 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Responsável
                </label>
                <Input
                  value={formData.responsible}
                  onChange={(e) =>
                    setFormData({ ...formData, responsible: e.target.value })
                  }
                  placeholder="Nome da pessoa responsável"
                  className="mt-1 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Document Content */}
          <div className="p-8 space-y-8">
            {/* Inspection Title */}
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-3">
                Título da Inspeção
              </label>
              <Input
                value={formData.inspection_title}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    inspection_title: e.target.value,
                  })
                }
                placeholder="Ex: SUBSTITUIÇÃO TEMPORÁRIA DO PNEU ESQUERDO"
                className="text-sm font-semibold text-slate-900 p-4 border-slate-300 focus:border-primary"
              />
            </div>

            {/* Separator */}
            <div className="border-t-2 border-slate-300"></div>

            {/* Description Section */}
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 pb-3 border-b-2 border-slate-300">
                Descrição das Inspeções Realizadas
              </h2>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Descreva detalhadamente os trabalhos realizados, observações e resultados das inspeções..."
                className="min-h-48 p-4 text-sm leading-relaxed resize-none focus:border-primary"
              />
            </div>

            {/* Photos Section */}
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 pb-3 border-b-2 border-slate-300">
                Registro Fotográfico
              </h2>

              <div className="mb-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2 w-full border-2 border-dashed border-slate-300 hover:border-primary hover:bg-primary/5"
                >
                  <ImageIcon className="h-4 w-4" />
                  Clique para adicionar fotos ou arraste aqui
                </Button>
              </div>

              {photos.length > 0 && (
                <div className="space-y-6">
                  {photos.map((photo) => (
                    <Card key={photo.id} className="border-slate-200 overflow-hidden">
                      <CardContent className="p-4">
                        <div className="grid grid-cols-4 gap-4">
                          {/* Photo Preview */}
                          <div className="col-span-1">
                            <img
                              src={photo.preview}
                              alt="Foto do RAS"
                              className="w-full h-32 object-cover rounded border border-slate-200"
                            />
                          </div>

                          {/* Photo Description */}
                          <div className="col-span-2">
                            <Label className="text-xs font-semibold text-slate-600 uppercase">
                              Descrição da Foto
                            </Label>
                            <Textarea
                              value={photo.description}
                              onChange={(e) =>
                                updatePhotoDescription(photo.id, e.target.value)
                              }
                              placeholder="Descreva o que está na foto..."
                              className="mt-2 min-h-24 text-sm resize-none"
                            />
                          </div>

                          {/* Remove Button */}
                          <div className="col-span-1 flex items-end justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removePhoto(photo.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Document Footer */}
          <div className="bg-slate-50 border-t border-slate-200 px-8 py-6 text-right text-xs text-slate-500">
            <p>
              Gerado em: {format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </p>
            <p>Documento: {formData.number}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
