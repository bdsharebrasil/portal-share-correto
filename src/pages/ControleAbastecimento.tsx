import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SupplierDirectory } from "@/components/fuel/SupplierDirectory";
import { ClientFuelRecords } from "@/components/fuel/ClientFuelRecords";

export default function ControleAbastecimento() {
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Controle de Abastecimento</h1>
          <p className="text-muted-foreground mt-2">Gerencie fornecedores e registros de abastecimento</p>
        </div>

        <Tabs defaultValue="suppliers" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="suppliers">Agenda de Fornecedores</TabsTrigger>
            <TabsTrigger value="records">Controle por Cliente</TabsTrigger>
          </TabsList>

          <TabsContent value="suppliers" className="mt-6">
            <SupplierDirectory />
          </TabsContent>

          <TabsContent value="records" className="mt-6">
            <ClientFuelRecords />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
