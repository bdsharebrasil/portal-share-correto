// @ts-nocheck
import { useCallback, useMemo, useState } from "react";
import Cropper from "react-easy-crop";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, FileText, Loader2, UserPlus, X } from "lucide-react";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";

const AVATAR_BUCKET = "avatar-profile";
const EMAIL_DOMAIN = "@share-brasil.com";

export const DEPARTAMENTOS: AppRole[] = [
  "operacoes",
  "coordenador_de_voo",
  "tripulante",
  "piloto_chefe",
  "financeiro",
  "financeiro_master",
  "adm",
];

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

type FormState = {
  full_name: string;
  display_name: string;
  emailLocal: string;
  password: string;
  departamento: AppRole | "";
  address: string;
  phone: string;
  birth_date: string;
  admission_date: string;
  cpf: string;
  rg: string;
  canac: string;
  bank_name: string;
  bank_agency: string;
  bank_account: string;
  bank_pix: string;
};

const emptyForm: FormState = {
  full_name: "",
  display_name: "",
  emailLocal: "",
  password: "",
  departamento: "",
  address: "",
  phone: "",
  birth_date: "",
  admission_date: "",
  cpf: "",
  rg: "",
  canac: "",
  bank_name: "",
  bank_account: "",
  bank_pix: "",
};

async function getCroppedBlob(imageSrc: string, area: { x: number; y: number; width: number; height: number }) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, size, size);
  return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b as Blob), "image/jpeg", 0.92));
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovoFuncionarioDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);

  const setField = (field: keyof FormState, value: string) =>
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "full_name") {
        const firstName = value.trim().split(/\s+/)[0] || "";
        if (!prev.display_name || prev.display_name === (prev.full_name.trim().split(/\s+/)[0] || "")) {
          next.display_name = firstName;
        }
        if (!prev.emailLocal || prev.emailLocal === slugify(prev.full_name.trim().split(/\s+/)[0] || "")) {
          next.emailLocal = slugify(firstName);
        }
      }
      return next;
    });

  const email = useMemo(() => `${form.emailLocal || ""}${EMAIL_DOMAIN}`, [form.emailLocal]);

  const handleFile = (file: File | null) => {
    if (!file) return;
    if (file.type === "application/pdf") {
      setPdfFile(file);
      setImageSrc(null);
      setCroppedBlob(null);
      setPreviewUrl(null);
      return;
    }
    setPdfFile(null);
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCroppedBlob(null);
      setPreviewUrl(null);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
  };

  const confirmCrop = async () => {
    if (!imageSrc || !croppedArea) return;
    try {
      const blob = await getCroppedBlob(imageSrc, croppedArea);
      setCroppedBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      setImageSrc(null);
    } catch (e: any) {
      toast.error("Não foi possível recortar a imagem", { description: e.message });
    }
  };

  const reset = () => {
    setForm(emptyForm);
    setImageSrc(null);
    setPdfFile(null);
    setCroppedBlob(null);
    setPreviewUrl(null);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim()) throw new Error("Informe o nome completo.");
      if (!form.emailLocal.trim()) throw new Error("Informe o e-mail do colaborador.");
      if (form.password.length < 6) throw new Error("A senha deve ter ao menos 6 caracteres.");
      if (!form.departamento) throw new Error("Selecione o departamento.");

      const profileData: Record<string, any> = {
        full_name: form.full_name.trim(),
        display_name: form.display_name.trim() || form.full_name.trim().split(/\s+/)[0],
        endereco: form.address || null,
        telefone: form.phone || null,
        birth_date: form.birth_date || null,
        admission_date: form.admission_date || null,
        cpf: form.cpf || null,
        rg: form.rg || null,
        canac: form.canac || null,
        bank_name: form.bank_name || null,
        bank_account: form.bank_account || null,
        bank_agency: form.bank_agency || null,
        bank_pix: form.bank_pix || null,
        employment_status: "ativo",
      };

      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email,
          password: form.password,
          role: form.departamento,
          userType: "colaborador",
          profileData,
        },
      });

      if (error) throw new Error(error.message || "Erro ao criar usuário.");
      const userId = (data as any)?.user?.id;
      if (!userId) throw new Error((data as any)?.error || "Resposta inválida ao criar usuário.");

      const file: Blob | File | null = croppedBlob ?? pdfFile;
      if (file) {
        const ext = pdfFile ? "pdf" : "jpg";
        const path = `${userId}/${userId}_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(path, file, { upsert: true, contentType: pdfFile ? "application/pdf" : "image/jpeg" });
        if (uploadError) throw uploadError;
        const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
        await supabase.from("user_profiles").update({ avatar_url: pub.publicUrl }).eq("id", userId);
      }

      return userId;
    },
    onSuccess: () => {
      toast.success("Funcionário criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Erro ao criar funcionário", { description: e.message }),
  });

  const initials = form.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={(v) => (createMutation.isPending ? null : onOpenChange(v))}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Criar Novo Funcionário
          </DialogTitle>
          <DialogDescription>
           Criar registro de um novo funcionário (perfil de acesso).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Foto */}
          <section className="rounded-2xl border border-border/60 bg-muted/20 p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Foto de Perfil</h3>
            {imageSrc ? (
              <div className="space-y-4">
                <div className="relative h-64 w-full overflow-hidden rounded-xl bg-black/60">
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    cropShape="round"
                    showGrid={false}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={(_, areaPixels) => setCroppedArea(areaPixels)}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <Label className="text-xs text-muted-foreground w-16">Zoom</Label>
                  <Slider value={[zoom]} min={1} max={4} step={0.05} onValueChange={(v) => setZoom(v[0])} className="flex-1" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setImageSrc(null)}>
                    <X className="h-4 w-4 mr-1" /> Cancelar
                  </Button>
                  <Button type="button" size="sm" onClick={confirmCrop}>
                    Aplicar corte
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-5">
                <Avatar className="h-20 w-20 border-2 border-primary/30">
                  <AvatarImage src={previewUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                    {initials || <Camera className="h-6 w-6" />}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                    className="h-11 rounded-xl"
                  />
                  {pdfFile && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3 w-3" /> {pdfFile.name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Imagem (com ajuste de corte) ou PDF.</p>
                </div>
              </div>
            )}
          </section>

          {/* Dados pessoais */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2 space-y-2">
              <Label>Nome Completo <span className="text-destructive">*</span></Label>
              <Input value={form.full_name} onChange={(e) => setField("full_name", e.target.value)} placeholder="Nome completo" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Primeiro Nome</Label>
              <Input value={form.display_name} onChange={(e) => setField("display_name", e.target.value)} placeholder="Primeiro nome" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>E-mail <span className="text-destructive">*</span></Label>
              <div className="flex items-center">
                <Input value={form.emailLocal} onChange={(e) => setField("emailLocal", slugify(e.target.value))} placeholder="nome.colaborador" className="h-11 rounded-l-xl rounded-r-none" />
                <span className="h-11 flex items-center px-3 rounded-r-xl border border-l-0 border-input bg-muted/40 text-sm text-muted-foreground whitespace-nowrap">
                  {EMAIL_DOMAIN}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Senha <span className="text-destructive">*</span></Label>
              <Input type="text" value={form.password} onChange={(e) => setField("password", e.target.value)} placeholder="Mínimo 6 caracteres" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Departamento <span className="text-destructive">*</span></Label>
              <Select value={form.departamento} onValueChange={(v) => setField("departamento", v)}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione o departamento" /></SelectTrigger>
                <SelectContent className="z-[9999]">
                  {DEPARTAMENTOS.map((role) => (
                    <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Endereço</Label>
              <Input value={form.address} onChange={(e) => setField("address", e.target.value)} placeholder="Rua, número, bairro, cidade" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Celular</Label>
              <Input value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="(00) 00000-0000" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Data de Aniversário</Label>
              <Input type="date" value={form.birth_date} onChange={(e) => setField("birth_date", e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Data de Admissão</Label>
              <Input type="date" value={form.admission_date} onChange={(e) => setField("admission_date", e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={form.cpf} onChange={(e) => setField("cpf", e.target.value)} placeholder="000.000.000-00" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>RG</Label>
              <Input value={form.rg} onChange={(e) => setField("rg", e.target.value)} placeholder="0.000.000" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>CANAC </Label>  
              <Input value={form.canac} onChange={(e) => setField("canac", e.target.value)} placeholder="Código ANAC" className="h-11 rounded-xl" />
            </div>
          </section>

          <Separator />

          {/* Dados de pagamento */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Dados de Pagamento</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-2">
                <Label>Banco</Label>
                <Input value={form.bank_name} onChange={(e) => setField("bank_name", e.target.value)} placeholder="Nome do banco" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Tipo de conta</Label>
                <Select value={form.bank_account} onValueChange={(v) => setField("bank_account", v)}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="CC / CP" /></SelectTrigger>
                  <SelectContent className="z-[9999]">
                    <SelectItem value="Conta Corrente">Conta Corrente (CC)</SelectItem>
                    <SelectItem value="Conta Poupança">Conta Poupança (CP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Agência</Label>
                <Input value={form.bank_agency} onChange={(e) => setField("bank_agency", e.target.value)} placeholder="Número da agência" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Chave Pix</Label>
                <Input value={form.bank_pix} onChange={(e) => setField("bank_pix", e.target.value)} placeholder="CPF, e-mail, telefone ou aleatória" className="h-11 rounded-xl" />
              </div>
            </div>
          </section>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending} className="rounded-xl">
            Cancelar
          </Button>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="rounded-xl">
            {createMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando...</> : "Criar Funcionário"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default NovoFuncionarioDialog;
