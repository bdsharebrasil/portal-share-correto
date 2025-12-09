import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  ArrowLeft, Edit, Plane, Calendar, MapPin, Users, Fuel,
  FileText, Upload, Trash2, Download, Eye, Shield, Radio,
  Scale, Wrench, FileCheck, BookOpen, AlertCircle, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AddAircraftDialog } from "@/components/diario/AddAircraftDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AircraftDocument {
  id: string;
  aircraft_id: string | null;
  document_type: string | null;
  name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  expiry_date: string | null;
  description: string | null;
  created_at: string | null;
  uploaded_by: string | null;
}

const DOCUMENT_TYPES = [
  { key: "apolice_seguro", label: "Apólice de Seguro", icon: Shield, color: "text-blue-500" },
  { key: "certificado_matricula", label: "Certificado de Matrícula (CM)", icon: FileCheck, color: "text-green-500" },
  { key: "certificado_aeronavegabilidade", label: "Certificado de Aeronavegabilidade (CA)", icon: FileCheck, color: "text-emerald-500" },
  { key: "manual_voo", label: "Manual de Voo e Checklists", icon: BookOpen, color: "text-purple-500" },
  { key: "licenca_anatel", label: "Licença de Estação (ANATEL)", icon: Radio, color: "text-orange-500" },
  { key: "seguro_reta", label: "Apólice de Seguro RETA", icon: Shield, color: "text-cyan-500" },
  { key: "fiam", label: "Ficha de Inspeção Anual (FIAM)", icon: Wrench, color: "text-rose-500" },
  { key: "pesagem_balanceamento", label: "Ficha de Pesagem e Balanceamento", icon: Scale, color: "text-amber-500" },
];

export default function AeronaveDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: aircraft, isLoading } = useQuery({
    queryKey: ["aircraft-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aircraft")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-for-aircraft", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_aircraft")
        .select(`
          share_percentage,
          clients:client_id(id, company_name)
        `)
        .eq("aircraft_id", id);
      if (error) throw error;
      return data as Array<{ share_percentage: number; clients: { id: string; company_name: string | null } }>;
    },
    enabled: !!id,
  });

  const { data: documents, refetch: refetchDocuments } = useQuery({
    queryKey: ["aircraft-documents", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flight_documents")
        .select("*")
        .eq("aircraft_id", id)
        .order("document_type");
      if (error) throw error;
      return data as AircraftDocument[];
    },
    enabled: !!id,
  });

  const handleUploadDocument = async () => {
    if (!uploadFile || !selectedDocType || !id) return;

    setIsUploading(true);
    try {
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${id}/${selectedDocType}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("flight-documents")
        .upload(fileName, uploadFile);

      if (uploadError) throw uploadError;

      // Delete existing document of same type if exists
      const existingDoc = documents?.find(d => d.document_type === selectedDocType);
      if (existingDoc) {
        await supabase.storage.from("flight-documents").remove([existingDoc.file_path]);
        await supabase.from("flight_documents").delete().eq("id", existingDoc.id);
      }

      const { error: insertError } = await supabase
        .from("flight_documents")
        .insert({
          aircraft_id: id,
          document_type: selectedDocType,
          name: uploadFile.name,
          file_path: fileName,
          file_size: uploadFile.size,
          file_type: uploadFile.type,
          expiry_date: expiryDate || null,
          description: notes || null,
        });

      if (insertError) throw insertError;

      toast.success("Documento enviado com sucesso!");
      setUploadDialogOpen(false);
      setUploadFile(null);
      setExpiryDate("");
      setNotes("");
      setSelectedDocType(null);
      refetchDocuments();
    } catch (error: any) {
      toast.error(`Erro ao enviar documento: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!deleteConfirmId) return;

    try {
      const doc = documents?.find(d => d.id === deleteConfirmId);
      if (doc) {
        await supabase.storage.from("flight-documents").remove([doc.file_path]);
      }

      const { error } = await supabase
        .from("flight_documents")
        .delete()
        .eq("id", deleteConfirmId);

      if (error) throw error;

      toast.success("Documento excluído!");
      setDeleteConfirmId(null);
      refetchDocuments();
    } catch (error: any) {
      toast.error(`Erro ao excluir: ${error.message}`);
    }
  };

  const handleViewDocument = async (doc: AircraftDocument) => {
    const { data } = await supabase.storage
      .from("flight-documents")
      .createSignedUrl(doc.file_path, 3600);

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  const handleDownloadDocument = async (doc: AircraftDocument) => {
    const { data } = await supabase.storage
      .from("flight-documents")
      .download(doc.file_path);

    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const getDocumentByType = (type: string) => {
    return documents?.find(d => d.document_type === type);
  };

  const isDocumentExpired = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const isDocumentExpiringSoon = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiry = new Date(expiryDate);
    return expiry > new Date() && expiry <= thirtyDaysFromNow;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <Plane className="h-12 w-12 mx-auto text-muted-foreground/40 animate-pulse" />
            <p className="text-muted-foreground">Carregando informações...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!aircraft) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
            <p className="text-muted-foreground">Aeronave não encontrada</p>
            <Button onClick={() => navigate("/aeronaves")}>Voltar</Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-6 lg:p-8 rounded-3xl shadow-xl">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 rounded-xl"
                onClick={() => navigate("/aeronaves")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="h-16 w-16 lg:h-20 lg:w-20 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
                <Plane className="h-8 w-8 lg:h-10 lg:w-10 text-white" />
              </div>
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold tracking-wider uppercase">
                  {aircraft.registration}
                </h1>
                <p className="text-white/70 mt-1">{aircraft.model} • {aircraft.manufacturer}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                className={`px-4 py-2 text-sm font-medium rounded-xl ${aircraft.status === "inativa"
                    ? "bg-red-500/20 text-red-200 border-red-400/30"
                    : "bg-emerald-500/20 text-emerald-200 border-emerald-400/30"
                  }`}
                variant="outline"
              >
                {aircraft.status === "inativa" ? "Inativa" : "Ativa"}
              </Badge>
              <Button
                variant="secondary"
                className="rounded-xl"
                onClick={() => setEditDialogOpen(true)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </div>
          </div>
        </div>

        {/* Info Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-5 w-5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Ano de Fabricação</p>
                  <p className="text-lg font-bold text-white">{aircraft.year || "N/A"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-5 w-5 text-green-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Base</p>
                  <p className="text-lg font-bold text-white uppercase">{aircraft.base || "N/A"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <Fuel className="h-5 w-5 text-orange-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Consumo</p>
                  <p className="text-lg font-bold text-white">{aircraft.fuel_consumption ? `${aircraft.fuel_consumption} L/H` : "N/A"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Users className="h-5 w-5 text-purple-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Proprietário</p>
                  <p className="text-lg font-bold text-white truncate">{aircraft.owner_name || "N/A"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clients & Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Users className="h-5 w-5 text-cyan-400" />
                Clientes Vinculados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {clients && clients.length > 0 ? (
                clients.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-slate-700/40 rounded-lg"
                  >
                    <span className="font-medium text-white">{c.clients?.company_name || "Sem nome"}</span>
                    <Badge variant="secondary" className="rounded-lg bg-slate-600 text-white">
                      {c.share_percentage}%
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-center py-4">Nenhum cliente vinculado</p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 rounded-2xl border-0 shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <FileText className="h-5 w-5 text-cyan-400" />
                Informações Técnicas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-700/40 rounded-lg">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Nº Série</p>
                  <p className="font-semibold text-white">{aircraft.serial_number || "N/A"}</p>
                </div>
                <div className="p-3 bg-slate-700/40 rounded-lg">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Fabricante</p>
                  <p className="font-semibold text-white">{aircraft.manufacturer || "N/A"}</p>
                </div>
                <div className="p-3 bg-slate-700/40 rounded-lg">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Modelo</p>
                  <p className="font-semibold text-white">{aircraft.model || "N/A"}</p>
                </div>
                <div className="p-3 bg-slate-700/40 rounded-lg">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Célula Atual</p>
                  <p className="font-semibold text-white">{aircraft.cell_hours_current ? `${aircraft.cell_hours_current}h` : "N/A"}</p>
                </div>
                <div className="p-3 bg-slate-700/40 rounded-lg">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Horímetro</p>
                  <p className="font-semibold text-white">{aircraft.horimeter_active ? `${aircraft.horimeter_active}h` : "N/A"}</p>
                </div>
                <div className="p-3 bg-slate-700/40 rounded-lg">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Valor Hora</p>
                  <p className="font-semibold text-white">{aircraft.hourly_price ? `R$ ${aircraft.hourly_price}` : "N/A"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Documents Section */}
        <Card className="rounded-2xl border-0 shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <FileText className="h-5 w-5 text-primary" />
                  Documentos da Aeronave
                </CardTitle>
                <CardDescription className="mt-1">
                  Gerencie os documentos obrigatórios e certificados
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DOCUMENT_TYPES.map((docType) => {
                const doc = getDocumentByType(docType.key);
                const Icon = docType.icon;
                const expired = doc ? isDocumentExpired(doc.expiry_date) : false;
                const expiringSoon = doc ? isDocumentExpiringSoon(doc.expiry_date) : false;

                return (
                  <div
                    key={docType.key}
                    className={`p-4 rounded-2xl border-2 transition-all ${doc
                        ? expired
                          ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20"
                          : expiringSoon
                            ? "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
                            : "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20"
                        : "border-dashed border-muted-foreground/30 bg-muted/10 hover:border-primary/50"
                      }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${doc ? "bg-white dark:bg-background" : "bg-muted"
                          }`}>
                          <Icon className={`h-5 w-5 ${doc ? docType.color : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{docType.label}</p>
                          {doc ? (
                            <div className="mt-1 space-y-1">
                              <p className="text-xs text-muted-foreground truncate">{doc.name}</p>
                              {doc.expiry_date && (
                                <div className="flex items-center gap-1">
                                  {expired ? (
                                    <Badge variant="destructive" className="text-xs rounded-lg">
                                      Vencido em {format(new Date(doc.expiry_date), "dd/MM/yyyy")}
                                    </Badge>
                                  ) : expiringSoon ? (
                                    <Badge className="text-xs rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                      Vence em {format(new Date(doc.expiry_date), "dd/MM/yyyy")}
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-xs rounded-lg">
                                      Válido até {format(new Date(doc.expiry_date), "dd/MM/yyyy")}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-1">Nenhum documento anexado</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {doc ? (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-lg"
                              onClick={() => handleViewDocument(doc)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-lg"
                              onClick={() => handleDownloadDocument(doc)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-lg text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirmId(doc.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : null}
                        <Button
                          size="sm"
                          variant={doc ? "outline" : "default"}
                          className="rounded-xl"
                          onClick={() => {
                            setSelectedDocType(docType.key);
                            setUploadDialogOpen(true);
                          }}
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          {doc ? "Atualizar" : "Anexar"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Edit Aircraft Dialog */}
        <AddAircraftDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          aircraft={aircraft}
        />

        {/* Upload Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Enviar Documento
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tipo de Documento</Label>
                <p className="text-sm text-muted-foreground">
                  {DOCUMENT_TYPES.find(d => d.key === selectedDocType)?.label}
                </p>
              </div>
              <div>
                <Label htmlFor="file">Arquivo</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="expiry">Data de Validade (opcional)</Label>
                <Input
                  id="expiry"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="notes">Observações (opcional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Adicione observações sobre o documento..."
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleUploadDocument}
                disabled={!uploadFile || isUploading}
              >
                {isUploading ? "Enviando..." : "Enviar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar Exclusão</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              Deseja realmente excluir este documento? Esta ação não pode ser desfeita.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDeleteDocument}>
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
