import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, Save, Edit, User as UserIcon, Calendar, AlertCircle, CheckCircle, Clock, Lock, Eye, EyeOff, X, Palette, Sun, Moon } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import type { UserProfile } from "@/hooks/useUserProfile";
import { ROLE_LABELS, selectPrimaryRole, type AppRole } from "@/lib/roles";
import { getShortUserId, getIdBadgeColor } from "@/lib/user-id";
import { useQuery } from "@tanstack/react-query";

import { EmployeeDocumentsManager } from "@/components/profile/EmployeeDocumentsManager";
import { TimeClockTab } from "@/components/profile/TimeClockTab";
import EmployeeBankStatement from "@/components/profile/ExtratoBancarioFuncionario";
import { TravelReportApprovalsTab } from "@/components/profile/TravelReportApprovalsTab";

type ContactType = "Colaboradores" | "Clientes" | "Fornecedores" | "Hoteis";

// CORREÇÃO 1: Unificamos os nomes das variáveis para bater com o banco de dados (telefone e endereco)
type FormState = {
  full_name: string;
  display_name: string;
  telefone: string;
  endereco: string;
  tipo: ContactType | "";
  cpf: string;
  rg: string;
  canac: string;
  birth_date: string;
  bank_name: string;
  bank_agency: string;
  bank_account: string;
  bank_pix: string;
};

const contactTypeOptions: { value: ContactType; label: string }[] = [
  { value: "Colaboradores", label: "Colaboradores" },
  { value: "Clientes", label: "Clientes" },
  { value: "Fornecedores", label: "Fornecedores" },
  { value: "Hoteis", label: "Hotéis" }
];

const getInitials = (input: string | null | undefined) => {
  if (!input) return "";
  const parts = input.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return input.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
};

const sanitizePhone = (value: string) => value.replace(/\D/g, "");

const buildAvatarPath = (userId: string, fileName: string) => {
  const extension = fileName.split(".").pop();
  const uniqueId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return extension ? `${userId}/${uniqueId}.${extension}` : `${userId}/${uniqueId}`;
};

const formatTimestamp = (isoDate: string | null | undefined) => {
  if (!isoDate) return null;
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(isoDate));
  } catch (error) {
    console.error("Failed to format date", error);
    return null;
  }
};

const AVATAR_CROP_BOX_SIZE = 256;
const AVATAR_OUTPUT_SIZE = 512;
const DEFAULT_CROP_SCALE = 1;

export default function Perfil() {
  const { user, roles } = useAuth();
  const { theme, setTheme, isThemeSaving } = useTheme();
  const primaryRole = useMemo(() => selectPrimaryRole(roles), [roles]);
  const { toast } = useToast();
  const isAdmin = roles.includes("admin");
  const isGestorMaster = roles.includes("gestor_master");
  const showTimeClock = roles.some(r => ['financeiro', 'financeiro_master', 'adm', 'operacoes'].includes(r));
  
  const { profile, isLoading, isFetching, updateProfile, isUpdating } = useUserProfile(user, {
    skipCreation: Boolean(isAdmin || isGestorMaster)
  });

  const [formState, setFormState] = useState<FormState>({
    full_name: "", display_name: "", telefone: "", endereco: "", tipo: "",
    cpf: "", rg: "", canac: "", birth_date: "", bank_name: "", bank_agency: "", bank_account: "", bank_pix: ""
  });

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [avatarPosition, setAvatarPosition] = useState<number>(50);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImage, setCropImage] = useState<{ file: File; url: string } | null>(null);
  const [cropMeta, setCropMeta] = useState<{ width: number; height: number; baseScale: number } | null>(null);
  const [cropScale, setCropScale] = useState(DEFAULT_CROP_SCALE);
  const [cropPosition, setCropPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const cropImageRef = useRef<HTMLImageElement | null>(null);
  const cropDragStart = useRef<{ x: number; y: number } | null>(null);
  const [isCropDragging, setIsCropDragging] = useState(false);

  useEffect(() => {
    if (profile) {
      const p: any = profile as any;
      setFormState({
        full_name: p.full_name ?? "",
        display_name: p.display_name ?? "",
        telefone: p.telefone != null ? String(p.telefone) : "",
        endereco: p.endereco ?? "",
        tipo: "",
        cpf: p.cpf ?? "",
        rg: p.rg ?? "",
        canac: p.canac ?? "",
        birth_date: p.birth_date ?? "",
        bank_name: p.bank_name ?? "",
        bank_agency: p.bank_agency ?? "",
        bank_account: p.bank_account ?? "",
        bank_pix: p.bank_pix ?? ""
      });
    }
  }, [profile]);

  useEffect(() => {
    setAvatarPosition(50);
  }, [profile?.avatar_url]);

  useEffect(() => {
    return () => {
      if (cropImage) URL.revokeObjectURL(cropImage.url);
    };
  }, [cropImage]);

  const displayName = useMemo(() => formState.display_name || formState.full_name || profile?.full_name || user?.email || "Usuário", [formState.display_name, formState.full_name, profile?.full_name, user?.email]);
  const avatarInitials = useMemo(() => getInitials(displayName), [displayName]);
  const accountUpdatedAt = useMemo(() => formatTimestamp(profile?.updated_at), [profile?.updated_at]);
  const isProfileBusy = isUpdating || avatarUploading;
  const userId = user?.id ?? "";

  const { data: isCrewMember = false } = useQuery({
    queryKey: ["crew_member_check", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("membros_tripulacao").select("id").eq("user_id", userId).maybeSingle();
      if (error) return false;
      return !!data;
    },
  });

  const { data: vacationRequests = [], refetch: refetchVacations } = useQuery({
    queryKey: ["vacation-requests", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.from("vacation_requests" as any).select("*").eq("user_id", userId).order("criado_em", { ascending: false });
      if (error) return [];
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
  
  const approvedTaken = vacationRequests.filter((r: any) => r.status === "approved").reduce((sum: number, r: any) => sum + (Number(r.days) || 0), 0);
  const available = workingMonths < 12 ? 0 : Math.max(0, entitlement - approvedTaken);
  
  const isWeekend = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    return day === 0 || day === 6; // Verifica timezone base do navegador, ideal passar UTC
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
      const formattedDate = new Intl.DateTimeFormat("pt-BR", { year: "numeric", month: "long", day: "numeric" }).format(eligibilityDate!);
      toast({ title: "Período aquisitivo não completado", description: `Você poderá solicitar férias a partir de ${formattedDate}.`, variant: "destructive" });
      return;
    }
    if (!startDate || !endDate) {
      toast({ title: "Datas obrigatórias", description: "Informe início e fim das férias.", variant: "destructive" });
      return;
    }
    if (isWeekend(startDate)) {
      toast({ title: "Início inválido", description: "As férias não podem começar em sábado ou domingo.", variant: "destructive" });
      return;
    }
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (e < s) {
      toast({ title: "Período inválido", description: "Data final deve ser após a inicial.", variant: "destructive" });
      return;
    }
    const days = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (days < 5) {
      toast({ title: "Período curto", description: "Cada período deve ter pelo menos 5 dias.", variant: "destructive" });
      return;
    }
    if (days > available) {
      toast({ title: "Saldo insuficiente", description: "Quantidade de dias solicitada excede o disponível.", variant: "destructive" });
      return;
    }
    
    const { error } = await supabase.from("vacation_requests" as any).insert({
      user_id: userId, start_date: startDate, end_date: endDate, days, status: "pending"
    });
    
    if (error) {
      toast({ title: "Erro ao solicitar", description: error.message, variant: "destructive" });
      return;
    }
    
    await supabase.functions.invoke("notify-vacation-request", { body: { userId } }).catch(() => {});
    toast({ title: "Solicitação enviada", description: "RH e gestores foram notificados." });
    setStartDate("");
    setEndDate("");
    void refetchVacations();
  };

  const handlePasswordChange = async () => {
    if (!newPassword || !confirmPassword) {
      toast({ title: "Campos obrigatórios", description: "Preencha a nova senha e confirmação.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Senhas não conferem", description: "A nova senha e a confirmação devem ser iguais.", variant: "destructive" });
      return;
    }
    const meetsPasswordRequirements =
      newPassword.length >= 8 &&
      /[A-Z]/.test(newPassword) &&
      /[a-z]/.test(newPassword) &&
      /[0-9]/.test(newPassword) &&
      /[^A-Za-z0-9]/.test(newPassword);
    if (!meetsPasswordRequirements) {
      toast({
        title: "Senha não atende aos requisitos",
        description: "Use ao menos 8 caracteres, incluindo letras maiúsculas, minúsculas, números e símbolos.",
        variant: "destructive"
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Senha alterada", description: "Sua senha foi alterada com sucesso." });
      setNewPassword("");
      setConfirmPassword("");
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (error) {
      toast({ title: "Erro ao alterar senha", description: error instanceof Error ? error.message : "Erro ao alterar a senha.", variant: "destructive" });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const resetCropState = useCallback(() => {
    setCropDialogOpen(false); setCropImage(null); setCropMeta(null); setCropScale(DEFAULT_CROP_SCALE);
    setCropPosition({ x: 0, y: 0 }); setIsCropDragging(false); cropDragStart.current = null; cropImageRef.current = null;
  }, []);

  const clampPosition = useCallback((position: { x: number; y: number }, scaleOverride?: number) => {
    if (!cropMeta) return position;
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
    if (!cropMeta) return;
    event.preventDefault(); setIsCropDragging(true);
    cropDragStart.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [cropMeta]);

  const handleCropPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isCropDragging || !cropDragStart.current) return;
    event.preventDefault();
    const deltaX = event.clientX - cropDragStart.current.x;
    const deltaY = event.clientY - cropDragStart.current.y;
    cropDragStart.current = { x: event.clientX, y: event.clientY };
    setCropPosition(prev => clampPosition({ x: prev.x + deltaX, y: prev.y + deltaY }));
  }, [clampPosition, isCropDragging]);

  const handleCropPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsCropDragging(false); cropDragStart.current = null;
  }, []);

  const handleScaleChange = useCallback((value: number[]) => {
    const newScale = value[0] ?? DEFAULT_CROP_SCALE;
    setCropScale(newScale); setCropPosition(prev => clampPosition(prev, newScale));
  }, [clampPosition]);

  const handleCropImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (!naturalWidth || !naturalHeight) return;
    const baseScale = Math.max(AVATAR_CROP_BOX_SIZE / naturalWidth, AVATAR_CROP_BOX_SIZE / naturalHeight);
    setCropMeta({ width: naturalWidth, height: naturalHeight, baseScale });
    setCropScale(DEFAULT_CROP_SCALE); setCropPosition({ x: 0, y: 0 });
  }, []);

  const uploadAvatarFile = useCallback(async (file: File) => {
    if (!user?.id) {
      toast({ title: "Usuário não encontrado", description: "Faça login novamente.", variant: "destructive" });
      return false;
    }
    setAvatarUploading(true);
    try {
      const path = buildAvatarPath(user.id, file.name);
      const { error: uploadError } = await supabase.storage.from("avatar-profile").upload(path, file, { cacheControl: "3600", upsert: true });
      if (uploadError) throw uploadError;
      
      const { data: publicData } = supabase.storage.from("avatar-profile").getPublicUrl(path);
      if (!publicData?.publicUrl) throw new Error("Não foi possível gerar a URL.");
      
      await updateProfile({ avatar_url: publicData.publicUrl });
      toast({ title: "Foto atualizada", description: "Sua foto de perfil foi atualizada com sucesso." });
      return true;
    } catch (error) {
      toast({ title: "Erro no envio", description: error instanceof Error ? error.message : "Erro desconhecido.", variant: "destructive" });
      return false;
    } finally {
      setAvatarUploading(false);
    }
  }, [toast, updateProfile, user?.id]);

  const handleConfirmCrop = useCallback(async () => {
    if (!cropImage || !cropMeta || !cropImageRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_OUTPUT_SIZE; canvas.height = AVATAR_OUTPUT_SIZE;
    const context = canvas.getContext("2d");
    if (!context) {
      toast({ title: "Erro de imagem", description: "Não foi possível processar a imagem.", variant: "destructive" });
      return;
    }
    
    const scaleMultiplier = cropMeta.baseScale * cropScale;
    const ratio = AVATAR_OUTPUT_SIZE / AVATAR_CROP_BOX_SIZE;
    const drawWidth = cropMeta.width * scaleMultiplier * ratio;
    const drawHeight = cropMeta.height * scaleMultiplier * ratio;
    const drawX = (AVATAR_OUTPUT_SIZE - drawWidth) / 2 + cropPosition.x * ratio;
    const drawY = (AVATAR_OUTPUT_SIZE - drawHeight) / 2 + cropPosition.y * ratio;
    
    const preferredMime = cropImage.file.type === "image/png" ? "image/png" : "image/jpeg";
    context.clearRect(0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
    if (preferredMime === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
    }
    context.drawImage(cropImageRef.current, drawX, drawY, drawWidth, drawHeight);
    
    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, preferredMime, preferredMime === "image/jpeg" ? 0.92 : undefined));
    if (!blob) return;
    
    const baseName = cropImage.file.name.replace(/\.[^.]+$/, "");
    const croppedFile = new File([blob], `${baseName}.${preferredMime === "image/png" ? "png" : "jpg"}`, { type: preferredMime });
    
    if (await uploadAvatarFile(croppedFile)) resetCropState();
  }, [cropImage, cropMeta, cropPosition, cropScale, resetCropState, toast, uploadAvatarFile]);

  const handleCancelCrop = useCallback(() => {
    if (!avatarUploading) resetCropState();
  }, [avatarUploading, resetCropState]);

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || avatarUploading) return;
    setCropImage({ file, url: URL.createObjectURL(file) });
    setCropDialogOpen(true); setCropMeta(null); setCropScale(DEFAULT_CROP_SCALE);
    setCropPosition({ x: 0, y: 0 }); setIsCropDragging(false);
  };

  // CORREÇÃO 2: Essa função agora extrai o 'name' do input e atualiza o estado corretamente. 
  // Isso impede que componentes recarreguem ou percam o foco.
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: name === "telefone" ? sanitizePhone(value) : value
    }));
  };

  const handleSaveEditableFields = async () => {
    try {
      const payload = {
        full_name: formState.full_name,
        display_name: formState.display_name,
        telefone: formState.telefone, // Corrigido para bater com a interface
        endereco: formState.endereco, // Corrigido para bater com a interface
        cpf: formState.cpf,
        rg: formState.rg,
        canac: formState.canac,
        birth_date: formState.birth_date,
        bank_name: formState.bank_name,
        bank_agency: formState.bank_agency,
        bank_account: formState.bank_account,
        bank_pix: formState.bank_pix
      };
      await updateProfile(payload);
      setIsEditing(false);
      toast({ title: "Dados salvos", description: "Suas informações foram atualizadas com sucesso." });
    } catch (error) {
      toast({ title: "Erro ao salvar", description: error instanceof Error ? error.message : "Erro desconhecido.", variant: "destructive" });
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p>Não foi possível carregar as informações do usuário autenticado.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Dialog open={cropDialogOpen} onOpenChange={(open) => !open && !avatarUploading && resetCropState()}>
        {/* ... Dialog de Crop inalterado ... */}
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Ajustar foto de perfil</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-6">
            <div className="flex justify-center">
              <div 
                className="relative h-64 w-64 overflow-hidden rounded-full border-2 border-primary bg-muted shadow-lg" 
                onPointerDown={handleCropPointerDown} onPointerMove={handleCropPointerMove} onPointerUp={handleCropPointerUp} onPointerCancel={handleCropPointerUp} style={{ touchAction: 'none' }}
              >
                {cropImage?.url ? (
                  <div className={`absolute inset-0 ${isCropDragging ? "cursor-grabbing" : "cursor-grab"}`}>
                    <img 
                      ref={node => { cropImageRef.current = node; }} 
                      src={cropImage.url} alt="Preview" onLoad={handleCropImageLoad} draggable={false} 
                      className="pointer-events-none absolute select-none" 
                      style={{
                        left: '50%', top: '50%',
                        width: cropMeta ? `${cropMeta.width * cropMeta.baseScale * cropScale}px` : 'auto',
                        height: cropMeta ? `${cropMeta.height * cropMeta.baseScale * cropScale}px` : 'auto',
                        transform: `translate(calc(-50% + ${cropPosition.x}px), calc(-50% + ${cropPosition.y}px))`,
                        maxWidth: 'none'
                      }} 
                    />
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <Slider min={1} max={3} step={0.01} value={[cropScale]} onValueChange={handleScaleChange} disabled={!cropMeta || avatarUploading} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelCrop} disabled={avatarUploading}>Cancelar</Button>
            <Button onClick={handleConfirmCrop} disabled={!cropMeta || avatarUploading}>
              {avatarUploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Meu Perfil</h1>
            <p className="mt-2 text-muted-foreground">Gerencie suas informações pessoais.</p>
          </div>
          {/* Botão Global de Edição */}
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button onClick={() => setIsEditing(false)} variant="outline" className="shadow-sm">
                  <X className="mr-2 h-4 w-4" /> Cancelar
                </Button>
                <Button onClick={handleSaveEditableFields} disabled={isUpdating} className="shadow-sm bg-teal-700 hover:bg-teal-600 text-white">
                  {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)} disabled={isFetching || isLoading} className="shadow-sm bg-teal-700 hover:bg-teal-600 text-white">
                <Edit className="mr-2 h-4 w-4" /> Editar
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="dados" className="w-full">
          <TabsList className={`grid w-full ${showTimeClock ? (isCrewMember ? 'grid-cols-7' : 'grid-cols-6') : (isCrewMember ? 'grid-cols-6' : 'grid-cols-5')} bg-gradient-card border border-border rounded-xl p-2 shadow-card h-auto`}>
            <TabsTrigger value="dados" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200">Dados</TabsTrigger>
            {showTimeClock && <TabsTrigger value="ponto" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200">Ponto</TabsTrigger>}
            <TabsTrigger value="documentos" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200">Docs</TabsTrigger>
            <TabsTrigger value="extrato" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200">Extrato</TabsTrigger>
            <TabsTrigger value="viagens" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200">Viagens</TabsTrigger>
            <TabsTrigger value="ferias" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200">Férias</TabsTrigger>
            <TabsTrigger value="senha" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200">Senha</TabsTrigger>
            <TabsTrigger value="aparencia" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200">Aparência</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações Básicas</CardTitle>
                <CardDescription>Atualize sua foto de perfil e detalhes pessoais.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Avatar Section */}
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <Avatar className="h-24 w-24 border-2 border-border">
                      <AvatarImage src={profile?.avatar_url || ""} />
                      <AvatarFallback className="text-2xl">{avatarInitials}</AvatarFallback>
                    </Avatar>
                    <div 
                      className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                      onClick={() => !isProfileBusy && fileInputRef.current?.click()}
                    >
                      <Camera className="h-8 w-8 text-white" />
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/jpeg,image/png" onChange={handleAvatarUpload} />
                  </div>
                  <div>
                    <h3 className="font-medium text-lg">{displayName}</h3>
                    <p className="text-sm text-muted-foreground">{primaryRole ? ROLE_LABELS[primaryRole as AppRole] : "Usuário"}</p>
                  </div>
                </div>

                {/* CORREÇÃO 3: Inputs não perdem mais o foco. A propriedade 'name' gerencia o estado e passamos onChange com referência estável. */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome Completo</Label>
                    <Input name="full_name" value={formState.full_name} onChange={handleInputChange} disabled={!isEditing} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome de Exibição (Apelido)</Label>
                    <Input name="display_name" value={formState.display_name} onChange={handleInputChange} disabled={!isEditing} />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input name="telefone" value={formState.telefone} onChange={handleInputChange} disabled={!isEditing} placeholder="Apenas números" />
                  </div>
                  <div className="space-y-2">
                    <Label>Endereço</Label>
                    <Input name="endereco" value={formState.endereco} onChange={handleInputChange} disabled={!isEditing} />
                  </div>
                  <div className="space-y-2">
                    <Label>CPF</Label>
                    <Input name="cpf" value={formState.cpf} onChange={handleInputChange} disabled={!isEditing} />
                  </div>
                  <div className="space-y-2">
                    <Label>RG</Label>
                    <Input name="rg" value={formState.rg} onChange={handleInputChange} disabled={!isEditing} />
                  </div>
                  <div className="space-y-2">
                    <Label>CANAC</Label>
                    <Input name="canac" value={formState.canac} onChange={handleInputChange} disabled={!isEditing} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data de Nascimento</Label>
                    <Input type="date" name="birth_date" value={formState.birth_date} onChange={handleInputChange} disabled={!isEditing} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dados Bancários</CardTitle>
                <CardDescription>Suas informações para recebimentos e reembolsos.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Banco</Label>
                    <Input name="bank_name" value={formState.bank_name} onChange={handleInputChange} disabled={!isEditing} />
                  </div>
                  <div className="space-y-2">
                    <Label>Agência</Label>
                    <Input name="bank_agency" value={formState.bank_agency} onChange={handleInputChange} disabled={!isEditing} />
                  </div>
                  <div className="space-y-2">
                    <Label>Conta</Label>
                    <Input name="bank_account" value={formState.bank_account} onChange={handleInputChange} disabled={!isEditing} />
                  </div>
                  <div className="space-y-2">
                    <Label>Chave PIX</Label>
                    <Input name="bank_pix" value={formState.bank_pix} onChange={handleInputChange} disabled={!isEditing} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {showTimeClock && (
            <TabsContent value="ponto" className="mt-6">
              <TimeClockTab />
            </TabsContent>
          )}

          <TabsContent value="documentos" className="mt-6">
            <EmployeeDocumentsManager userId={userId} userName={displayName} />
          </TabsContent>

          <TabsContent value="extrato" className="mt-6">
            <EmployeeBankStatement employeeId={userId} employeeName={displayName} />
          </TabsContent>

          <TabsContent value="viagens" className="mt-6">
            <TravelReportApprovalsTab userId={userId} />
          </TabsContent>

          <TabsContent value="ferias" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Solicitação de Férias</CardTitle>
                <CardDescription>Verifique seu saldo e solicite suas férias.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground">Meses Trabalhados</div>
                    <div className="text-2xl font-bold">{workingMonths}</div>
                  </div>
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground">Dias Disponíveis</div>
                    <div className="text-2xl font-bold">{available}</div>
                  </div>
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground">Dias Aprovados/Tirados</div>
                    <div className="text-2xl font-bold">{approvedTaken}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data de Início</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data de Fim</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleVacationRequest} disabled={workingMonths < 12}>Solicitar Férias</Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="aparencia" className="mt-6">
            <Card className="border-border/70 bg-card/80 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-sky-400" /> Aparência do sistema</CardTitle>
                <CardDescription>Escolha como o sistema será exibido para você.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <button type="button" onClick={() => void setTheme("light")} aria-pressed={theme === "light"} className={`group rounded-xl border p-4 text-left transition-colors ${theme === "light" ? "border-sky-500 bg-sky-500/10 ring-2 ring-sky-500/20" : "border-border/70 bg-background/40 hover:border-sky-500/50"}`}>
                    <div className="mb-4 flex items-center justify-between"><span className="flex items-center gap-2 font-semibold text-foreground"><Sun className="h-4 w-4 text-amber-500" /> Light</span>{theme === "light" && <CheckCircle className="h-4 w-4 text-sky-500" />}</div>
                    <div className="rounded-lg border border-slate-200 bg-slate-100 p-3 shadow-sm"><div className="mb-3 h-2 w-24 rounded bg-card-secondary" /><div className="grid grid-cols-3 gap-2"><div className="h-12 rounded border border-slate-200 bg-white" /><div className="h-12 rounded border border-slate-200 bg-white" /><div className="h-12 rounded border border-slate-200 bg-white" /></div><div className="mt-3 h-2 w-32 rounded bg-sky-600/70" /></div>
                    <p className="mt-3 text-xs text-muted-foreground">Fundo claro, cards brancos e contraste suave.</p>
                  </button>
                  <button type="button" onClick={() => void setTheme("dark")} aria-pressed={theme === "dark"} className={`group rounded-xl border p-4 text-left transition-colors ${theme === "dark" ? "border-sky-500 bg-sky-500/10 ring-2 ring-sky-500/20" : "border-border/70 bg-background/40 hover:border-sky-500/50"}`}>
                    <div className="mb-4 flex items-center justify-between"><span className="flex items-center gap-2 font-semibold text-foreground"><Moon className="h-4 w-4 text-sky-400" /> Dark</span>{theme === "dark" && <CheckCircle className="h-4 w-4 text-sky-400" />}</div>
                    <div className="rounded-lg border border-border bg-background p-3 shadow-sm"><div className="mb-3 h-2 w-24 rounded bg-slate-200" /><div className="grid grid-cols-3 gap-2"><div className="h-12 rounded border border-border bg-card" /><div className="h-12 rounded border border-border bg-card" /><div className="h-12 rounded border border-border bg-card" /></div><div className="mt-3 h-2 w-32 rounded bg-sky-500/70" /></div>
                    <p className="mt-3 text-xs text-muted-foreground">Fundo azul-marinho, cards escuros e azul discreto.</p>
                  </button>
                </div>
                {isThemeSaving && <p className="mt-4 text-xs text-muted-foreground">Salvando preferência...</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="senha" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Alterar senha</CardTitle>
                <CardDescription>Defina uma nova senha diretamente na sua conta autenticada.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      autoComplete="new-password"
                      className="pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((visible) => !visible)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showNewPassword ? "Ocultar nova senha" : "Mostrar nova senha"}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground">Use ao menos 8 caracteres, com maiúsculas, minúsculas, números e símbolos.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">Confirmar nova senha</Label>
                  <div className="relative">
                    <Input
                      id="confirm-new-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      className="pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((visible) => !visible)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showConfirmPassword ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handlePasswordChange} disabled={isChangingPassword || !newPassword || !confirmPassword}>
                  {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Atualizar senha
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
        </Tabs>
      </div>
    </Layout>
  );
}
