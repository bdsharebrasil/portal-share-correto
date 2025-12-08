import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Plus, Trash2, Upload, X } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type CrewMember = Database['public']['Tables']['crew_members']['Row'];
type CrewLicense = Database['public']['Tables']['crew_licenses']['Row'];
type LicenseInsert = Database['public']['Tables']['crew_licenses']['Insert'];

interface CrewMemberWithLicenses extends CrewMember {
  licenses: CrewLicense[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crewMember?: CrewMemberWithLicenses | null;
}

const LICENSE_TYPES = ['CMA', 'IFR', 'MNTE', 'MLTE', 'ICAO', 'TIPO', 'CHT'];

export function TripulanteFormDialog({ open, onOpenChange, crewMember }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dados");

  // Form state
  const [formData, setFormData] = useState({
    canac: '',
    full_name: '',
    birth_date: '',
    email: '',
    phone: '',
    photo_url: '',
  });

  const [licenses, setLicenses] = useState<Partial<LicenseInsert>[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (crewMember) {
      setFormData({
        canac: crewMember.canac,
        full_name: crewMember.full_name,
        birth_date: crewMember.birth_date,
        email: crewMember.email || '',
        phone: crewMember.phone || '',
        photo_url: crewMember.photo_url || '',
      });
      setLicenses(crewMember.licenses || []);
      setPhotoPreview(crewMember.photo_url || '');
      setPhotoFile(null);
    } else {
      resetForm();
    }
  }, [crewMember, open]);

  const resetForm = () => {
    setFormData({
      canac: '',
      full_name: '',
      birth_date: '',
      email: '',
      phone: '',
      photo_url: '',
    });
    setLicenses([]);
    setPhotoFile(null);
    setPhotoPreview('');
    setActiveTab("dados");
  };

  const uploadPhoto = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('crew-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('crew-photos')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let photoUrl = formData.photo_url;

      if (photoFile) {
        photoUrl = await uploadPhoto(photoFile);
      }

      const dataToSave = { ...formData, photo_url: photoUrl };

      if (crewMember) {
        const { error: memberError } = await supabase
          .from('crew_members')
          .update(dataToSave)
          .eq('id', crewMember.id);

        if (memberError) throw memberError;

        // Delete existing licenses and insert new ones
        await supabase
          .from('crew_licenses')
          .delete()
          .eq('crew_member_id', crewMember.id);

        if (licenses.length > 0) {
          const licensesToInsert = licenses.map(l => ({
            ...l,
            crew_member_id: crewMember.id,
          }));

          const { error: licensesError } = await supabase
            .from('crew_licenses')
            .insert(licensesToInsert as LicenseInsert[]);

          if (licensesError) throw licensesError;
        }

        toast({
          title: "Tripulante atualizado",
          description: "Os dados foram atualizados com sucesso.",
        });
      } else {
        const { data: newMember, error: memberError } = await supabase
          .from('crew_members')
          .insert([dataToSave])
          .select()
          .single();

        if (memberError) throw memberError;

        // Insert licenses
        if (licenses.length > 0) {
          const licensesToInsert = licenses.map(l => ({
            ...l,
            crew_member_id: newMember.id,
          }));

          const { error: licensesError } = await supabase
            .from('crew_licenses')
            .insert(licensesToInsert as LicenseInsert[]);

          if (licensesError) throw licensesError;
        }

        toast({
          title: "Tripulante cadastrado",
          description: "O tripulante foi cadastrado com sucesso.",
        });
      }

      onOpenChange(true); // Pass true to refresh the list
      resetForm();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar os dados.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addLicense = () => {
    setLicenses([...licenses, {
      license_type: 'CMA',
      license_number: '',
      issue_date: '',
      expiry_date: '',
    }]);
  };

  const removeLicense = (index: number) => {
    setLicenses(licenses.filter((_, i) => i !== index));
  };

  const updateLicense = (index: number, field: string, value: any) => {
    const newLicenses = [...licenses];
    newLicenses[index] = { ...newLicenses[index], [field]: value };
    setLicenses(newLicenses);
  };

  const getLicenseStatus = (expiryDate: string) => {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) return { label: 'Vencida', variant: 'destructive' as const };
    if (daysUntilExpiry <= 60) return { label: 'A Vencer', variant: 'secondary' as const };
    return { label: 'Válida', variant: 'default' as const };
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5242880) {
      toast({
        title: "Arquivo muito grande",
        description: "A foto deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      toast({
        title: "Formato inválido",
        description: "Apenas imagens JPG, PNG ou WEBP são permitidas.",
        variant: "destructive",
      });
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(crewMember?.photo_url || '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onOpenChange(false)}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {crewMember ? 'Editar Tripulante' : 'Novo Tripulante'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="dados">Dados Principais</TabsTrigger>
              <TabsTrigger value="habilitacoes">Habilitações</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="canac">Código ANAC (CANAC) *</Label>
                  <Input
                    id="canac"
                    required
                    value={formData.canac}
                    onChange={(e) => setFormData({ ...formData, canac: e.target.value })}
                    placeholder="Ex: 113374"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birth_date">Data de Nascimento *</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    required
                    value={formData.birth_date}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">Nome Completo *</Label>
                <Input
                  id="full_name"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Nome completo do tripulante"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Foto do Perfil</Label>
                <div className="flex items-center gap-4">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={photoPreview || formData.photo_url} />
                    <AvatarFallback>
                      {formData.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handlePhotoSelect}
                      className="hidden"
                      id="photo-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Escolher Foto
                    </Button>
                    {(photoFile || photoPreview) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearPhoto}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remover
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP (máx. 5MB)</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="habilitacoes" className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Gerencie as habilitações e seus vencimentos
                </p>
                <Button type="button" onClick={addLicense} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>

              <div className="space-y-3">
                {licenses.map((license, index) => {
                  const status = getLicenseStatus(license.expiry_date || '');
                  return (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <select
                              value={license.license_type}
                              onChange={(e) => updateLicense(index, 'license_type', e.target.value)}
                              className="px-3 py-1.5 rounded-md border border-input bg-background"
                            >
                              {LICENSE_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                            {status && (
                              <Badge variant={status.variant}>{status.label}</Badge>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLicense(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Número</Label>
                            <Input
                              value={license.license_number || ''}
                              onChange={(e) => updateLicense(index, 'license_number', e.target.value)}
                              placeholder="Número"
                              size={1}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Emissão</Label>
                            <Input
                              type="date"
                              value={license.issue_date || ''}
                              onChange={(e) => updateLicense(index, 'issue_date', e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Vencimento *</Label>
                            <Input
                              type="date"
                              required
                              value={license.expiry_date || ''}
                              onChange={(e) => updateLicense(index, 'expiry_date', e.target.value)}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {licenses.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma habilitação cadastrada
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
