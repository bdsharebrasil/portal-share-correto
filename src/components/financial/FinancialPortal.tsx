import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, FileText, Building, Receipt } from "lucide-react";

export function FinancialPortal() {
  const [companyConfig, setCompanyConfig] = useState({
    razaoSocial: "",
    cnpj: "",
    endereco: "",
    telefone: "",
    email: ""
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <DollarSign className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Portal Financeiro</h1>
      </div>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="config">Config. Empresa</TabsTrigger>
          <TabsTrigger value="recibo">Emissão de Recibo</TabsTrigger>
          <TabsTrigger value="viagem">Relatório de Viagem</TabsTrigger>
          <TabsTrigger value="cobranca">Cobrança</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building className="mr-2 h-5 w-5 text-primary" />
                Configuração da Empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="razaoSocial">Razão Social</Label>
                  <Input
                    id="razaoSocial"
                    value={companyConfig.razaoSocial}
                    onChange={(e) => setCompanyConfig({...companyConfig, razaoSocial: e.target.value})}
                    placeholder="Digite a razão social"
                  />
                </div>
                <div>
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={companyConfig.cnpj}
                    onChange={(e) => setCompanyConfig({...companyConfig, cnpj: e.target.value})}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div>
                  <Label htmlFor="endereco">Endereço</Label>
                  <Input
                    id="endereco"
                    value={companyConfig.endereco}
                    onChange={(e) => setCompanyConfig({...companyConfig, endereco: e.target.value})}
                    placeholder="Digite o endereço completo"
                  />
                </div>
                <div>
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={companyConfig.telefone}
                    onChange={(e) => setCompanyConfig({...companyConfig, telefone: e.target.value})}
                    placeholder="(00) 0000-0000"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={companyConfig.email}
                    onChange={(e) => setCompanyConfig({...companyConfig, email: e.target.value})}
                    placeholder="contato@empresa.com"
                  />
                </div>
              </div>
              <Button className="w-full bg-primary hover:bg-primary/90">
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recibo" className="space-y-4">
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Receipt className="mr-2 h-5 w-5 text-primary" />
                Emissão de Recibo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p>Módulo de emissão de recibos em desenvolvimento</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="viagem" className="space-y-4">
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5 text-primary" />
                Relatório de Viagem
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p>Módulo de relatórios de viagem em desenvolvimento</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cobranca" className="space-y-4">
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="mr-2 h-5 w-5 text-primary" />
                Cobrança
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p>Módulo de cobrança em desenvolvimento</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}