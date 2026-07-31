import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building, Edit, FileImage, Loader2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CompanySettings {
  url_logo: any;
  id?: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  telefone: string;
  email: string;
  logo_url: string;
}

const EMPTY_DATA: CompanySettings = {
  url_logo: null,
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  endereco: "",
  cidade: "",
  estado: "",
  cep: "",
  telefone: "",
  email: "",
  logo_url: "",
};

export default function ConfigEmpresa() {
  const [companyData, setCompanyData] = useState<CompanySettings>(EMPTY_DATA);
  const [editData, setEditData] = useState<CompanySettings>(EMPTY_DATA);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [editLogoPreview, setEditLogoPreview] = useState<string>("");
  const [validationError, setValidationError] = useState<string>("");

  // Carregar dados ao montar
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
  .from("configuracao_empresa")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const row = data[0];
        const settings: CompanySettings = {
          id: row.id,
          razao_social: row.razao_social || "",
          nome_fantasia: row.nome_fantasia || "",
          cnpj: row.cnpj || "",
          endereco: row.endereco || "",
          cidade: row.cidade || "",
          estado: row.estado || "",
          cep: row.cep || "",
          telefone: row.telefone || "",
          email: row.email || "",
          logo_url: row.logo_url || "",
          url_logo: row.logo_url || null,
        };
        setCompanyData(settings);
        setEditData(settings);
        if (row.logo_url) setLogoPreview(row.logo_url);
      }
    } catch (err) {
      console.error("Erro ao carregar:", err);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar as configurações",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEdit = () => {
    setEditData(companyData);
    setEditLogoPreview(logoPreview);
    setSelectedLogoFile(null);
    setValidationError("");
    setIsEditModalOpen(true);
  };

  const handleEditInputChange = (field: keyof CompanySettings, value: string) => {
    setEditData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleEditLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Selecione uma imagem (PNG, JPG, JPEG)",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "Máximo 5MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedLogoFile(file);

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setEditLogoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    // Validações
    if (!editData.razao_social.trim()) {
      setValidationError("Razão Social é obrigatória");
      return;
    }

    if (editData.email && !validateEmail(editData.email)) {
      setValidationError("Email inválido");
      return;
    }

    if (editData.estado && editData.estado.length !== 2) {
      setValidationError("Estado deve ter 2 caracteres (ex: SP)");
      return;
    }

    setValidationError("");
    setIsSaving(true);

    try {
      let logoUrl = companyData.url_logo; // Manter logo anterior

      // Se há novo arquivo, fazer upload
      if (selectedLogoFile) {
        const fileExt = selectedLogoFile.name.split(".").pop()?.toLowerCase() || "png";
        const fileName = `logo-company-${Date.now()}.${fileExt}`;
        const filePath = `company-logos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("company-logos")
          .upload(filePath, selectedLogoFile, {
            upsert: false,
            contentType: selectedLogoFile.type,
          });

        if (uploadError) throw new Error(`Upload: ${uploadError.message}`);

        const { data: publicUrlData } = supabase.storage
          .from("company-logos")
          .getPublicUrl(filePath);

        if (!publicUrlData?.publicUrl) {
          throw new Error("Erro ao gerar URL pública");
        }

        logoUrl = publicUrlData.publicUrl;
      }

      const payload = {
        razao_social: editData.razao_social,
        nome_fantasia: editData.nome_fantasia || null,
        cnpj: editData.cnpj || null,
        endereco: editData.endereco || null,
        cidade: editData.cidade || null,
        estado: editData.estado || null,
        cep: editData.cep || null,
        telefone: editData.telefone || null,
        email: editData.email || null,
        logo_url: logoUrl || null,
      };

      if (companyData.id) {
        const { error } = await supabase
  .from("configuracao_empresa")
          .update(payload)
          .eq("id", companyData.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
  .from("configuracao_empresa")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        if (data) {
          setCompanyData((prev) => ({ ...prev, id: (data as any).id }));
        }
      }

      setCompanyData(editData);
      setLogoPreview(logoUrl);
      setSelectedLogoFile(null);
      setIsEditModalOpen(false);

      toast({
        title: "Sucesso!",
        description: "Configurações da empresa atualizadas",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast({
        title: "Erro ao salvar",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="animate-spin h-8 w-8" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Configuração da Empresa</h1>
            <p className="text-muted-foreground mt-2">
              Configure os dados que aparecem nos recibos e relatórios
            </p>
          </div>
          <Button onClick={handleOpenEdit} className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Editar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Dados da Empresa
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {!companyData.razao_social ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhuma configuração encontrada. Clique em "Editar" para adicionar.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">Razão Social</Label>
                      <p className="text-foreground font-medium">{companyData.razao_social || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">Nome Fantasia</Label>
                      <p className="text-foreground font-medium">{companyData.nome_fantasia || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">CNPJ</Label>
                      <p className="text-foreground font-medium">{companyData.cnpj || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">Endereço</Label>
                      <p className="text-foreground font-medium">{companyData.endereco || "-"}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">Cidade</Label>
                      <p className="text-foreground font-medium">{companyData.cidade || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">Estado</Label>
                      <p className="text-foreground font-medium">{companyData.estado || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">CEP</Label>
                      <p className="text-foreground font-medium">{companyData.cep || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">Email</Label>
                      <p className="text-foreground font-medium">{companyData.email || "-"}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <FileImage className="h-4 w-4" />
                    Logo da Empresa
                  </h3>
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="w-32 h-32 border border-border rounded-lg overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt="Logo"
                          className="max-w-full max-h-full object-contain p-2"
                        />
                      ) : (
                        <Building className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 text-sm text-muted-foreground">
                      {logoPreview ? (
                        <p>✅ Logo configurada</p>
                      ) : (
                        <p>Nenhuma logo configurada</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Configurações</DialogTitle>
            <DialogDescription>
              Modifique os dados da empresa
            </DialogDescription>
          </DialogHeader>

          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Razão Social *</Label>
                <Input
                  value={editData.razao_social}
                  onChange={(e) => handleEditInputChange("razao_social", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Nome Fantasia</Label>
                <Input
                  value={editData.nome_fantasia}
                  onChange={(e) => handleEditInputChange("nome_fantasia", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input
                  value={editData.cnpj}
                  onChange={(e) => handleEditInputChange("cnpj", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={editData.telefone}
                  onChange={(e) => handleEditInputChange("telefone", e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editData.email}
                  onChange={(e) => handleEditInputChange("email", e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Endereço</Label>
                <Input
                  value={editData.endereco}
                  onChange={(e) => handleEditInputChange("endereco", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input
                  value={editData.cidade}
                  onChange={(e) => handleEditInputChange("cidade", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Estado (UF)</Label>
                <Input
                  value={editData.estado}
                  maxLength={2}
                  onChange={(e) => handleEditInputChange("estado", e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input
                  value={editData.cep}
                  onChange={(e) => handleEditInputChange("cep", e.target.value)}
                />
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <FileImage className="h-4 w-4" />
                Logo (PNG, JPG - Max 5MB)
              </h3>
              <div className="flex flex-col items-center gap-3">
                <div className="w-24 h-24 border border-border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                  {editLogoPreview ? (
                    <img
                      src={editLogoPreview}
                      alt="Logo preview"
                      className="max-w-full max-h-full object-contain p-2"
                    />
                  ) : (
                    <Building className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <Label htmlFor="edit-logo-upload" className="cursor-pointer">
                  <div className="flex items-center justify-center gap-2 p-2 border border-border rounded-lg hover:bg-muted transition-colors">
                    <FileImage className="h-4 w-4" />
                    <span className="text-sm">Escolher Logo</span>
                  </div>
                </Label>
                <input
                  id="edit-logo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleEditLogoUpload}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
