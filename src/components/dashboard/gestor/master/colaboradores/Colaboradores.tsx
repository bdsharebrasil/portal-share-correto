import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Network, Building2, Calendar } from "lucide-react";
import { ColaboradoresListTab } from "./ColaboradoresListTab";
import { OrgChartEditableTab } from "./OrgChartEditableTab";
import { OrganigramaVisual } from "./OrganigramaVisual";
import { FeriasDecimosTab } from "./FeriasDecimosTab";
import { EstruturaDepartamentosTab } from "./EstruturaDepartamentosTab";
import { PageHeader, SectionCard, tabsListClass, tabTriggerClass } from "../ui/Premium";

export function Colaboradores() {
  return (
    <div className="w-full max-w-full min-w-0 space-y-5 overflow-x-hidden">
      <PageHeader
        icon={Users}
        title="Colaboradores"
        subtitle="Gestão de pessoas, organograma e benefícios"
      />

      <Tabs defaultValue="lista" className="w-full min-w-0 space-y-4">
        <TabsList className={tabsListClass}>
          <TabsTrigger value="lista" className={tabTriggerClass}>
            <Users className="h-4 w-4" /> Lista
          </TabsTrigger>
          <TabsTrigger value="organograma-editavel" className={tabTriggerClass}>
            <Network className="h-4 w-4" /> Organograma
          </TabsTrigger>
          <TabsTrigger value="estrutura" className={tabTriggerClass}>
            <Building2 className="h-4 w-4" /> Estrutura
          </TabsTrigger>
          <TabsTrigger value="ferias-decimos" className={tabTriggerClass}>
            <Calendar className="h-4 w-4" /> Férias e 13º
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="min-w-0 focus-visible:outline-none">
          <ColaboradoresListTab />
        </TabsContent>
        <TabsContent value="organograma-editavel" className="min-w-0 focus-visible:outline-none">
          <OrgChartEditableTab />
        </TabsContent>
        <TabsContent value="estrutura" className="min-w-0 space-y-4 focus-visible:outline-none">
          <SectionCard
            title="Estrutura organizacional"
            subtitle="Visualização hierárquica dos departamentos"
            icon={Building2}
            action={<EstruturaDepartamentosTab triggerOnly />}
          >
            <OrganigramaVisual />
          </SectionCard>
        </TabsContent>
        <TabsContent value="ferias-decimos" className="min-w-0 focus-visible:outline-none">
          <FeriasDecimosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
