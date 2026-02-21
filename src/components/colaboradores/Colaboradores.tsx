import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Network, Building2, Calendar, Plus } from "lucide-react";
import { ColaboradoresListTab } from "./ColaboradoresListTab";
import { OrgChartEditableTab } from "./OrgChartEditableTab";
import { OrganigramaVisual } from "./OrganigramaVisual";
import { FeriasDecimosTab } from "./FeriasDecimosTab";
import { Button } from "@/components/ui/button";
import { EstruturaDepartamentosTab } from "./EstruturaDepartamentosTab";
export function Colaboradores() {
  return <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Colaboradores</h1>
        <p className="text-muted-foreground">
          Gestão de colaboradores, organograma e benefícios
        </p>
      </div>

      <Tabs defaultValue="lista" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="lista" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Lista</span>
          </TabsTrigger>
          <TabsTrigger value="organograma-editavel" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            <span className="hidden sm:inline">Organograma </span>
          </TabsTrigger>
          <TabsTrigger value="estrutura" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Estrutura</span>
          </TabsTrigger>
          <TabsTrigger value="ferias-decimos" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Férias e 13º</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista">
          <ColaboradoresListTab />
        </TabsContent>
        <TabsContent value="organograma-editavel">
          <OrgChartEditableTab />
        </TabsContent>
        <TabsContent value="estrutura" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Estrutura Organizacional</h2>
              <p className="text-sm text-muted-foreground">
                Visualização hierárquica dos departamentos
              </p>
            </div>
            <EstruturaDepartamentosTab triggerOnly />
          </div>
          <OrganigramaVisual />
        </TabsContent>
        <TabsContent value="ferias-decimos">
          <FeriasDecimosTab />
        </TabsContent>
      </Tabs>
    </div>;
}
