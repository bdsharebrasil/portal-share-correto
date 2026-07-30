// @ts-nocheck
import { useState, useRef, ChangeEvent, useEffect, useCallback, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { formatDateToBR } from "@/lib/date-utils";
import { GestaoSalariosContent } from "./GestaoSalarios";
import { Suspense } from "react";
import { TimeEntriesTable } from "@/components/ponto/TimeEntriesTable";
import { DocumentUploadWidget } from "@/components/profile/DocumentUploadWidget";
import { ThirteenthSalaryManager } from "@/components/vencimentos/ThirteenthSalaryManager";
import { VacationManagement } from "@/components/Ferias/VacationManagement";
import { EmployeeVacationTab } from "@/components/Ferias/EmployeeVacationTab";
import { Users, FileText, Calendar, Building, Phone, Mail, CreditCard, DollarSign, User as UserIcon, Edit, Save, X, Aperture, Upload, Camera, Trash2, Clock, Palmtree, Search, Receipt } from "lucide-react";
import EmployeeBankStatement from "@/components/profile/ExtratoBancarioFuncionario";
import { APP_ROLE_VALUES, ROLE_LABELS, type AppRole } from "@/lib/roles";
import { formatRoleLabel } from "@/lib/roles";
interface CrewMemberData {
  id: string;
  canac: string;
  avatar_url: string | null;
  status: string;
}
interface Employee {
  id: string;
  email: string;
  full_name: string;
  display_name: string | null;
  cpf: string | null;
  rg: string | null;
  birth_date: string | null;
  phone: string | null;
  address: string | null;
  admission_date: string | null;
  canac: string | null;
  salary: string | null;
  benefits: string | null;
  employment_status: string;
  is_authenticated_user: boolean;
  bank_data: any;
  roles: AppRole[];
  crew_data: CrewMemberData | null;
  photo_url: string | null;
}
type EditEmployeeForm = Omit<Employee, 'id' | 'is_authenticated_user' | 'bank_data' | 'roles' | 'crew_data'> & {
  role: AppRole;
  new_photo_file?: File | null;
  delete_current_photo?: boolean;
};

// Mostrar apenas perfis cujo campo `tipo` é 'colaborador'

const AVATAR_BUCKET = 'avatar-profile';
const EditEmployeeFormComponent = memo(({
  editEmployeeForm,
  selectedEmployee,
  onFieldChange,
  onSave,
  updateEmployeeMutation,
  setIsEditing
}: {
  editEmployeeForm: EditEmployeeForm | null;
  selectedEmployee: Employee | null;
  onFieldChange: (field: keyof EditEmployeeForm, value: string | File | null | boolean) => void;
  onSave: () => void;
  updateEmployeeMutation: any;
  setIsEditing: (value: boolean) => void;
}) => {
  if (!editEmployeeForm || !selectedEmployee) return null;
  return <div className="pr-4 max-h-none">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 flex flex-col items-center">
          <div className="space-y-4 w-full">
            <div>
              <h3 className="text-foreground font-semibold mb-4 text-center">Foto de Perfil</h3>
              <div className="flex flex-col items-center gap-4">
                <Avatar className="h-28 w-28 border-4 border-primary/30 shadow-xl">
                  <AvatarImage src={editEmployeeForm.photo_url || undefined} alt={selectedEmployee.full_name} />
                  <AvatarFallback className="text-4xl text-primary bg-primary/10">
                    {selectedEmployee.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="col-span-full space-y-2">
            <Label htmlFor="edit_full_name" className="text-muted-foreground font-medium">Nome Completo <span className="text-destructive">*</span></Label>
            <Input id="edit_full_name" value={editEmployeeForm.full_name} onChange={e => onFieldChange("full_name", e.target.value)} placeholder="Nome completo do funcionário" className="h-11 rounded-xl w-full" />
          </div>
          <div className="col-span-full space-y-2">
            <Label htmlFor="edit_email" className="text-muted-foreground font-medium">Email <span className="text-destructive">*</span></Label>
            <Input id="edit_email" type="email" value={editEmployeeForm.email} onChange={e => onFieldChange("email", e.target.value)} placeholder="email@example.com" className="h-11 rounded-xl w-full" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_cpf" className="text-muted-foreground font-medium">CPF</Label>
            <Input id="edit_cpf" value={editEmployeeForm.cpf || ""} onChange={e => onFieldChange("cpf", e.target.value)} placeholder="XXX.XXX.XXX-XX" className="h-11 rounded-xl w-full" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_rg" className="text-muted-foreground font-medium">RG</Label>
            <Input id="edit_rg" value={editEmployeeForm.rg || ""} onChange={e => onFieldChange("rg", e.target.value)} placeholder="X.XXX.XXX" className="h-11 rounded-xl w-full" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_canac" className="text-muted-foreground font-medium">CANAC</Label>
            <Input id="edit_canac" value={editEmployeeForm.canac || ""} onChange={e => onFieldChange("canac", e.target.value)} placeholder="Número CANAC" className="h-11 rounded-xl w-full" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_birth_date" className="text-muted-foreground font-medium">Data de Nascimento</Label>
            <Input id="edit_birth_date" type="data" value={editEmployeeForm.birth_date || ""} onChange={e => onFieldChange("birth_date", e.target.value)} className="h-11 rounded-xl w-full" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_phone" className="text-muted-foreground font-medium">Telefone</Label>
            <Input id="edit_phone" value={editEmployeeForm.phone || ""} onChange={e => onFieldChange("phone", e.target.value)} placeholder="(XX) XXXX-XXXX" className="h-11 rounded-xl w-full" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_admission_date" className="text-muted-foreground font-medium">Data de Admissão</Label>
            <Input id="edit_admission_date" type="data" value={editEmployeeForm.admission_date || ""} onChange={e => onFieldChange("admission_date", e.target.value)} className="h-11 rounded-xl w-full" />
          </div>
          <div className="col-span-full space-y-2">
            <Label htmlFor="edit_address" className="text-muted-foreground font-medium">Endereço</Label>
            <Input id="edit_address" value={editEmployeeForm.endereco || ""} onChange={e => onFieldChange("endereco", e.target.value)} placeholder="Rua, Número, Bairro, Cidade - Estado" className="h-11 rounded-xl w-full" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_salary" className="text-muted-foreground font-medium">Salário (Base)</Label>
            <Input id="edit_salary" type="number" step="0.01" value={editEmployeeForm.salary || ""} onChange={e => onFieldChange("salary", e.target.value)} placeholder="R$ 0.00" className="h-11 rounded-xl w-full" />
          </div>
          <div className="col-span-full space-y-2">
            <Label htmlFor="edit_benefits" className="text-muted-foreground font-medium">Benefícios</Label>
            <Input id="edit_benefits" value={editEmployeeForm.benefits || ""} onChange={e => onFieldChange("benefits", e.target.value)} placeholder="Plano de saúde, vale alimentação..." className="h-11 rounded-xl w-full" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_role" className="text-muted-foreground font-medium">Função</Label>
            <Select value={editEmployeeForm.role} onValueChange={value => onFieldChange("role", value)}>
              <SelectTrigger className="h-11 rounded-xl w-full"><SelectValue placeholder="Selecione uma função" /></SelectTrigger>
              <SelectContent className="rounded-xl">
                {APP_ROLE_VALUES.map(role => <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_employment_status" className="text-muted-foreground font-medium">Status</Label>
            <Select value={editEmployeeForm.employment_status} onValueChange={value => onFieldChange("employment_status", value)}>
              <SelectTrigger className="h-11 rounded-xl w-full"><SelectValue placeholder="Selecione um status" /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
                <SelectItem value="ferias">Férias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-8 border-t border-border mt-8">
        <Button onClick={onSave} disabled={updateEmployeeMutation.isPending || !editEmployeeForm.full_name || !editEmployeeForm.email} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 h-11 rounded-xl">
          <Save className="mr-2 h-4 w-4" />
          {updateEmployeeMutation.isPending ? "Salvando..." : "Salvar Alterações"}
        </Button>
        <Button variant="outline" onClick={() => setIsEditing(false)} className="h-11 px-6 rounded-xl">
          <X className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
      </div>
    </div>;
});
EditEmployeeFormComponent.displayName = "EditEmployeeFormComponent";
export default function GestaoFuncionarios() {
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();
  const {
    isAdmin,
    isFinanceiroMaster,
    isGestorMaster
  } = useUserRole();
  const canManage = isAdmin || isFinanceiroMaster || isGestorMaster;
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editEmployeeForm, setEditEmployeeForm] = useState<EditEmployeeForm | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const handleSelectEmployee = useCallback((employee: Employee) => {
    setSelectedEmployee(employee);
    setIsEditing(false);
  }, []);
  const startEditing = useCallback(() => {
    if (selectedEmployee) {
      setIsEditing(true);
      setEditEmployeeForm({
        full_name: selectedEmployee.full_name,
        email: selectedEmployee.email,
        display_name: selectedEmployee.display_name || selectedEmployee.full_name,
        cpf: selectedEmployee.cpf || "",
        rg: selectedEmployee.rg || "",
        canac: selectedEmployee.canac || "",
        birth_date: selectedEmployee.birth_date || "",
        phone: selectedEmployee.telefone || "",
        address: selectedEmployee.endereco || "",
        admission_date: selectedEmployee.admission_date || "",
        salary: selectedEmployee.salary || "",
        benefits: selectedEmployee.benefits || "",
        employment_status: selectedEmployee.employment_status,
        role: selectedEmployee.roles.length > 0 ? selectedEmployee.roles[0] : 'tripulante',
        photo_url: selectedEmployee.photo_url || null,
        new_photo_file: null,
        delete_current_photo: false
      });
    }
  }, [selectedEmployee]);
  const handleFieldChange = useCallback((field: keyof EditEmployeeForm, value: string | File | null | boolean) => {
    setEditEmployeeForm(prev => {
      if (!prev) return null;
      if (field === 'new_photo_file' && value instanceof File) {
        return {
          ...prev,
          new_photo_file: value,
          delete_current_photo: false
        };
      }
      if (field === 'delete_current_photo' && value === true) {
        return {
          ...prev,
          delete_current_photo: true,
          new_photo_file: null
        };
      }
      if (typeof value === 'string' || value === null) {
        return {
          ...prev,
          [field]: value
        };
      }
      return prev;
    });
  }, []);
  const {
    data: employees = [],
    isLoading
  } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const {
        data: profiles,
        error: profilesError
      } = await supabase.from("user_profiles").select("*").order("full_name", {
        ascending: true
      });
      if (profilesError) throw profilesError;
      const profilesWithRolesPromises = (profiles || []).map(async profile => {
        const {
          data: rolesData
        } = await supabase.from("user_roles").select("role").eq("user_id", profile.id);
        const roles = rolesData?.map(r => r.role).filter(Boolean) || [];
        const isCrewMemberRole = roles.includes('tripulante') || roles.includes('piloto_chefe');
        let crewData: CrewMemberData | null = null;
        if (isCrewMemberRole) {
          const {
            data: crewMember,
            error: crewError
          } = await supabase.from("membros_tripulacao").select("id, status, canac").eq("usuario_id", profile.id).single();
          if (crewError && crewError.code !== 'PGRST116') {
            console.error("Erro ao buscar crew member para", profile.full_name, "-", crewError.message || crewError);
          }
          if (crewMember) {
            crewData = {
              id: (crewMember as any).id,
              canac: (crewMember as any).canac,
              avatar_url: null,
              status: (crewMember as any).status || 'active'
            };
          }
        }
        let latestSalary: string | null = null;
        let latestBenefits: string | null = null;
        const {
          data: salaryData
        } = await supabase.from("salaries").select("base_salary_bruto, benefit").eq("user_profile", profile.id).order("effective_date", {
          ascending: false
        }).limit(1);
        if (salaryData && salaryData.length > 0) {
          latestSalary = salaryData[0].base_salary_bruto ? salaryData[0].base_salary_bruto.toString() : null;
          latestBenefits = salaryData[0].benefit;
        }
        return {
          id: profile.id,
          email: profile.email || '',
          full_name: profile.full_name,
          display_name: profile.display_name,
          cpf: profile.cpf,
          rg: profile.rg,
          canac: profile.canac,
          birth_date: profile.birth_date,
          phone: profile.telefone,
          address: profile.endereco,
          admission_date: profile.admission_date || null,
          salary: latestSalary,
          benefits: latestBenefits,
          employment_status: profile.employment_status || 'ativo',
          is_authenticated_user: false,
          bank_data: null,
          roles: roles,
          tipo: (profile as any).tipo || null,
          crew_data: crewData,
          photo_url: (profile as any).avatar_url
        } as Employee;
      });
      const employeesWithRoles = await Promise.all(profilesWithRolesPromises);

      // Filtrar pelos perfis cujo campo `tipo` é 'colaborador'
      return employeesWithRoles.filter(employee => (employee as any).tipo === 'colaborador');
    },
    enabled: canManage
  });
  const filteredEmployees = employees.filter(emp => emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || emp.email.toLowerCase().includes(searchTerm.toLowerCase()));
  const updateEmployeeMutation = useMutation({
    mutationFn: async (updatedData: EditEmployeeForm) => {
      if (!selectedEmployee) throw new Error("Nenhum funcionário selecionado para edição.");
      const {
        id: employeeId
      } = selectedEmployee;
      let newPhotoUrl = updatedData.photo_url;
      if (updatedData.delete_current_photo && selectedEmployee.photo_url) {
        const pathSegment = `/${AVATAR_BUCKET}/`;
        const filePath = selectedEmployee.photo_url.split(pathSegment)[1];
        if (filePath) {
          await supabase.storage.from(AVATAR_BUCKET).remove([filePath]);
        }
        newPhotoUrl = null;
      }
      if (updatedData.new_photo_file) {
        const file = updatedData.new_photo_file;
        const fileExt = file.nome.split('.').pop();
        const fileName = `${employeeId}_${Date.now()}.${fileExt}`;
        const filePath = `${employeeId}/${fileName}`;
        const {
          error: uploadError
        } = await supabase.storage.from(AVATAR_BUCKET).upload(filePath, file, {
          upsert: true
        });
        if (uploadError) throw uploadError;
        const {
          data: publicUrl
        } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
        newPhotoUrl = publicUrl.publicUrl;
      }
      const {
        error: profileUpdateError
      } = await supabase.from("user_profiles").update({
        full_name: updatedData.full_name,
        display_name: updatedData.full_name,
        email: updatedData.email,
        cpf: updatedData.cpf || null,
        rg: updatedData.rg || null,
        canac: updatedData.canac || null,
        birth_date: updatedData.birth_date || null,
        phone: updatedData.telefone || null,
        address: updatedData.endereco || null,
        admission_date: updatedData.admission_date || null,
        employment_status: updatedData.employment_status,
        avatar_url: newPhotoUrl
      }).eq("id", employeeId);
      if (profileUpdateError) throw profileUpdateError;
      if (updatedData.salary !== selectedEmployee.salary || updatedData.benefits !== selectedEmployee.benefits) {
        const {
          error: salaryUpdateError
        } = await supabase.from("salaries").upsert([{
          user_profile: employeeId,
          base_salary_liquid: updatedData.salary ? parseFloat(updatedData.salary.toString()) : 0.00,
          benefit: updatedData.benefits || null,
          effective_date: new Date().toISOString().split('T')[0]
        } as any]);
        if (salaryUpdateError) console.error("Erro ao atualizar salário/benefício:", salaryUpdateError);
      }
      return employeeId;
    },
    onSuccess: () => {
      toast({
        title: "Perfil de funcionário atualizado com sucesso!"
      });
      queryClient.invalidateQueries({
        queryKey: ["employees"]
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar funcionário",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  const handleFormSave = useCallback(() => {
    if (!editEmployeeForm) return;
    updateEmployeeMutation.mutate(editEmployeeForm);
  }, [editEmployeeForm, updateEmployeeMutation]);
  if (!canManage) {
    return <Layout>
        <div className="p-8">
          <Card className="shadow-lg border-destructive/50 rounded-2xl">
            <CardContent className="pt-6 text-center text-lg text-muted-foreground">
              <p>Você não tem permissão para acessar esta página.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>;
  }
  const DetailItem = ({
    label,
    value,
    icon,
    fullWidth = false
  }: {
    label: string;
    value: string | null;
    icon?: React.ReactNode;
    fullWidth?: boolean;
  }) => <div className={`${fullWidth ? "col-span-full" : ""} bg-muted/30 rounded-xl p-4`}>
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-2">{label}</Label>
      <div className="flex items-center gap-2 text-base font-semibold text-foreground">
        {icon && <span className="text-primary">{icon}</span>}
        <p>{value || "Não informado"}</p>
      </div>
    </div>;
  const EmployeeDetails = () => {
    if (!selectedEmployee) return null;
    if (isEditing) {
      return <>
          <CardHeader className="pb-4 border-b border-border">
            <CardTitle className="text-2xl font-bold text-foreground">Editar Perfil</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <EditEmployeeFormComponent editEmployeeForm={editEmployeeForm} selectedEmployee={selectedEmployee} onFieldChange={handleFieldChange} onSave={handleFormSave} updateEmployeeMutation={updateEmployeeMutation} setIsEditing={setIsEditing} />
          </CardContent>
        </>;
    }
    return <>
        <CardHeader className="pb-6 border-b border-border">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <Avatar className="h-24 w-24 border-4 border-primary/20 shadow-xl">
                <AvatarImage src={selectedEmployee.photo_url || undefined} alt={selectedEmployee.full_name} />
                <AvatarFallback className="text-3xl bg-primary/10 text-primary font-bold">
                  {selectedEmployee.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-bold text-foreground leading-tight">{selectedEmployee.full_name}</h2>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-muted/20 text-muted-foreground border border-border">
                    {selectedEmployee.canac || selectedEmployee.id.slice(0, 6)}
                  </span>
                </div>
                <p className="text-base text-muted-foreground flex items-center gap-2 mt-1">
                  <Mail className="h-4 w-4 text-primary" />
                  {selectedEmployee.email}
                </p>
                {selectedEmployee.roles.length > 0 && <Badge className="mt-3 px-4 py-1.5 text-sm bg-primary/10 text-primary border-primary/20 rounded-full">
                    {formatRoleLabel(selectedEmployee.roles[0])}
                  </Badge>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {selectedEmployee.employment_status !== 'ativo'}
              <Button variant="outline" size="icon" onClick={startEditing} title="Editar Perfil" className="rounded-xl h-11 w-11">
                <Edit className="h-5 w-5 text-primary" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-4 max-w-lg mx-auto mb-6 rounded-2xl p-1.5 h-auto bg-transparent border-2 border-border">
              <TabsTrigger value="info" className="py-3 text-sm font-medium rounded-xl border-2 border-transparent data-[state=inactive]:bg-muted/10 data-[state=inactive]:shadow-sm data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:shadow-sm">Informações</TabsTrigger>
              <TabsTrigger value="documentos" className="py-3 text-sm font-medium rounded-xl border-2 border-transparent data-[state=inactive]:bg-muted/10 data-[state=inactive]:shadow-sm data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:shadow-sm">Documentos</TabsTrigger>
              <TabsTrigger value="vacation" className="py-3 text-sm font-medium rounded-xl border-2 border-transparent data-[state=inactive]:bg-muted/10 data-[state=inactive]:shadow-sm data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:shadow-sm">Férias</TabsTrigger>
              <TabsTrigger value="statement" className="py-3 text-sm font-medium rounded-xl border-2 border-transparent data-[state=inactive]:bg-muted/10 data-[state=inactive]:shadow-sm data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:shadow-sm">Extrato</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-6 mt-0">
              {/* Dados Pessoais */}
              <div className="border-2 border-border rounded-xl p-6 bg-muted/20 space-y-4">
                <h3 className="font-bold text-lg flex items-center gap-2 text-foreground">
                  <UserIcon className="h-5 w-5 text-primary" />
                  Dados Pessoais
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <DetailItem label="CPF" value={selectedEmployee.cpf} icon={<CreditCard className="h-4 w-4" />} />
                  <DetailItem label="RG" value={selectedEmployee.rg} icon={<CreditCard className="h-4 w-4" />} />
                  <DetailItem label="CANAC" value={selectedEmployee.canac} icon={<Aperture className="h-4 w-4" />} />
                  <DetailItem label="Data de Nascimento" value={selectedEmployee.birth_date ? formatDateToBR(selectedEmployee.birth_date) : null} icon={<Calendar className="h-4 w-4" />} />
                  <DetailItem label="Telefone" value={selectedEmployee.telefone} icon={<Phone className="h-4 w-4" />} />
                  <DetailItem label="Endereço" value={selectedEmployee.endereco} icon={<Building className="h-4 w-4" />} fullWidth />
                </div>
              </div>

              {/* Informações Profissionais */}
              <div className="border-2 border-border rounded-xl p-6 bg-muted/20 space-y-4">
                <h3 className="font-bold text-lg flex items-center gap-2 text-foreground">
                  <Building className="h-5 w-5 text-primary" />
                  Informações Profissionais
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <DetailItem label="Data de Admissão" value={selectedEmployee.admission_date ? formatDateToBR(selectedEmployee.admission_date) : null} icon={<Calendar className="h-4 w-4" />} />
                  <DetailItem label="Salário Base" value={selectedEmployee.salary ? `R$ ${parseFloat(selectedEmployee.salary).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2
                })}` : 'Não registrado'} icon={<DollarSign className="h-4 w-4" />} />
                  <DetailItem label="Benefícios" value={selectedEmployee.benefits} fullWidth />
                </div>
              </div>

              {/* Dados Bancários */}
              <div className="border-2 border-border rounded-xl p-6 bg-muted/20 space-y-4">
                <h3 className="font-bold text-lg flex items-center gap-2 text-foreground">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Dados Bancários
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <DetailItem label="Banco" value={selectedEmployee.bank_data?.bank} />
                  <DetailItem label="Agência" value={selectedEmployee.bank_data?.agency} />
                  <DetailItem label="Conta" value={selectedEmployee.bank_data?.account} />
                  <DetailItem label="PIX" value={selectedEmployee.bank_data?.pix} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="documentos" className="min-h-[400px] mt-0">
              <DocumentUploadWidget employeeId={selectedEmployee.id} employeeName={selectedEmployee.full_name} />
            </TabsContent>

            <TabsContent value="vacation" className="min-h-[400px] mt-0">
              <EmployeeVacationTab employeeId={selectedEmployee.id} employeeName={selectedEmployee.full_name} />
            </TabsContent>

            <TabsContent value="statement" className="min-h-[400px] mt-0">
              <EmployeeBankStatement employeeId={selectedEmployee.id} employeeName={selectedEmployee.full_name} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </>;
  };
  return <Layout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-8">
        <Tabs defaultValue="funcionarios" className="space-y-8">
          {/* Header */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-foreground leading-tight">Gestão de Funcionários</h1>
              <p className="text-base lg:text-lg text-muted-foreground mt-2">Gerencie perfis, informações e documentos dos colaboradores</p>
            </div>
          </div>

          {/* Navegação de Tabs */}
          <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-2 border border-border/50 shadow-sm">
            <TabsList className={`grid ${isAdmin || isGestorMaster ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-4'} gap-2 w-full bg-transparent p-0 border-2 border-border rounded-lg`}>
              <TabsTrigger value="funcionarios" className="py-3.5 px-4 text-sm font-medium rounded-xl border-2 border-transparent transition-all duration-200
                  data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/50
                  data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:border-blue-500 data-[state=active]:ring-2 data-[state=active]:ring-blue-400 data-[state=active]:ring-offset-2 data-[state=active]:ring-offset-background">
                <Users className="w-4 h-4 mr-2" />
                Funcionários
              </TabsTrigger>
              <TabsTrigger value="salarios" className="py-3.5 px-4 text-sm font-medium rounded-xl border-2 border-transparent transition-all duration-200
                  data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/50
                  data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:border-blue-500 data-[state=active]:ring-2 data-[state=active]:ring-blue-400 data-[state=active]:ring-offset-2 data-[state=active]:ring-offset-background">
                <DollarSign className="w-4 h-4 mr-2" />
                Salários
              </TabsTrigger>
              <TabsTrigger value="decimo" className="py-3.5 px-4 text-sm font-medium rounded-xl border-2 border-transparent transition-all duration-200
                  data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/50
                  data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:border-emerald-500 data-[state=active]:ring-2 data-[state=active]:ring-emerald-400 data-[state=active]:ring-offset-2 data-[state=active]:ring-offset-background">
                <DollarSign className="w-4 h-4 mr-2" />
                13º Salário
              </TabsTrigger>
              <TabsTrigger value="ferias" className="py-3.5 px-4 text-sm font-medium rounded-xl border-2 border-transparent transition-all duration-200
                  data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/50
                  data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:border-blue-500 data-[state=active]:ring-2 data-[state=active]:ring-blue-400 data-[state=active]:ring-offset-2 data-[state=active]:ring-offset-background">
                <Palmtree className="w-4 h-4 mr-2" />
                Férias
              </TabsTrigger>
              {(isAdmin || isGestorMaster) && <TabsTrigger value="ponto" className="py-3.5 px-4 text-sm font-medium rounded-xl border-2 border-transparent transition-all duration-200
                    data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/50
                    data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:border-indigo-900 data-[state=active]:ring-2 data-[state=active]:ring-violet-400 data-[state=active]:ring-offset-2 data-[state=active]:ring-offset-background">
                  <Clock className="w-4 h-4 mr-2" />
                  Ponto
                </TabsTrigger>}
            </TabsList>
          </div>

          <TabsContent value="funcionarios" className="space-y-6 mt-0">
            {/* Search and Employees Grid */}
            <Card className="shadow-lg border-border/50 rounded-2xl overflow-hidden">
              <CardHeader className="pb-4 border-b border-border bg-muted/30">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                    <Users className="h-5 w-5 text-primary" />
                    Colaboradores ({filteredEmployees.length})
                  </CardTitle>
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar funcionário..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-11 rounded-xl" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {isLoading ? <p className="text-center text-muted-foreground py-8">Carregando lista de funcionários...</p> : filteredEmployees.length === 0 ? <p className="text-center text-muted-foreground py-8">Nenhum funcionário encontrado.</p> : <div className="space-y-4">
                    <div>
                      <Label htmlFor="employee-select" className="text-muted-foreground font-medium mb-2 block">Selecione um colaborador</Label>
                      <Select value={selectedEmployee?.id || ""} onValueChange={employeeId => {
                    const employee = filteredEmployees.find(e => e.id === employeeId);
                    if (employee) {
                      handleSelectEmployee(employee);
                    }
                  }}>
                        <SelectTrigger id="employee-select" className="h-11 rounded-xl">
                          <SelectValue placeholder="Escolha um colaborador..." />
                        </SelectTrigger>
                        <SelectContent side="bottom" className="rounded-xl max-h-64">
                          {filteredEmployees.map(employee => <SelectItem key={employee.id} value={employee.id}>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-6 w-6 border border-primary/20">
                                  <AvatarImage src={employee.photo_url || undefined} alt={employee.full_name} />
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                    {employee.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                  <span className="font-semibold">{employee.full_name}</span>
                                  <span className="text-xs text-muted-foreground">{employee.email}</span>
                                </div>
                              </div>
                            </SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>}
              </CardContent>
            </Card>

            {/* Employee Details Panel */}
            <Card className="shadow-lg border-border/50 rounded-2xl min-h-[500px]">
              {selectedEmployee ? <EmployeeDetails /> : <div className="flex items-center justify-center min-h-[500px] animate-fade-in">
                  <div className="text-center space-y-4 text-muted-foreground max-w-sm p-8">
                    <div className="bg-primary/10 rounded-full p-6 w-fit mx-auto">
                      <Users className="h-12 w-12 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground">Nenhum funcionário selecionado</h3>
                    <p className="text-sm">Selecione um funcionário na lista acima para visualizar seus detalhes e editar seu perfil.</p>
                  </div>
                </div>}
            </Card>
          </TabsContent>

          <TabsContent value="salarios" className="mt-0">
            <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-200px)]"><p className="text-muted-foreground">Carregando Gestão de Salários...</p></div>}>
              <GestaoSalariosContent />
            </Suspense>
          </TabsContent>

          <TabsContent value="decimo" className="mt-0">
            <ThirteenthSalaryManager />
          </TabsContent>

          <TabsContent value="ferias" className="mt-0">
            <VacationManagement />
          </TabsContent>

          {(isAdmin || isGestorMaster) && <TabsContent value="ponto" className="space-y-6 mt-0">
              <Card className="shadow-lg border-border/50 rounded-2xl">
                <CardHeader className="pb-4 border-b border-border bg-muted/30">
                  <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                    <Clock className="h-5 w-5 text-primary" />
                    Registro de Ponto
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <TimeEntriesTable viewAll={true} />
                </CardContent>
              </Card>
            </TabsContent>}
        </Tabs>
      </div>
    </Layout>;
}
