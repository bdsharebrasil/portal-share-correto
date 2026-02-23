import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle } from 'lucide-react';

interface FiscalConfig {
  defaultPaymentTerms: number;
  invoicePrefix: string;
  nfeAutomatic: boolean;
  nfceAutomatic: boolean;
  notificationEmail: string;
}

interface ConfiguracoesFiscaisProps {
  config?: FiscalConfig;
  loading?: boolean;
  onSave?: (config: FiscalConfig) => void;
}

export function ConfiguracoesFiscais({ config, loading = false, onSave }: ConfiguracoesFiscaisProps) {
  const [settings, setSettings] = useState<FiscalConfig>(
    config || {
      defaultPaymentTerms: 30,
      invoicePrefix: 'NF',
      nfeAutomatic: false,
      nfceAutomatic: false,
      notificationEmail: ''
    }
  );

  const handleSave = () => {
    onSave?.(settings);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configurações Fiscais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 animate-pulse">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações Fiscais</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="geral" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="nfe">NFe</TabsTrigger>
            <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="prefix">Prefixo de Fatura</Label>
              <Input
                id="prefix"
                value={settings.invoicePrefix}
                onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
                placeholder="Ex: NF, FAT, etc"
              />
              <p className="text-xs text-gray-500 mt-1">Prefixo usado nas numerações das faturas</p>
            </div>

            <div>
              <Label htmlFor="terms">Prazo de Pagamento Padrão (dias)</Label>
              <Input
                id="terms"
                type="number"
                value={settings.defaultPaymentTerms}
                onChange={(e) => setSettings({ ...settings, defaultPaymentTerms: parseInt(e.target.value) })}
                placeholder="30"
              />
            </div>
          </TabsContent>

          <TabsContent value="nfe" className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label>Emissão de NFe Automática</Label>
                <p className="text-sm text-gray-500">Emitir NFe automaticamente após confirmação</p>
              </div>
              <Switch
                checked={settings.nfeAutomatic}
                onCheckedChange={(checked) => setSettings({ ...settings, nfeAutomatic: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label>Emissão de NFCe Automática</Label>
                <p className="text-sm text-gray-500">Emitir NFCe automaticamente após confirmação</p>
              </div>
              <Switch
                checked={settings.nfceAutomatic}
                onCheckedChange={(checked) => setSettings({ ...settings, nfceAutomatic: checked })}
              />
            </div>

            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <p className="text-sm text-yellow-700">
                Configuração automática requer integração ativa com a Sefaz
              </p>
            </div>
          </TabsContent>

          <TabsContent value="notificacoes" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="email">Email de Notificações</Label>
              <Input
                id="email"
                type="email"
                value={settings.notificationEmail}
                onChange={(e) => setSettings({ ...settings, notificationEmail: e.target.value })}
                placeholder="email@empresa.com.br"
              />
              <p className="text-xs text-gray-500 mt-1">
                Email onde serão enviadas notificações de operações fiscais
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline">Cancelar</Button>
          <Button onClick={handleSave}>Salvar Configurações</Button>
        </div>
      </CardContent>
    </Card>
  );
}