import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, Save, Edit, User as UserIcon, Calendar, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import type { UserProfile } from "@/hooks/useUserProfile";
import { ROLE_LABELS, selectPrimaryRole, type AppRole } from "@/lib/roles";
import { getShortUserId, getIdBadgeColor } from "@/lib/user-id";
import { useQuery } from "@tanstack/react-query";
// Payslips hook removed - using pagamento_salario_funcionario directly
import { EmployeeDocumentsManager } from "@/components/profile/EmployeeDocumentsManager";

type ContactType = "Colaboradores" | "Clientes" | "Fornecedores" | "Hoteis";
type FormState = {
  full_name: string;
  display_name: string;
  phone: string;
  address: string;
  tipo: ContactType | "";
  cpf: string;
  rg: string;
  birth_date: string;
  bank_name: string;
  bank_agency: string;
  bank_account: string;
  bank_pix: string;
};
const contactTypeOptions: {
  value: ContactType;
  label: string;
}[] = [{
  value: "Colaboradores",
  label: "Colaboradores"
}, {
  value: "Clientes",
  label: "Clientes"
}, {
  value: "Fornecedores",
  label: "Fornecedores"
}, {
  value: "Hoteis",
  label: "Hotéis"
}];

// Use ROLE_LABELS from lib/roles.ts

const getInitials = (input: string | null | undefined) => {
  if (!input) {
    return "";
  }
  const parts = input.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return input.slice(0, 2).toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
};
const sanitizePhone = (value: string) => value.replace(/\D/g, "");
const buildAvatarPath = (userId: string, fileName: string) => {
  const extension = fileName.split(".").pop();
  const uniqueId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return extension ? `${userId}/${uniqueId}.${extension}` : `${userId}/${uniqueId}`;
};
const formatTimestamp = (isoDate: string | null | undefined) => {
  if (!isoDate) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(isoDate));
  } catch (error) {
    console.error("Failed to format date", error);
    return null;
  }
};
const AVATAR_CROP_BOX_SIZE = 256;
const AVATAR_OUTPUT_SIZE = 512;
const DEFAULT_CROP_SCALE = 1;
export default function Perfil() {
  const {
    user,
    roles
  } = useAuth();
  const primaryRole = useMemo(() => selectPrimaryRole(roles), [roles]);
  const {
    toast
  } = useToast();
  const isAdmin = roles.includes("admin");
  const isGestorMaster = roles.includes("gestor_master");
  const showTimeClock = roles.some(r => ['financeiro', 'financeiro_master', 'adm', 'operacoes'].includes(r));
  const {
    profile,
    isLoading,
    isFetching,
    updateProfile,
    isUpdating
  } = useUserProfile(user, {
    skipCreation: Boolean(isAdmin || isGestorMaster)
  });
  const [formState, setFormState] = useState<FormState>({
    full_name: "",
    display_name: "",
    phone: "",
    address: "",
    tipo: "",
    cpf: "",
    rg: "",
    birth_date: "",
    bank_name: "",
    bank_agency: "",
    bank_account: "",
    bank_pix: ""
  });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [avatarPosition, setAvatarPosition] = useState<number>(50);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImage, setCropImage] = useState<{
    file: File;
    url: string;
  } | null>(null);
  const [cropMeta, setCropMeta] = useState<{
    width: number;
    height: number;
    baseScale: number;
  } | null>(null);
  const [cropScale, setCropScale] = useState(DEFAULT_CROP_SCALE);
  const [cropPosition, setCropPosition] = useState<{
    x: number;
    y: number;
  }>({
    x: 0,
    y: 0
  });
  const cropImageRef = useRef<HTMLImageElement | null>(null);
  const cropDragStart = useRef<{
    x: number;
    y: number;
  } | null>(null);
  const [isCropDragging, setIsCropDragging] = useState(false);
  useEffect(() => {
    if (profile) {
      const p: any = profile as any;
      setFormState({
        full_name: profile.full_name ?? "",
        display_name: profile.display_name ?? "",
        phone: profile.phone != null ? String(profile.phone) : "",
        address: profile.address ?? "",
        tipo: "",
        cpf: p?.cpf ?? "",
        rg: p?.rg ?? "",
        birth_date: p?.birth_date ?? "",
        bank_name: p?.bank_name ?? "",
        bank_agency: p?.bank_agency ?? "",
        bank_account: p?.bank_account ?? "",
        bank_pix: p?.bank_pix ?? ""
      });
    }
  }, [profile]);
  useEffect(() => {
    setAvatarPosition(50);
  }, [profile?.avatar_url]);
  useEffect(() => {
    return () => {
      if (cropImage) {
        URL.revokeObjectURL(cropImage.url);
      }
    };
  }, [cropImage]);
  const displayName = useMemo(() => formState.display_name || formState.full_name || profile?.full_name || user?.email || "Usuário", [formState.display_name, formState.full_name, profile?.full_name, user?.email]);
  const avatarInitials = useMemo(() => getInitials(displayName), [displayName]);
  const accountUpdatedAt = useMemo(() => formatTimestamp(profile?.updated_at), [profile?.updated_at]);
  const isProfileBusy = isUpdating || avatarUploading;
  const userId = user?.id ?? "";
  const {
    data: salaryPayments = []
  } = useQuery({
    queryKey: ["profile-salary-payments", userId],
    queryFn: async () => {
      if (!userId) return [] as any[];
      const { data, error } = await supabase
        .from("pagamento_salario_funcionario")
        .select("*")
        .eq("user_profile", userId)
        .order("created_at", { ascending: false });
      if (error) return [] as any[];
      return data as any[];
    },
    enabled: !!userId
  });
  // Payslips são agora carregados da tabela pagamento_salario_funcionario acima
  const {
    data: vacationRequests = [],
    refetch: refetchVacations
  } = useQuery({
    queryKey: ["vacation-requests", userId],
    queryFn: async () => {
      if (!userId) return [] as any[];
      const {
        data,
        error
      } = await supabase.from("vacation_requests" as any).select("*").eq("user_id", userId).order("created_at", {
        ascending: false
      });
      if (error) return [] as any[];
      return data as any[];
    },
    enabled: !!userId
  });
  const [absences, setAbsences] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const workingMonths = (() => {
    const admission = (profile as any)?.admission_date as string | undefined;
    if (!admission) return 0;
    const start = new Date(admission);
    const now = new Date();
    return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
  })();
  const baseDays = workingMonths >= 12 ? 30 : Math.floor(workingMonths * 2.5);
  const entitlement = (() => {
    if (absences <= 5) return baseDays;
    if (absences <= 14) return Math.min(baseDays, 24);
    if (absences <= 23) return Math.min(baseDays, 18);
    if (absences <= 32) return Math.min(baseDays, 12);
    return 0;
  })();
  const approvedTaken = (vacationRequests as any[]).filter(r => r.status === "approved").reduce((sum, r) => sum + (Number(r.days) || 0), 0);
  const available = workingMonths < 12 ? 0 : Math.max(0, entitlement - approvedTaken);
  const isWeekend = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    return day === 0 || day === 6;
  };
  const getEligibilityDateForVacation = () => {
    const admission = (profile as any)?.admission_date as string | undefined;
    if (!admission) return null;
    const start = new Date(admission);
    return new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
  };

  const handleVacationRequest = async () => {
    if (workingMonths < 12) {
      const eligibilityDate = getEligibilityDateForVacation();
      const formattedDate = new Intl.DateTimeFormat("pt-BR", {
        year: "numeric",
        month: "long",
        day: "numeric"
      }).format(eligibilityDate!);
      toast({
        title: "Período aquisitivo não completado",
        description: `Você poderá solicitar férias a partir de ${formattedDate}, quando completar 12 meses de trabalho.`,
        variant: "destructive"
      });
      return;
    }

    if (!startDate || !endDate) {
      toast({
        title: "Datas obrigatórias",
        description: "Informe início e fim das férias.",
        variant: "destructive"
      });
      return;
    }
    if (isWeekend(startDate)) {
      toast({
        title: "Início inválido",
        description: "As férias não podem começar em sábado ou domingo.",
        variant: "destructive"
      });
      return;
    }
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (e < s) {
      toast({
        title: "Período inválido",
        description: "Data final deve ser após a inicial.",
        variant: "destructive"
      });
      return;
    }
    const days = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (days < 5) {
      toast({
        title: "Período curto",
        description: "Cada período deve ter pelo menos 5 dias.",
        variant: "destructive"
      });
      return;
    }
    if (days > available) {
      toast({
        title: "Saldo insuficiente",
        description: "Quantidade de dias solicitada excede o disponível.",
        variant: "destructive"
      });
      return;
    }
    const {
      error
    } = await supabase.from("vacation_requests" as any).insert({
      user_id: userId,
      start_date: startDate,
      end_date: endDate,
      days,
      status: "pending"
    });
    if (error) {
      toast({
        title: "Erro ao solicitar",
        description: error.message,
        variant: "destructive"
      });
      return;
    }
    await supabase.functions.invoke("notify-vacation-request", {
      body: {
        userId
      }
    }).catch(() => {});
    toast({
      title: "Solicitação enviada",
      description: "RH e gestores foram notificados."
    });
    setStartDate("");
    setEndDate("");
    void refetchVacations();
  };
  const resetCropState = useCallback(() => {
    setCropDialogOpen(false);
    setCropImage(null);
    setCropMeta(null);
    setCropScale(DEFAULT_CROP_SCALE);
    setCropPosition({
      x: 0,
      y: 0
    });
    setIsCropDragging(false);
    cropDragStart.current = null;
    cropImageRef.current = null;
  }, []);
  const clampPosition = useCallback((position: {
    x: number;
    y: number;
  }, scaleOverride?: number) => {
    if (!cropMeta) {
      return position;
    }
    const scale = scaleOverride ?? cropScale;
    const scaledWidth = cropMeta.width * cropMeta.baseScale * scale;
    const scaledHeight = cropMeta.height * cropMeta.baseScale * scale;
    const maxOffsetX = Math.max((scaledWidth - AVATAR_CROP_BOX_SIZE) / 2, 0);
    const maxOffsetY = Math.max((scaledHeight - AVATAR_CROP_BOX_SIZE) / 2, 0);
    return {
      x: Math.min(Math.max(position.x, -maxOffsetX), maxOffsetX),
      y: Math.min(Math.max(position.y, -maxOffsetY), maxOffsetY)
    };
  }, [cropMeta, cropScale]);
  const handleCropPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!cropMeta) {
      return;
    }
    event.preventDefault();
    setIsCropDragging(true);
    cropDragStart.current = {
      x: event.clientX,
      y: event.clientY
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [cropMeta]);
  const handleCropPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isCropDragging || !cropDragStart.current) {
      return;
    }
    event.preventDefault();
    const deltaX = event.clientX - cropDragStart.current.x;
    const deltaY = event.clientY - cropDragStart.current.y;
    cropDragStart.current = {
      x: event.clientX,
      y: event.clientY
    };
    setCropPosition(prev => clampPosition({
      x: prev.x + deltaX,
      y: prev.y + deltaY
    }));
  }, [clampPosition, isCropDragging]);
  const handleCropPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsCropDragging(false);
    cropDragStart.current = null;
  }, []);
  const handleScaleChange = useCallback((value: number[]) => {
    const newScale = value[0] ?? DEFAULT_CROP_SCALE;
    setCropScale(newScale);
    setCropPosition(prev => clampPosition(prev, newScale));
  }, [clampPosition]);
  const handleCropImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const {
      naturalWidth,
      naturalHeight
    } = event.currentTarget;
    if (!naturalWidth || !naturalHeight) {
      return;
    }
    const baseScale = Math.max(AVATAR_CROP_BOX_SIZE / naturalWidth, AVATAR_CROP_BOX_SIZE / naturalHeight);
    setCropMeta({
      width: naturalWidth,
      height: naturalHeight,
      baseScale
    });
    setCropScale(DEFAULT_CROP_SCALE);
    setCropPosition({
      x: 0,
      y: 0
    });
  }, []);
  const uploadAvatarFile = useCallback(async (file: File) => {
    if (!user?.id) {
      toast({
        title: "Usuário não encontrado",
        description: "Faça login novamente para atualizar a foto de perfil.",
        variant: "destructive"
      });
      return false;
    }
    setAvatarUploading(true);
    try {
      const path = buildAvatarPath(user.id, file.name);
      const {
        error: uploadError
      } = await supabase.storage.from("avatar-profile").upload(path, file, {
        cacheControl: "3600",
        upsert: true
      });
      if (uploadError) {
        throw uploadError;
      }
      const {
        data: publicData
      } = supabase.storage.from("avatar-profile").getPublicUrl(path);
      if (!publicData?.publicUrl) {
        throw new Error("Não foi possível gerar a URL da imagem.");
      }
      await updateProfile({
        avatar_url: publicData.publicUrl
      });
      toast({
        title: "Foto atualizada",
        description: "Sua foto de perfil foi atualizada com sucesso."
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao atualizar a foto.";
      toast({
        title: "Não foi possível enviar a foto",
        description: message,
        variant: "destructive"
      });
      return false;
    } finally {
      setAvatarUploading(false);
    }
  }, [toast, updateProfile, user?.id]);
  const handleConfirmCrop = useCallback(async () => {
    if (!cropImage || !cropMeta) {
      return;
    }
    const imageElement = cropImageRef.current;
    if (!imageElement) {
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_OUTPUT_SIZE;
    canvas.height = AVATAR_OUTPUT_SIZE;
    const context = canvas.getContext("2d");
    if (!context) {
      toast({
        title: "Erro ao preparar a imagem",
        description: "Não foi possível processar a imagem selecionada.",
        variant: "destructive"
      });
      return;
    }
    const scaleMultiplier = cropMeta.baseScale * cropScale;
    const ratio = AVATAR_OUTPUT_SIZE / AVATAR_CROP_BOX_SIZE;
    const {
      x,
      y
    } = cropPosition;
    const drawWidth = cropMeta.width * scaleMultiplier * ratio;
    const drawHeight = cropMeta.height * scaleMultiplier * ratio;
    const drawX = (AVATAR_OUTPUT_SIZE - drawWidth) / 2 + x * ratio;
    const drawY = (AVATAR_OUTPUT_SIZE - drawHeight) / 2 + y * ratio;
    const preferredMime = cropImage.file.type === "image/png" ? "image/png" : "image/jpeg";
    context.clearRect(0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
    if (preferredMime === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
    }
    context.drawImage(imageElement, drawX, drawY, drawWidth, drawHeight);
    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, preferredMime, preferredMime === "image/jpeg" ? 0.92 : undefined));
    if (!blob) {
      toast({
        title: "Erro ao gerar a imagem",
        description: "Não foi possível finalizar o corte da foto.",
        variant: "destructive"
      });
      return;
    }
    const extension = preferredMime === "image/png" ? "png" : "jpg";
    const baseName = cropImage.file.name.replace(/\.[^.]+$/, "");
    const croppedFile = new File([blob], `${baseName}.${extension}`, {
      type: preferredMime
    });
    const success = await uploadAvatarFile(croppedFile);
    if (success) {
      resetCropState();
    }
  }, [cropImage, cropMeta, cropPosition, cropScale, resetCropState, toast, uploadAvatarFile]);
  const handleCancelCrop = useCallback(() => {
    if (avatarUploading) {
      return;
    }
    resetCropState();
  }, [avatarUploading, resetCropState]);
  const handleCropDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      if (avatarUploading) {
        return;
      }
      resetCropState();
    } else {
      setCropDialogOpen(true);
    }
  }, [avatarUploading, resetCropState]);
  const handleInputChange = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setFormState(prev => ({
      ...prev,
      [field]: field === "phone" ? sanitizePhone(value) : value
    }));
  };
  const handleSelectChange = (value: ContactType) => {
    setFormState(prev => ({
      ...prev,
      tipo: value
    }));
  };
  const handleSave = async () => {
    const trimmedFullName = formState.full_name.trim();
    if (!trimmedFullName) {
      toast({
        title: "Nome obrigatório",
        description: "Informe o nome completo para salvar o perfil.",
        variant: "destructive"
      });
      return;
    }
    const phoneDigits = formState.phone ? String(formState.phone) : null;
    try {
      if (!user?.id) {
        throw new Error("Usuário não autenticado");
      }

      const payload: Record<string, any> = {
        full_name: trimmedFullName,
        display_name: formState.display_name.trim() || null,
        phone: phoneDigits,
        address: formState.address.trim() || null,
        tipo: formState.tipo || null,
        cpf: formState.cpf.trim() || null,
        rg: formState.rg.trim() || null,
        birth_date: formState.birth_date || null,
        bank_name: formState.bank_name.trim() || null,
        bank_agency: formState.bank_agency.trim() || null,
        bank_account: formState.bank_account.trim() || null,
        bank_pix: formState.bank_pix.trim() || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from("user_profiles")
        .update(payload)
        .eq("id", user.id)
        .select()
        .single();

      if (error) {
        console.error("Erro ao atualizar perfil:", error);
        throw new Error(error.message || "Erro ao salvar o perfil");
      }

      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso."
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar o perfil.";
      console.error("Erro na atualização do perfil:", message);
      toast({
        title: "Não foi possível atualizar",
        description: message,
        variant: "destructive"
      });
    }
  };

  const handleSaveEditableFields = async () => {
    try {
      const payload = {
        display_name: formState.display_name,
        phone: formState.phone,
        address: formState.address,
        bank_name: formState.bank_name,
        bank_agency: formState.bank_agency,
        bank_account: formState.bank_account,
        bank_pix: formState.bank_pix
      };

      await updateProfile(payload);
      setIsEditing(false);
      toast({
        title: "Dados salvos",
        description: "Suas informações foram atualizadas com sucesso."
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar.";
      toast({
        title: "Erro ao salvar",
        description: message,
        variant: "destructive"
      });
    }
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || avatarUploading) {
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setCropImage({
      file,
      url: previewUrl
    });
    setCropDialogOpen(true);
    setCropMeta(null);
    setCropScale(DEFAULT_CROP_SCALE);
    setCropPosition({
      x: 0,
      y: 0
    });
    setIsCropDragging(false);
  };
  const triggerFileDialog = () => {
    if (!isProfileBusy) {
      fileInputRef.current?.click();
    }
  };
  if (!user) {
    return <Layout>
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p>Não foi possível carregar as informações do usuário autenticado.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>;
  }
  return <Layout>
      <Dialog open={cropDialogOpen} onOpenChange={handleCropDialogOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Ajustar foto de perfil</DialogTitle>
            <DialogDescription>
              Arraste a imagem e utilize a régua para escolher o melhor enquadramento antes de salvar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-6">
            <div className="flex justify-center">
              <div className="relative h-64 w-64 overflow-hidden rounded-full border-2 border-primary bg-muted shadow-lg" onPointerDown={handleCropPointerDown} onPointerMove={handleCropPointerMove} onPointerUp={handleCropPointerUp} onPointerCancel={handleCropPointerUp} style={{
              touchAction: 'none'
            }}>
                {cropImage?.url ? <div className={`absolute inset-0 ${isCropDragging ? "cursor-grabbing" : "cursor-grab"}`}>
                    <img ref={node => {
                  cropImageRef.current = node;
                }} src={cropImage.url} alt="Pré-visualização do avatar" onLoad={handleCropImageLoad} draggable={false} className="pointer-events-none absolute select-none" style={{
                  left: '50%',
                  top: '50%',
                  width: cropMeta ? `${cropMeta.width * cropMeta.baseScale * cropScale}px` : 'auto',
                  height: cropMeta ? `${cropMeta.height * cropMeta.baseScale * cropScale}px` : 'auto',
                  transform: `translate(calc(-50% + ${cropPosition.x}px), calc(-50% + ${cropPosition.y}px))`,
                  maxWidth: 'none'
                }} />
                  </div> : <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="avatar-scale" className="text-sm font-medium">
                  Ajuste o zoom da imagem
                </Label>
                <span className="text-xs text-muted-foreground">
                  {cropScale.toFixed(2)}x
                </span>
              </div>
              <Slider id="avatar-scale" min={1} max={3} step={0.01} value={[cropScale]} onValueChange={handleScaleChange} disabled={!cropMeta || avatarUploading} className="cursor-pointer" />
              <p className="text-xs text-muted-foreground text-center">
                Arraste a imagem para posicionar e use a régua para ampliar ou reduzir
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelCrop} disabled={avatarUploading}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmCrop} disabled={!cropMeta || avatarUploading} className="flex items-center gap-2">
              {avatarUploading && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar corte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Meu Perfil</h1>
            <p className="mt-2 text-muted-foreground">
              Gerencie suas informações pessoais e mantenha seus dados sempre atualizados.
            </p>
          </div>
          <Button onClick={() => setIsEditing(true)} disabled={isFetching || isLoading || isEditing} variant="default">
            {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Edit className="mr-2 h-4 w-4" />}
            Editar
          </Button>
        </div>

        <Tabs defaultValue="dados" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-gradient-card border border-border rounded-xl p-2 shadow-card h-auto">
            <TabsTrigger value="dados" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200">Dados</TabsTrigger>
            <TabsTrigger value="salario" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200">Salário</TabsTrigger>
            <TabsTrigger value="ferias" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200">Férias</TabsTrigger>
            <TabsTrigger value="documentos" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200">Documentos</TabsTrigger>
          </TabsList>

          <TabsContent value="dados">
            <Card className="border-border shadow-elevated rounded-xl">
              <CardHeader className="border-b bg-gradient-card pb-8 rounded-t-xl">
                <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                  <div className="relative">
                    <Avatar className="h-32 w-32 border-4 border-primary shadow-elevated">
                      <AvatarImage src={profile?.avatar_url ?? undefined} alt={displayName} className="h-full w-full object-cover transition-[object-position] duration-200" style={{
                      objectPosition: `center ${avatarPosition}%`
                    }} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-4xl">{avatarInitials || <UserIcon className="h-12 w-12" />}</AvatarFallback>
                    </Avatar>
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif" className="hidden" onChange={handleAvatarUpload} />
                    <button
                      onClick={triggerFileDialog}
                      disabled={avatarUploading}
                      className="absolute bottom-0 right-0 bg-primary hover:bg-primary-dark p-2 rounded-full shadow-elevated text-white transition-all duration-200 disabled:opacity-50"
                      aria-label="Alterar foto"
                    >
                      {avatarUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                    </button>
                  </div>

                  <div className="flex-1 space-y-3 text-center sm:text-left">
                    <div>
                      <h2 className="text-4xl font-bold text-foreground">{displayName}</h2>
                      <p className="text-sm text-muted-foreground mt-1">{profile?.email ?? user.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start items-center">
                      <Badge className="bg-primary/20 text-primary hover:bg-primary/30">{primaryRole ? ROLE_LABELS[primaryRole] : "Sem categoria"}</Badge>
                      {user?.id && <Badge className={`${getIdBadgeColor(getShortUserId(user.id))} font-semibold px-3 py-1 text-sm`}>{getShortUserId(user.id)}</Badge>}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-8 py-8">
                <div className="space-y-6">
                  <div>
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
                          <div className="h-2 w-2 rounded-full bg-primary"></div>
                          Informações Pessoais
                        </h3>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="full-name" className="text-sm font-medium text-foreground">Nome Completo</Label>
                        <Input id="full-name" value={formState.full_name} onChange={(e) => setFormState({...formState, full_name: e.target.value})} disabled={!isEditing} className={`rounded-lg border ${isEditing ? 'border-primary bg-background text-foreground cursor-text' : 'border-border bg-muted text-foreground cursor-not-allowed'}`} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="display-name" className="text-sm font-medium text-foreground">Nome de Exibição</Label>
                        <Input id="display-name" value={formState.display_name} onChange={(e) => setFormState({...formState, display_name: e.target.value})} disabled={!isEditing} className={`rounded-lg border ${isEditing ? 'border-primary bg-background text-foreground cursor-text' : 'border-border bg-muted text-foreground cursor-not-allowed'}`} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-sm font-medium text-foreground">E-mail</Label>
                        <Input id="email" value={profile?.email ?? user.email ?? ""} disabled className="rounded-lg border border-border bg-muted text-foreground cursor-not-allowed" />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="phone" className="text-sm font-medium text-foreground">Telefone</Label>
                        <Input id="phone" value={formState.phone} onChange={(e) => setFormState({...formState, phone: e.target.value})} placeholder="(XX) XXXXX-XXXX" disabled={!isEditing} className={`rounded-lg border ${isEditing ? 'border-primary bg-background text-foreground cursor-text' : 'border-border bg-muted text-foreground cursor-not-allowed'}`} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cpf" className="text-sm font-medium text-foreground">CPF</Label>
                        <Input id="cpf" value={formState.cpf} onChange={(e) => setFormState({...formState, cpf: e.target.value})} disabled={!isEditing} className={`rounded-lg border ${isEditing ? 'border-primary bg-background text-foreground cursor-text' : 'border-border bg-muted text-foreground cursor-not-allowed'}`} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rg" className="text-sm font-medium text-foreground">RG</Label>
                        <Input id="rg" value={formState.rg} onChange={(e) => setFormState({...formState, rg: e.target.value})} disabled={!isEditing} className={`rounded-lg border ${isEditing ? 'border-primary bg-background text-foreground cursor-text' : 'border-border bg-muted text-foreground cursor-not-allowed'}`} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="birth" className="text-sm font-medium text-foreground">Data de Nascimento</Label>
                      <Input id="birth" type="date" value={formState.birth_date} onChange={(e) => setFormState({...formState, birth_date: e.target.value})} disabled={!isEditing} className={`rounded-lg border ${isEditing ? 'border-primary bg-background text-foreground cursor-text' : 'border-border bg-muted text-foreground cursor-not-allowed'}`} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="address" className="text-sm font-medium text-foreground">Endereço</Label>
                      <Textarea id="address" value={formState.address} onChange={(e) => setFormState({...formState, address: e.target.value})} rows={3} disabled={!isEditing} className={`rounded-lg border ${isEditing ? 'border-primary bg-background text-foreground cursor-text' : 'border-border bg-muted text-foreground cursor-not-allowed'}`} />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
                      <div className="h-2 w-2 rounded-full bg-primary"></div>
                      Dados Bancários
                    </h3>
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="bank_name" className="text-sm font-medium text-foreground">Banco</Label>
                        <Input
                          id="bank_name"
                          value={formState.bank_name}
                          onChange={(e) => setFormState({...formState, bank_name: e.target.value})}
                          disabled={!isEditing}
                          className={`rounded-lg border ${isEditing ? 'border-primary bg-background text-foreground cursor-text' : 'border-border bg-muted text-foreground cursor-not-allowed'}`}
                        />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bank_agency" className="text-sm font-medium text-foreground">Agência</Label>
                        <Input
                          id="bank_agency"
                          value={formState.bank_agency}
                          onChange={(e) => setFormState({...formState, bank_agency: e.target.value})}
                          disabled={!isEditing}
                          className={`rounded-lg border ${isEditing ? 'border-primary bg-background text-foreground cursor-text' : 'border-border bg-muted text-foreground cursor-not-allowed'}`}
                        />
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="bank_account" className="text-sm font-medium text-foreground">Conta</Label>
                        <Input
                          id="bank_account"
                          value={formState.bank_account}
                          onChange={(e) => setFormState({...formState, bank_account: e.target.value})}
                          disabled={!isEditing}
                          className={`rounded-lg border ${isEditing ? 'border-primary bg-background text-foreground cursor-text' : 'border-border bg-muted text-foreground cursor-not-allowed'}`}
                        />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bank_pix" className="text-sm font-medium text-foreground">PIX</Label>
                        <Input
                          id="bank_pix"
                          value={formState.bank_pix}
                          onChange={(e) => setFormState({...formState, bank_pix: e.target.value})}
                          disabled={!isEditing}
                          className={`rounded-lg border ${isEditing ? 'border-primary bg-background text-foreground cursor-text' : 'border-border bg-muted text-foreground cursor-not-allowed'}`}
                        />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {isEditing && (
                  <div className="border-t pt-6 flex gap-3 justify-end">
                    <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isProfileBusy}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSaveEditableFields} disabled={isProfileBusy} className="flex items-center gap-2">
                      {isProfileBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Salvar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="salario">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Pagamentos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {salaryPayments.length === 0 ? (
                    <p className="text-muted-foreground">Sem registros de salário.</p>
                  ) : (
                    <ul className="space-y-3">
                      {salaryPayments.map((s: any) => {
                        const descriptions: string[] = [];
                        if (s.base_salary_holerite) descriptions.push(`Salário: R$ ${Number(s.base_salary_holerite).toFixed(2)}`);
                        if (s.benefit) descriptions.push(`Benefício: ${s.benefit}`);
                        if (s.horas_voo) descriptions.push(`Horas de Voo: ${s.horas_voo}`);
                        if (s.extra) descriptions.push(`Extra: ${s.extra}`);
                        
                        return (
                          <li key={s.id} className="rounded-md border p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm">
                                {new Date(s.created_at ?? Date.now()).toLocaleDateString("pt-BR", {
                                  month: "long",
                                  year: "numeric"
                                })}
                              </p>
                              <div className="flex gap-2">
                                {s.comprovante_url && (
                                  <a href={s.comprovante_url} target="_blank" rel="noreferrer">
                                    <Button variant="outline" size="sm" className="h-7 text-xs">
                                      Comprovante
                                    </Button>
                                  </a>
                                )}
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              {descriptions.map((desc, i) => (
                                <p key={i}>{desc}</p>
                              ))}
                              {s.obs && <p className="text-xs italic mt-2">Obs: {s.obs}</p>}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Holerites</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {salaryPayments.filter((s: any) => s.holerite_url).length === 0 ? (
                    <p className="text-muted-foreground">Sem holerites enviados.</p>
                  ) : (
                    <ul className="space-y-3">
                      {salaryPayments
                        .filter((s: any) => s.holerite_url)
                        .map((s: any) => (
                          <li key={s.id} className="flex items-center justify-between rounded-md border p-3">
                            <div>
                              <p className="font-medium">
                                {new Date(s.created_at ?? Date.now()).toLocaleDateString("pt-BR", {
                                  month: "long",
                                  year: "numeric"
                                })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {s.base_salary_holerite ? `R$ ${Number(s.base_salary_holerite).toFixed(2)}` : ""}
                              </p>
                            </div>
                            <a href={s.holerite_url} target="_blank" rel="noreferrer">
                              <Button variant="outline" size="sm">Visualizar</Button>
                            </a>
                          </li>
                        ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ferias">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-4">Férias</h2>
                <p className="text-muted-foreground mb-6">Solicitação e informações sobre suas férias</p>

                <div className="grid gap-4 md:grid-cols-3 mb-6">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2">Disponíveis</p>
                        <p className="text-4xl font-bold text-green-600">{available}</p>
                        <p className="text-xs text-muted-foreground mt-2">dias</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2">Usadas</p>
                        <p className="text-4xl font-bold text-blue-600">{approvedTaken}</p>
                        <p className="text-xs text-muted-foreground mt-2">dias</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2">Agendadas</p>
                        <p className="text-4xl font-bold text-amber-600">{vacationRequests.filter((r: any) => r.status === 'pending' || r.status === 'approved').length}</p>
                        <p className="text-xs text-muted-foreground mt-2">dias</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-lg">ℹ️</span>
                    Regras de Férias
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Direito a 30 dias após 12 meses de trabalho</span>
                    </li>
                    <li className="flex gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Podem ser fracionadas em até 3 períodos</span>
                    </li>
                    <li className="flex gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Um período deve ter no mínimo 14 dias</span>
                    </li>
                    <li className="flex gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Solicitar com 30 dias de antecedência</span>
                    </li>
                    <li className="flex gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Adicional de 1/3 sobre o salário</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Solicitar Férias</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {workingMonths < 12 && (
                    <Alert className="border-yellow-500/50 bg-yellow-500/5">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                        <p className="font-semibold mb-2">Período aquisitivo não completado</p>
                        <p className="text-sm">
                          Você poderá solicitar férias a partir de{" "}
                          <span className="font-semibold">
                            {new Intl.DateTimeFormat("pt-BR", {
                              year: "numeric",
                              month: "long",
                              day: "numeric"
                            }).format(getEligibilityDateForVacation()!)}
                          </span>
                          , quando completar 12 meses de trabalho.
                        </p>
                      </AlertDescription>
                    </Alert>
                  )}

                  {workingMonths >= 12 && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="vacation-type">Tipo de Férias</Label>
                        <Select defaultValue="full">
                          <SelectTrigger id="vacation-type">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">Integral (mínimo 14 dias)</SelectItem>
                            <SelectItem value="partial">Parcial (customizado)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="start-date">Data de Início</Label>
                          <Input
                            id="start-date"
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            placeholder="dd/mm/aaaa"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="end-date">Data de Fim</Label>
                          <Input
                            id="end-date"
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            placeholder="dd/mm/aaaa"
                          />
                        </div>
                      </div>

                      <Button onClick={handleVacationRequest} className="w-full">Solicitar</Button>
                      <p className="text-xs text-muted-foreground">Aviso mínimo de 30 dias e pagamento até 2 dias antes do início.</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Solicitações</CardTitle>
                </CardHeader>
                <CardContent>
                  {vacationRequests.length === 0 ? (
                    <p className="text-muted-foreground text-center py-6">Nenhuma solicitação registrada.</p>
                  ) : (
                    <div className="space-y-3">
                      {(vacationRequests as any[]).map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition">
                          <div className="flex items-center gap-3">
                            <Calendar className="h-5 w-5 text-primary" />
                            <div>
                              <p className="font-medium">{new Date(r.start_date).toLocaleDateString("pt-BR")} → {new Date(r.end_date).toLocaleDateString("pt-BR")}</p>
                              <p className="text-sm text-muted-foreground">{r.days} dias</p>
                            </div>
                          </div>
                          <Badge variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'}>
                            {r.status === 'approved' ? 'Aprovado' : r.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-lg">⭐</span>
                    Dicas para suas Férias
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex gap-3">
                      <span className="text-lg">⭐</span>
                      <span className="text-sm">Planeje suas férias com antecedência</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-lg">⭐</span>
                      <span className="text-sm">Considere os períodos de alta temporada</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-lg">⭐</span>
                      <span className="text-sm">Verifique a escala antes de solicitar</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-lg">⭐</span>
                      <span className="text-sm">Mantenha seus documentos atualizados</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-lg">⭐</span>
                      <span className="text-sm">Considere vender parte das férias se precisar</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="documentos">
            <EmployeeDocumentsManager
              userId={userId}
              userName={displayName}
              isAdmin={isAdmin}
              isFinanceiroMaster={roles.includes("financeiro_master")}
              isGestorMaster={isGestorMaster}
              currentUserId={user?.id}
            />
          </TabsContent>
        </Tabs>

        {(isLoading || isFetching) && <Card>
            <CardContent className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando informações do perfil...
            </CardContent>
          </Card>}
      </div>
    </Layout>;
}
