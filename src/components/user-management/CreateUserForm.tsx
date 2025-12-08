import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, UserX } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import type { AppRole } from "@/lib/roles";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Mapeamento de setor para role
const DEPARTMENT_TO_ROLE_MAP: Record<string, AppRole> = {
  "financeiro": "financeiro",
  "financeiro_master": "financeiro_master",
  "rh": "rh",
  "ctm": "operacoes",
  "tripulacao": "tripulante",
  "piloto_chefe": "piloto_chefe",
  "administrativo": "adm",
  "coordenacao_voo": "coordenador_de_voo",
};

const colaboradorSchema = z.object({
  login: z.string().optional(),
  password: z.string().optional(),
  full_name: z.string().min(2, "Nome é obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  birth_date: z.string().optional(),
  address: z.string().optional(),
  admission_date: z.string().optional(),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  canac: z.string().optional(),
  department: z.string().optional(),
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  pix: z.string().optional(),
});

const clienteSchema = z.object({
  login: z.string().min(3, "Login deve ter no mínimo 3 caracteres"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  client_id: z.string().min(1, "Selecione um cliente"),
});

type ColaboradorFormData = z.infer<typeof colaboradorSchema>;
type ClienteFormData = z.infer<typeof clienteSchema>;

export function CreateUserForm({ defaultUserType }: { defaultUserType?: "colaborador" | "cliente" }) {
  const [isLoading, setIsLoading] = useState(false);
  const [userType, setUserType] = useState<"colaborador" | "cliente">(defaultUserType || "colaborador");
  const [hasSystemAccess, setHasSystemAccess] = useState(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const colaboradorForm = useForm<ColaboradorFormData>({
    resolver: zodResolver(colaboradorSchema),
    defaultValues: {
      login: "",
      password: "",
      full_name: "",
      email: "",
      phone: "",
      birth_date: "",
      address: "",
      admission_date: "",
      cpf: "",
      rg: "",
      canac: "",
      department: "",
      banco: "",
      agencia: "",
      conta: "",
      pix: "",
    },
  });

  const clienteForm = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      login: "",
      password: "",
      client_id: "",
    },
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Erro",
          description: "Por favor, selecione um arquivo de imagem.",
          variant: "destructive",
        });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Erro",
          description: "A imagem deve ter no máximo 5MB.",
          variant: "destructive",
        });
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async (uniqueId: string): Promise<string | null> => {
    if (!avatarFile) return null;

    const fileExt = avatarFile.name.split('.').pop();
    const filePath = `${uniqueId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatar-profile')
      .upload(filePath, avatarFile, { upsert: true });

    if (uploadError) {
      console.error('Error uploading avatar:', uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatar-profile')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const onSubmitColaborador = async (data: ColaboradorFormData) => {
    // Validação adicional quando tem acesso ao sistema
    if (hasSystemAccess) {
      if (!data.login || data.login.length < 3) {
        toast({
          title: "Erro",
          description: "Login deve ter no mínimo 3 caracteres.",
          variant: "destructive",
        });
        return;
      }
      if (!data.password || data.password.length < 6) {
        toast({
          title: "Erro",
          description: "Senha deve ter no mínimo 6 caracteres.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);
    try {
      if (hasSystemAccess) {
        // COM acesso ao sistema - criar via edge function
        const email = `${data.login}@share.com`;
        const role = data.department ? DEPARTMENT_TO_ROLE_MAP[data.department] || "adm" : "adm";

        const profileData: Record<string, any> = {
          full_name: data.full_name || null,
          email: email,
          phone: data.phone || null,
          birth_date: data.birth_date || null,
          address: data.address || null,
          admission_date: data.admission_date || null,
          cpf: data.cpf || null,
          rg: data.rg || null,
          canac: data.canac || null,
          banco: data.banco || null,
          agencia: data.agencia || null,
          conta: data.conta || null,
          pix: data.pix || null,
        };

        const { data: result, error } = await supabase.functions.invoke("create-user", {
          body: {
            email,
            password: data.password,
            role: role,
            userType: "colaborador",
            profileData,
          },
        });

        if (error) throw error;

        // Upload avatar se houver
        if (avatarFile && result?.user?.id) {
          const avatarUrl = await uploadAvatar(result.user.id);
          if (avatarUrl) {
            await supabase
              .from('user_profiles')
              .update({ avatar_url: avatarUrl })
              .eq('id', result.user.id);
          }
        }

        toast({
          title: "Sucesso!",
          description: "Colaborador criado com acesso ao sistema.",
        });
      } else {
        // SEM acesso ao sistema - inserir diretamente no user_profiles
        const newId = crypto.randomUUID();

        const { error } = await supabase
          .from('user_profiles')
          .insert({
            id: newId,
            full_name: data.full_name,
            email: data.email || null,
            phone: data.phone || null,
            birth_date: data.birth_date || null,
            address: data.address || null,
            admission_date: data.admission_date || null,
            cpf: data.cpf || null,
            rg: data.rg || null,
            canac: data.canac || null,
            banco: data.banco || null,
            agencia: data.agencia || null,
            conta: data.conta || null,
            pix: data.pix || null,
          });

        if (error) throw error;

        // Upload avatar se houver
        if (avatarFile) {
          const avatarUrl = await uploadAvatar(newId);
          if (avatarUrl) {
            await supabase
              .from('user_profiles')
              .update({ avatar_url: avatarUrl })
              .eq('id', newId);
          }
        }

        toast({
          title: "Sucesso!",
          description: "Funcionário cadastrado (sem acesso ao sistema).",
        });
      }

      colaboradorForm.reset();
      setAvatarFile(null);
      setAvatarPreview("");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["all-users-combined"] });
    } catch (error: any) {
      console.error("Error creating user:", error);
      const errorMessage = error?.message || error?.toString?.() || "Erro desconhecido ao criar colaborador.";
      toast({
        title: "Erro ao criar colaborador",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitCliente = async (data: ClienteFormData) => {
    setIsLoading(true);
    try {
      const email = `${data.login}@share.com`;

      const { data: result, error } = await supabase.functions.invoke("create-user", {
        body: {
          email,
          password: data.password,
          role: "cliente",
          userType: "cliente",
          clientId: data.client_id,
        },
      });

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Cliente criado com sucesso.",
      });

      clienteForm.reset();
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["all-users-combined"] });
    } catch (error: any) {
      console.error("Error creating user:", error);
      const errorMessage = error?.message || error?.toString?.() || "Erro desconhecido ao criar cliente.";
      toast({
        title: "Erro ao criar cliente",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Criar Novo Usuário</CardTitle>
        <CardDescription>
          Preencha os dados abaixo para cadastrar um novo colaborador ou cliente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={userType} onValueChange={(v) => setUserType(v as "colaborador" | "cliente")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="colaborador" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Colaborador
            </TabsTrigger>
            <TabsTrigger value="cliente" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Cliente
            </TabsTrigger>
          </TabsList>

          <TabsContent value="colaborador" className="mt-6">
            <Form {...colaboradorForm}>
              <form onSubmit={colaboradorForm.handleSubmit(onSubmitColaborador)} className="space-y-6">
                {/* Toggle de Acesso ao Sistema */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    {hasSystemAccess ? (
                      <User className="h-5 w-5 text-primary" />
                    ) : (
                      <UserX className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <Label htmlFor="system-access" className="text-base font-medium">
                        Acesso ao Sistema
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {hasSystemAccess
                          ? "Colaborador poderá fazer login"
                          : "Apenas cadastro (sem login)"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="system-access"
                    checked={hasSystemAccess}
                    onCheckedChange={setHasSystemAccess}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Dados de Acesso - Apenas quando tem acesso */}
                  {hasSystemAccess && (
                    <div className="md:col-span-2 space-y-4">
                      <h3 className="text-lg font-semibold text-foreground">Dados de Acesso *</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={colaboradorForm.control}
                          name="login"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Login *</FormLabel>
                              <FormControl>
                                <div className="flex items-center border border-input rounded-md bg-background overflow-hidden">
                                  <input
                                    type="text"
                                    className="flex-1 px-3 py-2 bg-transparent outline-none"
                                    value={field.value}
                                    onChange={(e) => field.onChange(e.target.value.replace("@share.com", ""))}
                                  />
                                  <div className="px-3 py-2 bg-muted text-muted-foreground font-semibold whitespace-nowrap border-l border-input">
                                    @share
                                  </div>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={colaboradorForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Senha *</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="******" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {/* Foto de Perfil */}
                  <div className="md:col-span-2 space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Foto de Perfil</h3>
                    <div className="flex items-center gap-4">
                      <Avatar className="h-24 w-24">
                        <AvatarImage src={avatarPreview} />
                        <AvatarFallback>
                          <User className="h-12 w-12 text-muted-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarChange}
                          className="cursor-pointer"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          PNG, JPG até 5MB
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Dados Pessoais */}
                  <div className="md:col-span-2 space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">
                      Dados Pessoais {!hasSystemAccess && "*"}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={colaboradorForm.control}
                        name="full_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome Completo *</FormLabel>
                            <FormControl>
                              <Input placeholder="João Silva" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={colaboradorForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <Input placeholder="(11) 99999-9999" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={colaboradorForm.control}
                        name="birth_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data de Nascimento</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={colaboradorForm.control}
                        name="cpf"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF</FormLabel>
                            <FormControl>
                              <Input placeholder="000.000.000-00" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={colaboradorForm.control}
                        name="rg"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>RG</FormLabel>
                            <FormControl>
                              <Input placeholder="00.000.000-0" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={colaboradorForm.control}
                        name="canac"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CANAC</FormLabel>
                            <FormControl>
                              <Input placeholder="000000" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={colaboradorForm.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Endereço</FormLabel>
                            <FormControl>
                              <Input placeholder="Rua, Número, Bairro, Cidade - UF" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Dados da Empresa */}
                  <div className="md:col-span-2 space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Dados da Empresa</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={colaboradorForm.control}
                        name="department"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Setor</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o setor" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="financeiro">Setor Financeiro</SelectItem>
                                <SelectItem value="financeiro_master">Setor Financeiro Master</SelectItem>
                                <SelectItem value="rh">Setor RH</SelectItem>
                                <SelectItem value="ctm">Setor CTM</SelectItem>
                                <SelectItem value="tripulacao">Setor Tripulação</SelectItem>
                                <SelectItem value="piloto_chefe">Setor Piloto Chefe</SelectItem>
                                <SelectItem value="administrativo">Setor Administrativo</SelectItem>
                                <SelectItem value="coordenacao_voo">Setor Coordenação de Voo</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={colaboradorForm.control}
                        name="admission_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data de Admissão</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Dados Bancários */}
                  <div className="md:col-span-2 space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Dados Bancários</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={colaboradorForm.control}
                        name="banco"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Banco</FormLabel>
                            <FormControl>
                              <Input placeholder="Banco do Brasil" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={colaboradorForm.control}
                        name="agencia"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Agência</FormLabel>
                            <FormControl>
                              <Input placeholder="0001" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={colaboradorForm.control}
                        name="conta"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Conta</FormLabel>
                            <FormControl>
                              <Input placeholder="12345-6" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={colaboradorForm.control}
                        name="pix"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Chave PIX</FormLabel>
                            <FormControl>
                              <Input placeholder="email@exemplo.com ou CPF" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    hasSystemAccess ? "Criar Colaborador" : "Cadastrar Funcionário"
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="cliente" className="mt-6">
            <ClientForm
              form={clienteForm}
              onSubmit={clienteForm.handleSubmit(onSubmitCliente)}
              isLoading={isLoading}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ClientForm({
  form,
  onSubmit,
  isLoading
}: {
  form: ReturnType<typeof useForm<ClienteFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}) {
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("status", "ativo")
        .order("company_name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Dados de Acesso *</h3>

          <FormField
            control={form.control}
            name="client_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cliente *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="login"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Login *</FormLabel>
                <FormControl>
                  <Input placeholder="usuario" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Senha *</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="******" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Criando...
            </>
          ) : (
            "Criar Cliente"
          )}
        </Button>
      </form>
    </Form>
  );
}