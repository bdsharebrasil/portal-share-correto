import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, Users } from "lucide-react";
import { CreateUserForm } from "@/components/user-management/CreateUserForm";
import { UsersList } from "@/components/user-management/UsersList";
import { useUserRole } from "@/hooks/useUserRole";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
const GerenciarUsuarios = () => {
  const {
    isAdmin,
    isGestorMaster,
    isLoading
  } = useUserRole();
  const [activeTab, setActiveTab] = useState("list");
  const [createUserType, setCreateUserType] = useState<"colaborador" | "cliente">("colaborador");
  if (isLoading) {
    return <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </Layout>;
  }
  if (!isAdmin && !isGestorMaster) {
    return <Layout>
        <div className="p-6">
          <Alert variant="destructive">
            <AlertDescription>
              Você não tem permissão para acessar esta página. Apenas administradores e gestores master podem gerenciar usuários.
            </AlertDescription>
          </Alert>
        </div>
      </Layout>;
  }
  return <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">Gerenciar Usuários</h1>
            <p className="text-muted-foreground mt-2">Crie e gerencie usuários colaboradores e clientes</p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Criar Novo Usuário
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={e => {
                e.preventDefault();
                setCreateUserType("colaborador");
                setActiveTab("create");
              }}>
                  Colaborador
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={e => {
                e.preventDefault();
                setCreateUserType("cliente");
                setActiveTab("create");
              }}>
                  Cliente
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="create" className="flex items-center gap-2">
              
              Criar Usuário
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Usuários
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <CreateUserForm defaultUserType={createUserType} />
          </TabsContent>

          <TabsContent value="list">
            <UsersList />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>;
};
export default GerenciarUsuarios;