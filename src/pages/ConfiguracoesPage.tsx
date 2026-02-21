
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Settings, Bell, Database, Shield } from "lucide-react";

const ConfiguracoesPage = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-600 mt-1">Gerencie as configurações do sistema</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* General Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <CardTitle>Configurações Gerais</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nome da Empresa</label>
                <Input defaultValue="Share Brasil Ltda" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">CNPJ</label>
                <Input defaultValue="XX.XXX.XXX/XXXX-XX" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Moeda Padrão</label>
                <Input defaultValue="BRL (Real Brasileiro)" className="mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Bell className="w-5 h-5" />
                <CardTitle>Notificações</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Alertas de Vencimento</label>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Relatórios Automáticos</label>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Backup Automático</label>
                <Switch />
              </div>
              <div>
                <label className="text-sm font-medium">E-mail para Notificações</label>
                <Input defaultValue="admin@sharebrasil.com" className="mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* Database Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Database className="w-5 h-5" />
                <CardTitle>Backup e Dados</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  Último backup: 01/01/2025 às 02:00
                </p>
              </div>
              <Button className="w-full">Fazer Backup Agora</Button>
              <Button variant="outline" className="w-full">
                Restaurar Backup
              </Button>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <CardTitle>Segurança</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Autenticação de 2 Fatores</label>
                <Switch />
              </div>
              <div>
                <label className="text-sm font-medium">Sessão Expira em (minutos)</label>
                <Input defaultValue="60" className="mt-1" type="number" />
              </div>
              <Button variant="outline" className="w-full">
                Alterar Senha
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end space-x-4">
          <Button variant="outline">Cancelar</Button>
          <Button className="bg-blue-600 hover:bg-blue-700">Salvar Configurações</Button>
        </div>
      </div>
    </Layout>
  );
};

export default ConfiguracoesPage;
